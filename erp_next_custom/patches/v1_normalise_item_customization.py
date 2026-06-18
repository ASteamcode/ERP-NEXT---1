import frappe

# Old fieldnames created via Customize Form UI (auto-generated names with double
# underscores, missing suffixes, or random hash suffixes). These conflict with the
# clean names defined in customize/item.py and must be removed so Frappe rebuilds
# the form from a known-good state.
_STALE_CUSTOM_FIELDS = [
    "Item-custom_section_break_kwrfa",   # → custom_identification_section
    "Item-custom_column_break_syswp",    # → custom_col_break_id
    "Item-custom_column_break_zgyoc",    # → custom_col_break_scaff
    "Item-custom_function__use",         # → custom_function_use
    "Item-custom_length__size",          # → custom_length_size
    "Item-custom_tube_diameter",         # → custom_tube_diameter_mm
    "Item-custom_column_break_8qvsv",    # → custom_col_break_mfg / mfg2 / mfg3
    "Item-custom_stock",                 # → custom_stock_section
    "Item-custom_hire__value",           # → custom_hire_value_section
    "Item-custom_hire_rate",             # → custom_weekly_hire_rate
]


def execute():
    # 1. Delete stale custom fields
    for name in _STALE_CUSTOM_FIELDS:
        if frappe.db.exists("Custom Field", name):
            frappe.delete_doc("Custom Field", name, ignore_missing=True, force=True)

    # 2. Wipe ALL Item property setters so none from the old fixture survive
    frappe.db.delete("Property Setter", {"doc_type": "Item"})

    frappe.db.commit()

    # 3. Rebuild from scratch using the canonical definition
    from erp_next_custom.customize import item
    item.setup()
