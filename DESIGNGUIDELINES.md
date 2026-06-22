# Design Guidelines — ERP Next Custom
> **THE MESH** — A unified UI/UX system derived from the Prospect Grid.  
> Every new page, list, form, and mobile view should inherit from these rules.  
> When prompting AI or briefing interns, paste the relevant section verbatim.

---

## 1. Philosophy

| Principle | Meaning |
|-----------|---------|
| **One source of truth** | `prospect_grid.js` / `prospect_list.js` is the golden standard. All deviations need a reason. |
| **Content first** | Chrome (borders, shadows, gradients) supports content — never competes with it. |
| **Instant feedback** | Optimistic saves. Close the cell/form first, sync in background. Never make the user wait for the server. |
| **Earn the interaction** | One click opens an edit. One click opens a dropdown. Never require a second click to activate. |
| **Mobile = same data, smaller frame** | The mobile row is a collapsed version of the desktop row — same fields, same actions, just prioritised. |

---

## 2. Color Palette

```
Primary Blue      #2563eb   — buttons, active states, links, accents
Blue Light Bg     #eff6ff   — selected row, active badge bg, hover badge bg
Blue Border       #bfdbfe   — selected row border, input focus ring
Blue Dark         #1e40af   — badge text on blue bg

Navy Gradient     linear-gradient(135deg, #1e3a8a 0%, #2d52a8 100%)
                            — page/section headers, modal title bars

White             #ffffff   — card backgrounds, cell backgrounds
Off-White         #f8fafc   — page bg, toolbar bg
Surface Border    #e8e8f0   — card borders, dividers, input borders (1.5px)
Muted Border      #e2e8f0   — inner table cell borders (0.5px)

Text Primary      #111827   — body text, cell values
Text Secondary    #374151   — labels, secondary values
Text Muted        #64748b   — placeholders, helper text, icon resting state
Text Disabled     #9ca3af   — empty cells, row numbers (resting)

Status Amber Bg   #fffbeb   / Text #d97706
Status Green Bg   #f0fdf4   / Text #16a34a
Status Red Bg     #fff1f2   / Text #e11d48
Status Gray Bg    #f3f4f6   / Text #6b7280

Danger Hover      #fee2e2   bg / #dc2626 text / #fecaca glow ring
                            — destructive buttons, close X on hover
```

---

## 3. Typography

```
Font family:   inherit (Frappe's Inter / system stack)
Base size:     13px  — table cell values
Label size:    11px  — column headers, form labels (uppercase, weight 650, letter-spacing .06em)
Badge size:    11px  — status pills (weight 650)
Small helper:  11px  — muted metadata, timestamps
Button text:   12px  — toolbar/action buttons (weight 500–600)
Heading:       15px  — section titles inside panels
```

---

## 4. Spacing & Sizing

```
Base unit: 4px

Cell padding:      0 12px horizontal, height driven by row-height (36px default)
Row height:        36px (compact), 44px (comfortable for mobile)
Card padding:      16px–20px
Section gap:       12px between related groups
Icon button size:  30px × 30px (circle) or 28px × 28px
Toolbar height:    48px desktop, auto-wrap on mobile
Border radius:
  Pill/circle btn  99px
  Card / modal     12px
  Badge            99px
  Input            6–8px (inline edit uses 3px — tight to cell)
  Dropdown         10px
  Swatch           50% (circle)
```

---

## 5. Component Patterns

### 5.1 Table / Grid (desktop)

```
Shell:          .pg-tbl-outer — horizontal scroll, no vertical scroll on outer
Header row:     Navy gradient bg, uppercase 11px labels, 650 weight
                sticky (position:sticky top:0 z-index:10)
Fixed columns:  Left-pinned with box-shadow right fade (shadow: true)
Hover:          No background change (cells already have borders as context)
Selection:      background #eff6ff — wins over hover via specificity (.pg-tbl .pg-row-sel td)
Active cell:    outline: 1px solid #bfdbfe; outline-offset: -1px (inset, no layout shift)
Zebra:          Not used — borders provide structure
```

**Column types:**
| type | Behaviour |
|------|-----------|
| `text` | Plain input on edit |
| `select` | `<select>` that opens immediately on first click (showPicker) |
| `status` | Badge pill + select to edit |
| `date` | `<input type="date">` |
| `num` | `<input type="number">` |
| `link` | Clickable — email opens compose panel, socials open in new tab |
| `company` | Autocomplete from Company doctype, auto-create if not found (optimistic) |
| `owner` | Avatar circle (initials), hover shows name/email/location popup |
| `maps` | Shows map preview on hover, expand to full modal |
| `files` | Shows file grid on hover, expand to full modal, click opens file in new tab |
| `drawing` | Pencil icon, opens frappe_drawing.js canvas modal |
| `rownum` | Row index, click = select row, drag = range select |
| `phone` | Plain text display, future: click-to-call |

### 5.2 Floating Edit Input

```css
position: fixed   /* overlay — never displaces layout */
inset: 0          /* matches td exactly */
border: 2px solid #2563eb
border-radius: 3px
animation: pg-float-in 0.14s  /* scaleY from 0.6 */
```

Close triggers: Escape (discard), Enter/Tab (save + nav right), blur (save), scroll (save).  
Scroll position is preserved on save.

### 5.3 Badges / Status Pills

```html
<span class="pg-badge pg-badge-blue">In Discussion</span>
```

Classes: `pg-badge-blue` `pg-badge-amber` `pg-badge-gray` `pg-badge-green` `pg-badge-red`  
Shape: `border-radius:99px; padding:2px 9px; font-size:11px; font-weight:650`

### 5.4 Buttons

**Primary action** (Save, Confirm):
```css
background: linear-gradient(135deg, #2563eb, #1d4ed8)
border: none; border-radius: 99px; padding: 6px 22px; font-weight: 600
```

**Toolbar action** (Export, Add Row):
```css
border: 1.5px solid #e8e8f0; border-radius: 99px; height: 32px; padding: 0 14px
background: #fff; color: #374151; font-size: 12px; font-weight: 500
hover → background: #f8fafc
```

**Icon button** (circle, 30px):
```css
width:30px; height:30px; border-radius:99px
border: 1px solid #e8e8f0; background: transparent; color: #64748b
hover → background:#f1f5f9; border-color:#cbd5e1; color:#1e293b
active/selected → background:#eff6ff; border-color:#bfdbfe; color:#2563eb
```

**Danger / Close X** (hover only):
```css
hover → background: #fee2e2; color: #dc2626; box-shadow: 0 0 0 3px #fecaca
border-radius: 50%
```

### 5.5 Popups / Hover Panels

- Default: `pointer-events:none` — invisible to mouse, won't steal clicks
- When visible (`.pg-popup-vis`): `pointer-events:all` — mouse can enter
- Timer pattern: 180ms delay before close; entering popup cancels timer
- Expand button: top-left corner (6px from each edge), opens 80vw × 80vh modal
- Shell: `border-radius:12px; border:1.5px solid #e8e8f0; box-shadow:0 8px 24px rgba(0,0,0,0.1)`

### 5.6 Modal / Dialog

```
Frappe size:    "extra-large" for drawing/compose, "large" for confirmations
Body padding:   0 (let inner component control its own padding)
Footer:         border-top: 1.5px solid #e8e8f0; padding: 10px 16px
Close X:        28×28 circle, red glow on hover
```

### 5.7 Email Compose Panel

- Outlook-style floating panel (fixed, right-anchored)
- TO field: tag-input (typed addresses become pill tags, × to remove)
- Autocomplete: queries Prospect by name/email as you type, replaces current segment
- Broadcast button (+): opens bulk-select modal with search + checkboxes
- Send: `frappe.core.doctype.communication.email.make` with `send_email:1`
- Error on missing email account: msgprint with link to `/app/email-account`

### 5.8 Autocomplete Dropdown (company / link fields)

```css
position: fixed; z-index: 100001
border: 1.5px solid #e8e8f0; border-radius: 10px
box-shadow: 0 8px 24px rgba(0,0,0,0.1)
max-height: 220px; overflow-y: auto
```

Item: `padding: 7px 13px; font-size: 12.5px`  
Active item: `background: #eff6ff; color: #1e40af`  
Create option: `color: #2563eb; border-top: 1px solid #e8e8f0` with + icon

---

## 6. Page Layout (desktop)

```
.gl-host wrapper:   padding: 12px 16px 32px
Frappe chrome:      hidden (page-head, filters, toolbar, list-row-head all display:none)
Tab bar:            Pill tabs in header row — active pill: white bg, blue text, blue shadow
Header gradient:    Navy (1e3a8a → 2d52a8) with white text and pill tab buttons
```

---

## 7. Mobile Row Pattern — THE MESH mobile unit

Each record = one row card:

```
┌─────────────────────────────────────────────────────────┐
│  Mr Anthony Karam                  📞  💬  ✉  📍       │
│  Achi Scaffolding · Lead                                 │
└─────────────────────────────────────────────────────────┘
```

**Structure:**
```
.mesh-row
  .mesh-row-left
    .mesh-row-name     — salutation + first + last (15px, weight 600, #111827)
    .mesh-row-sub      — company · status badge (12px, #64748b)
  .mesh-row-actions
    [call icon]  [whatsapp icon]  [email icon]  [maps icon]
```

**Sizing:**
```
Row height:     56px (min) — auto-grows for long names
Padding:        12px 16px
Name:           15px, weight 600
Sub:            12px, color #64748b
Action icons:   36×36px circles, border: 1px solid #e8e8f0
  call   → color #16a34a (green)
  whatsapp → color #16a34a (green)
  email  → color #2563eb (blue)
  maps   → color #d97706 (amber)
Separator:      1px solid #f1f5f6 between rows
```

**Touch interactions:**
- Tap row → opens detail sheet (bottom drawer, 80vh)
- Long-press → enters selection mode (checkboxes appear)
- Swipe left → reveals quick actions (same icons, larger)
- Pull-to-refresh → reloads data

**Status colours** mirror desktop badge colours. Shown inline after company name with a `·` separator.

---

## 8. Drawing Plugin (frappe_drawing.js)

Toolbar: white, `border-bottom: 1.5px solid #e8e8f0`  
Tool buttons: 30px circles, `border-radius:99px`, blue active state  
Unit selector: pill (`border-radius:99px`), preceded by "Units" label  
Undo/Redo: pill buttons with SVG icons  
Canvas: fills 100% of modal width (measured post-layout via double-RAF)  
Accent: `#2563eb` for selection box, arc draft, chain anchor  
Close X: 28px circle, red glow on hover

---

## 9. Rules for AI Prompting

When asking an AI to build or modify a component, include this block:

```
DESIGN SYSTEM (THE MESH):
- Primary blue: #2563eb, Light blue bg: #eff6ff, Navy header gradient: #1e3a8a → #2d52a8
- Surface border: 1.5px solid #e8e8f0, Border radius: cards=12px, buttons/pills=99px
- Row height 36px, cell padding 0 12px, base font 13px, label font 11px uppercase weight 650
- Buttons: pill shape, gradient primary, icon buttons are 30px circles
- Badges: pg-badge-blue/amber/gray/green/red classes, 11px 650 weight pills
- Active/selected: background #eff6ff, border #bfdbfe, text/icon #2563eb
- Hover state on close/delete: background #fee2e2, color #dc2626, glow #fecaca ring
- No hover row highlight — selection always wins via CSS specificity
- Optimistic saves: update UI first, sync to server in background
- Dropdowns open on FIRST click (showPicker / el.click())
- All popups: pointer-events:none by default, pointer-events:all when visible
- Mobile row: name (weight 600) + company·status sub-line + 36px action icon circles
```

---

## 10. File Map

| File | Role |
|------|------|
| `prospect_grid.js` | **Golden standard component** — PG mount, rendering, editing, popups, email compose |
| `prospect_list.js` | Prospect page config + column schema + export leads/contacts |
| `frappe_drawing.js` | Canvas drawing modal — standalone, consumed by grid's `drawing` cell type |
| `grid_core.js` | Shared GL bootstrap utilities |
| `quick_launch.js` | App launcher / home screen |
| `custom_sidebar_hover.js` | Sidebar interaction enhancement |

---

## 11. What NOT to do

- ❌ Don't add hover background colour to rows (cells provide enough context)
- ❌ Don't use Frappe's default `frappe.ui.FileUploader` — use direct fetch POST to `/api/method/upload_file`
- ❌ Don't require two clicks to open a dropdown or activate a cell
- ❌ Don't block the UI waiting for a server response on saves
- ❌ Don't use `border-radius: 6px` on buttons — use `99px` (pill) or `50%` (circle)
- ❌ Don't add comments explaining *what* code does — only add them for *why* (hidden constraint, workaround)
- ❌ Don't create new Company/Lead/Contact without first checking for duplicates by email
- ❌ Don't use `frappe.core.doctype.communication.communication.make` — use `frappe.core.doctype.communication.email.make`
