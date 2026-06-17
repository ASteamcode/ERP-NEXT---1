import frappe
from frappe.model.document import Document


class SiteSurvey(Document):
    pass


@frappe.whitelist()
def send_survey_to_mto(site_survey_name):
    """
    Creates a Measurement Take Off from a Site Survey.
    Skips if an MTO already exists for this survey.
    Returns dict with mto name and whether it already existed.
    """
    existing = frappe.db.get_value(
        "Measurement Take Off", {"site_survey": site_survey_name}, "name"
    )
    if existing:
        return {"mto": existing, "existing": True}

    ss = frappe.get_doc("Site Survey", site_survey_name)

    mto = frappe.new_doc("Measurement Take Off")
    mto.status = "Draft"
    mto.date = frappe.utils.today()
    mto.lead = ss.lead or ""
    mto.site_survey = site_survey_name
    mto.contact = ss.contact or ""
    mto.site_location = ss.site_location or ""
    mto.google_maps_url = ss.google_maps_url or ""
    mto.site_type = ss.site_type or ""
    mto.roof_type = ss.roof_type or ""
    mto.site_area = ss.site_area or None
    mto.notes = "Pending architect upload of MTO / CAD drawing file."
    mto.insert(ignore_permissions=True)

    return {"mto": mto.name, "existing": False}
