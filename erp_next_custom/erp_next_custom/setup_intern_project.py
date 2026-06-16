"""
Achi Scaffolding ERP — Intern Build Project Setup
==================================================
Run once on the company server after creating the three intern accounts:

    bench --site <your-site> execute \
        erp_next_custom.erp_next_custom.setup_intern_project.run

Prereqs:
  - ERPNext installed
  - Intern users created (update the emails below to match)
  - Projects module enabled (ERPNext > Settings > Show Modules)
"""

import frappe
from frappe.utils import add_days, today

# ── Update these to match the real user emails on your server ─────────────────
USERS = {
    "anthony": "karamanthony08@gmail.com",
    "grace":   "grece.jack.khoury@gmail.com",
    "pascale": "pascalalkhouri.2004@gmail.com",
    "supervisor": frappe.session.user,   # whoever runs the script
}

PROJECT_NAME = "Achi ERP — Intern Build"
START = today()


def _d(offset):
    """Return a date string offset working days from START."""
    return add_days(START, offset)


def run():
    frappe.flags.ignore_permissions = True

    # ── 1. Create the Project ─────────────────────────────────────────────────
    if frappe.db.exists("Project", PROJECT_NAME):
        frappe.delete_doc("Project", PROJECT_NAME, force=True)

    project = frappe.get_doc({
        "doctype":          "Project",
        "project_name":     PROJECT_NAME,
        "status":           "Open",
        "priority":         "High",
        "expected_start_date": START,
        "expected_end_date":   _d(42),
        "notes": (
            "Intern build sprint for Achi Scaffolding ERP.\n\n"
            "Ground rules:\n"
            "• Each intern has their own login — never share.\n"
            "• 15-min standup every morning.\n"
            "• After any form/config change: bench export-fixtures --app scaffolding_erp\n"
            "• Work on a branch → PR → supervisor review → merge. Never push to main.\n"
            "• Ask early when stuck."
        ),
    }).insert()

    print(f"✓ Project '{PROJECT_NAME}' created")

    # ── 2. Task definitions ───────────────────────────────────────────────────
    # Format: (subject, assigned_to_key, start_offset, duration_days, priority, depends_on_subjects)
    # depends_on_subjects is matched by subject string — resolved to task names after insert.

    TASKS = [
        # ── FOUNDATION (Supervisor) ───────────────────────────────────────────
        ("F1 · Create scaffolding_erp custom app skeleton",
         "supervisor", 0, 1, "High", []),

        ("F2 · GitHub repo setup and branch protection rules",
         "supervisor", 0, 1, "High", []),

        ("F3 · Intern user accounts, roles, and permissions",
         "supervisor", 0, 1, "High", []),

        ("F4 · ERPNext workspaces and sidebar menus",
         "supervisor", 1, 1, "Medium",
         ["F1 · Create scaffolding_erp custom app skeleton"]),

        ("F5 · Enable Projects module and confirm module access",
         "supervisor", 1, 0.5, "Medium", []),

        # ── LANE A — Anthony: Inventory · Estimation · Quotation ──────────────
        ("A1 · Map scaffolding item categories and sub-groups",
         "anthony", 2, 1, "Medium",
         ["F1 · Create scaffolding_erp custom app skeleton"]),

        ("A2 · Create Item Group tree (Tubes / Couplers / Boards / Frames / Jacks / Accessories)",
         "anthony", 3, 1, "High",
         ["A1 · Map scaffolding item categories and sub-groups"]),

        ("A3 · Define custom fields on Item master (weight, length, condition, rack location)",
         "anthony", 4, 2, "High",
         ["A2 · Create Item Group tree (Tubes / Couplers / Boards / Frames / Jacks / Accessories)"]),

        ("A4 · Configure Item form layout and field ordering",
         "anthony", 6, 1, "Medium",
         ["A3 · Define custom fields on Item master (weight, length, condition, rack location)"]),

        ("A5 · Set up Units of Measure for scaffolding (pcs, m, kg)",
         "anthony", 4, 0.5, "Medium",
         ["A2 · Create Item Group tree (Tubes / Couplers / Boards / Frames / Jacks / Accessories)"]),

        ("A6 · Import 10 sample items into item master",
         "anthony", 7, 2, "High",
         ["A4 · Configure Item form layout and field ordering",
          "A5 · Set up Units of Measure for scaffolding (pcs, m, kg)"]),

        ("A7 · Test item creation, edit, and search flows",
         "anthony", 9, 1, "High",
         ["A6 · Import 10 sample items into item master"]),

        ("A8 · Design Bill of Quantities (BOQ) template structure",
         "anthony", 4, 2, "High",
         ["A2 · Create Item Group tree (Tubes / Couplers / Boards / Frames / Jacks / Accessories)"]),

        ("A9 · Build BOQ custom doctype (or Quotation child table) with item, qty, rate",
         "anthony", 6, 2, "High",
         ["A8 · Design Bill of Quantities (BOQ) template structure"]),

        ("A10 · Map item catalog to BOQ line-item picker",
         "anthony", 8, 1, "High",
         ["A9 · Build BOQ custom doctype (or Quotation child table) with item, qty, rate"]),

        ("A11 · Configure Quotation form fields (validity, discount, terms)",
         "anthony", 8, 1, "High",
         ["A9 · Build BOQ custom doctype (or Quotation child table) with item, qty, rate"]),

        ("A12 · Create Quotation print format (PDF letterhead)",
         "anthony", 10, 2, "Medium",
         ["A11 · Configure Quotation form fields (validity, discount, terms)"]),

        ("A13 · End-to-end test: select items → BOQ → generate Quotation",
         "anthony", 10, 1, "High",
         ["A10 · Map item catalog to BOQ line-item picker",
          "A11 · Configure Quotation form fields (validity, discount, terms)"]),

        ("A14 · Import full item list (all current stock SKUs)",
         "anthony", 11, 2, "Medium",
         ["A7 · Test item creation, edit, and search flows"]),

        ("A15 · Supervisor review: Item master + BOQ + Quotation",
         "supervisor", 13, 1, "High",
         ["A13 · End-to-end test: select items → BOQ → generate Quotation",
          "A14 · Import full item list (all current stock SKUs)"]),

        ("A16 · Fix review feedback — Anthony lane",
         "anthony", 14, 1, "High",
         ["A15 · Supervisor review: Item master + BOQ + Quotation"]),

        # ── LANE G — Grace: Warehouses · Clients · Job Orders ─────────────────
        ("G1 · Map current physical warehouse layout and zones",
         "grace", 2, 1, "Medium",
         ["F1 · Create scaffolding_erp custom app skeleton"]),

        ("G2 · Create Warehouse tree in ERPNext (All → Main Yard → Sites → Site A/B/C)",
         "grace", 3, 1, "High",
         ["G1 · Map current physical warehouse layout and zones"]),

        ("G3 · Configure warehouse types, cost centres, and disable unusable defaults",
         "grace", 4, 1, "Medium",
         ["G2 · Create Warehouse tree in ERPNext (All → Main Yard → Sites → Site A/B/C)"]),

        ("G4 · Test stock entry: receive goods → Main Yard → transfer to Site",
         "grace", 5, 1, "High",
         ["G3 · Configure warehouse types, cost centres, and disable unusable defaults"]),

        ("G5 · Define Customer custom fields (site address, contact, contract ref)",
         "grace", 3, 1, "High",
         ["F4 · ERPNext workspaces and sidebar menus"]),

        ("G6 · Configure Customer list view and filters",
         "grace", 4, 1, "Medium",
         ["G5 · Define Customer custom fields (site address, contact, contract ref)"]),

        ("G7 · Import 5 test customer records",
         "grace", 5, 0.5, "Medium",
         ["G6 · Configure Customer list view and filters"]),

        ("G8 · Design Job Order doctype fields (client, site, start date, scaffolding type)",
         "grace", 5, 2, "High",
         ["G5 · Define Customer custom fields (site address, contact, contract ref)",
          "G2 · Create Warehouse tree in ERPNext (All → Main Yard → Sites → Site A/B/C)"]),

        ("G9 · Create Job Order doctype and form",
         "grace", 7, 2, "High",
         ["G8 · Design Job Order doctype fields (client, site, start date, scaffolding type)"]),

        ("G10 · Link Job Orders to Customers, Sites, and Warehouses",
         "grace", 9, 1, "High",
         ["G9 · Create Job Order doctype and form"]),

        ("G11 · Configure Job Order workflow (Draft → Active → On Hold → Closed)",
         "grace", 10, 1, "High",
         ["G10 · Link Job Orders to Customers, Sites, and Warehouses"]),

        ("G12 · Full lifecycle test: create customer → job order → close",
         "grace", 11, 1, "High",
         ["G11 · Configure Job Order workflow (Draft → Active → On Hold → Closed)"]),

        ("G13 · Configure Daily Site Stock Report (items out per site per day)",
         "grace", 11, 2, "Medium",
         ["G4 · Test stock entry: receive goods → Main Yard → transfer to Site",
          "G9 · Create Job Order doctype and form"]),

        ("G14 · Supervisor review: Warehouses + Job Orders + Stock Report",
         "supervisor", 13, 1, "High",
         ["G12 · Full lifecycle test: create customer → job order → close",
          "G13 · Configure Daily Site Stock Report (items out per site per day)"]),

        ("G15 · Fix review feedback — Grace lane",
         "grace", 14, 1, "High",
         ["G14 · Supervisor review: Warehouses + Job Orders + Stock Report"]),

        # ── LANE P — Pascale: CRM Pipeline · Reports ──────────────────────────
        ("P1 · Review CRM Log doctype and test existing Lead auto-creation",
         "pascale", 2, 1, "Medium",
         ["F1 · Create scaffolding_erp custom app skeleton"]),

        ("P2 · Configure Lead form fields for scaffolding pipeline",
         "pascale", 3, 1, "High",
         ["P1 · Review CRM Log doctype and test existing Lead auto-creation"]),

        ("P3 · Test and configure Site Survey form",
         "pascale", 4, 1, "High",
         ["P2 · Configure Lead form fields for scaffolding pipeline"]),

        ("P4 · Test and configure Measurement Take Off form",
         "pascale", 5, 1, "High",
         ["P3 · Test and configure Site Survey form"]),

        ("P5 · Configure CRM Workspace: Kanban view of pipeline stages",
         "pascale", 5, 1, "Medium",
         ["P2 · Configure Lead form fields for scaffolding pipeline"]),

        ("P6 · Build Lead pipeline report (by stage, by source, by date range)",
         "pascale", 6, 2, "High",
         ["P2 · Configure Lead form fields for scaffolding pipeline"]),

        ("P7 · Build weekly activity summary report (new leads, surveys, MTOs)",
         "pascale", 8, 2, "Medium",
         ["P5 · Configure CRM Workspace: Kanban view of pipeline stages"]),

        ("P8 · Configure Supervisor dashboard (pipeline KPIs + inventory snapshot)",
         "pascale", 10, 2, "High",
         ["P6 · Build Lead pipeline report (by stage, by source, by date range)",
          "P7 · Build weekly activity summary report (new leads, surveys, MTOs)"]),

        ("P9 · Create client-facing quote summary report (links to Quotation)",
         "pascale", 12, 2, "Medium",
         ["P8 · Configure Supervisor dashboard (pipeline KPIs + inventory snapshot)"]),

        ("P10 · Test all reports with real/dummy data",
         "pascale", 14, 1, "High",
         ["P9 · Create client-facing quote summary report (links to Quotation)"]),

        ("P11 · Supervisor review: CRM pipeline + all reports",
         "supervisor", 15, 1, "High",
         ["P10 · Test all reports with real/dummy data"]),

        ("P12 · Fix review feedback — Pascale lane",
         "pascale", 16, 1, "High",
         ["P11 · Supervisor review: CRM pipeline + all reports"]),

        # ── INTEGRATION + GO-LIVE ─────────────────────────────────────────────
        ("I1 · Cross-module test: CRM Log → Lead → Quotation → Job Order → Stock",
         "supervisor", 17, 2, "Urgent",
         ["A16 · Fix review feedback — Anthony lane",
          "G15 · Fix review feedback — Grace lane",
          "P12 · Fix review feedback — Pascale lane"]),

        ("I2 · Full data import: items, customers, warehouses (production data)",
         "supervisor", 19, 2, "Urgent",
         ["I1 · Cross-module test: CRM Log → Lead → Quotation → Job Order → Stock"]),

        ("I3 · User acceptance testing — all interns run their own workflows",
         "supervisor", 21, 2, "Urgent",
         ["I2 · Full data import: items, customers, warehouses (production data)"]),

        ("I4 · Bug-fix sprint from UAT findings",
         "supervisor", 23, 2, "Urgent",
         ["I3 · User acceptance testing — all interns run their own workflows"]),

        ("I5 · Export all fixtures, final git commit, tag release v1.0",
         "supervisor", 25, 1, "High",
         ["I4 · Bug-fix sprint from UAT findings"]),

        ("I6 · Go-live: migrate to production, brief end-users",
         "supervisor", 26, 1, "Urgent",
         ["I5 · Export all fixtures, final git commit, tag release v1.0"]),
    ]

    # ── 3. Insert tasks and build a lookup table for dependencies ─────────────
    subject_to_name = {}

    for (subject, user_key, start_offset, duration, priority, _deps) in TASKS:
        assigned_email = USERS.get(user_key, frappe.session.user)

        task = frappe.get_doc({
            "doctype":          "Task",
            "project":          PROJECT_NAME,
            "subject":          subject,
            "status":           "Open",
            "priority":         priority,
            "assigned_to":      assigned_email,
            "exp_start_date":   _d(start_offset),
            "exp_end_date":     _d(start_offset + max(int(duration), 1)),
            "expected_time":    duration * 8,   # hours
        }).insert()

        subject_to_name[subject] = task.name
        print(f"  ✓ {subject[:60]}")

    # ── 4. Wire up dependencies ───────────────────────────────────────────────
    print("\nSetting dependencies…")
    for (subject, _user, _s, _d2, _p, deps) in TASKS:
        if not deps:
            continue
        task_name = subject_to_name.get(subject)
        if not task_name:
            continue
        task = frappe.get_doc("Task", task_name)
        for dep_subject in deps:
            dep_name = subject_to_name.get(dep_subject)
            if dep_name:
                task.append("depends_on", {"task": dep_name})
        task.save()

    frappe.db.commit()

    print(f"\n{'='*60}")
    print(f"Project '{PROJECT_NAME}' ready — {len(TASKS)} tasks created.")
    print("Open ERPNext > Projects > Gantt to see the full timeline.")
    print("="*60)


if __name__ == "__main__":
    run()
