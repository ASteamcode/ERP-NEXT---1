# Copyright (c) 2026, ASteamcode and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CRMLog(Document):
    pass


@frappe.whitelist()
def get_client_companies(txt="", limit=20):
    """Return client company names shared by Sales REP CRM and CRM Log.

    ERPNext's Company doctype stores our own legal companies. Client companies in
    this app live as free-text names on Prospect / CRM Log records, so the UI
    uses this list for autocomplete instead of linking to Company.
    """
    txt = (txt or "").strip()
    limit = frappe.utils.cint(limit) or 20
    filters = {}
    if txt:
        filters["company_name"] = ["like", f"%{txt}%"]

    names = []
    seen = set()
    for doctype in ("Prospect", "CRM Log"):
        for row in frappe.get_all(
            doctype,
            filters=filters,
            fields=["company_name"],
            order_by="modified desc",
            limit_page_length=limit * 4,
        ):
            company = (row.company_name or "").strip()
            key = company.lower()
            if not company or key in seen:
                continue
            seen.add(key)
            names.append(company)
            if len(names) >= limit:
                return names

    return names


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


@frappe.whitelist()
def delete_crm_log(crm_log_name):
    """
    Unlinks any back-references on Lead/Contact before deleting the CRM Log,
    so Frappe's link checker doesn't block the deletion.
    """
    doc = frappe.get_doc("CRM Log", crm_log_name)

    if doc.crm_lead and frappe.db.exists("Lead", doc.crm_lead):
        if frappe.db.get_value("Lead", doc.crm_lead, "custom_crm_log") == crm_log_name:
            frappe.db.set_value("Lead", doc.crm_lead, "custom_crm_log", None)

    frappe.delete_doc("CRM Log", crm_log_name, ignore_permissions=True, force=True)
    return {"deleted": True}


@frappe.whitelist()
def validate_crm_log(crm_log_name):
    """
    Full pipeline for a Lead row: Lead → Site Survey → Measurement Take Off.
    Creates missing records; updates existing ones where we have new data.
    Returns a summary dict with action taken for each record type.
    """
    doc = frappe.get_doc("CRM Log", crm_log_name)

    # ── Lead ─────────────────────────────────────────────────────────────────
    if doc.crm_lead:
        update_lead_from_log(crm_log_name)
        doc.reload()
        lead_action = "updated"
    else:
        create_lead_from_log(crm_log_name)
        doc.reload()
        lead_action = "created"

    lead_name = doc.crm_lead
    contact_name = doc.crm_contact

    # ── Site Survey ───────────────────────────────────────────────────────────
    existing_ss = frappe.db.get_value("Site Survey", {"lead": lead_name}, "name")
    if existing_ss:
        if doc.site_location or doc.google_maps_url:
            ss = frappe.get_doc("Site Survey", existing_ss)
            if doc.site_location:
                ss.site_location = doc.site_location
            if doc.google_maps_url:
                ss.google_maps_url = doc.google_maps_url
            ss.save(ignore_permissions=True)
        ss_name = existing_ss
        ss_action = "existing"
    else:
        ss = frappe.new_doc("Site Survey")
        ss.status = "Draft"
        ss.survey_date = frappe.utils.today()
        ss.lead = lead_name
        ss.contact = contact_name or ""
        ss.site_location = doc.site_location or ""
        ss.google_maps_url = doc.google_maps_url or ""
        ss.insert(ignore_permissions=True)
        ss_name = ss.name
        ss_action = "created"

    # ── Measurement Take Off ──────────────────────────────────────────────────
    existing_mto = frappe.db.get_value("Measurement Take Off", {"lead": lead_name}, "name")
    if existing_mto:
        mto_name = existing_mto
        mto_action = "existing"
    else:
        mto = frappe.new_doc("Measurement Take Off")
        mto.status = "Draft"
        mto.date = frappe.utils.today()
        mto.lead = lead_name
        mto.site_survey = ss_name
        mto.contact = contact_name or ""
        mto.site_location = doc.site_location or ""
        mto.google_maps_url = doc.google_maps_url or ""
        mto.notes = "Pending architect upload of MTO / CAD drawing file."
        mto.insert(ignore_permissions=True)
        mto_name = mto.name
        mto_action = "created"

    return {
        "lead": lead_name,
        "lead_action": lead_action,
        "site_survey": ss_name,
        "site_survey_action": ss_action,
        "mto": mto_name,
        "mto_action": mto_action,
    }


@frappe.whitelist()
def update_lead_from_log(crm_log_name):
    """
    Updates an existing Lead (and Contact) from the latest CRM Log data.
    Falls back to create_lead_from_log if no lead is linked yet.
    Returns dict with names and updated=True flag.
    """
    doc = frappe.get_doc("CRM Log", crm_log_name)

    if not doc.crm_lead:
        return create_lead_from_log(crm_log_name)

    # ── Update Lead ───────────────────────────────────────────────────────────
    lead = frappe.get_doc("Lead", doc.crm_lead)
    full_name = " ".join(filter(None, [doc.first_name, doc.last_name])).strip()
    if full_name:
        lead.lead_name = full_name
    if doc.prefix:
        lead.salutation = doc.prefix
    if doc.company_name:
        lead.company_name = doc.company_name
    if doc.mobile:
        lead.mobile_no = doc.mobile
    if doc.tel:
        lead.phone = doc.tel
    if doc.email:
        lead.email_id = doc.email
    if doc.description:
        lead.notes = doc.description
    if doc.user:
        lead.lead_owner = doc.user
    lead.save(ignore_permissions=True)

    # ── Update Contact ────────────────────────────────────────────────────────
    if doc.crm_contact and frappe.db.exists("Contact", doc.crm_contact):
        contact = frappe.get_doc("Contact", doc.crm_contact)
        if doc.prefix:
            contact.salutation = doc.prefix
        if doc.first_name:
            contact.first_name = doc.first_name
        if doc.last_name:
            contact.last_name = doc.last_name
        contact.save(ignore_permissions=True)

    return {
        "lead": doc.crm_lead,
        "contact": doc.crm_contact,
        "customer": doc.crm_customer,
        "updated": True,
    }
