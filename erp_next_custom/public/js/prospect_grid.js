/* ─────────────────────────────────────────────────────────────────
   ProspectGrid  —  Reusable pill-tab sticky-column spreadsheet
   Usage:  PG.mount(containerEl, config)
   Config: { tabs:string[], fixed:[{key,label,cls,shadow,type}],
             cols:[{tab,key,label,type,map?}], rows:object[] }
   Exported as window.PG
───────────────────────────────────────────────────────────────── */
(function () {
    "use strict";

    const STYLE_VER = "pg-v1";

    // ── CSS ────────────────────────────────────────────────────────
    const CSS = `
/* shell */
.pg-shell{background:#fff;border-radius:12px;border:1.5px solid #e8e8f0;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);}

/* pill nav */
.pg-pill-nav{display:flex;justify-content:center;padding:14px 20px 12px;background:transparent;overflow-x:auto;scrollbar-width:none;cursor:grab;user-select:none;}
.pg-pill-nav:active{cursor:grabbing;}
.pg-pill-nav::-webkit-scrollbar{display:none;}
.pg-pill-track{position:relative;display:inline-flex;align-items:center;background:#f0f0f5;border-radius:99px;padding:4px;gap:0;box-shadow:0 2px 12px rgba(0,0,0,.10),0 1px 3px rgba(0,0,0,.06);flex-shrink:0;}
.pg-pill-ind{position:absolute;top:4px;bottom:4px;background:#fff;border-radius:99px;box-shadow:0 1px 4px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.07);transition:transform .28s cubic-bezier(.4,0,.2,1),width .28s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:0;}
.pg-pill{position:relative;z-index:1;padding:7px 18px;border:none;background:transparent;border-radius:99px;font-size:12.5px;font-weight:600;color:#9ca3af;cursor:pointer;transition:color .2s;white-space:nowrap;line-height:1;}
.pg-pill:hover{color:#6b7280;}
.pg-pill.active{color:#111827;}

/* table scroll wrapper */
.pg-tbl-outer{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#e5e7eb transparent;}
.pg-tbl-outer::-webkit-scrollbar{height:4px;}
.pg-tbl-outer::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:99px;}

/* table base */
.pg-tbl{width:100%;border-collapse:separate;border-spacing:0;}
.pg-tbl th{background:#f8f8fc;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;padding:0 14px;height:38px;text-align:left;border-bottom:2px solid #e8e8f0;white-space:nowrap;}
.pg-tbl td{font-size:12.5px;color:#374151;padding:0 14px;height:46px;border-bottom:1px solid #f0f0f5;white-space:nowrap;vertical-align:middle;background:#fff;}
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

/* variable cols: hidden, revealed per data-tab */
.pg-v{display:none;min-width:0;width:auto;white-space:nowrap;position:relative;z-index:0;}
@keyframes pg-col-in{from{opacity:0;transform:translateX(var(--pg-dir,22px))}to{opacity:1;transform:none}}

/* status / semantic badge variants */
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

/* maps cell */
.pg-maps-cell{display:inline-flex;align-items:center;gap:5px;}
.pg-maps-btn{display:inline-flex;align-items:center;gap:5px;color:#2563eb;text-decoration:none;font-size:12.5px;font-weight:500;padding:4px 10px 4px 8px;border-radius:20px;background:#eff6ff;transition:background .15s;white-space:nowrap;}
.pg-maps-btn:hover{background:#dbeafe;}
.pg-maps-pin{width:14px;height:14px;color:#ef4444;stroke:currentColor;flex-shrink:0;}
.pg-map-edit{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;color:#9ca3af;cursor:pointer;opacity:0;transition:opacity .15s,background .15s,color .15s,border-color .15s;flex-shrink:0;}
.pg-maps-cell:hover .pg-map-edit{opacity:1;}
.pg-map-edit:hover{background:#f1f5f9;border-color:#94a3b8;color:#475569;}

/* file action buttons */
.pg-files{display:inline-flex;align-items:center;gap:6px;}
.pg-file-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.pg-file-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.pg-cam-btn:hover{background:#f0fdf4 !important;border-color:#16a34a !important;color:#16a34a !important;}
.pg-file-ico{width:13px;height:13px;}
`;

    // ── SVG icons ──────────────────────────────────────────────────
    const SVG = {
        pin:    `<svg class="pg-maps-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        pen:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pg-file-ico"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pg-file-ico"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    };

    // ── Style injection (idempotent) ───────────────────────────────
    function injectStyles() {
        if (document.getElementById(STYLE_VER)) return;
        const s = document.createElement("style");
        s.id = STYLE_VER;
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    // ── Cell renderer (dispatch on col.type) ──────────────────────
    function renderCell(col, row) {
        const v = row[col.key];
        const empty = v == null || v === "" || v === "—";
        switch (col.type) {
            case "text":
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
            case "link":
                return empty ? `<span class="pg-mt">—</span>`
                    : `<a class="pg-lnk">${_e(v)} <span class="pg-lnk-ext">↗</span></a>`;
            case "phone":
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-ph">${_e(v)}</span>`;
            case "num":
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-num-val">${_e(v)}</span>`;
            case "status": {
                const cls = (col.map || {})[v] || "pg-badge-gray";
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-badge ${cls}">${_e(v)}</span>`;
            }
            case "maps": {
                const btn = v
                    ? `<a class="pg-maps-btn" href="#" target="_blank">${SVG.pin}<span>Open Map</span></a>`
                    : `<span class="pg-mt">—</span>`;
                return `<span class="pg-maps-cell">${btn}<button class="pg-map-edit" title="Edit link">${SVG.pen}</button></span>`;
            }
            case "files":
                return `<span class="pg-files">
  <button class="pg-file-btn" title="Upload file">${SVG.upload}</button>
  <button class="pg-file-btn pg-cam-btn" title="Take photo">${SVG.camera}</button>
</span>`;
            default:
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
        }
    }

    // ── Fixed cell renderer ────────────────────────────────────────
    function renderFixed(col, row) {
        const v = row[col.key];
        if (col.type === "rownum") {
            return `<td class="pg-f ${col.cls || ""}${col.shadow?" pg-f-shadow":""}" style="text-align:center;color:#9ca3af;font-size:11px;font-weight:700">${v != null ? v : ""}</td>`;
        }
        return `<td class="pg-f ${col.cls || ""}${col.shadow?" pg-f-shadow":""}">${v != null ? _e(String(v)) : "—"}</td>`;
    }

    // ── HTML builders ──────────────────────────────────────────────
    function buildTabRevealCSS(n) {
        return Array.from({ length: n }, (_, i) =>
            `.pg-tbl[data-tab="${i}"] .pg-v-${i}`
        ).join(",") + `{display:table-cell;animation:pg-col-in .15s cubic-bezier(.2,0,.2,1) both}`;
    }

    function buildHeader(cfg) {
        const fixed = cfg.fixed.map(f =>
            `<th class="pg-f ${f.cls || ""}${f.shadow ? " pg-f-shadow" : ""}">${f.label}</th>`
        ).join("");
        const vars = cfg.cols.map(c =>
            `<th class="pg-v pg-v-${c.tab}">${c.label}</th>`
        ).join("");
        return `<tr>${fixed}${vars}</tr>`;
    }

    function buildRow(cfg, row, idx) {
        const fixed = cfg.fixed.map(f => renderFixed(f, row)).join("");
        const vars  = cfg.cols.map(c =>
            `<td class="pg-v pg-v-${c.tab}">${renderCell(c, row)}</td>`
        ).join("");
        return `<tr class="${idx % 2 ? "pg-tr-alt" : ""}">${fixed}${vars}</tr>`;
    }

    // ── Mount — main entry point ───────────────────────────────────
    function mount(el, cfg) {
        injectStyles();

        // Per-instance tab-reveal CSS (keyed on tab count, injected once)
        const n = cfg.tabs.length;
        const dynId = "pg-tabs-" + n;
        if (!document.getElementById(dynId)) {
            const s = document.createElement("style");
            s.id = dynId;
            s.textContent = buildTabRevealCSS(n);
            document.head.appendChild(s);
        }

        // Compute sticky left offsets from fixed col widths
        let left = 0;
        cfg.fixed.forEach(f => { f._left = left; left += (f.width || 120); });

        const pillsHtml = cfg.tabs.map((label, i) =>
            `<button class="pg-pill${i === 0 ? " active" : ""}" data-tab="${i}">${label}</button>`
        ).join("");

        const rowsHtml = cfg.rows.map((r, i) => buildRow(cfg, r, i)).join("");

        el.innerHTML = `<div class="pg-shell">
  <div class="pg-pill-nav">
    <div class="pg-pill-track">
      <div class="pg-pill-ind"></div>
      ${pillsHtml}
    </div>
  </div>
  <div class="pg-tbl-outer">
    <table class="pg-tbl" data-tab="0">
      <thead>${buildHeader(cfg)}</thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</div>`;

        // Apply sticky left positions via inline style (config-driven widths)
        const shell = el.querySelector(".pg-shell");
        cfg.fixed.forEach((f, fi) => {
            shell.querySelectorAll(`.pg-f:nth-child(${fi + 1})`).forEach(cell => {
                cell.style.left = f._left + "px";
                cell.style.minWidth = (f.width || 120) + "px";
                cell.style.width    = (f.width || 120) + "px";
            });
        });

        _wire(el, cfg.tabs.length);

        // Initialise indicator without transition
        setTimeout(() => {
            const pill = el.querySelector(".pg-pill.active");
            const ind  = el.querySelector(".pg-pill-ind");
            if (!pill || !ind) return;
            ind.style.transition = "none";
            ind.style.transform  = `translateX(${pill.offsetLeft}px)`;
            ind.style.width      = pill.offsetWidth + "px";
            requestAnimationFrame(() => { if (ind) ind.style.transition = ""; });
        }, 0);
    }

    // ── Programmatic tab switch ────────────────────────────────────
    function setTab(shellEl, n) {
        const pill = shellEl.querySelector(`.pg-pill[data-tab="${n}"]`);
        if (pill) pill.click();
    }

    // ── Event wiring ──────────────────────────────────────────────
    function _wire(root, tabCount) {
        let _wt = 0, _ts = null;
        let _navDown = false, _navDragged = false, _navMx = 0, _navSl = 0;

        const nav   = root.querySelector(".pg-pill-nav");
        const outer = root.querySelector(".pg-tbl-outer");

        // Pill click
        root.addEventListener("click", function (e) {
            const pill = e.target.closest(".pg-pill");
            if (!pill) return;
            if (_navDragged) { _navDragged = false; return; }
            _activatePill(root, pill, tabCount);
        });

        // Drag-to-scroll on pill nav
        nav.addEventListener("mousedown", function (e) {
            _navDown = true; _navDragged = false;
            _navMx = e.clientX; _navSl = nav.scrollLeft;
            e.preventDefault();
        });
        const onMove = function (e) {
            if (!_navDown) return;
            const dx = e.clientX - _navMx;
            if (Math.abs(dx) > 4) _navDragged = true;
            nav.scrollLeft = _navSl - dx;
        };
        const onUp = function () { _navDown = false; };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup",   onUp);

        // Wheel on nav → switch tab
        nav.addEventListener("wheel", function (e) {
            const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
            if (ax <= ay || ax < 8) return;
            e.preventDefault();
            const now = Date.now();
            if (now - _wt < 450) return;
            _wt = now;
            _stepTab(root, tabCount, e.deltaX);
        }, { passive: false });

        // Wheel on table → switch tab
        outer.addEventListener("wheel", function (e) {
            const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
            if (ax <= ay || ax < 8) return;
            e.preventDefault();
            const now = Date.now();
            if (now - _wt < 450) return;
            _wt = now;
            _stepTab(root, tabCount, e.deltaX);
        }, { passive: false });

        // Touch swipe
        root.addEventListener("touchstart", function (e) { _ts = e.touches[0].clientX; }, { passive: true });
        root.addEventListener("touchend", function (e) {
            if (_ts === null) return;
            const dx = e.changedTouches[0].clientX - _ts; _ts = null;
            if (Math.abs(dx) < 40) return;
            _stepTab(root, tabCount, -dx);
        });
    }

    function _activatePill(root, pill, tabCount) {
        const tbl  = root.querySelector(".pg-tbl");
        const newN = parseInt(pill.dataset.tab);
        const oldN = parseInt(tbl.getAttribute("data-tab") || 0);
        if (newN === oldN) return;
        root.querySelectorAll(".pg-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const ind = root.querySelector(".pg-pill-ind");
        if (ind) {
            ind.style.transform = `translateX(${pill.offsetLeft}px)`;
            ind.style.width     = pill.offsetWidth + "px";
        }
        tbl.style.setProperty("--pg-dir", (newN > oldN ? -160 : 160) + "px");
        tbl.setAttribute("data-tab", newN);
    }

    function _stepTab(root, tabCount, deltaX) {
        const tbl = root.querySelector(".pg-tbl");
        const cur = parseInt(tbl.getAttribute("data-tab") || 0);
        const nxt = deltaX > 0 ? Math.min(tabCount - 1, cur + 1) : Math.max(0, cur - 1);
        if (nxt !== cur) root.querySelector(`.pg-pill[data-tab="${nxt}"]`).click();
    }

    // ── Utility ────────────────────────────────────────────────────
    function _e(s) {
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    // ── Public API ─────────────────────────────────────────────────
    window.PG = { mount, setTab, injectStyles };

    injectStyles();
})();
