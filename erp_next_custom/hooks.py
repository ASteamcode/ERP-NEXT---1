app_name = "erp_next_custom"
app_title = "Erp Next Custom"
app_publisher = "ASteamcode"
app_description = "Customizations for ERPNext"
app_email = "mgmtechaff@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "erp_next_custom",
# 		"logo": "/assets/erp_next_custom/logo.png",
# 		"title": "Erp Next Custom",
# 		"route": "/erp_next_custom",
# 		"has_permission": "erp_next_custom.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/erp_next_custom/css/erp_next_custom.css"
app_include_js = [
    "/assets/erp_next_custom/js/core/ui/sidebar_hover.js",
    "/assets/erp_next_custom/js/core/offline/offline_cache_v2.js",
    "/assets/erp_next_custom/js/core/grid/grid_core.js",
    "/assets/erp_next_custom/js/doctypes/prospect/prospect_grid.js",
    "/assets/erp_next_custom/js/doctypes/prospect/prospect_mobile.js",
    "/assets/erp_next_custom/js/core/ui/drawing.js",
    "/assets/erp_next_custom/js/core/ui/annotations.js",
    "/assets/erp_next_custom/js/pages/desk/overview_offline.js",
    "/assets/erp_next_custom/js/core/ui/quick_launch.js",
]

# include js, css files in header of web template
# web_include_css = "/assets/erp_next_custom/css/erp_next_custom.css"
# web_include_js = "/assets/erp_next_custom/js/erp_next_custom.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "erp_next_custom/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
page_js = {"desktop": "public/js/pages/desk/desk_home.js"}

# include js in doctype views
doctype_js = {
    "Item":                  "public/js/doctypes/item/item_form.js",
    "Stock Entry":           "public/js/doctypes/stock_entry/stock_entry_form.js",
    "CRM Log":               "erp_next_custom/doctype/crm_log/crm_log.js",
    "Site Survey":           "erp_next_custom/doctype/site_survey/site_survey.js",
    "Measurement Take Off":  "erp_next_custom/doctype/measurement_take_off/measurement_take_off.js",
    "Custom Calendar Event": "erp_next_custom/doctype/custom_calendar_event/custom_calendar_event.js",
}
doctype_list_js = {
    "Contact":              "public/js/doctypes/contact/contact_list.js",
    "Lead":                 "public/js/doctypes/lead/lead_list.js",
    "CRM Log":              "public/js/doctypes/crm_log/crm_log_list.js",
    "Site Survey":          "public/js/doctypes/site_survey/site_survey_list.js",
    "Measurement Take Off": "public/js/doctypes/measurement_take_off/measurement_take_off_list.js",
    "Quotation":            "public/js/doctypes/quotation/quotation_list.js",
    "Item":                 "public/js/doctypes/item/item_list.js",
    "Prospect":             "public/js/doctypes/prospect/prospect_list.js",
    "Stock Entry":          "public/js/doctypes/stock_entry/stock_entry_list.js",
}

after_migrate = ["erp_next_custom.setup.setup_custom_fields"]

# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "erp_next_custom/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
role_home_page = {
    "Project Board": "desk",
}
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "erp_next_custom.utils.jinja_methods",
# 	"filters": "erp_next_custom.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "erp_next_custom.install.before_install"
# after_install = "erp_next_custom.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "erp_next_custom.uninstall.before_uninstall"
# after_uninstall = "erp_next_custom.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "erp_next_custom.utils.before_app_install"
# after_app_install = "erp_next_custom.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "erp_next_custom.utils.before_app_uninstall"
# after_app_uninstall = "erp_next_custom.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "erp_next_custom.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "erp_next_custom.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
    "Prospect": {
        "before_insert": "erp_next_custom.customize.prospect.set_prospect_name",
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"erp_next_custom.tasks.all"
# 	],
# 	"daily": [
# 		"erp_next_custom.tasks.daily"
# 	],
# 	"hourly": [
# 		"erp_next_custom.tasks.hourly"
# 	],
# 	"weekly": [
# 		"erp_next_custom.tasks.weekly"
# 	],
# 	"monthly": [
# 		"erp_next_custom.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "erp_next_custom.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "erp_next_custom.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "erp_next_custom.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "erp_next_custom.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["erp_next_custom.utils.before_request"]
# after_request = ["erp_next_custom.utils.after_request"]

# Job Events
# ----------
# before_job = ["erp_next_custom.utils.before_job"]
# after_job = ["erp_next_custom.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"erp_next_custom.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

fixtures = [
    {"doctype": "Workspace", "filters": [["name", "in", ["CRM", "Overview", "Project Tracker", "Inventory"]]]},
    {"doctype": "Workspace Sidebar", "filters": [["name", "in", ["CRM", "Overview", "Project Tracker", "Inventory"]]]},
    {"doctype": "Warehouse", "filters": [["name", "like", "% - AS"]]},
    {"doctype": "Item Group"},
]

website_route_rules = [{'from_route': '/frontend/<path:app_path>', 'to_route': 'frontend'},]