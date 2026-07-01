import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def set_prospect_name(doc, method=None):
    """Give every Prospect a unique auto-incremented name so multiple
    prospects from the same company are allowed."""
    doc.name = frappe.generate_hash(length=8)

# ── Custom fields added to the Prospect DocType ───────────────────
# ERPNext's Prospect already has: company_name, industry, website
# Everything below is scaffolding-company-specific.

FIELDS = [
    # ── Contact identity ─────────────────────────────────────────
    {
        "fieldname": "custom_identity_section",
        "fieldtype": "Section Break",
        "label": "Contact Identity",
        "insert_after": "company_name",
        "collapsible": 0,
    },
    {
        "fieldname": "custom_salutation",
        "fieldtype": "Link",
        "label": "Salutation",
        "options": "Salutation",
        "insert_after": "custom_identity_section",
        "in_list_view": 0,
        "columns": 1,
    },
    {
        "fieldname": "custom_first_name",
        "fieldtype": "Data",
        "label": "First Name",
        "insert_after": "custom_salutation",
        "in_list_view": 1,
        "bold": 1,
        "reqd": 1,
    },
    {
        "fieldname": "custom_col_break_identity",
        "fieldtype": "Column Break",
        "insert_after": "custom_first_name",
    },
    {
        "fieldname": "custom_last_name",
        "fieldtype": "Data",
        "label": "Last Name",
        "insert_after": "custom_col_break_identity",
        "in_list_view": 1,
        "bold": 1,
    },
    {
        "fieldname": "custom_company_activity_type",
        "fieldtype": "Data",
        "label": "Activity Type",
        "insert_after": "custom_last_name",
    },
    {
        "fieldname": "custom_lead_source",
        "fieldtype": "Select",
        "label": "Source",
        "options": "\nReferral\nCold Call\nWalk-in\nWebsite\nExhibition\nSocial Media\nDigital",
        "insert_after": "custom_last_name",
    },
    {
        "fieldname": "custom_position",
        "fieldtype": "Autocomplete",
        "label": "Role",
        "options": "\nOwner / Partner\nGeneral Manager\nProject Manager\nSite Engineer\nSite Foreman / معلم\nTechnical / Studies Engineer\nProcurement / Purchasing\nArchitect\nQuantity Surveyor\nAccountant / Finance\nOther",
        "insert_after": "custom_lead_source",
    },
    {
        "fieldname": "custom_prospect_status",
        "fieldtype": "Select",
        "label": "Prospect Status",
        "options": "\nLead\nIn Discussion\nContacted\nConverted\nLost",
        "insert_after": "custom_last_name",
        "in_list_view": 1,
        "in_filter": 1,
        "default": "Lead",
    },
    {
        "fieldname": "custom_stage",
        "fieldtype": "Select",
        "label": "Stage",
        "options": "\nProspect\nOutreached\nPassby Visit\nLead\nSite Visit\nQuotation\nNegotiation\nWon\nJob Scheduled\nLost",
        "insert_after": "custom_prospect_status",
        "in_list_view": 1,
        "in_filter": 1,
        "default": "Prospect",
    },

    # ── Contact details ──────────────────────────────────────────
    {
        "fieldname": "custom_contact_section",
        "fieldtype": "Section Break",
        "label": "Contact Details",
        "insert_after": "custom_prospect_status",
        "collapsible": 0,
    },
    {
        "fieldname": "custom_mobile",
        "fieldtype": "Data",
        "label": "Primary Mobile",
        "options": "Phone",
        "insert_after": "custom_contact_section",
        "in_list_view": 1,
    },
    {
        "fieldname": "custom_email",
        "fieldtype": "Data",
        "label": "Email",
        "options": "Email",
        "insert_after": "custom_mobile",
    },

    # ── Site information ─────────────────────────────────────────
    {
        "fieldname": "custom_site_section",
        "fieldtype": "Section Break",
        "label": "Site Information",
        "insert_after": "custom_email",
        "collapsible": 0,
    },
    {
        "fieldname": "custom_site_country",
        "fieldtype": "Data",
        "label": "Country",
        "insert_after": "custom_site_section",
        "default": "Lebanon",
    },
    {
        "fieldname": "custom_site_district",
        "fieldtype": "Data",
        "label": "District",
        "insert_after": "custom_site_country",
    },
    {
        "fieldname": "custom_site_city",
        "fieldtype": "Data",
        "label": "City",
        "insert_after": "custom_site_district",
    },
    {
        "fieldname": "custom_site_street",
        "fieldtype": "Data",
        "label": "Street",
        "insert_after": "custom_site_city",
    },
    {
        "fieldname": "custom_maps_url",
        "fieldtype": "Data",
        "label": "Google Maps URL",
        "insert_after": "custom_site_location",
    },
    {
        "fieldname": "custom_description",
        "fieldtype": "Small Text",
        "label": "Description",
        "insert_after": "custom_maps_url",
    },
    {
        "fieldname": "custom_drawing",
        "fieldtype": "Long Text",
        "label": "Drawing",
        "insert_after": "custom_description",
        "hidden": 1,
    },
    {
        "fieldname": "custom_has_drawing",
        "fieldtype": "Check",
        "label": "Has Drawing",
        "insert_after": "custom_drawing",
        "hidden": 1,
    },

    # ── Follow-up ────────────────────────────────────────────────
    {
        "fieldname": "custom_follow_up_date",
        "fieldtype": "Date",
        "label": "Follow Up Date",
        "insert_after": "custom_has_drawing",
    },
    {
        "fieldname": "custom_follow_up_notes",
        "fieldtype": "Small Text",
        "label": "Follow Up Notes",
        "insert_after": "custom_follow_up_date",
    },


    # ── Scope & specs ────────────────────────────────────────────
    {
        "fieldname": "custom_scope_section",
        "fieldtype": "Section Break",
        "label": "Scope & Specifications",
        "insert_after": "custom_maps_url",
        "collapsible": 0,
    },
    {
        "fieldname": "custom_project_status",
        "fieldtype": "Select",
        "label": "Project Status",
        "options": "\nEmpty lot\nExcavation\nConcrete structure\nTopped out\nFinishing\nMEP\nCompleted",
        "insert_after": "custom_scope_section",
        "in_filter": 1,
    },
    {
        "fieldname": "custom_project_start",
        "fieldtype": "Date",
        "label": "Start Date",
        "insert_after": "custom_project_status",
    },
    {
        "fieldname": "custom_col_break_scope",
        "fieldtype": "Column Break",
        "insert_after": "custom_project_start",
    },
    {
        "fieldname": "custom_floors",
        "fieldtype": "Int",
        "label": "Floors",
        "insert_after": "custom_col_break_scope",
    },
    {
        "fieldname": "custom_area",
        "fieldtype": "Data",
        "label": "Area (sqm)",
        "insert_after": "custom_floors",
    },
    {
        "fieldname": "custom_scaffold_type",
        "fieldtype": "Select",
        "label": "Scaffold Type",
        "options": "\nExternal Scaffolding\nPropping Scaffolding\nAdjustable Props\nRental per Piece\nSales per Piece\nSales Used\nMobile Scaffolding",
        "insert_after": "custom_area",
    },
    {
        "fieldname": "custom_project_type",
        "fieldtype": "Select",
        "label": "Project Type",
        "options": "\nCommercial\nResidential\nIndustrial\nReligious\nBuilding – New Construction\nBuilding – Renovation / Façade\nHigh-Rise / Tower\nIndustrial / Plant\nBridge / Infrastructure\nHeritage / Restoration\nShoring / Propping\nEvent / Temporary Structure\nOther",
        "insert_after": "custom_scaffold_type",
    },
    {
        "fieldname": "custom_scope_notes",
        "fieldtype": "Small Text",
        "label": "Notes",
        "insert_after": "custom_project_type",
    },

    # ── Site team ────────────────────────────────────────────────
    {
        "fieldname": "custom_team_section",
        "fieldtype": "Section Break",
        "label": "Site Team",
        "insert_after": "custom_project_type",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_architect",
        "fieldtype": "Data",
        "label": "Architect",
        "insert_after": "custom_team_section",
    },
    {
        "fieldname": "custom_project_owner",
        "fieldtype": "Data",
        "label": "Contact Person #1",
        "insert_after": "custom_architect",
    },
    {
        "fieldname": "custom_col_break_team",
        "fieldtype": "Column Break",
        "insert_after": "custom_project_owner",
    },
    {
        "fieldname": "custom_site_engineer",
        "fieldtype": "Data",
        "label": "Contact Person #2",
        "insert_after": "custom_col_break_team",
    },
    {
        "fieldname": "custom_workers_count",
        "fieldtype": "Int",
        "label": "Workers on Site",
        "insert_after": "custom_site_engineer",
    },
    {
        "fieldname": "custom_safety_officer",
        "fieldtype": "Data",
        "label": "Contact Person #3",
        "insert_after": "custom_workers_count",
    },
    {
        "fieldname": "custom_contact_person_4",
        "fieldtype": "Data",
        "label": "Contact Person #4",
        "insert_after": "custom_safety_officer",
    },
    {
        "fieldname": "custom_contract_value",
        "fieldtype": "Currency",
        "label": "Contract Value",
        "insert_after": "custom_safety_officer",
    },

    # ── Social & web ─────────────────────────────────────────────
    {
        "fieldname": "custom_social_section",
        "fieldtype": "Section Break",
        "label": "Social & Web",
        "insert_after": "custom_contract_value",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_telegram",
        "fieldtype": "Data",
        "label": "Telegram",
        "insert_after": "custom_social_section",
    },
    {
        "fieldname": "custom_linkedin",
        "fieldtype": "Data",
        "label": "LinkedIn",
        "insert_after": "custom_telegram",
    },
    {
        "fieldname": "custom_col_break_social",
        "fieldtype": "Column Break",
        "insert_after": "custom_linkedin",
    },
    {
        "fieldname": "custom_facebook",
        "fieldtype": "Data",
        "label": "Facebook",
        "insert_after": "custom_col_break_social",
    },
    {
        "fieldname": "custom_instagram",
        "fieldtype": "Data",
        "label": "Instagram",
        "insert_after": "custom_facebook",
    },
    {
        "fieldname": "custom_tiktok",
        "fieldtype": "Data",
        "label": "TikTok",
        "insert_after": "custom_instagram",
    },
    {
        "fieldname": "custom_x",
        "fieldtype": "Data",
        "label": "X",
        "insert_after": "custom_tiktok",
    },
]


def setup():
    # Fields that need a fieldtype change (Frappe blocks this via update=True).
    # Delete-and-recreate those fields first so create_custom_fields won't choke.
    _RETYPE = {"custom_position": "Autocomplete"}
    for fieldname, new_type in _RETYPE.items():
        existing = frappe.db.get_value(
            "Custom Field", {"dt": "Prospect", "fieldname": fieldname}, ["name", "fieldtype"], as_dict=True
        )
        if existing and existing.fieldtype != new_type:
            frappe.delete_doc("Custom Field", existing.name, force=True)

    create_custom_fields({"Prospect": FIELDS}, update=True)
    frappe.db.commit()
