import json

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


VISIBLE_STOCK_ENTRY_FIELDS = {
    "stock_entry_details_tab",
    "details_section",
    "naming_series",
    "stock_entry_type",
    "col2",
    "posting_date",
    "posting_time",
    "custom_scaffolding_movement_section",
    "custom_movement_type",
    "from_warehouse",
    "custom_delivery_slip_no",
    "custom_driver_name",
    "custom_vehicle_number",
    "custom_scaffolding_movement_column_break",
    "custom_supervisor",
    "custom_storekeeper",
    "project",
    "custom_movement_notes",
    "items_section",
    "items",
    "get_stock_and_rate",
}

CUSTOM_STOCK_ENTRY_FIELDS = {
    fieldname for fieldname in VISIBLE_STOCK_ENTRY_FIELDS if fieldname.startswith("custom_")
}

STALE_STOCK_ENTRY_FIELDS = {
    "reference_section",
    "column_break_qpgu",
    "movement_type",
    "delivery_slip_no",
    "driver_name",
    "vehicle_number",
    "column_break_jabv",
    "supervisor",
    "storekeeper",
    "project__job",
    "movement_notes",
}

STOCK_ENTRY_FIELD_ORDER = [
    "stock_entry_details_tab",
    "details_section",
    "naming_series",
    "stock_entry_type",
    "col2",
    "posting_date",
    "posting_time",
    "custom_scaffolding_movement_section",
    "custom_movement_type",
    "from_warehouse",
    "custom_delivery_slip_no",
    "custom_driver_name",
    "custom_vehicle_number",
    "custom_scaffolding_movement_column_break",
    "custom_supervisor",
    "custom_storekeeper",
    "project",
    "custom_movement_notes",
    "items_section",
    "items",
    "get_stock_and_rate",
]

STOCK_ENTRY_CUSTOM_FIELDS = [
    {
        "fieldname": "custom_scaffolding_movement_section",
        "label": "Scaffolding movement type",
        "fieldtype": "Section Break",
        "insert_after": "posting_time",
    },
    {
        "fieldname": "custom_movement_type",
        "label": "Movement Type",
        "fieldtype": "Select",
        "insert_after": "custom_scaffolding_movement_section",
        "options": "\nDispatch to Site\nReturn to Yard\nSite to Site Transfer\nDamaged Transfer\nLost Material\nStock Adjustment",
    },
    {
        "fieldname": "custom_delivery_slip_no",
        "label": "Delivery Slip No",
        "fieldtype": "Data",
        "insert_after": "from_warehouse",
    },
    {
        "fieldname": "custom_driver_name",
        "label": "Driver Name",
        "fieldtype": "Data",
        "insert_after": "custom_delivery_slip_no",
    },
    {
        "fieldname": "custom_vehicle_number",
        "label": "Vehicle Number",
        "fieldtype": "Data",
        "insert_after": "custom_driver_name",
    },
    {
        "fieldname": "custom_scaffolding_movement_column_break",
        "fieldtype": "Column Break",
        "insert_after": "custom_vehicle_number",
    },
    {
        "fieldname": "custom_supervisor",
        "label": "Supervisor",
        "fieldtype": "Link",
        "options": "User",
        "insert_after": "custom_scaffolding_movement_column_break",
    },
    {
        "fieldname": "custom_storekeeper",
        "label": "Storekeeper",
        "fieldtype": "Link",
        "options": "User",
        "insert_after": "custom_supervisor",
    },
    {
        "fieldname": "custom_movement_notes",
        "label": "Movement Notes",
        "fieldtype": "Small Text",
        "insert_after": "project",
    },
]

STOCK_ENTRY_DETAIL_GRID_FIELDS = {
    "s_warehouse": 2,
    "item_code": 3,
    "qty": 1,
    "basic_rate": 1,
}


def setup():
    _delete_stock_entry_customizations()
    create_custom_fields({"Stock Entry": STOCK_ENTRY_CUSTOM_FIELDS}, update=True)
    frappe.clear_cache(doctype="Stock Entry")

    _apply_stock_entry_form_properties()
    _apply_stock_entry_detail_grid_properties()

    frappe.clear_cache(doctype="Stock Entry")
    frappe.clear_cache(doctype="Stock Entry Detail")


def _delete_stock_entry_customizations():
    for field in frappe.get_all(
        "Custom Field",
        filters={"dt": "Stock Entry"},
        fields=["name", "fieldname"],
    ):
        if field.fieldname not in CUSTOM_STOCK_ENTRY_FIELDS:
            frappe.delete_doc("Custom Field", field.name, force=True, ignore_permissions=True)

    for doctype in ["Stock Entry", "Stock Entry Detail"]:
        frappe.db.delete("Property Setter", {"doc_type": doctype})


def _property_setter(doctype, fieldname, property_name, value, property_type="Data", doctype_or_field="DocField"):
    if fieldname and not frappe.get_meta(doctype).has_field(fieldname):
        return

    existing = frappe.db.get_value(
        "Property Setter",
        {
            "doc_type": doctype,
            "field_name": fieldname,
            "property": property_name,
        },
    )
    if existing:
        frappe.db.set_value("Property Setter", existing, "value", value)
        frappe.db.set_value("Property Setter", existing, "property_type", property_type)
        frappe.db.set_value("Property Setter", existing, "doctype_or_field", doctype_or_field)
        return

    frappe.make_property_setter(
        {
            "doctype": doctype,
            "doctype_or_field": doctype_or_field,
            "fieldname": fieldname,
            "property": property_name,
            "value": value,
            "property_type": property_type,
        },
        ignore_validate=True,
    )


def _apply_stock_entry_form_properties():
    ps = lambda fieldname, prop, value, prop_type="Data": _property_setter(
        "Stock Entry", fieldname, prop, value, prop_type
    )

    meta = frappe.get_meta("Stock Entry")
    for field in meta.fields:
        visible = field.fieldname in VISIBLE_STOCK_ENTRY_FIELDS
        ps(field.fieldname, "hidden", "0" if visible else "1", "Check")
        ps(field.fieldname, "depends_on", "", "Code")
        ps(field.fieldname, "mandatory_depends_on", "", "Code")
        ps(field.fieldname, "read_only_depends_on", "", "Code")
        if not visible:
            ps(field.fieldname, "reqd", "0", "Check")

    for fieldname in STALE_STOCK_ENTRY_FIELDS:
        ps(fieldname, "hidden", "1", "Check")
        ps(fieldname, "reqd", "0", "Check")

    ps("company", "hidden", "1", "Check")
    ps("company", "reqd", "0", "Check")
    ps("details_section", "label", "Details")
    ps("from_warehouse", "label", "Default Source Warehouse")
    ps("project", "label", "Project / Job")
    ps("project", "hidden", "0", "Check")
    ps("project", "reqd", "0", "Check")
    ps("items", "hidden", "0", "Check")
    ps("get_stock_and_rate", "hidden", "0", "Check")

    full_field_order = STOCK_ENTRY_FIELD_ORDER + [
        field.fieldname for field in meta.fields if field.fieldname not in STOCK_ENTRY_FIELD_ORDER
    ]
    _property_setter(
        "Stock Entry",
        None,
        "field_order",
        json.dumps(full_field_order),
        "Data",
        doctype_or_field="DocType",
    )


def _apply_stock_entry_detail_grid_properties():
    ps = lambda fieldname, prop, value, prop_type="Data": _property_setter(
        "Stock Entry Detail", fieldname, prop, value, prop_type
    )

    meta = frappe.get_meta("Stock Entry Detail")
    for field in meta.fields:
        ps(field.fieldname, "hidden", "1", "Check")
        ps(field.fieldname, "in_list_view", "0", "Check")
        ps(field.fieldname, "depends_on", "", "Code")
        ps(field.fieldname, "columns", "0", "Int")

    for fieldname, columns in STOCK_ENTRY_DETAIL_GRID_FIELDS.items():
        ps(fieldname, "hidden", "0", "Check")
        ps(fieldname, "in_list_view", "1", "Check")
        ps(fieldname, "columns", str(columns), "Int")

    ps("s_warehouse", "label", "Source Warehouse")
    ps("t_warehouse", "label", "Target Warehouse")
    ps("t_warehouse", "hidden", "1", "Check")
    ps("t_warehouse", "in_list_view", "0", "Check")
