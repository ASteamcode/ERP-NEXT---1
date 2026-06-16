# Copyright (c) 2026, ASteamcode and contributors
# For license information, please see license.txt

import csv
import io
import os
import re

import frappe


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
