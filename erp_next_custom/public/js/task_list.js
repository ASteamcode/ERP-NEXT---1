"use strict";

frappe.listview_settings["Task"] = {
    // Pull these fields into the list row so the button action can read them
    add_fields: ["status", "project", "assigned_to", "completed_on"],

    // Quick-complete button on every non-finished row
    button: {
        show(doc) {
            return doc.status !== "Completed" && doc.status !== "Cancelled";
        },
        get_label() { return __("Complete"); },
        get_description() { return __("Mark as Completed with today's date"); },
        action(doc) {
            frappe.call({
                method: "frappe.client.set_value",
                args: {
                    doctype: "Task",
                    name: doc.name,
                    fieldname: {
                        status: "Completed",
                        completed_on: frappe.datetime.get_today(),
                    },
                },
                freeze: true,
                callback() { cur_list.refresh(); },
            });
        },
    },

    // Colour-code rows by status for quick scanning
    get_indicator(doc) {
        const map = {
            "Open":        ["orange", "status,=,Open"],
            "Working":     ["blue",   "status,=,Working"],
            "Pending Review": ["yellow", "status,=,Pending Review"],
            "Completed":   ["green",  "status,=,Completed"],
            "Cancelled":   ["gray",   "status,=,Cancelled"],
        };
        return map[doc.status] || ["gray", "status,=," + doc.status];
    },
};
