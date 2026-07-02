# Public JavaScript Architecture

This folder is organized by ownership and responsibility. Do not add new one-off files directly under public/js.

## Where Code Goes

- core/: shared systems used by more than one DocType or page.
- core/grid/: reusable grid/table engine code.
  - grid_core.js: shared list/grid data helpers, editing behavior, cell renderers, and Frappe ListView integration.
  - tabbed_grid.js: shared pill-tab spreadsheet shell, quick stats strip, table layout, and GridShell/PG public API.
- core/offline/: offline caching and offline status behavior.
- core/ui/: global Desk UI helpers and shared UI tools.
- core/tracking/: shared tracking/location behavior.
- doctypes/<doctype>/: scripts owned by one DocType.
- pages/<page>/: scripts owned by a Frappe page.

## Naming Rules

Use names that describe both the owner and the role:

- <doctype>_list.js for ListView scripts.
- <doctype>_form.js for Form scripts.
- <doctype>_grid.js for DocType-specific grid rendering.
- <doctype>_actions.js for buttons, row actions, and menu actions.
- <doctype>_mobile.js for mobile-only behavior.

Avoid names like custom.js, test.js, new.js, final.js, or fix.js.

## Team Ownership

Prefer folder ownership over giant person-owned file sections. If code belongs to Prospect, keep it in doctypes/prospect/. If code is shared, move it into core/ only after at least two features need it.

When editing another intern owned folder, notify them first and keep the change focused.
