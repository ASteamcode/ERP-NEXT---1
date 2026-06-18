import json

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

# Standard Item fields hidden to reduce clutter
_HIDDEN_FIELDS = [
    "column_break0",
    "opening_stock",
    "standard_rate",
    "is_fixed_asset",
    "auto_create_assets",
    "is_grouped_asset",
    "asset_category",
    "asset_naming_series",
    "over_delivery_receipt_allowance",
    "over_billing_allowance",
    "disabled",
    "naming_series",
    "description",
    "brand",
    "has_variants",
    "allow_alternative_item",
    "uoms",
]

# Controls visual order of the Details tab.
# Standard fields interleaved with custom ones are placed here explicitly;
# any field not listed is appended by Frappe at the end.
_FIELD_ORDER = [
    # ── Details tab ───────────────────────────────────────────────
    "details",
    # ── Identification ────────────────────────────────────────────
    "custom_identification_section",
    "item_code",
    "item_name",
    "custom_col_break_id",
    "custom_arabic_name",
    "image",
    "column_break0", "naming_series", "disabled",           # hidden
    "allow_alternative_item", "has_variants",               # hidden
    "opening_stock", "standard_rate",                       # hidden
    "is_fixed_asset", "auto_create_assets", "is_grouped_asset",  # hidden
    "asset_category", "asset_naming_series",                # hidden
    "over_delivery_receipt_allowance", "over_billing_allowance",  # hidden
    # ── Scaffolding Spec ──────────────────────────────────────────
    # Row 1: System | Length / Size
    # Row 2: Function / Use
    "custom_scaffolding_spec_section",
    "custom_system",
    "custom_col_break_scaff",
    "custom_length_size",
    "custom_function_use",
    # ── Manufacturing Specs ───────────────────────────────────────
    # Row 1: Material       | Tube Diameter (mm)
    # Row 2: Weight Per Unit | Finish
    # Row 3: Steel Wall Thickness
    "custom_manufacturing_specs_section",
    "custom_material",
    "custom_col_break_mfg",
    "custom_tube_diameter_mm",
    "custom_col_break_mfg2",
    "weight_per_unit",
    "custom_col_break_mfg3",
    "custom_finish",
    "custom_steel_wall_thickness_mm",
    "description", "brand", "uoms",                        # hidden
    # ── Stock ─────────────────────────────────────────────────────
    # Row 1: Default Unit of Measure | Maintain Stock
    "custom_stock_section",
    "stock_uom",
    "is_stock_item",
    "custom_col_break_stock",
    "reorder_levels",
    "item_defaults",
    # ── Hire & Value ──────────────────────────────────────────────
    # Row 1: Valuation Rate | Replacement Value
    # Row 2: Weekly Hire Rate
    "custom_hire_value_section",
    "valuation_rate",
    "custom_col_break_hire",
    "custom_replacement_value",
    "custom_weekly_hire_rate",
    # ── Remaining standard tabs (untouched) ───────────────────────
    "dashboard_tab",
    "inventory_section",
    "inventory_settings_section",
    "weight_uom",
    "shelf_life_in_days",
    "end_of_life",
    "default_material_request_type",
    "valuation_method",
    "allow_negative_stock",
    "column_break1",
    "warranty_period",
    "sb_barcodes",
    "barcodes",
    "reorder_section",
    "serial_nos_and_batches",
    "has_batch_no",
    "create_new_batch",
    "batch_number_series",
    "has_expiry_date",
    "retain_sample",
    "sample_quantity",
    "column_break_37",
    "has_serial_no",
    "serial_no_series",
    "variants_section",
    "variant_of",
    "variant_based_on",
    "attributes",
    "accounting",
    "deferred_accounting_section",
    "enable_deferred_expense",
    "no_of_months_exp",
    "column_break_9s9o",
    "enable_deferred_revenue",
    "no_of_months",
    "section_break_avcp",
    "purchasing_tab",
    "purchase_uom",
    "min_order_qty",
    "safety_stock",
    "is_purchase_item",
    "custom_column_break_7aail",
    "purchase_details_cb",
    "lead_time_days",
    "last_purchase_rate",
    "is_customer_provided_item",
    "customer",
    "supplier_details",
    "delivered_by_supplier",
    "column_break2",
    "supplier_items",
    "foreign_trade_details",
    "country_of_origin",
    "column_break_59",
    "customs_tariff_number",
    "sales_details",
    "sales_uom",
    "grant_commission",
    "is_sales_item",
    "column_break3",
    "max_discount",
    "customer_details",
    "customer_items",
    "item_tax_section_break",
    "taxes",
    "quality_tab",
    "inspection_required_before_purchase",
    "quality_inspection_template",
    "inspection_required_before_delivery",
    "manufacturing",
    "include_item_in_manufacturing",
    "is_sub_contracted_item",
    "default_bom",
    "column_break_74",
    "customer_code",
    "default_item_manufacturer",
    "default_manufacturer_part_no",
    "total_projected_qty",
]

FIELDS = [
    # ── Identification ────────────────────────────────────────────────────────
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
        "read_only": 1,
        "in_list_view": 1,
        "in_preview": 1,
    },
    {
        "fieldname": "custom_col_break_id",
        "fieldtype": "Column Break",
        "insert_after": "item_name",
    },
    {
        "fieldname": "custom_arabic_name",
        "label": "Arabic Name",
        "fieldtype": "Data",
        "insert_after": "custom_col_break_id",
        "reqd": 1,
        "in_list_view": 1,
        "in_preview": 1,
    },
    # ── Scaffolding Spec ──────────────────────────────────────────────────────
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
        "options": (
            "\nTube & Fitting\nRinglock\nCuplock\nKwikstage"
            "\nFrame / H-Frame\nPropping / Shoring\nFormwork"
            "\nUniversal / Accessories\nConsumable\nService\nN/A"
        ),
    },
    {
        "fieldname": "custom_col_break_scaff",
        "fieldtype": "Column Break",
        "insert_after": "custom_system",
    },
    {
        "fieldname": "custom_length_size",
        "label": "Length / Size",
        "fieldtype": "Data",
        "insert_after": "custom_col_break_scaff",
        "in_list_view": 1,
        "in_preview": 1,
    },
    {
        "fieldname": "custom_function_use",
        "label": "Function / Use",
        "fieldtype": "Data",
        "insert_after": "custom_length_size",
        "reqd": 1,
        "in_list_view": 1,
        "in_preview": 1,
    },
    # ── Manufacturing Specs ───────────────────────────────────────────────────
    {
        "fieldname": "custom_manufacturing_specs_section",
        "label": "Manufacturing Specs",
        "fieldtype": "Section Break",
        "insert_after": "custom_function_use",
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
        "fieldname": "custom_col_break_mfg",
        "fieldtype": "Column Break",
        "insert_after": "custom_material",
    },
    {
        "fieldname": "custom_tube_diameter_mm",
        "label": "Tube Diameter (mm)",
        "fieldtype": "Float",
        "insert_after": "custom_col_break_mfg",
    },
    {
        "fieldname": "custom_col_break_mfg2",
        "fieldtype": "Column Break",
        "insert_after": "custom_tube_diameter_mm",
    },
    {
        "fieldname": "custom_col_break_mfg3",
        "fieldtype": "Column Break",
        "insert_after": "custom_col_break_mfg2",
    },
    {
        "fieldname": "custom_finish",
        "label": "Finish",
        "fieldtype": "Select",
        "insert_after": "custom_col_break_mfg3",
        "options": "\nGalvanized\nPainted\nBlack Steel\nAluminum\nOther",
    },
    {
        "fieldname": "custom_steel_wall_thickness_mm",
        "label": "Steel Wall Thickness (mm)",
        "fieldtype": "Float",
        "insert_after": "custom_finish",
    },
    # ── Stock ─────────────────────────────────────────────────────────────────
    {
        "fieldname": "custom_stock_section",
        "label": "Stock",
        "fieldtype": "Section Break",
        "insert_after": "custom_steel_wall_thickness_mm",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_col_break_stock",
        "fieldtype": "Column Break",
        "insert_after": "is_stock_item",
    },
    # ── Hire & Value ──────────────────────────────────────────────────────────
    {
        "fieldname": "custom_hire_value_section",
        "label": "Hire & Value",
        "fieldtype": "Section Break",
        "insert_after": "custom_col_break_stock",
        "collapsible": 1,
    },
    {
        "fieldname": "custom_col_break_hire",
        "fieldtype": "Column Break",
        "insert_after": "custom_hire_value_section",
    },
    {
        "fieldname": "custom_replacement_value",
        "label": "Replacement Value",
        "fieldtype": "Currency",
        "insert_after": "custom_col_break_hire",
    },
    {
        "fieldname": "custom_weekly_hire_rate",
        "label": "Weekly Hire Rate",
        "fieldtype": "Currency",
        "insert_after": "custom_replacement_value",
    },
]


def setup():
    create_custom_fields({"Item": FIELDS}, update=True)
    _apply_property_setters()
    frappe.clear_cache(doctype="Item")


def _apply_property_setters():
    def ps(field, prop, value, prop_type="Data", doctype_or_field="DocField"):
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

    # Label renames on standard fields
    ps("item_code", "label", "ID")
    ps("weight_per_unit", "label", "Weight Per Unit (KG)")
    ps("stock_uom", "label", "Default Unit of Measure")
    ps("item_group", "label", "Item Group")   # restore in case old fixture renamed it

    # Hidden fields
    for fieldname in _HIDDEN_FIELDS:
        ps(fieldname, "hidden", "1", prop_type="Check")

    # List-view columns
    for fieldname in ["item_code", "item_name"]:
        ps(fieldname, "in_list_view", "1", prop_type="Check")

    # Sort by Item No ascending
    ps(None, "sort_field", "custom_item_no", doctype_or_field="DocType")
    ps(None, "sort_order", "ASC", doctype_or_field="DocType")

    # Naming series
    ps("naming_series", "options", "STO-ITEM-.YYYY.-")
    ps("naming_series", "hidden", "1", prop_type="Check")
    ps("naming_series", "reqd", "0", prop_type="Check")

    # Field order
    ps(None, "field_order", json.dumps(_FIELD_ORDER), doctype_or_field="DocType")
