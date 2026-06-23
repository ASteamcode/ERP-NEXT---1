import frappe


@frappe.whitelist()
def get_company_info():
    """Return basic company info for the sidebar."""
    companies = frappe.get_all(
        "Company",
        fields=["name", "company_name", "company_logo", "default_currency"],
        limit=1,
    )
    return companies[0] if companies else {}
