# Copyright (c) 2026, ASteamcode and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CRMLog(Document):
    pass


@frappe.whitelist()
def create_lead_from_log(crm_log_name):
    """
    Creates a Contact, Customer (if company_name set), and Lead from a CRM Log.
    Links all three back to the originating CRM Log.
    Returns dict with names of created/existing records.
    """
    doc = frappe.get_doc("CRM Log", crm_log_name)

    if doc.crm_lead:
        return {
            "lead": doc.crm_lead,
            "contact": doc.crm_contact,
            "customer": doc.crm_customer,
            "existing": True,
        }

    # ── Contact ──────────────────────────────────────────────────────────────
    contact = frappe.new_doc("Contact")
    contact.salutation = doc.prefix or ""
    contact.first_name = doc.first_name or ""
    contact.last_name = doc.last_name or ""
    if doc.mobile:
        contact.append("phone_nos", {"phone": doc.mobile, "is_primary_mobile_no": 1})
    if doc.tel:
        contact.append("phone_nos", {"phone": doc.tel})
    if doc.email:
        contact.append("email_ids", {"email_id": doc.email, "is_primary": 1})
    contact.insert(ignore_permissions=True)

    # ── Customer ─────────────────────────────────────────────────────────────
    customer_name = None
    if doc.company_name:
        existing_customer = frappe.db.get_value(
            "Customer", {"customer_name": doc.company_name}, "name"
        )
        if existing_customer:
            customer_name = existing_customer
        else:
            customer = frappe.new_doc("Customer")
            customer.customer_name = doc.company_name
            customer.customer_type = "Company"
            customer.insert(ignore_permissions=True)
            customer_name = customer.name

    # ── Lead ─────────────────────────────────────────────────────────────────
    full_name = " ".join(filter(None, [doc.first_name, doc.last_name])).strip()
    lead = frappe.new_doc("Lead")
    lead.lead_name = full_name or doc.company_name or "New Lead"
    lead.salutation = doc.prefix or ""
    lead.company_name = doc.company_name or ""
    lead.mobile_no = doc.mobile or ""
    lead.phone = doc.tel or ""
    lead.email_id = doc.email or ""
    lead.notes = doc.description or ""
    if doc.user:
        lead.lead_owner = doc.user
    if frappe.db.has_column("Lead", "custom_crm_log"):
        lead.custom_crm_log = crm_log_name
    lead.insert(ignore_permissions=True)

    # ── Back-link CRM Log ─────────────────────────────────────────────────────
    frappe.db.set_value(
        "CRM Log",
        crm_log_name,
        {
            "crm_lead": lead.name,
            "crm_contact": contact.name,
            "crm_customer": customer_name,
        },
    )

    return {
        "lead": lead.name,
        "contact": contact.name,
        "customer": customer_name,
    }
