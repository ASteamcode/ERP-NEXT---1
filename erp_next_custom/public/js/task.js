"use strict";

const _DEFAULT_PROJECT = "Achi ERP — Intern Build";

frappe.ui.form.on("Task", {
    onload(frm) {
        if (!frm.is_new()) return;

        // Auto-assign to whoever is creating the task
        if (!frm.doc.assigned_to) {
            frm.set_value("assigned_to", frappe.session.user);
        }

        // Default project to the Intern Build project
        if (!frm.doc.project) {
            frappe.db.get_value("Project", { project_name: _DEFAULT_PROJECT }, "name")
                .then(({ message }) => {
                    if (message && message.name) {
                        frm.set_value("project", message.name);
                    }
                });
        }
    },

    status(frm) {
        // Auto-fill completed_on when marking complete
        if (frm.doc.status === "Completed" && !frm.doc.completed_on) {
            frm.set_value("completed_on", frappe.datetime.get_today());
        }
    }
});
