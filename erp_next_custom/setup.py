import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

_EXTRA_SALUTATIONS = ["Eng", "Arch"]


def setup_custom_fields():
    """Main entry point called by hooks.py during migration."""
    # 1. Handle Master Data / Role Setups
    _ensure_salutations()
    _ensure_project_board_role()

    # 2. Combine and Create Custom Fields
    fields_payload = {
        "Item": [
            {
                "fieldname": "custom_item_no",
                "label": "Item No",
                "fieldtype": "Int",
                "insert_after": "item_code",
                "read_only": 1,
                "in_list_view": 1,
                "in_preview": 1,
            },
            {
                "fieldname": "custom_arabic_name",
                "label": "Arabic Name",
                "fieldtype": "Data",
                "insert_after": "item_name",
                "in_list_view": 1,
                "in_preview": 1,
            },
            {
                "fieldname": "custom_function_use",
                "label": "Function / Use",
                "fieldtype": "Data",
                "insert_after": "custom_arabic_name",
                "in_list_view": 1,
                "in_preview": 1,
            },
            {
                "fieldname": "custom_length_size",
                "label": "Length / Size",
                "fieldtype": "Data",
                "insert_after": "custom_function_use",
                "in_list_view": 1,
                "in_preview": 1,
            },
            {
                "fieldname": "custom_system",
                "label": "System",
                "fieldtype": "Select",
                "insert_after": "custom_length_size",
                "options": "\nTube & Fitting\nRinglock\nCuplock\nKwikstage\nFrame / H-Frame\nPropping / Shoring\nFormwork\nUniversal / Accessories\nConsumable\nService\nN/A",
            },
            {
                "fieldname": "custom_material",
                "label": "Material",
                "fieldtype": "Select",
                "insert_after": "custom_system",
                "options": "\nSteel\nAluminum\nWood\nPlastic\nMixed\nN/A",
            },
            {
                "fieldname": "custom_tube_diameter_mm",
                "label": "Tube Diameter (mm)",
                "fieldtype": "Float",
                "insert_after": "custom_material",
            },
            {
                "fieldname": "custom_steel_wall_thickness_mm",
                "label": "Steel Wall Thickness (mm)",
                "fieldtype": "Float",
                "insert_after": "custom_tube_diameter_mm",
            },
            {
                "fieldname": "custom_finish",
                "label": "Finish",
                "fieldtype": "Select",
                "insert_after": "custom_steel_wall_thickness_mm",
                "options": "\nGalvanized\nPainted\nBlack Steel\nAluminum\nOther",
            },
            {
                "fieldname": "custom_replacement_value",
                "label": "Replacement Value",
                "fieldtype": "Currency",
                "insert_after": "custom_finish",
            },
            {
                "fieldname": "custom_hire_rate",
                "label": "Hire Rate",
                "fieldtype": "Currency",
                "insert_after": "custom_replacement_value",
            },
        ],
        "Lead": [
            {
                "fieldname": "custom_crm_log",
                "fieldtype": "Link",
                "label": "CRM Log",
                "options": "CRM Log",
                "insert_after": "source",
                "read_only": 1,
            }
        ],
        "Quotation": [
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
        ],
    }

    create_custom_fields(fields_payload, update=True)

    # 3. Clear Caches globally for modified layouts
    for doctype in ["Item", "Lead", "Quotation"]:
        frappe.clear_cache(doctype=doctype)


# --- Keep an alias just in case your app references execute() elsewhere ---
def execute():
    setup_custom_fields()


# --- Helper Routines ---


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