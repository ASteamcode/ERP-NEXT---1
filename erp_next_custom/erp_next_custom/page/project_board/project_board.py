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


@frappe.whitelist(allow_guest=False)
def resolve_maps_url(url):
    """Follow redirects on a Google Maps short URL and extract coordinates."""
    import re, requests as _req
    try:
        r = _req.head(url, allow_redirects=True, timeout=6, headers={"User-Agent": "Mozilla/5.0"})
        final = r.url
    except Exception:
        return {"url": url}
    patterns = [
        r'@(-?\d+\.?\d+),\+?(-?\d+\.?\d+)',            # @lat,lng or @lat,+lng
        r'/maps/search/(-?\d+\.?\d+),\+?(-?\d+\.?\d+)',# /maps/search/lat,+lng
        r'[?&]q=(-?\d+\.?\d+),\+?(-?\d+\.?\d+)',       # ?q=lat,lng
        r'll=(-?\d+\.?\d+),\+?(-?\d+\.?\d+)',           # ll=lat,lng
    ]
    for pat in patterns:
        m = re.search(pat, final)
        if m:
            return {"lat": float(m.group(1)), "lng": float(m.group(2)), "url": final}
    place = re.search(r'/maps/place/([^/@?]+)', final)
    if place:
        return {"place": place.group(1).replace("+", " "), "url": final}
    return {"url": final}


@frappe.whitelist()
def get_prospects():
    """Return all Prospect records mapped to the prospect grid schema."""
    rows = frappe.get_all(
        "Prospect",
        fields=[
            "name", "company_name", "industry", "website", "owner",
            "custom_salutation", "custom_first_name", "custom_last_name",
            "custom_prospect_status", "custom_mobile", "custom_email",
            "custom_site_location", "custom_maps_url", "custom_position",
            "custom_has_drawing",
            "custom_project_status", "custom_project_start",
            "custom_floors", "custom_area", "custom_scaffold_type", "custom_project_type",
            "custom_architect", "custom_project_owner", "custom_site_engineer",
            "custom_workers_count", "custom_safety_officer", "custom_contract_value",
            "custom_telegram", "custom_linkedin", "custom_facebook", "custom_instagram",
        ],
        order_by="creation asc",
    )

    # Bulk-fetch owner full names
    unique_owners = list(set(r.owner for r in rows if r.owner))
    owner_names = {}
    if unique_owners:
        users = frappe.get_all("User", filters=[["name", "in", unique_owners]], fields=["name", "full_name"])
        owner_names = {u.name: u.full_name for u in users}

    def _initials(email):
        full = owner_names.get(email, "")
        words = [w for w in full.split() if w]
        if words:
            return "".join(w[0].upper() for w in words[:2])
        return email[:2].upper() if email else "?"

    result = []
    for i, r in enumerate(rows):
        owner_email = r.owner or ""
        result.append({
            "name":     r.name,
            "num":      i + 1,
            "title":    r.custom_salutation or "",
            "first":    r.custom_first_name or "",
            "last":     r.custom_last_name or "",
            "company":  r.company_name or "",
            "role":     r.custom_position or "",
            "status":   r.custom_prospect_status or "Lead",
            "mobile":   r.custom_mobile or "",
            "email":    r.custom_email or "",
            "city":     r.custom_site_location or "",
            "maps":        r.custom_maps_url or "",
            "has_drawing": r.custom_has_drawing or 0,
            "owner":          owner_email,
            "owner_initials": _initials(owner_email),
            "owner_name":     owner_names.get(owner_email, owner_email),
            "pstatus":  r.custom_project_status or "",
            "pstart":   str(r.custom_project_start) if r.custom_project_start else "",
            "floors":   r.custom_floors or "",
            "area":     r.custom_area or "",
            "scaffold": r.custom_scaffold_type or "",
            "ptype":    r.custom_project_type or "",
            "architect":r.custom_architect or "",
            "proj_owner": r.custom_project_owner or "",
            "site_eng": r.custom_site_engineer or "",
            "workers":  r.custom_workers_count or "",
            "safety":   r.custom_safety_officer or "",
            "contract": ("${:,.0f}".format(r.custom_contract_value) if r.custom_contract_value else ""),
            "instagram":r.custom_instagram or "",
            "linkedin": r.custom_linkedin or "",
            "facebook": r.custom_facebook or "",
            "telegram": r.custom_telegram or "",
            "website":  r.website or "",
        })

    return result
