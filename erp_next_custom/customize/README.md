# Customize Architecture

This package contains migration-time customizations for ERPNext and Frappe documents. Keep files grouped by the DocType or system area they modify.

## Where Code Goes

- doctypes/<doctype>/custom_fields.py: custom fields, property setters, naming hooks, and setup code for one DocType.
- workspaces/<workspace>.py: Workspace creation or cleanup code.
- shared/: only for helpers used by more than one DocType. Create it only when needed.

## Rules

- If a function changes fields on Contact, put it in doctypes/contact/custom_fields.py.
- If a function changes fields on Stock Entry, put it in doctypes/stock_entry/custom_fields.py.
- Keep setup() idempotent: running it twice should not duplicate fields or break migration.
- Update erp_next_custom/setup.py when a new DocType customization should run after migrate.
- Update hooks.py when a moved customization function is used by doc_events.

## Current Note

stock_entry and workspace customization modules exist, but they were not previously called by setup_custom_fields(). They remain organized here without changing migration behavior.
