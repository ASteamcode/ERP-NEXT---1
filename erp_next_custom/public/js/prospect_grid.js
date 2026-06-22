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

/* maps popup */
.pg-maps-popup{position:fixed;z-index:99990;background:#fff;border-radius:12px;border:1.5px solid #e8e8f0;box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;width:240px;opacity:0;transition:opacity .15s;pointer-events:none;}
.pg-maps-popup.pg-popup-vis{opacity:1;pointer-events:all;}
.pg-maps-popup-inner{position:relative;}
.pg-maps-popup iframe{width:240px;height:160px;border:none;display:block;}
.pg-maps-popup-url{padding:7px 12px;font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid #f0f0f5;}

/* files */
.pg-files{display:inline-flex;align-items:center;gap:6px;}
.pg-file-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.pg-file-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.pg-cam-btn:hover{background:#f0fdf4 !important;border-color:#16a34a !important;color:#16a34a !important;}
.pg-file-ico{width:13px;height:13px;}

/* files popup */
.pg-files-popup{position:fixed;z-index:99990;background:#fff;border-radius:12px;border:1.5px solid #e8e8f0;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:12px;min-width:160px;max-width:320px;opacity:0;transition:opacity .15s;pointer-events:none;}
.pg-files-popup.pg-popup-vis{opacity:1;pointer-events:all;}
.pg-fp-items{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;}
.pg-fp-thumb{width:68px;height:68px;object-fit:cover;border-radius:8px;border:2px solid #e8e8f0;display:block;}
.pg-fp-file{width:64px;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:#f8fafc;border-radius:8px;border:1.5px solid #e8e8f0;}
.pg-fp-fname{font-size:9px;color:#6b7280;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
.pg-fp-empty{color:#9ca3af;font-size:12px;text-align:center;padding:8px 16px;}

/* expand button inside popup */
.pg-popup-expand{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.88);border:1.5px solid #e8e8f0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;color:#6b7280;transition:background .12s,color .12s,border-color .12s;padding:0;flex-shrink:0;}
.pg-popup-expand:hover{background:#eff6ff;color:#2563eb;border-color:#2563eb;}
.pg-fp-expand-wrap{position:relative;}

/* large modal */
.pg-modal-overlay{position:fixed;inset:0;z-index:999990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;animation:pg-modal-in .18s ease both;}
@keyframes pg-modal-in{from{opacity:0}to{opacity:1}}
.pg-modal-box{background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.32);overflow:hidden;display:flex;flex-direction:column;max-width:90vw;max-height:90vh;}
.pg-modal-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1.5px solid #e8e8f0;flex-shrink:0;gap:12px;}
.pg-modal-title{font-size:13px;font-weight:600;color:#111827;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pg-modal-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;color:#6b7280;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,color .12s;padding:0;}
.pg-modal-close:hover{background:#fee2e2;color:#dc2626;}
.pg-modal-body{overflow:auto;flex:1;}
.pg-modal-map-iframe{width:700px;height:500px;border:none;display:block;}
.pg-modal-files-grid{display:flex;flex-wrap:wrap;gap:14px;padding:20px;align-items:flex-start;}
.pg-modal-thumb{width:130px;height:130px;object-fit:cover;border-radius:10px;border:2px solid #e8e8f0;cursor:zoom-in;display:block;transition:transform .12s,box-shadow .12s;}
.pg-modal-thumb:hover{transform:scale(1.04);box-shadow:0 4px 16px rgba(0,0,0,.14);}
.pg-modal-file-item{width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#f8fafc;border-radius:10px;border:1.5px solid #e8e8f0;padding:14px 8px;}
.pg-modal-fname{font-size:10px;color:#6b7280;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
.pg-modal-empty{color:#9ca3af;font-size:13px;text-align:center;padding:40px;}

/* drawing button — circle matching file buttons */
.fd-icon-btn.fd-draw-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;padding:0;}
.fd-icon-btn.fd-draw-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has{background:#eff6ff;border-color:#2563eb;border-style:solid;color:#2563eb;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has:hover{background:#dbeafe;}

/* WhatsApp button */
.pg-wa-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#f0fdf4;color:#16a34a;text-decoration:none;transition:background .15s,color .15s;flex-shrink:0;margin-left:4px;}
.pg-wa-btn:hover{background:#dcfce7;color:#15803d;}

/* owner avatar */
.pg-owner-av{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:10px;font-weight:700;color:#fff;letter-spacing:.02em;flex-shrink:0;cursor:default;}

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
        expand: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="10,2 14,2 14,6"/><polyline points="6,14 2,14 2,10"/><line x1="14" y1="2" x2="9" y2="7"/><line x1="2" y1="14" x2="7" y2="9"/></svg>`,
        close:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>`,
        wa:     `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
        file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:22px;height:22px;color:#94a3b8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    };

    // ── Owner avatar color (deterministic from initials) ───────────
    const _OWNER_COLORS = ["#2563eb","#7c3aed","#db2777","#dc2626","#d97706","#059669","#0891b2","#4f46e5"];
    function _ownerColor(initials) {
        let h = 0;
        for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) & 0xffffffff;
        return _OWNER_COLORS[Math.abs(h) % _OWNER_COLORS.length];
    }

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
            case "phone": {
                if (empty) return `<span class="pg-mt">—</span>`;
                const digits = String(v).replace(/\D/g, "");
                const waUrl  = `https://wa.me/${digits}`;
                return (
                    `<span class="pg-ph">${_e(v)}</span>` +
                    `<a class="pg-wa-btn" href="${_e(waUrl)}" target="_blank" title="WhatsApp" onclick="event.stopPropagation()">${SVG.wa}</a>`
                );
            }
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
            case "owner": {
                const initials = v || "?";
                const color    = _ownerColor(initials);
                const title    = row.owner_name ? _e(row.owner_name) : _e(initials);
                return `<span class="pg-owner-av" style="background:${color}" title="${title}">${_e(initials)}</span>`;
            }
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
            if (f.type === "owner") {
                // render avatar; not editable
                return `<td class="pg-f ${f.cls||""}" data-row-name="${_e(name)}">${renderCell(f, row)}</td>`;
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

    // ── Popup helpers ──────────────────────────────────────────────
    let _mapsPopup = null, _mapsTimer = null;
    let _filesPopup = null, _filesTimer = null;
    const _filesCache = {}; // name → files array

    function _parseMapsCoords(url) {
        const pats = [
            /@(-?\d+\.?\d+),\+?(-?\d+\.?\d+)/,
            /\/maps\/search\/(-?\d+\.?\d+),\+?(-?\d+\.?\d+)/,
            /[?&]q=(-?\d+\.?\d+),\+?(-?\d+\.?\d+)/,
            /ll=(-?\d+\.?\d+),\+?(-?\d+\.?\d+)/,
        ];
        for (const p of pats) {
            const m = url.match(p);
            if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        }
        return null;
    }

    function _ensureMapsPopup() {
        if (_mapsPopup) return;
        _mapsPopup = document.createElement("div");
        _mapsPopup.className = "pg-maps-popup";
        _mapsPopup.addEventListener("mouseenter", () => clearTimeout(_mapsTimer));
        _mapsPopup.addEventListener("mouseleave", () => { _mapsTimer = setTimeout(_hideMapsPopup, 120); });
        document.body.appendChild(_mapsPopup);
    }

    function _renderMapsEmbed(coords, url) {
        if (!_mapsPopup) return;
        const { lat, lng } = coords;
        const d = 0.004;
        const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-d},${lat-d},${lng+d},${lat+d}&layer=mapnik&marker=${lat},${lng}`;
        _mapsPopup.innerHTML =
            `<div class="pg-maps-popup-inner">` +
            `<iframe src="${_e(src)}" loading="lazy" style="width:240px;height:160px;border:none;display:block;"></iframe>` +
            `<button class="pg-popup-expand" data-expand="maps" data-lat="${lat}" data-lng="${lng}" data-url="${_e(url)}" title="Expand map">${SVG.expand}</button>` +
            `</div>` +
            `<div class="pg-maps-popup-url">${_e(url)}</div>`;
    }

    function _showMapsPopup(anchor, url) {
        _ensureMapsPopup();
        const coords = _parseMapsCoords(url);
        if (coords) {
            _renderMapsEmbed(coords, url);
        } else {
            // Show loading card, then resolve server-side
            _mapsPopup.innerHTML = `<div class="pg-maps-popup-url" style="padding:14px 12px;font-size:12px;color:#9ca3af;">Resolving location…</div>`;
            frappe.call({
                method: "erp_next_custom.erp_next_custom.page.project_board.project_board.resolve_maps_url",
                args: { url },
                callback(r) {
                    if (!_mapsPopup || !_mapsPopup.classList.contains("pg-popup-vis")) return;
                    const d = r.message || {};
                    if (d.lat != null && d.lng != null) {
                        _renderMapsEmbed({ lat: d.lat, lng: d.lng }, d.url || url);
                    } else {
                        const label = d.place || (d.url || url);
                        _mapsPopup.innerHTML = `<div class="pg-maps-popup-url" style="padding:14px 12px;font-size:12px;color:#374151;white-space:normal;word-break:break-all;">${_e(label)}</div>`;
                    }
                    _positionPopup(_mapsPopup, anchor);
                },
            });
        }
        _positionPopup(_mapsPopup, anchor);
        _mapsPopup.classList.add("pg-popup-vis");
    }

    function _hideMapsPopup() {
        if (_mapsPopup) _mapsPopup.classList.remove("pg-popup-vis");
    }

    function _ensureFilesPopup() {
        if (_filesPopup) return;
        _filesPopup = document.createElement("div");
        _filesPopup.className = "pg-files-popup";
        _filesPopup.addEventListener("mouseenter", () => clearTimeout(_filesTimer));
        _filesPopup.addEventListener("mouseleave", () => { _filesTimer = setTimeout(_hideFilesPopup, 120); });
        document.body.appendChild(_filesPopup);
    }

    function _showFilesPopup(anchor, name) {
        _ensureFilesPopup();
        _filesPopup.dataset.rowName = name;
        _filesPopup.innerHTML = `<div class="pg-fp-empty">Loading…</div>`;
        _positionPopup(_filesPopup, anchor);
        _filesPopup.classList.add("pg-popup-vis");

        if (_filesCache[name] !== undefined) {
            _renderFilesPopup(_filesCache[name]);
            return;
        }
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "File",
                filters: { attached_to_doctype: "Prospect", attached_to_name: name },
                fields: ["name", "file_name", "file_url", "is_private"],
                limit: 12,
            },
            callback(r) {
                _filesCache[name] = r.message || [];
                if (_filesPopup.classList.contains("pg-popup-vis")) {
                    _renderFilesPopup(_filesCache[name]);
                    _positionPopup(_filesPopup, anchor);
                }
            },
        });
    }

    function _renderFilesPopup(files) {
        const name = _filesPopup.dataset.rowName || "";
        if (!files.length) {
            _filesPopup.innerHTML = `<div class="pg-fp-empty">No files attached</div>`;
            return;
        }
        const imgs = ["jpg","jpeg","png","gif","webp","svg","bmp"];
        const rotations = [-4,-2,0,2,3,-3,1,-1,4,-4,2,0];
        const items = files.map((f, i) => {
            const ext = (f.file_name || "").split(".").pop().toLowerCase();
            const rot = rotations[i % rotations.length];
            if (imgs.includes(ext)) {
                return `<img class="pg-fp-thumb" src="${_e(f.file_url)}" title="${_e(f.file_name)}" style="transform:rotate(${rot}deg)" loading="lazy">`;
            }
            return `<div class="pg-fp-file" title="${_e(f.file_name)}" style="transform:rotate(${rot}deg)">${SVG.file}<span class="pg-fp-fname">${_e(f.file_name)}</span></div>`;
        }).join("");
        _filesPopup.innerHTML =
            `<div class="pg-fp-expand-wrap" style="position:relative;">` +
            `<button class="pg-popup-expand" data-expand="files" data-name="${_e(name)}" title="Expand files" style="top:0;right:0;">${SVG.expand}</button>` +
            `<div class="pg-fp-items">${items}</div>` +
            `</div>`;
    }

    function _hideFilesPopup() {
        if (_filesPopup) _filesPopup.classList.remove("pg-popup-vis");
    }

    // ── Expand modal ───────────────────────────────────────────────
    function _openExpandModal(btn) {
        const type = btn.dataset.expand;
        let title = "", bodyHtml = "";

        if (type === "maps") {
            const lat = parseFloat(btn.dataset.lat);
            const lng = parseFloat(btn.dataset.lng);
            const url = btn.dataset.url || "";
            const d   = 0.01;
            const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-d},${lat-d},${lng+d},${lat+d}&layer=mapnik&marker=${lat},${lng}`;
            title    = "Map Preview";
            bodyHtml = `<iframe class="pg-modal-map-iframe" src="${_e(src)}" loading="lazy"></iframe>`;
        } else if (type === "files") {
            const name  = btn.dataset.name || "";
            const files = _filesCache[name] || [];
            const imgs  = ["jpg","jpeg","png","gif","webp","svg","bmp"];
            title = "Attached Files";
            if (!files.length) {
                bodyHtml = `<div class="pg-modal-empty">No files attached</div>`;
            } else {
                const items = files.map(f => {
                    const ext = (f.file_name || "").split(".").pop().toLowerCase();
                    if (imgs.includes(ext)) {
                        return `<img class="pg-modal-thumb" src="${_e(f.file_url)}" title="${_e(f.file_name)}" loading="lazy">`;
                    }
                    return `<div class="pg-modal-file-item">${SVG.file}<span class="pg-modal-fname">${_e(f.file_name)}</span></div>`;
                }).join("");
                bodyHtml = `<div class="pg-modal-files-grid">${items}</div>`;
            }
        }

        _hideMapsPopup();
        _hideFilesPopup();

        const overlay = document.createElement("div");
        overlay.className = "pg-modal-overlay";
        overlay.innerHTML =
            `<div class="pg-modal-box">` +
            `<div class="pg-modal-header"><span class="pg-modal-title">${_e(title)}</span><button class="pg-modal-close">${SVG.close}</button></div>` +
            `<div class="pg-modal-body">${bodyHtml}</div>` +
            `</div>`;

        const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
        const onKey = e => { if (e.key === "Escape") close(); };

        overlay.querySelector(".pg-modal-close").addEventListener("click", close);
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(overlay);
    }

    function _positionPopup(popup, anchor) {
        const r   = anchor.getBoundingClientRect();
        const pw  = popup.offsetWidth  || 240;
        const ph  = popup.offsetHeight || 80;
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;
        let left  = r.left;
        let top   = r.bottom + 6;
        if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
        if (top  + ph > vh - 8) top  = Math.max(8, r.top - ph - 6);
        popup.style.left = left + "px";
        popup.style.top  = top  + "px";
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

        // Apply sticky offsets
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
    let _eFl = null;
    let _eIn = null;
    let _eTd = null;
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

        const name  = td.dataset.rowName;
        const ff    = td.dataset.ff;
        const ctype = td.dataset.ctype;
        const ckey  = td.dataset.ckey;

        td.dataset.val = newVal;

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

        const rowObj = (cfg.rows || []).find(r => r.name === name);
        if (rowObj && ckey) rowObj[ckey] = newVal;

        if (cfg.onEdit && name && ff) cfg.onEdit(name, ff, newVal);
    }

    function _navCell(root, fromTd, direction) {
        const tbl      = root.querySelector(".pg-tbl");
        const tabN     = parseInt(tbl.getAttribute("data-tab") || 0);
        const tabCount = (root._pgCfg.tabs || []).length;
        const rowName  = fromTd.dataset.rowName;

        if (direction === "up" || direction === "down") {
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

        const hDir  = direction === "right" ? 1 : -1;
        const rowEd = (t) => Array.from(tbl.querySelectorAll("td.pg-ed")).filter(td =>
            td.dataset.rowName === rowName &&
            (td.classList.contains("pg-f") || td.classList.contains(`pg-v-${t}`))
        );
        const allEd = rowEd(tabN);
        const idx   = allEd.indexOf(fromTd);
        if (idx === -1) return;
        const next  = allEd[idx + hDir];
        if (next) { _openEdit(root, next); return; }

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

        // ── Wheel tab switch ────────────────────────────────────
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

        // ── Row number selection ─────────────────────────────────
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

        // ── Inline edit ─────────────────────────────────────────
        if (cfg.editable) {
            root.addEventListener("click", e => {
                if (e.target.closest(".pg-maps-btn")) return;
                if (e.target.closest(".pg-wa-btn"))   return;
                const td = e.target.closest("td.pg-ed");
                if (!td) return;
                _openEdit(root, td);
            });
        }

        // ── Expand button (inside popup) — wired once ────────────
        if (!document._pgExpandWired) {
            document._pgExpandWired = true;
            document.addEventListener("click", e => {
                const btn = e.target.closest(".pg-popup-expand");
                if (!btn) return;
                e.stopPropagation();
                _openExpandModal(btn);
            });
        }

        // ── Maps hover popup ─────────────────────────────────────
        root.addEventListener("mouseenter", e => {
            const btn = e.target.closest(".pg-maps-btn");
            if (!btn) return;
            const url = btn.getAttribute("href") || "";
            if (!url) return;
            clearTimeout(_mapsTimer);
            _mapsTimer = setTimeout(() => _showMapsPopup(btn, url), 180);
        }, true);

        root.addEventListener("mouseleave", e => {
            if (!e.target.closest(".pg-maps-btn")) return;
            clearTimeout(_mapsTimer);
            _mapsTimer = setTimeout(_hideMapsPopup, 120);
        }, true);

        // ── Files hover popup ────────────────────────────────────
        root.addEventListener("mouseenter", e => {
            const filesCell = e.target.closest(".pg-files");
            if (!filesCell) return;
            const td   = filesCell.closest("td");
            const name = td && td.dataset.rowName;
            if (!name) return;
            clearTimeout(_filesTimer);
            _filesTimer = setTimeout(() => _showFilesPopup(filesCell, name), 200);
        }, true);

        root.addEventListener("mouseleave", e => {
            if (!e.target.closest(".pg-files")) return;
            clearTimeout(_filesTimer);
            _filesTimer = setTimeout(_hideFilesPopup, 120);
        }, true);

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
                delete _filesCache[name]; // invalidate cache
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
                    tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
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
