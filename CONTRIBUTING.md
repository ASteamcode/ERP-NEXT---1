# Customization Guide

## Golden rule
Never use **Customize Form** in the browser to make permanent changes.
Whatever you click there lives only in your local database and will not exist on anyone else's machine.
All customizations must be written in code.

---

## Where things live

```
erp_next_custom/
  customize/
    item.py         ← Item form fields, layout, property setters
    lead.py         ← Lead custom fields
    quotation.py    ← Quotation custom fields
    <doctype>.py    ← add a new file for each new doctype you customize

  patches/
    v1_normalise_item_customization.py   ← one-time DB cleanup patch

  public/js/
    item_form.js        ← Item form JS (frm events, button logic)
    item_list.js        ← Item list view JS
    contacts_list.js    ← Contact list view JS
    leads_list.js       ← Lead list view JS
    quotation_list.js   ← Quotation list view JS

  setup.py            ← calls each customize/*.py — do not add fields here directly
  hooks.py            ← wires everything to Frappe — rarely needs changing
  patches.txt         ← registers patches so bench migrate runs them once
```

---

## Adding a custom field to an existing doctype

Open the relevant file in `customize/`. Example: adding a field to Item.

**1. Add the field to the `FIELDS` list in `customize/item.py`:**

```python
{
    "fieldname": "custom_my_field",
    "label": "My Field",
    "fieldtype": "Data",          # Data / Select / Float / Currency / Link / etc.
    "insert_after": "custom_arabic_name",   # fieldname of the field it should follow
    "reqd": 1,                    # 1 = required, omit if not required
    "in_list_view": 1,            # 1 = show in list view column, omit otherwise
},
```

**Field naming rules:**
- Always prefix with `custom_` — Frappe requires this for custom fields
- Use `snake_case`, never double underscores (`custom_my__field` is wrong)
- Keep it descriptive: `custom_tube_diameter_mm` not `custom_td`

**2. Add it to `_FIELD_ORDER` in the same file** at the position where it should appear on the form:

```python
_FIELD_ORDER = [
    ...
    "custom_arabic_name",
    "custom_my_field",      # ← insert here
    "custom_scaffolding_spec_section",
    ...
]
```

**3. Run migrate to apply:**

```bash
bench --site <your-site> migrate
```

---

## Adding a field to a different doctype (Lead, Quotation, etc.)

Same steps but in the relevant file. Example for Lead — open `customize/lead.py` and add to `FIELDS`:

```python
{
    "fieldname": "custom_my_lead_field",
    "label": "My Lead Field",
    "fieldtype": "Data",
    "insert_after": "source",
},
```

Lead and Quotation do not use `_FIELD_ORDER` — `insert_after` alone controls position since we are not interleaving standard fields.

---

## Adding customizations for a brand new doctype

1. Create `customize/<doctype_snake_case>.py` (e.g. `customize/contact.py`):

```python
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

FIELDS = [
    {
        "fieldname": "custom_my_field",
        "label": "My Field",
        "fieldtype": "Data",
        "insert_after": "some_existing_field",
    },
]

def setup():
    create_custom_fields({"Contact": FIELDS}, update=True)
```

2. Register it in `setup.py`:

```python
from erp_next_custom.customize import item, lead, quotation, contact  # ← add import

def setup_custom_fields():
    ...
    contact.setup()   # ← add call
```

3. Run migrate.

---

## Adding layout structure (sections and columns)

Sections and column breaks are just fields with special `fieldtype`.

```python
# Section break — starts a new titled group
{
    "fieldname": "custom_my_section",
    "label": "My Section",
    "fieldtype": "Section Break",
    "insert_after": "some_field",
    "collapsible": 1,   # 1 = user can collapse it
},

# Column break — splits the current section into left / right columns
{
    "fieldname": "custom_col_break_my",
    "fieldtype": "Column Break",
    "insert_after": "custom_left_field",
},
```

Layout within a section with one column break:
```
[ left_field  ]  [ right_field ]
[ left_field2 ]  [ right_field2]   ← fields keep stacking in their column
```

Add these to `_FIELD_ORDER` in the correct position just like any other field.

---

## Changing a standard field (label, hidden, required)

Standard fields (ones that exist in ERPNext by default) cannot go in `FIELDS`.
Use `frappe.make_property_setter` inside `_apply_property_setters()` in `customize/item.py`:

```python
def _apply_property_setters():
    def ps(field, prop, value, prop_type="Data", doctype_or_field="DocField"):
        frappe.make_property_setter({
            "doctype": "Item",
            "doctype_or_field": doctype_or_field,
            "fieldname": field,
            "property": prop,
            "value": value,
            "property_type": prop_type,
        }, ignore_validate=True)

    ps("item_code", "label", "ID")              # rename label
    ps("description", "hidden", "1", "Check")   # hide a field
    ps("item_name", "reqd", "1", "Check")       # make required
```

---

## Modifying the form with JavaScript

For button logic, dynamic behaviour, or field events — edit `public/js/item_form.js`:

```javascript
frappe.ui.form.on('Item', {
    refresh(frm) {
        // runs every time the form opens or refreshes
    },

    custom_system(frm) {
        // runs when the System field value changes
        if (frm.doc.custom_system === 'N/A') {
            frm.set_value('custom_function_use', '');
        }
    },

    before_save(frm) {
        // runs just before the record is saved
    },
});
```

Do **not** use this file to control which fields exist or their layout — that belongs in `customize/item.py`.

---

## What NOT to do

| Action | Why not |
|---|---|
| Use Customize Form in the browser | Changes only exist in your local DB |
| Export `Custom Field` or `Property Setter` to fixtures | Conflicts with the Python setup — only Workspace, Warehouse, Item Group go in fixtures |
| Add fields directly to `setup.py` | Put them in `customize/<doctype>.py` instead |
| Use double underscores in fieldnames | Frappe auto-generates these from UI — they are a sign of a UI-created field |
| Duplicate a `doctype_list_js` or `doctype_js` key in `hooks.py` | Python dicts take the last value — earlier entries are silently dropped |

---

## After any change — checklist

1. `bench --site <site> migrate`
2. `bench --site <site> build` (if you changed any `.js` files)
3. Hard-refresh the browser (`Ctrl+Shift+R`)
4. Open the affected form and verify the field appears where expected
