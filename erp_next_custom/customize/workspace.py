import json
import frappe


def setup():
    delete_inventory_workspace()
    create_inventory_workspace()
    frappe.clear_cache()


def has_field(doctype, fieldname):
    return frappe.get_meta(doctype).has_field(fieldname)


def set_if_exists(doc, fieldname, value):
    if has_field(doc.doctype, fieldname):
        doc.set(fieldname, value)


def child_has_field(parent_doctype, table_fieldname, child_fieldname):
    if not has_field(parent_doctype, table_fieldname):
        return False

    table_df = frappe.get_meta(parent_doctype).get_field(table_fieldname)
    child_doctype = table_df.options

    return frappe.get_meta(child_doctype).has_field(child_fieldname)


def delete_inventory_workspace():
    if frappe.db.exists("Workspace", "Inventory"):
        frappe.delete_doc(
            "Workspace",
            "Inventory",
            force=True,
            ignore_permissions=True,
        )

    if frappe.db.exists("DocType", "Workspace Sidebar"):
        if frappe.db.exists("Workspace Sidebar", "Inventory"):
            frappe.delete_doc(
                "Workspace Sidebar",
                "Inventory",
                force=True,
                ignore_permissions=True,
            )

    frappe.db.commit()


def add_shortcut(workspace, label, shortcut_type, link_to):
    row = {}

    if child_has_field("Workspace", "shortcuts", "label"):
        row["label"] = label

    if child_has_field("Workspace", "shortcuts", "type"):
        row["type"] = shortcut_type

    if child_has_field("Workspace", "shortcuts", "link_to"):
        row["link_to"] = link_to

    if child_has_field("Workspace", "shortcuts", "color"):
        row["color"] = "Blue"

    if child_has_field("Workspace", "shortcuts", "icon"):
        row["icon"] = "stock"

    workspace.append("shortcuts", row)


def create_inventory_workspace():
    workspace = frappe.new_doc("Workspace")

    workspace.label = "Inventory"
    workspace.title = "Inventory"

    # Important for appearing on the main Desk modules page
    set_if_exists(workspace, "module", "Stock")
    set_if_exists(workspace, "public", 1)
    set_if_exists(workspace, "is_hidden", 0)
    set_if_exists(workspace, "hide_custom", 0)
    set_if_exists(workspace, "is_standard", 1)
    set_if_exists(workspace, "category", "Modules")
    set_if_exists(workspace, "sequence_id", 2)

    set_if_exists(workspace, "indicator_color", "blue")
    set_if_exists(workspace, "icon", "stock")

    if has_field("Workspace", "parent_page"):
        workspace.parent_page = ""

    if has_field("Workspace", "for_user"):
        workspace.for_user = ""

    if has_field("Workspace", "shortcuts"):
        workspace.set("shortcuts", [])

        add_shortcut(workspace, "Item", "DocType", "Item")
        add_shortcut(workspace, "Stock Entry", "DocType", "Stock Entry")
        add_shortcut(workspace, "Stock Balance", "Report", "Stock Balance")
        add_shortcut(
            workspace,
            "Daily Site Stock Report",
            "DocType",
            "Daily Site Stock Report",
        )

    if has_field("Workspace", "content"):
        workspace.content = json.dumps(
            [
                {
                    "id": "inventory_header",
                    "type": "header",
                    "data": {"text": "Inventory"},
                },
                {
                    "id": "item_shortcut",
                    "type": "shortcut",
                    "data": {"shortcut_name": "Item", "col": 3},
                },
                {
                    "id": "stock_entry_shortcut",
                    "type": "shortcut",
                    "data": {"shortcut_name": "Stock Entry", "col": 3},
                },
                {
                    "id": "stock_balance_shortcut",
                    "type": "shortcut",
                    "data": {"shortcut_name": "Stock Balance", "col": 3},
                },
                {
                    "id": "daily_site_stock_report_shortcut",
                    "type": "shortcut",
                    "data": {
                        "shortcut_name": "Daily Site Stock Report",
                        "col": 3,
                    },
                },
            ]
        )

    workspace.insert(ignore_permissions=True)
    frappe.db.commit()