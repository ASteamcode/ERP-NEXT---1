/* ─────────────────────────────────────────────────────────────────
   ProspectGrid (PG) — pill-tab sticky spreadsheet with inline editing
   Config: { tabs, fixed, cols, rows,
             editable?, doctype?,
             onEdit?(name,field,val), onAddRow?(reload),
             onDeleteRows?(names,reload), onExportLeads?(rows,reload) }
   window.PG = { mount, setTab, injectStyles, getSelected }
───────────────────────────────────────────────────────────────── */
(function () {
    "use strict";

    const STYLE_VER = "pg-v2";

    // ── CSS ────────────────────────────────────────────────────────
    const CSS = `
/* shell */
.pg-shell{background:#fff;border-radius:12px;border:1.5px solid #e8e8f0;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);}

/* nav row — CSS grid gives true centering: left | center | right */
.pg-nav-row{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  padding:10px 14px;
  gap:8px;
  position:relative;
  z-index:20;
  background:#fff;
  border-bottom:1.5px solid #e8e8f0;
}
.pg-nav-left{display:flex;align-items:center;gap:6px;justify-content:flex-start;}
.pg-nav-center{display:flex;justify-content:center;align-items:center;}
.pg-nav-right{display:flex;align-items:center;gap:8px;justify-content:flex-end;}

/* pill track */
.pg-pill-track{position:relative;display:inline-flex;align-items:center;background:#f0f0f5;border-radius:99px;padding:4px;gap:0;box-shadow:0 2px 12px rgba(0,0,0,.10),0 1px 3px rgba(0,0,0,.06);}
.pg-pill-ind{position:absolute;top:4px;bottom:4px;left:0;background:#fff;border-radius:99px;box-shadow:0 1px 4px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.07);transition:left .28s cubic-bezier(.4,0,.2,1),width .28s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:0;width:0;}
.pg-pill{position:relative;z-index:1;padding:7px 18px;border:none;background:transparent;border-radius:99px;font-size:12.5px;font-weight:600;color:#9ca3af;cursor:pointer;transition:color .2s;white-space:nowrap;line-height:1;}
.pg-pill:hover{color:#6b7280;}
.pg-pill.active{color:#111827;}

/* table wrapper — z-index must stay below nav (nav is z-index:20) */
.pg-tbl-outer{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#e5e7eb transparent;position:relative;z-index:0;}
.pg-tbl-outer::-webkit-scrollbar{height:4px;}
.pg-tbl-outer::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:99px;}

/* table */
.pg-tbl{width:100%;border-collapse:separate;border-spacing:0;}
.pg-tbl th{background:#f8f8fc;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;padding:0 14px;height:38px;text-align:left;border-bottom:2px solid #e8e8f0;white-space:nowrap;}
.pg-tbl td{font-size:12.5px;color:#374151;padding:0 14px;height:46px;border-bottom:1px solid #f0f0f5;white-space:nowrap;vertical-align:middle;background:#fff;position:relative;}
.pg-tr-alt td{background:#fafafa;}
.pg-tbl tr:hover td{background:#dbeafe !important;}

/* sticky fixed cols */
.pg-f{position:sticky;z-index:2;}
.pg-tbl td.pg-f{background:#fff;}
.pg-tr-alt td.pg-f{background:#fafafa;}
.pg-tbl tr:hover td.pg-f{background:#f5f8ff !important;}
.pg-tbl th.pg-f{z-index:3;background:#f8f8fc;}
.pg-f-shadow{box-shadow:2px 0 6px -1px rgba(0,0,0,.09);}
.pg-tbl th.pg-f-shadow{box-shadow:2px 0 6px -1px rgba(0,0,0,.07);}

/* variable cols */
.pg-v{display:none;min-width:0;width:auto;white-space:nowrap;position:relative;z-index:0;}
@keyframes pg-col-in{from{opacity:0;transform:translateX(var(--pg-dir,22px))}to{opacity:1;transform:none}}

/* row selection — selected wins over hover */
.pg-tbl tr:hover td,.pg-tbl tr:hover td.pg-f{background:#eff6ff !important;}
.pg-row-sel td,.pg-row-sel td.pg-f{background:#bfdbfe !important;}
.pg-row-sel:hover td,.pg-row-sel:hover td.pg-f{background:#93c5fd !important;}
.pg-f-num-cell{cursor:pointer;user-select:none;text-align:center;color:#cbd5e1;font-size:11px;font-weight:700;transition:color .12s;}
.pg-f-num-cell:hover{color:#2563eb;}
.pg-row-num{display:inline-block;min-width:18px;text-align:center;}
.pg-row-sel .pg-f-num-cell{color:#2563eb;font-weight:800;}

/* inline edit */
.pg-ed{cursor:text;}
.pg-ed:hover{outline:1px solid #bfdbfe;outline-offset:-1px;}
.pg-float-wrap{position:fixed;z-index:99999;pointer-events:none;}
@keyframes pg-float-in{from{opacity:0;transform:scaleY(.6) scaleX(.97);box-shadow:none}to{opacity:1;transform:none;box-shadow:0 4px 20px rgba(37,99,235,.18);}}
.pg-float-input,.pg-float-select{position:absolute;inset:0;width:100%;height:100%;border:2px solid #2563eb;border-radius:3px;background:#fff;padding:0 12px;font-size:12.5px;font-family:inherit;color:#111827;outline:none;box-sizing:border-box;pointer-events:all;transform-origin:top center;animation:pg-float-in .14s cubic-bezier(.2,0,.2,1) both;}
.pg-float-select{padding:0 8px;cursor:pointer;}

/* status badges */
.pg-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:650;white-space:nowrap;}
.pg-badge-blue  {background:#eff6ff;color:#2563eb;}
.pg-badge-amber {background:#fffbeb;color:#d97706;}
.pg-badge-gray  {background:#f3f4f6;color:#6b7280;}
.pg-badge-green {background:#ecfdf5;color:#059669;}
.pg-badge-red   {background:#fef2f2;color:#dc2626;}

/* cell types */
.pg-lnk{color:#2563eb;text-decoration:none;font-size:12.5px;display:inline-flex;align-items:center;gap:3px;cursor:default;}
.pg-lnk-ext{font-size:10px;color:#93c5fd;}
.pg-ph{font-variant-numeric:tabular-nums;color:#374151;letter-spacing:.01em;}
.pg-num-val{font-variant-numeric:tabular-nums;color:#374151;font-weight:600;}
.pg-mt{color:#d1d5db;}

/* maps */
.pg-maps-cell{display:inline-flex;align-items:center;gap:5px;}
.pg-maps-btn{display:inline-flex;align-items:center;gap:5px;color:#2563eb;text-decoration:none;font-size:12.5px;font-weight:500;padding:4px 10px 4px 8px;border-radius:20px;background:#eff6ff;transition:background .15s;white-space:nowrap;}
.pg-maps-btn:hover{background:#dbeafe;}
.pg-maps-pin{width:14px;height:14px;color:#ef4444;stroke:currentColor;flex-shrink:0;}
.pg-map-edit{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px solid #2563eb;background:#eff6ff;color:#2563eb;cursor:pointer;transition:background .15s,border-color .15s;flex-shrink:0;padding:0;}
.pg-map-edit:hover{background:#dbeafe;}

/* files */
.pg-files{display:inline-flex;align-items:center;gap:6px;}
.pg-file-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.pg-file-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.pg-cam-btn:hover{background:#f0fdf4 !important;border-color:#16a34a !important;color:#16a34a !important;}
.pg-file-ico{width:13px;height:13px;}

/* drawing button — circle matching file buttons */
.fd-icon-btn.fd-draw-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;padding:0;}
.fd-icon-btn.fd-draw-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has{background:#eff6ff;border-color:#2563eb;border-style:solid;color:#2563eb;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has:hover{background:#dbeafe;}

/* search */
.pg-search-wrap{position:relative;display:flex;align-items:center;}
.pg-search-icon{position:absolute;left:10px;width:14px;height:14px;color:#9ca3af;pointer-events:none;flex-shrink:0;}
.pg-search{height:32px;padding:0 12px 0 30px;border:1.5px solid #e0e0ea;border-radius:99px;font-size:12px;font-family:inherit;color:#374151;background:#fff;outline:none;width:170px;transition:border-color .15s,width .2s;}
.pg-search::placeholder{color:#9ca3af;}
.pg-search:focus{border-color:#2563eb;width:210px;}
.pg-search:focus + .pg-search-icon,.pg-search-wrap:focus-within .pg-search-icon{color:#2563eb;}

/* toolbar buttons (now in nav row) */
.pg-tb-add{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #e0e0ea;border-radius:99px;background:#fff;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s;white-space:nowrap;}
.pg-tb-add:hover{border-color:#2563eb;color:#2563eb;background:#eff6ff;}
.pg-tb-exp{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #d1fae5;border-radius:99px;background:#f0fdf4;color:#059669;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s;white-space:nowrap;}
.pg-tb-exp:hover{background:#dcfce7;border-color:#059669;}
.pg-tb-del{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #fecaca;border-radius:99px;background:#fff;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap;opacity:0;pointer-events:none;max-width:0;overflow:hidden;padding-left:0;padding-right:0;border-width:0;}
.pg-tb-del.pg-tb-del-on{opacity:1;pointer-events:all;max-width:180px;padding:6px 14px;border-width:1.5px;}
.pg-tb-del:hover{background:#fef2f2;}
.pg-tb-cnt{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:99px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:0 4px;}
`;

    const SVG = {
        pin:    `<svg class="pg-maps-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        pen:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pg-file-ico"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pg-file-ico"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
        plus:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:13px;height:13px"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>`,
        trash:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:13px;height:13px"><polyline points="2,4 14,4"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M6 7v5m4-5v5"/><rect x="3" y="4" width="10" height="9" rx="1.5"/></svg>`,
        export: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:13px;height:13px"><path d="M9 2h4v4"/><path d="M13 2L8 7"/><path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V9"/></svg>`,
        search: `<svg class="pg-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>`,
    };

    // ── Style injection ────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById(STYLE_VER)) return;
        const s = document.createElement("style");
        s.id = STYLE_VER;
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    // ── Cell renderers ─────────────────────────────────────────────
    function renderCell(col, row) {
        const v = row[col.key];
        const empty = v == null || v === "" || v === "—";
        switch (col.type) {
            case "text":
            case "select":
            case "link":
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
            case "date": {
                const fmt = v ? frappe.datetime.str_to_user(v) : "";
                return fmt ? `<span>${_e(fmt)}</span>` : `<span class="pg-mt">—</span>`;
            }
            case "phone":
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-ph">${_e(v)}</span>`;
            case "num":
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-num-val">${_e(v)}</span>`;
            case "status": {
                const cls = (col.map || {})[v] || "pg-badge-gray";
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-badge ${cls}">${_e(v)}</span>`;
            }
            case "maps": {
                const url = v || "";
                if (!url) return `<span class="pg-mt">—</span>`;
                return (
                    `<span class="pg-maps-cell">` +
                    `<a class="pg-maps-btn" href="${_e(url)}" target="_blank" onclick="event.stopPropagation()">${SVG.pin}<span>Open in Maps</span></a>` +
                    `<button class="pg-map-edit" title="Edit link">${SVG.pen}</button>` +
                    `</span>`
                );
            }
            case "files":
                return `<span class="pg-files"><button class="pg-file-btn" title="Upload file">${SVG.upload}</button><button class="pg-file-btn pg-cam-btn" title="Take photo">${SVG.camera}</button></span>`;
            case "drawing":
                return typeof frappe_drawing !== "undefined"
                    ? frappe_drawing.render_btn(_e(row.name || ""), row.has_drawing)
                    : `<button class="fd-icon-btn fd-draw-btn" data-name="${_e(row.name||'')}" title="Drawing">${SVG.pen}</button>`;
            default:
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
        }
    }

    // ── Row / header builders ──────────────────────────────────────
    function buildTabRevealCSS(n) {
        return Array.from({ length: n }, (_, i) =>
            `.pg-tbl[data-tab="${i}"] .pg-v-${i}`
        ).join(",") + `{display:table-cell;animation:pg-col-in .15s cubic-bezier(.2,0,.2,1) both}`;
    }

    function buildHeader(cfg) {
        const fixed = cfg.fixed.map(f =>
            `<th class="pg-f ${f.cls||""}${f.shadow?" pg-f-shadow":""}">${f.label}</th>`
        ).join("");
        const vars = cfg.cols.map(c =>
            `<th class="pg-v pg-v-${c.tab}">${c.label}</th>`
        ).join("");
        return `<tr>${fixed}${vars}</tr>`;
    }

    function buildRow(cfg, row, idx) {
        const name = row.name || "";
        // Fixed cols
        const fixed = cfg.fixed.map(f => {
            const v = row[f.key];
            if (f.type === "rownum") {
                return `<td class="pg-f ${f.cls||""} pg-f-num-cell" data-row-name="${_e(name)}" style="position:sticky;left:0;min-width:${f.width||42}px;width:${f.width||42}px"><span class="pg-row-num">${idx+1}</span></td>`;
            }
            const ed = cfg.editable && f.frappe_field;
            return `<td class="pg-f ${f.cls||""}${f.shadow?" pg-f-shadow":""}${ed?" pg-ed":""}"${ed?` data-ff="${_e(f.frappe_field)}" data-val="${_e(v!=null?String(v):"")}" data-ctype="${f.type||"text"}" data-ckey="${_e(f.key)}"`:""} data-row-name="${_e(name)}">${v!=null?_e(String(v)):"—"}</td>`;
        }).join("");
        // Variable cols
        const vars = cfg.cols.map(c => {
            const ed = cfg.editable && c.frappe_field && c.type !== "files" && c.type !== "drawing";
            const v  = row[c.key];
            const rawVal = v != null && v !== "—" ? String(v) : "";
            return `<td class="pg-v pg-v-${c.tab}${ed?" pg-ed":""}"${ed?` data-ff="${_e(c.frappe_field)}" data-val="${_e(rawVal)}" data-ctype="${c.type||"text"}" data-ckey="${c.key}"`:""} data-row-name="${_e(name)}">${renderCell(c, row)}</td>`;
        }).join("");
        return `<tr class="${idx%2?"pg-tr-alt":""}" data-row-name="${_e(name)}">${fixed}${vars}</tr>`;
    }

    // ── Mount ──────────────────────────────────────────────────────
    function mount(el, cfg) {
        injectStyles();
        el._pgCfg = cfg;

        const n = cfg.tabs.length;
        const dynId = "pg-tabs-" + n;
        if (!document.getElementById(dynId)) {
            const s = document.createElement("style");
            s.id = dynId;
            s.textContent = buildTabRevealCSS(n);
            document.head.appendChild(s);
        }

        let left = 0;
        cfg.fixed.forEach(f => { f._left = left; left += (f.width || 120); });

        const pillsHtml = cfg.tabs.map((label, i) =>
            `<button class="pg-pill${i===0?" active":""}" data-tab="${i}">${label}</button>`
        ).join("");
        const rowsHtml = cfg.rows.map((r, i) => buildRow(cfg, r, i)).join("");

        el.innerHTML = `<div class="pg-shell">
  <div class="pg-nav-row">
    <div class="pg-nav-left">
      <button class="pg-tb-add">${SVG.plus} Add Row</button>
      <button class="pg-tb-del">${SVG.trash} Delete <span class="pg-tb-cnt">0</span></button>
    </div>
    <div class="pg-nav-center">
      <div class="pg-pill-track">
        <div class="pg-pill-ind"></div>
        ${pillsHtml}
      </div>
    </div>
    <div class="pg-nav-right">
      <div class="pg-search-wrap">
        ${SVG.search}
        <input type="text" class="pg-search" placeholder="Search prospects…">
      </div>
      <button class="pg-tb-exp">${SVG.export} Export Leads</button>
    </div>
  </div>
  <div class="pg-tbl-outer">
    <table class="pg-tbl" data-tab="0">
      <thead>${buildHeader(cfg)}</thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</div>`;

        // Apply sticky offsets — must set left+width inline; CSS class sets position:sticky
        const tblOuter = el.querySelector(".pg-tbl-outer");
        cfg.fixed.forEach((f, fi) => {
            tblOuter.querySelectorAll(`.pg-f:nth-child(${fi+1})`).forEach(cell => {
                cell.style.position = "sticky";
                cell.style.left     = f._left + "px";
                cell.style.minWidth = (f.width||120) + "px";
                cell.style.width    = (f.width||120) + "px";
            });
        });

        _wire(el, cfg);

        // Use rAF so layout is complete before measuring pill position
        requestAnimationFrame(() => {
            _positionInd(el.querySelector(".pg-pill.active"));
        });
    }

    // ── Tab switch ─────────────────────────────────────────────────
    function setTab(shellEl, n) {
        const pill = shellEl.querySelector(`.pg-pill[data-tab="${n}"]`);
        if (pill) pill.click();
    }

    function getSelected(el) {
        return Array.from(el.querySelectorAll(".pg-row-sel")).map(tr => tr.dataset.rowName);
    }

    // ── Floating edit input (one shared per page) ──────────────────
    let _eFl = null;  // floating wrapper div
    let _eIn = null;  // input or select inside
    let _eTd = null;  // active td
    let _eRoot = null;

    function _ensureFloat() {
        if (_eFl) return;
        _eFl = document.createElement("div");
        _eFl.className = "pg-float-wrap";
        document.body.appendChild(_eFl);
    }

    function _openEdit(root, td) {
        _ensureFloat();
        _closeEdit(true);

        const cfg   = root._pgCfg;
        const ctype = td.dataset.ctype || "text";
        const val   = td.dataset.val   || "";
        const ckey  = td.dataset.ckey  || "";
        const col   = (cfg.cols || []).find(c => c.key === ckey)
                   || (cfg.fixed || []).find(f => f.key === ckey)
                   || {};

        const rect = td.getBoundingClientRect();
        _eFl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:99999;pointer-events:none;`;

        let el;
        if (ctype === "status") {
            el = document.createElement("select");
            el.className = "pg-float-select";
            const opts = Object.keys(col.map || {});
            ["", ...opts].forEach(o => {
                const opt = document.createElement("option");
                opt.value = o; opt.textContent = o || "—";
                if (o === val) opt.selected = true;
                el.appendChild(opt);
            });
        } else if (ctype === "select") {
            el = document.createElement("select");
            el.className = "pg-float-select";
            (col.options || []).forEach(o => {
                const opt = document.createElement("option");
                opt.value = o; opt.textContent = o || "—";
                if (o === val) opt.selected = true;
                el.appendChild(opt);
            });
        } else if (ctype === "date") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "date";
            el.value = val;
        } else if (ctype === "maps") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "text";
            el.value = val;
            el.placeholder = "Paste Google Maps URL…";
        } else {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = ctype === "num" ? "number" : "text";
            el.value = val;
        }

        _eFl.innerHTML = "";
        _eFl.appendChild(el);
        _eIn  = el;
        _eTd  = td;
        _eRoot = root;
        el.focus();
        if (el.tagName === "INPUT") { try { el.select(); } catch(e){} }

        el.addEventListener("blur",    () => { setTimeout(() => _closeEdit(true), 80); });
        el.addEventListener("keydown", e => {
            if (e.key === "Escape") { _closeEdit(false); e.preventDefault(); return; }
            if (e.key === "Tab")   { _closeEdit(true); e.preventDefault(); return; }
            if (e.key === "Enter") { e.preventDefault(); _closeEdit(true); _navCell(root, td, e.shiftKey ? "left" : "right"); return; }

            const isText = el.tagName === "INPUT" && (el.type === "text" || el.type === "url" || el.type === "");
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                _closeEdit(true);
                _navCell(root, td, e.key === "ArrowDown" ? "down" : "up");
            } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                // In a text input let the cursor move freely; only navigate when already at the edge
                if (isText) {
                    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
                    const atEnd   = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
                    if (e.key === "ArrowLeft"  && !atStart) return;
                    if (e.key === "ArrowRight" && !atEnd)   return;
                }
                e.preventDefault();
                _closeEdit(true);
                _navCell(root, td, e.key === "ArrowRight" ? "right" : "left");
            }
        });
    }

    function _closeEdit(save) {
        if (!_eIn || !_eTd) return;
        const newVal = _eIn.value;
        const td = _eTd, root = _eRoot;
        _eTd = null; _eIn = null; _eRoot = null;
        if (_eFl) _eFl.innerHTML = "";

        if (!save || newVal === td.dataset.val) return;

        const name = td.dataset.rowName;
        const ff   = td.dataset.ff;
        const ctype = td.dataset.ctype;
        const ckey  = td.dataset.ckey;

        // Update stored val
        td.dataset.val = newVal;

        // Update display
        const cfg = root._pgCfg;
        const col = (cfg.cols || []).find(c => c.key === ckey)
                 || (cfg.fixed || []).find(f => f.key === ckey)
                 || {};
        const row = { [ckey || ""]: newVal, name };
        if (ckey) {
            td.innerHTML = renderCell(Object.assign({}, col, { key: ckey || "" }), row);
        } else {
            td.textContent = newVal;
        }

        // Update row data
        const rowObj = (cfg.rows || []).find(r => r.name === name);
        if (rowObj && ckey) rowObj[ckey] = newVal;

        if (cfg.onEdit && name && ff) cfg.onEdit(name, ff, newVal);
    }

    // Navigate to an adjacent cell in any of the four directions
    function _navCell(root, fromTd, direction) {
        const tbl      = root.querySelector(".pg-tbl");
        const tabN     = parseInt(tbl.getAttribute("data-tab") || 0);
        const tabCount = (root._pgCfg.tabs || []).length;
        const rowName  = fromTd.dataset.rowName;

        if (direction === "up" || direction === "down") {
            // Same column index, adjacent row
            const colIdx  = fromTd.cellIndex;
            const rows    = Array.from(tbl.querySelectorAll("tbody tr")).filter(tr => tr.style.display !== "none");
            const curRow  = fromTd.closest("tr");
            const rowIdx  = rows.indexOf(curRow);
            const nextIdx = direction === "down" ? rowIdx + 1 : rowIdx - 1;
            if (nextIdx < 0 || nextIdx >= rows.length) return;
            const nextTd = rows[nextIdx].cells[colIdx];
            if (nextTd && nextTd.classList.contains("pg-ed")) _openEdit(root, nextTd);
            return;
        }

        // Left / right — stay on same row, switch tab at edge
        const hDir   = direction === "right" ? 1 : -1;
        const rowEd  = (t) => Array.from(tbl.querySelectorAll("td.pg-ed")).filter(td =>
            td.dataset.rowName === rowName &&
            (td.classList.contains("pg-f") || td.classList.contains(`pg-v-${t}`))
        );
        const allEd  = rowEd(tabN);
        const idx    = allEd.indexOf(fromTd);
        if (idx === -1) return;
        const next   = allEd[idx + hDir];
        if (next) { _openEdit(root, next); return; }

        // End of tab's columns for this row — switch tab, same row
        const nextTab = tabN + hDir;
        if (nextTab < 0 || nextTab >= tabCount) return;
        root.querySelector(`.pg-pill[data-tab="${nextTab}"]`).click();
        requestAnimationFrame(() => {
            const newEd = Array.from(tbl.querySelectorAll("td.pg-ed")).filter(td =>
                td.dataset.rowName === rowName && td.classList.contains(`pg-v-${nextTab}`)
            );
            const target = hDir > 0 ? newEd[0] : newEd[newEd.length - 1];
            if (target) _openEdit(root, target);
        });
    }

    // ── Row selection ──────────────────────────────────────────────
    let _dragSelStart = -1, _dragSelActive = false;

    function _toggleRow(root, tr, force) {
        const on = force !== undefined ? force : !tr.classList.contains("pg-row-sel");
        tr.classList.toggle("pg-row-sel", on);
        _refreshToolbar(root);
    }

    function _refreshToolbar(root) {
        const sel = root.querySelectorAll(".pg-row-sel").length;
        const btn = root.querySelector(".pg-tb-del");
        const cnt = root.querySelector(".pg-tb-cnt");
        if (btn) btn.classList.toggle("pg-tb-del-on", sel > 0);
        if (cnt) cnt.textContent = sel;
    }

    // ── Full wiring ────────────────────────────────────────────────
    function _wire(root, cfg) {
        const tabCount = cfg.tabs.length;
        let _wt = 0, _ts = null;
        const outer = root.querySelector(".pg-tbl-outer");
        const tbody = root.querySelector("tbody");

        // ── Pill click ──────────────────────────────────────────
        root.addEventListener("click", e => {
            const pill = e.target.closest(".pg-pill");
            if (pill) _activatePill(root, pill, tabCount);
        });

        // ── Wheel tab switch on table scroll area ───────────────
        outer.addEventListener("wheel", e => {
            const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
            if (ax <= ay || ax < 8) return;
            e.preventDefault();
            const now = Date.now();
            if (now - _wt < 450) return;
            _wt = now;
            _stepTab(root, tabCount, e.deltaX);
        }, { passive: false });

        // ── Touch swipe ─────────────────────────────────────────
        root.addEventListener("touchstart", e => { _ts = e.touches[0].clientX; }, { passive: true });
        root.addEventListener("touchend",   e => {
            if (_ts === null) return;
            const dx = e.changedTouches[0].clientX - _ts; _ts = null;
            if (Math.abs(dx) < 40) return;
            _stepTab(root, tabCount, -dx);
        });

        // ── Row number: click to select/deselect, drag to range-select ─
        tbody.addEventListener("mousedown", e => {
            const numTd = e.target.closest(".pg-f-num-cell");
            if (!numTd) return;
            e.preventDefault();
            const tr   = numTd.closest("tr");
            const rows = Array.from(tbody.children);
            _dragSelStart  = rows.indexOf(tr);
            _dragSelActive = true;
            if (e.shiftKey) {
                _toggleRow(root, tr);
            } else {
                const wasSel  = tr.classList.contains("pg-row-sel");
                const selOnly = root.querySelectorAll(".pg-row-sel").length === 1 && wasSel;
                rows.forEach(r => r.classList.remove("pg-row-sel"));
                // Re-select only if it wasn't the sole selection (i.e. clicking sole selected row deselects)
                if (!selOnly) { _toggleRow(root, tr, true); } else { _refreshToolbar(root); }
            }
        });

        document.addEventListener("mousemove", e => {
            if (!_dragSelActive) return;
            const numTd = e.target.closest(".pg-f-num-cell");
            if (!numTd || !numTd.closest("tbody")) return;
            const rows = Array.from(tbody.children);
            const curIdx = rows.indexOf(numTd.closest("tr"));
            if (curIdx < 0) return;
            const lo = Math.min(_dragSelStart, curIdx);
            const hi = Math.max(_dragSelStart, curIdx);
            rows.forEach((r, i) => _toggleRow(root, r, i >= lo && i <= hi));
        });

        document.addEventListener("mouseup", () => { _dragSelActive = false; });

        // ── Deselect on outside click or Escape ─────────────────
        const _clearSel = () => {
            root.querySelectorAll(".pg-row-sel").forEach(r => r.classList.remove("pg-row-sel"));
            _refreshToolbar(root);
        };
        document.addEventListener("mousedown", e => {
            if (_dragSelActive) return;
            if (!root.contains(e.target)) _clearSel();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && !_eIn) _clearSel();
        });

        // ── Inline edit: click on editable cell ─────────────────
        if (cfg.editable) {
            root.addEventListener("click", e => {
                if (e.target.closest(".pg-maps-btn")) return; // let the link open
                const td = e.target.closest("td.pg-ed");
                if (!td) return;
                _openEdit(root, td);
            });
        }

        // ── File upload / camera ────────────────────────────────
        root.addEventListener("click", e => {
            const uploadBtn = e.target.closest(".pg-file-btn:not(.pg-cam-btn)");
            const camBtn    = e.target.closest(".pg-cam-btn");
            if (!uploadBtn && !camBtn) return;
            e.stopPropagation();
            const td   = (uploadBtn || camBtn).closest("td");
            const name = td && td.dataset.rowName;
            if (!name) return;
            const inp = document.createElement("input");
            inp.type   = "file";
            inp.style.display = "none";
            if (camBtn) {
                inp.accept  = "image/*";
                inp.capture = "environment";
            }
            inp.onchange = () => {
                const file = inp.files && inp.files[0];
                if (!file) return;
                const uploader = new frappe.ui.FileUploader({
                    doctype: cfg.doctype || "Prospect",
                    docname: name,
                    file_obj: file,
                    on_success(f) {
                        frappe.show_alert({ message: `Uploaded: ${f.file_name}`, indicator: "green" }, 3);
                    },
                });
                uploader.upload_file();
            };
            document.body.appendChild(inp);
            inp.click();
            inp.addEventListener("change", () => document.body.removeChild(inp), { once: true });
        });

        // ── Drawing button ──────────────────────────────────────
        root.addEventListener("click", e => {
            const btn = e.target.closest(".fd-draw-btn");
            if (!btn) return;
            e.stopPropagation();
            const name = btn.dataset.name;
            if (!name || typeof frappe_drawing === "undefined") return;
            frappe_drawing.open({
                doctype: "Prospect",
                docname: name,
                drawing_field: "custom_drawing",
                has_drawing_field: "custom_has_drawing",
                on_saved(hasShapes) {
                    const rowObj = (cfg.rows || []).find(r => r.name === name);
                    if (rowObj) rowObj.has_drawing = hasShapes ? 1 : 0;
                    if (cfg.onReload) cfg.onReload();
                },
            });
        });

        // ── Search ──────────────────────────────────────────────
        const $search = root.querySelector(".pg-search");
        if ($search) {
            $search.addEventListener("input", () => {
                const q = $search.value.trim().toLowerCase();
                root.querySelectorAll("tbody tr").forEach(tr => {
                    if (!q) { tr.style.display = ""; return; }
                    const text = tr.textContent.toLowerCase();
                    tr.style.display = text.includes(q) ? "" : "none";
                });
            });
        }

        // ── Toolbar buttons ─────────────────────────────────────
        root.querySelector(".pg-tb-add").addEventListener("click", () => {
            if (cfg.onAddRow) cfg.onAddRow(() => _reload(root));
        });

        root.querySelector(".pg-tb-del").addEventListener("click", () => {
            const names = getSelected(root);
            if (!names.length) return;
            if (cfg.onDeleteRows) cfg.onDeleteRows(names, () => _reload(root));
        });

        root.querySelector(".pg-tb-exp").addEventListener("click", () => {
            if (cfg.onExportLeads) cfg.onExportLeads(cfg.rows, () => _reload(root));
        });
    }

    function _reload(root) {
        if (root._pgCfg && root._pgCfg.onReload) root._pgCfg.onReload();
    }

    function _positionInd(pill, animate) {
        if (!pill) return;
        const track = pill.closest(".pg-pill-track");
        const ind   = track && track.querySelector(".pg-pill-ind");
        if (!ind || !track) return;
        const tr = track.getBoundingClientRect();
        const pr = pill.getBoundingClientRect();
        if (!animate) {
            ind.style.transition = "none";
            requestAnimationFrame(() => { ind.style.transition = ""; });
        }
        ind.style.left  = (pr.left - tr.left) + "px";
        ind.style.width = pr.width + "px";
    }

    function _activatePill(root, pill, tabCount) {
        const tbl  = root.querySelector(".pg-tbl");
        const newN = parseInt(pill.dataset.tab);
        const oldN = parseInt(tbl.getAttribute("data-tab") || 0);
        if (newN === oldN) return;
        root.querySelectorAll(".pg-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        _positionInd(pill);
        tbl.style.setProperty("--pg-dir", (newN > oldN ? -160 : 160) + "px");
        tbl.setAttribute("data-tab", newN);
    }

    function _stepTab(root, tabCount, deltaX) {
        const tbl = root.querySelector(".pg-tbl");
        const cur = parseInt(tbl.getAttribute("data-tab") || 0);
        const nxt = deltaX > 0 ? Math.min(tabCount-1, cur+1) : Math.max(0, cur-1);
        if (nxt !== cur) root.querySelector(`.pg-pill[data-tab="${nxt}"]`).click();
    }

    function _e(s) {
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    // ── Public API ─────────────────────────────────────────────────
    window.PG = { mount, setTab, injectStyles, getSelected };
    injectStyles();
})();
