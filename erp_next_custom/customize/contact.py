from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

FIELDS = [
    {
        "fieldname": "custom_reference_user",
        "fieldtype": "Link",
        "options": "User",
        "label": "Reference",
        "insert_after": "company_name",
    },
]


def setup():
    create_custom_fields({"Contact": FIELDS}, update=True)
