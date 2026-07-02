import json

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


VISIBLE_FIELDS = {
    "details",
    "custom_identification_section",
    "item_code",
    "item_name",
    "custom_identification_col_2",
    "custom_arabic_name",
    "custom_scaffolding_spec_section",
    "custom_system",
    "custom_function_use",
    "custom_scaffolding_col_2",
    "custom_length_size",
    "custom_manufacturing_specs_section",
    "custom_material",
    "custom_weight_per_unit_kg",
    "custom_steel_wall_thickness_mm",
    "custom_manufacturing_col_2",
    "custom_tube_diameter_mm",
    "custom_finish",
    "custom_stock_section",
    "custom_default_uom",
    "custom_stock_col_2",
    "custom_maintain_stock",
    "custom_hire_value_section",
    "custom_valuation_rate",
    "custom_hire_value_col_2",
    "custom_replacement_value",
    "custom_weekly_hire_rate",
}

LIST_ONLY_CUSTOM_FIELDNAMES = {"custom_item_no"}
CUSTOM_FIELDNAMES = {field for field in VISIBLE_FIELDS if field.startswith("custom_")} | LIST_ONLY_CUSTOM_FIELDNAMES

_FIELD_ORDER = [
    "details",
    "custom_identification_section",
    "item_code",
    "custom_item_no",
    "item_name",
    "custom_identification_col_2",
    "custom_arabic_name",
    "custom_scaffolding_spec_section",
    "custom_system",
    "custom_function_use",
    "custom_scaffolding_col_2",
    "custom_length_size",
    "custom_manufacturing_specs_section",
    "custom_material",
    "custom_weight_per_unit_kg",
    "custom_steel_wall_thickness_mm",
    "custom_manufacturing_col_2",
    "custom_tube_diameter_mm",
    "custom_finish",
    "custom_stock_section",
    "custom_default_uom",
    "custom_stock_col_2",
    "custom_maintain_stock",
    "custom_hire_value_section",
    "custom_valuation_rate",
    "custom_hire_value_col_2",
    "custom_replacement_value",
    "custom_weekly_hire_rate",
]

_FIELD_IDX = {
    "custom_identification_section": 3,
    "custom_identification_col_2": 6,
    "custom_arabic_name": 7,
    "custom_scaffolding_spec_section": 8,
    "custom_system": 9,
    "custom_function_use": 10,
    "custom_scaffolding_col_2": 11,
    "custom_length_size": 12,
    "custom_manufacturing_specs_section": 13,
    "custom_material": 14,
    "custom_weight_per_unit_kg": 15,
    "custom_steel_wall_thickness_mm": 16,
    "custom_manufacturing_col_2": 17,
    "custom_tube_diameter_mm": 18,
    "custom_finish": 19,
    "custom_stock_section": 20,
    "custom_default_uom": 21,
    "custom_stock_col_2": 22,
    "custom_maintain_stock": 23,
    "custom_hire_value_section": 24,
    "custom_valuation_rate": 25,
    "custom_hire_value_col_2": 26,
    "custom_replacement_value": 27,
    "custom_weekly_hire_rate": 28,
}

FIELDS = [
    {
        "fieldname": "custom_identification_section",
        "label": "Identification",
        "fieldtype": "Section Break",
        "insert_after": "details",
    },
    {
        "fieldname": "custom_item_no",
        "label": "Item No",
        "fieldtype": "Int",
        "insert_after": "item_code",
        "hidden": 1,
        "in_list_view": 1,
        "in_standard_filter": 1,
    },
    {
        "fieldname": "custom_identification_col_2",
        "fieldtype": "Column Break",
        "insert_after": "item_name",
    },
    {
        "fieldname": "custom_arabic_name",
        "label": "Arabic Name",
        "fieldtype": "Data",
        "insert_after": "custom_identification_col_2",
        "reqd": 1,
        "in_list_view": 1,
        "in_preview": 1,
    },
    {
        "fieldname": "custom_scaffolding_spec_section",
        "label": "Scaffolding Spec",
        "fieldtype": "Section Break",
        "insert_after": "custom_arabic_name",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_system",
        "label": "System",
        "fieldtype": "Select",
        "insert_after": "custom_scaffolding_spec_section",
        "reqd": 1,
        "options": "\nTube & Fitting\nRinglock\nCuplock\nKwikstage\nFrame / H-Frame\nPropping scaffolding Single\nPropping / Shoring\nFormwork\nUniversal / Accessories\nConsumable\nService\nN/A",
    },
    {
        "fieldname": "custom_function_use",
        "label": "Function / Use",
        "fieldtype": "Data",
        "insert_after": "custom_system",
        "reqd": 1,
        "in_list_view": 1,
        "in_preview": 1,
    },
    {
        "fieldname": "custom_scaffolding_col_2",
        "fieldtype": "Column Break",
        "insert_after": "custom_function_use",
    },
    {
        "fieldname": "custom_length_size",
        "label": "Length / Size",
        "fieldtype": "Data",
        "insert_after": "custom_scaffolding_col_2",
        "in_list_view": 1,
        "in_preview": 1,
    },
    {
        "fieldname": "custom_manufacturing_specs_section",
        "label": "Manufacturing Specs",
        "fieldtype": "Section Break",
        "insert_after": "custom_length_size",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_material",
        "label": "Material",
        "fieldtype": "Select",
        "insert_after": "custom_manufacturing_specs_section",
        "reqd": 1,
        "options": "\nSteel\nAluminum\nWood\nPlastic\nMixed\nN/A",
    },
    {
        "fieldname": "custom_weight_per_unit_kg",
        "label": "Weight Per Unit (KG)",
        "fieldtype": "Float",
        "insert_after": "custom_material",
    },
    {
        "fieldname": "custom_steel_wall_thickness_mm",
        "label": "Steel Wall Thickness (mm)",
        "fieldtype": "Float",
        "insert_after": "custom_weight_per_unit_kg",
    },
    {
        "fieldname": "custom_manufacturing_col_2",
        "fieldtype": "Column Break",
        "insert_after": "custom_steel_wall_thickness_mm",
    },
    {
        "fieldname": "custom_tube_diameter_mm",
        "label": "Tube Diameter (mm)",
        "fieldtype": "Float",
        "insert_after": "custom_manufacturing_col_2",
    },
    {
        "fieldname": "custom_finish",
        "label": "Finish",
        "fieldtype": "Select",
        "insert_after": "custom_tube_diameter_mm",
        "options": "\nGalvanized\nPainted\nBlack Steel\nAluminum\nOther",
    },
    {
        "fieldname": "custom_stock_section",
        "label": "Stock",
        "fieldtype": "Section Break",
        "insert_after": "custom_finish",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_default_uom",
        "label": "Default Unit of Measure",
        "fieldtype": "Link",
        "options": "UOM",
        "insert_after": "custom_stock_section",
        "reqd": 1,
        "default": "Nos",
    },
    {
        "fieldname": "custom_stock_col_2",
        "fieldtype": "Column Break",
        "insert_after": "custom_default_uom",
    },
    {
        "fieldname": "custom_maintain_stock",
        "label": "Maintain Stock",
        "fieldtype": "Check",
        "insert_after": "custom_stock_col_2",
        "default": "1",
    },
    {
        "fieldname": "custom_hire_value_section",
        "label": "Hire & Value",
        "fieldtype": "Section Break",
        "insert_after": "custom_maintain_stock",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_valuation_rate",
        "label": "Valuation Rate",
        "fieldtype": "Currency",
        "insert_after": "custom_hire_value_section",
    },
    {
        "fieldname": "custom_hire_value_col_2",
        "fieldtype": "Column Break",
        "insert_after": "custom_valuation_rate",
    },
    {
        "fieldname": "custom_replacement_value",
        "label": "Replacement Value",
        "fieldtype": "Currency",
        "insert_after": "custom_hire_value_col_2",
    },
    {
        "fieldname": "custom_weekly_hire_rate",
        "label": "Weekly Hire Rate",
        "fieldtype": "Currency",
        "insert_after": "custom_replacement_value",
    },
]


def setup():
    _remove_stale_item_custom_fields()
    frappe.db.delete("Property Setter", {"doc_type": "Item"})
    create_custom_fields({"Item": FIELDS}, update=True)
    _apply_field_idx()
    frappe.clear_cache(doctype="Item")
    _apply_property_setters()
    frappe.clear_cache(doctype="Item")


def _remove_stale_item_custom_fields():
    for field in frappe.get_all(
        "Custom Field",
        filters={"dt": "Item"},
        fields=["name", "fieldname"],
    ):
        if field.fieldname not in CUSTOM_FIELDNAMES:
            frappe.delete_doc("Custom Field", field.name, force=True)


def _apply_field_idx():
    for fieldname, idx in _FIELD_IDX.items():
        frappe.db.sql(
            """
            update `tabCustom Field`
            set idx = %s
            where dt = 'Item' and fieldname = %s
            """,
            (idx, fieldname),
        )

    for fieldname, idx in {"details": 1, "item_code": 4, "item_name": 5}.items():
        frappe.db.sql(
            """
            update `tabDocField`
            set idx = %s
            where parent = 'Item' and fieldname = %s
            """,
            (idx, fieldname),
        )


def _clear_item_list_user_settings():
    if frappe.db.table_exists("User Settings"):
        frappe.db.sql("delete from `tabUser Settings` where `doctype` = %s", ("Item",))
    if frappe.db.table_exists("List View Settings"):
        frappe.db.delete("List View Settings", {"name": "Item"})


def _apply_property_setters():
    def ps(field, prop, value, prop_type="Data", doctype_or_field="DocField"):
        existing = frappe.db.get_value(
            "Property Setter",
            {"doc_type": "Item", "field_name": field, "property": prop},
        )
        if existing:
            frappe.db.set_value("Property Setter", existing, "value", value)
        else:
            frappe.make_property_setter(
                {
                    "doctype": "Item",
                    "doctype_or_field": doctype_or_field,
                    "fieldname": field,
                    "property": prop,
                    "value": value,
                    "property_type": prop_type,
                },
                ignore_validate=True,
            )

    meta = frappe.get_meta("Item")
    for field in meta.fields:
        hidden = "0" if field.fieldname in VISIBLE_FIELDS else "1"
        ps(field.fieldname, "hidden", hidden, prop_type="Check")
        if field.fieldname not in VISIBLE_FIELDS:
            ps(field.fieldname, "reqd", "0", prop_type="Check")

    ps("item_code", "label", "ID")
    ps("item_code", "reqd", "1", prop_type="Check")
    ps("item_name", "reqd", "0", prop_type="Check")

    ps("stock_uom", "default", "Nos")
    ps("stock_uom", "hidden", "1", prop_type="Check")
    ps("stock_uom", "reqd", "0", prop_type="Check")
    ps("is_stock_item", "default", "1", prop_type="Check")
    ps("is_stock_item", "hidden", "1", prop_type="Check")

    list_fields = [
        "custom_item_no",
        "item_code",
        "item_name",
        "custom_arabic_name",
        "custom_function_use",
        "custom_length_size",
    ]
    filter_fields = [
        "custom_item_no",
        "has_variants",
        "custom_function_use",
        "custom_system",
        "custom_length_size",
        "custom_material",
        "custom_tube_diameter_mm",
        "custom_steel_wall_thickness_mm",
        "custom_finish",
        "variant_of",
    ]

    for field in meta.fields:
        ps(field.fieldname, "in_list_view", "0", prop_type="Check")
        ps(field.fieldname, "in_standard_filter", "0", prop_type="Check")
        ps(field.fieldname, "in_preview", "0", prop_type="Check")

    for fieldname in list_fields:
        ps(fieldname, "in_list_view", "1", prop_type="Check")
        ps(fieldname, "in_preview", "1", prop_type="Check")

    for fieldname in filter_fields:
        ps(fieldname, "in_standard_filter", "1", prop_type="Check")

    ps(None, "title_field", "custom_item_no", doctype_or_field="DocType")
    ps(None, "sort_field", "custom_item_no", doctype_or_field="DocType")
    ps(None, "sort_order", "ASC", doctype_or_field="DocType")
    _clear_item_list_user_settings()

    full_field_order = _FIELD_ORDER + [
        field.fieldname for field in meta.fields if field.fieldname not in _FIELD_ORDER
    ]
    ps(None, "field_order", json.dumps(full_field_order), doctype_or_field="DocType")