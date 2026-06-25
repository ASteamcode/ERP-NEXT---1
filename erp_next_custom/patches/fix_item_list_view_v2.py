import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter


def get_field_by_label(label):
    for df in frappe.get_meta("Item").fields:
        if df.label == label:
            return df.fieldname
    return None


def execute():
    item_no = get_field_by_label("Item No") or "custom_item_no"
    arabic_name = get_field_by_label("Arabic Name") or "custom_arabic_name"
    function_use = get_field_by_label("Function / Use") or "custom_function_use"
    length_size = get_field_by_label("Length / Size") or "custom_length_size"

    wanted_fields = [
        item_no,
        "item_code",
        "item_name",
        arabic_name,
        function_use,
        length_size,
    ]

    wanted_fields = [f for f in wanted_fields if frappe.get_meta("Item").has_field(f)]

    # Rename Item Code to ID
    make_property_setter("Item", "item_code", "label", "ID", "Data", for_doctype=False)

    # Force title/list first column to Item No
    make_property_setter("Item", None, "title_field", item_no, "Data", for_doctype=True)
    make_property_setter("Item", None, "sort_field", item_no, "Data", for_doctype=True)
    make_property_setter("Item", None, "sort_order", "ASC", "Data", for_doctype=True)

    # Remove all fields from list view
    for df in frappe.get_meta("Item").fields:
        make_property_setter("Item", df.fieldname, "in_list_view", 0, "Check", for_doctype=False)
        make_property_setter("Item", df.fieldname, "in_standard_filter", 0, "Check", for_doctype=False)

    # Add only wanted list fields
    for fieldname in wanted_fields:
        make_property_setter("Item", fieldname, "in_list_view", 1, "Check", for_doctype=False)

    # Hide duplicate custom ID fields
    for df in frappe.get_meta("Item").fields:
        if df.label == "ID" and df.fieldname != "item_code":
            make_property_setter("Item", df.fieldname, "hidden", 1, "Check", for_doctype=False)
            make_property_setter("Item", df.fieldname, "in_list_view", 0, "Check", for_doctype=False)
            make_property_setter("Item", df.fieldname, "in_standard_filter", 0, "Check", for_doctype=False)
            make_property_setter("Item", df.fieldname, "in_preview", 0, "Check", for_doctype=False)

    # Hide status/disabled fields
    for fieldname in ["disabled", "status", "enabled"]:
        if frappe.get_meta("Item").has_field(fieldname):
            make_property_setter("Item", fieldname, "hidden", 1, "Check", for_doctype=False)
            make_property_setter("Item", fieldname, "in_list_view", 0, "Check", for_doctype=False)
            make_property_setter("Item", fieldname, "in_standard_filter", 0, "Check", for_doctype=False)
            make_property_setter("Item", fieldname, "in_preview", 0, "Check", for_doctype=False)

    # Remove saved user list settings, otherwise old columns stay
    try:
        frappe.db.sql("delete from `tabUser Settings` where `doctype`=%s", ("Item",))
    except Exception:
        pass

    try:
        frappe.db.sql("delete from `tabList View Settings` where `name`=%s", ("Item",))
    except Exception:
        pass

    frappe.clear_cache(doctype="Item")