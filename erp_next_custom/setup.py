import frappe

from erp_next_custom.customize import item, lead, quotation

_EXTRA_SALUTATIONS = ["Eng", "Arch"]


def setup_custom_fields():
    """Entry point called by hooks.py after every migration."""
    _ensure_salutations()
    _ensure_project_board_role()

    item.setup()
    lead.setup()
    quotation.setup()


def execute():
    setup_custom_fields()


def _ensure_salutations():
    for sal in _EXTRA_SALUTATIONS:
        if not frappe.db.exists("Salutation", sal):
            frappe.get_doc({"doctype": "Salutation", "salutation": sal}).insert(
                ignore_permissions=True
            )


def _ensure_project_board_role():
    if not frappe.db.exists("Role", "Project Board"):
        frappe.get_doc(
            {
                "doctype": "Role",
                "role_name": "Project Board",
                "desk_access": 1,
            }
        ).insert(ignore_permissions=True)
