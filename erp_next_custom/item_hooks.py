import frappe
from frappe.utils import cint


def set_item_no(doc, method=None):
    if cint(doc.get("custom_item_no")) > 0:
        return

    last_no = frappe.db.sql("""
        SELECT COALESCE(MAX(custom_item_no), 0)
        FROM `tabItem`
        WHERE custom_item_no IS NOT NULL
          AND custom_item_no > 0
    """)[0][0]

    doc.custom_item_no = cint(last_no) + 1