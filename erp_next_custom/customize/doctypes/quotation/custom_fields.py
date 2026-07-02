from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


FIELDS = [
    {
        "fieldname": "custom_project_refs_section",
        "fieldtype": "Section Break",
        "label": "Project References",
        "insert_after": "opportunity",
        "collapsible": 0,
    },
    {
        "fieldname": "custom_crm_log",
        "fieldtype": "Link",
        "label": "CRM Log",
        "options": "CRM Log",
        "insert_after": "custom_project_refs_section",
        "in_list_view": 1,
    },
    {
        "fieldname": "custom_lead",
        "fieldtype": "Link",
        "label": "Lead",
        "options": "Lead",
        "insert_after": "custom_crm_log",
        "in_list_view": 1,
    },
    {
        "fieldname": "custom_col_break_refs",
        "fieldtype": "Column Break",
        "insert_after": "custom_lead",
    },
    {
        "fieldname": "custom_site_survey",
        "fieldtype": "Link",
        "label": "Site Survey",
        "options": "Site Survey",
        "insert_after": "custom_col_break_refs",
    },
    {
        "fieldname": "custom_measurement_take_off",
        "fieldtype": "Link",
        "label": "Measurement Take Off",
        "options": "Measurement Take Off",
        "insert_after": "custom_site_survey",
    },
]


def setup():
    create_custom_fields({"Quotation": FIELDS}, update=True)
