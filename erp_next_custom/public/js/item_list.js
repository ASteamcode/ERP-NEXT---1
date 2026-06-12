frappe.listview_settings["Item"] = frappe.listview_settings["Item"] || {};

frappe.listview_settings["Item"].get_indicator = function (doc) {
    return null;
};
frappe.listview_settings["Item"] = {
    add_fields: [
        "name",
        "item_name",
        "custom_item_no",
        "custom_arabic_name",
        "item_group",
        "custom_function_use",
        "disabled"
    ],

    hide_name_column: true,

    get_indicator: function (doc) {
        return null;
    },

    onload: function (listview) {
        listview.page.set_title("Item");
    },

    refresh: function (listview) {
        setTimeout(() => {
            reorder_item_list_columns();
        }, 300);
    }
};


function reorder_item_list_columns() {
    const wanted_headers = [
        "Item No",
        "ID",
        "Item Name",
        "Arabic Name",
        "Item Group",
        "Function / Use"
    ];

    const rows = document.querySelectorAll(".list-row-container .list-row, .list-row-head");

    rows.forEach(row => {
        const columns = Array.from(row.children);

        if (!columns.length) return;

        const checkbox_col = columns[0];

        const col_map = {};

        columns.forEach(col => {
            const text = (col.innerText || "").trim();

            if (text === "Item No") col_map["Item No"] = col;
            if (text === "ID") col_map["ID"] = col;
            if (text === "Item Name") col_map["Item Name"] = col;
            if (text === "Arabic Name") col_map["Arabic Name"] = col;
            if (text === "Item Group") col_map["Item Group"] = col;
            if (text === "Function / Use") col_map["Function / Use"] = col;

            // Hide Status column if found
            if (text === "Status" || text === "Enabled" || text === "Disabled") {
                col.style.display = "none";
            }
        });

        // For data rows, detect by column order/class if header text is not available
        // This part is only a visual correction and may need adjustment per ERPNext version.
    });
}
