from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

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
        "fieldname": "custom_position",
        "fieldtype": "Data",
        "label": "Position",
        "insert_after": "custom_last_name",
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
        "fieldname": "custom_site_location",
        "fieldtype": "Data",
        "label": "Site Location",
        "description": "Format: Country, District, City, Street",
        "insert_after": "custom_site_section",
    },
    {
        "fieldname": "custom_maps_url",
        "fieldtype": "Data",
        "label": "Google Maps URL",
        "insert_after": "custom_site_location",
    },
    {
        "fieldname": "custom_drawing",
        "fieldtype": "Long Text",
        "label": "Drawing",
        "insert_after": "custom_maps_url",
        "hidden": 1,
    },
    {
        "fieldname": "custom_has_drawing",
        "fieldtype": "Check",
        "label": "Has Drawing",
        "insert_after": "custom_drawing",
        "hidden": 1,
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
        "options": "\nNot Started\nStarting in 2w\nIn Progress\nOn Hold\nCompleted",
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
        "options": "\nRinglock System\nTube & Coupler\nKwikstage\nSuspended\nFrame System\nShoring",
        "insert_after": "custom_area",
    },
    {
        "fieldname": "custom_project_type",
        "fieldtype": "Select",
        "label": "Project Type",
        "options": "\nResidential\nCommercial\nMixed-Use\nHigh-Rise\nIndustrial\nInfrastructure",
        "insert_after": "custom_scaffold_type",
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
        "label": "Project Owner",
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
        "label": "Site Engineer",
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
        "label": "Safety Officer",
        "insert_after": "custom_workers_count",
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
]


def setup():
    create_custom_fields({"Prospect": FIELDS}, update=True)
