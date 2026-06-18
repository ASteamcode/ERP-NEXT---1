import frappe
import json
from collections import defaultdict

_ALLOWED_USERS = frozenset({
    "Administrator",
    "karamanthony08@gmail.com",
    "grece.jack.khoury@gmail.com",
    "pascalalkhouri.2004@gmail.com",
})


def _check_access():
    user = frappe.session.user
    roles = frappe.get_roles(user)
    if "System Manager" not in roles and "Project Board" not in roles and user not in _ALLOWED_USERS:
        frappe.throw("You do not have access to the Project Board.", frappe.PermissionError)


def get_context(context):
    _check_access()


@frappe.whitelist()
def get_board_data():
    _check_access()

    projects = frappe.get_list(
        "Project",
        fields=["name", "project_name", "status", "percent_complete",
                "expected_end_date", "notes", "is_active"],
        order_by="expected_end_date asc, creation desc",
        limit=200,
    )

    if not projects:
        return []

    project_names = [p["name"] for p in projects]

    task_rows = frappe.db.sql(
        """
        SELECT project, status, COUNT(*) AS cnt,
               GROUP_CONCAT(`_assign` SEPARATOR '||') AS assigns
        FROM `tabTask`
        WHERE project IN %(projects)s
        GROUP BY project, status
        """,
        {"projects": project_names},
        as_dict=True,
    )

    task_map = defaultdict(lambda: {"total": 0, "completed": 0, "open": 0,
                                     "in_progress": 0, "cancelled": 0})
    assign_map = defaultdict(set)

    for row in task_rows:
        pm = task_map[row.project]
        pm["total"] += row.cnt
        s = (row.status or "").lower()
        if "complet" in s:
            pm["completed"] += row.cnt
        elif "cancel" in s:
            pm["cancelled"] += row.cnt
        elif "open" in s:
            pm["open"] += row.cnt
        else:
            pm["in_progress"] += row.cnt

        if row.assigns:
            for chunk in row.assigns.split("||"):
                chunk = chunk.strip()
                if not chunk or chunk == "null":
                    continue
                try:
                    emails = json.loads(chunk)
                    for e in (emails or []):
                        if e:
                            assign_map[row.project].add(e)
                except Exception:
                    pass

    for p in projects:
        p["tasks"] = dict(task_map[p["name"]])
        p["assignees"] = list(assign_map[p["name"]])[:6]

    return projects


@frappe.whitelist()
def get_tasks_data(project=None):
    _check_access()
    filters = {}
    if project:
        filters["project"] = project
    return frappe.get_list(
        "Task",
        fields=["name", "subject", "status", "project", "exp_end_date", "_assign", "priority"],
        filters=filters,
        order_by="exp_end_date asc, creation desc",
        limit=500,
    )


@frappe.whitelist()
def toggle_assignee(task_name, user_email):
    _check_access()
    import json as _j
    raw = frappe.db.get_value("Task", task_name, "_assign") or "[]"
    try:
        cur = _j.loads(raw) or []
    except Exception:
        cur = []
    if user_email in cur:
        cur.remove(user_email)
    else:
        cur.append(user_email)
    frappe.db.set_value("Task", task_name, "_assign", _j.dumps(cur))
    return {"assigns": cur}


@frappe.whitelist()
def set_task_status(task_name, new_status):
    _check_access()
    frappe.db.set_value("Task", task_name, "status", new_status)
    return {"status": new_status}
