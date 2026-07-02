frappe.provide("frappe.listview_settings");

const ITEM_SORT_FIELD = "custom_item_no";
const ITEM_LIST_FIELDS = [
    "custom_item_no",
    "item_code",
    "item_name",
    "custom_arabic_name",
    "custom_function_use",
    "custom_length_size",
    "custom_system",
    "custom_material",
    "custom_tube_diameter_mm",
    "custom_steel_wall_thickness_mm",
    "custom_finish",
    "variant_of",
    "has_variants",
];

let item_listview = null;

frappe.listview_settings["Item"] = {
    add_fields: ITEM_LIST_FIELDS,
    hide_name_column: true,

    get_indicator: function () {
        return null;
    },

    onload: function (listview) {
        item_listview = listview;
        listview.page_title = __("Item");
        force_item_sort(listview);
        install_item_list_styles();
    },

    before_render: function () {
        remove_status_column_definition(item_listview);
    },

    refresh: function (listview) {
        item_listview = listview || item_listview;
        force_item_sort(item_listview);
        install_item_list_styles();
        window.setTimeout(clean_item_list_noise, 0);
        window.setTimeout(clean_item_list_noise, 100);
    },
};

function force_item_sort(listview) {
    if (!listview) return;

    listview.sort_by = ITEM_SORT_FIELD;
    listview.sort_order = "asc";
    listview.view_user_settings = listview.view_user_settings || {};
    listview.view_user_settings.sort_by = ITEM_SORT_FIELD;
    listview.view_user_settings.sort_order = "asc";

    if (listview.sort_selector && listview.sort_selector.sort_by !== ITEM_SORT_FIELD) {
        listview.sort_selector.set_value(ITEM_SORT_FIELD, "asc");
    }
}

function remove_status_column_definition(listview) {
    if (!listview || !Array.isArray(listview.columns)) return;
    listview.columns = listview.columns.filter((column) => column.type !== "Status");
}

function install_item_list_styles() {
    const style_id = "item-list-clean-columns";
    if (document.getElementById(style_id)) return;

    const style = document.createElement("style");
    style.id = style_id;
    style.textContent = `
        [data-doctype="Item"] .indicator-pill,
        [data-doctype="Item"] .list-row-col:has(.indicator-pill),
        body[data-route^="List/Item"] .indicator-pill,
        body[data-route^="List/Item"] .list-row-col:has(.indicator-pill) {
            display: none !important;
        }

        [data-doctype="Item"] .list-row-col,
        body[data-route^="List/Item"] .list-row-col {
            white-space: nowrap;
        }

        [data-doctype="Item"] .list-row-col.list-subject,
        body[data-route^="List/Item"] .list-row-col.list-subject {
            flex: 0 0 92px !important;
            max-width: 92px !important;
        }

        [data-doctype="Item"] .list-row-col.ellipsis.hidden-xs,
        body[data-route^="List/Item"] .list-row-col.ellipsis.hidden-xs {
            flex: 0 0 150px !important;
            max-width: 150px !important;
        }
    `;
    document.head.appendChild(style);
}

function clean_item_list_noise() {
    remove_status_column_definition(item_listview);

    const roots = document.querySelectorAll('[data-doctype="Item"], body[data-route^="List/Item"]');
    roots.forEach((root) => {
        const rows = Array.from(root.querySelectorAll(".list-row, .list-row-head"));
        const status_indexes = new Set();

        rows.forEach((row) => {
            Array.from(row.querySelectorAll(".list-row-col")).forEach((cell, index) => {
                const text = (cell.textContent || "").trim();
                if (["Status", "Enabled", "Disabled"].includes(text)) {
                    status_indexes.add(index);
                }
            });
        });

        rows.forEach((row) => {
            Array.from(row.querySelectorAll(".list-row-col")).forEach((cell, index) => {
                const text = (cell.textContent || "").trim();
                if (status_indexes.has(index) || ["Status", "Enabled", "Disabled"].includes(text)) {
                    cell.style.display = "none";
                }
            });
        });
    });
}
