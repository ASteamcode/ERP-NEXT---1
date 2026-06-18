from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


FIELDS = [
    {
        "fieldname": "custom_crm_log",
        "fieldtype": "Link",
        "label": "CRM Log",
        "options": "CRM Log",
        "insert_after": "source",
        "read_only": 1,
    },
]


def setup():
    create_custom_fields({"Lead": FIELDS}, update=True)
