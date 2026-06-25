import frappe

from erp_next_custom.customize import item, lead, prospect, quotation

_EXTRA_SALUTATIONS = ["Eng", "Arch"]


def setup_custom_fields():
    """Entry point called by hooks.py after every migration."""
    _ensure_salutations()
    _ensure_project_board_role()
    _ensure_task_module_field()

    item.setup()
    lead.setup()
    prospect.setup()
    quotation.setup()


def execute():
    setup_custom_fields()


def _ensure_salutations():
    for sal in _EXTRA_SALUTATIONS:
        if not frappe.db.exists("Salutation", sal):
            frappe.get_doc({"doctype": "Salutation", "salutation": sal}).insert(
                ignore_permissions=True
            )


def _ensure_task_module_field():
    if not frappe.db.exists("Custom Field", "Task-custom_pb_module"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Task",
            "fieldname": "custom_pb_module",
            "label": "Module",
            "fieldtype": "Select",
            "options": "General\nProspect\nCRM\nInventory",
            "default": "General",
            "insert_after": "status",
        }).insert(ignore_permissions=True)


def _ensure_project_board_role():
    if not frappe.db.exists("Role", "Project Board"):
        frappe.get_doc(
            {
                "doctype": "Role",
                "role_name": "Project Board",
                "desk_access": 1,
            }
        ).insert(ignore_permissions=True)
