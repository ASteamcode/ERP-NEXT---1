# Copyright (c) 2026, ASteamcode and contributors
# For license information, please see license.txt

import csv
import io
import os
import re

import frappe
import requests


@frappe.whitelist()
def export_translations():
    """
    Scan all Python and JavaScript files in erp_next_custom for translatable strings
    (__("...") in JS, _("...") in Python) and return a UTF-8 CSV ready for a
    translator to fill in — no build step required.
    """
    app_path = frappe.get_app_path("erp_next_custom")

    # Match __("...") and __('...') in JS; _("...") and _('...') in Python
    js_pat = re.compile(r"""__\(\s*["']([^"'\\]+(?:\\.[^"'\\]*)*)["']""")
    py_pat = re.compile(r"""_\(\s*["']([^"'\\]+(?:\\.[^"'\\]*)*)["']""")

    strings: set[str] = set()

    for root, dirs, files in os.walk(app_path):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "node_modules", ".git")]
        for fname in files:
            ext = os.path.splitext(fname)[1]
            if ext not in (".py", ".js"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                pat = js_pat if ext == ".js" else py_pat
                for m in pat.finditer(content):
                    s = m.group(1).strip()
                    if s:
                        strings.add(s)
            except Exception:
                pass

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["source_text", "translated_text"])
    for s in sorted(strings, key=str.casefold):
        writer.writerow([s, ""])

    frappe.response["type"] = "download"
    frappe.response["content_type"] = "text/csv; charset=utf-8"
    frappe.response["filename"] = "erp_next_custom_translations.csv"
    frappe.response["filecontent"] = output.getvalue().encode("utf-8")


@frappe.whitelist()
def send_whatsapp_message(to, message, prospect_name=None):
    """
    Send a WhatsApp message via Meta Cloud API.
    Requires site config keys: wa_api_token, wa_phone_number_id
    """
    token    = frappe.conf.get("wa_api_token")
    phone_id = frappe.conf.get("wa_phone_number_id")

    if not token or not phone_id:
        frappe.throw(
            "WhatsApp API not configured. Set <b>wa_api_token</b> and "
            "<b>wa_phone_number_id</b> in your site config (bench set-config).",
            title="WhatsApp API"
        )

    to = re.sub(r"\D", "", str(to))
    if not to:
        frappe.throw("Invalid phone number.")

    resp = requests.post(
        f"https://graph.facebook.com/v20.0/{phone_id}/messages",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": message},
        },
        timeout=15,
    )

    if not resp.ok:
        err = resp.json() if resp.content else {}
        msg = (err.get("error") or {}).get("message") or resp.text or "Unknown error"
        frappe.throw(f"WhatsApp API error: {msg}", title="Send Failed")

    # Log as a communication on the Prospect record
    if prospect_name:
        try:
            frappe.get_doc({
                "doctype": "Communication",
                "communication_type": "Communication",
                "communication_medium": "Phone",
                "subject": "WhatsApp Message",
                "content": message,
                "sent_or_received": "Sent",
                "reference_doctype": "Prospect",
                "reference_name": prospect_name,
                "phone_no": to,
                "status": "Linked",
            }).insert(ignore_permissions=True)
        except Exception:
            pass

    return {"status": "sent", "to": to}


# ── User Location Tracking ─────────────────────────────────────────────────
_LOC_TTL = 300  # 5 minutes — location expires if user goes idle

@frappe.whitelist()
def update_location(lat, lng, accuracy=None):
    """Called by the frontend watchPosition handler to push the user's GPS position."""
    user = frappe.session.user
    if not user or user == "Guest":
        return
    payload = {
        "user":     user,
        "lat":      float(lat),
        "lng":      float(lng),
        "accuracy": float(accuracy) if accuracy else None,
        "ts":       frappe.utils.now(),
        "full_name": frappe.db.get_value("User", user, "full_name") or user,
    }
    frappe.cache.set_value(f"user_loc:{user}", payload, expires_in_sec=_LOC_TTL)
    return {"ok": True}


@frappe.whitelist()
def get_locations():
    """Return all users who have a live location in the cache."""
    # Find all keys matching user_loc:*
    pattern = "user_loc:*"
    try:
        keys = frappe.cache.get_keys(pattern)
    except Exception:
        keys = []
    out = []
    for key in keys:
        try:
            data = frappe.cache.get_value(key.decode() if isinstance(key, bytes) else key)
            if data:
                out.append(data)
        except Exception:
            pass
    return out
