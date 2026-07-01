/* ────────────────────────────────────────────────────────────────
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
.pg-shell{background:#fff;border-radius:14px;border:1.5px solid #dce4f0;overflow:hidden;box-shadow:0 4px 20px rgba(40,79,158,.10);}

/* nav row */
.pg-nav-row{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  padding:12px 16px;
  gap:10px;
  position:relative;
  z-index:20;
  background:#1e3f85;
}
.pg-nav-left{display:flex;align-items:center;gap:8px;justify-content:flex-start;}
.pg-nav-center{display:flex;justify-content:center;align-items:center;}
.pg-nav-right{display:flex;align-items:center;gap:8px;justify-content:flex-end;}

/* pill track — dark translucent on gradient bg */
.pg-pill-track{position:relative;display:inline-flex;align-items:center;background:rgba(0,0,0,.20);border-radius:99px;padding:4px;gap:0;}
.pg-pill-ind{position:absolute;top:4px;bottom:4px;left:0;background:#fff;border-radius:99px;box-shadow:0 2px 10px rgba(0,0,0,.22);transition:left .28s cubic-bezier(.4,0,.2,1),width .28s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:0;width:0;}
.pg-pill{position:relative;z-index:1;padding:7px 16px;border:none;background:transparent;border-radius:99px;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.58);cursor:pointer;transition:color .2s;white-space:nowrap;line-height:1;}
.pg-pill:hover{color:rgba(255,255,255,.88);}
.pg-pill.active{color:#284f9e;font-weight:800;}

/* ── Quick stats strip ── */
.pg-qs-strip{display:flex;gap:12px;padding:14px 16px 14px;box-sizing:border-box;}
.pg-qs-card{flex:1;min-width:0;padding:16px 18px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.55);position:relative;overflow:hidden;cursor:default;transition:transform .18s,box-shadow .18s;box-shadow:0 2px 8px rgba(0,0,0,.10);}
.pg-qs-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.18);}
.pg-qs-card::after{content:'';position:absolute;top:-30%;right:-12%;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.12);}
.pg-qs-num{font-size:30px;font-weight:900;color:#fff;line-height:1;margin-bottom:4px;}
.pg-qs-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,.82);letter-spacing:.05em;text-transform:uppercase;}
.pg-qs-sub{font-size:10.5px;color:rgba(255,255,255,.52);margin-top:2px;}
.pg-qs-icon{position:absolute;bottom:12px;right:14px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);}
.pg-qs-icon svg{width:15px;height:15px;}
.pg-qs-c1{background:#0176d3;}
.pg-qs-c2{background:#032d60;}
.pg-qs-c3{background:#014486;}
.pg-qs-c4{background:#0e7490;}
/* table wrapper — z-index must stay below nav (nav is z-index:20) */
.pg-tbl-outer{overflow:auto;max-height:var(--pg-body-max-height,none);padding-bottom:56px;box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#e5e7eb transparent;position:relative;z-index:0;}
.pg-tbl-outer::-webkit-scrollbar{height:4px;width:6px;}
.pg-tbl-outer::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:99px;}

/* table */
.pg-tbl{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:8px;}
.pg-tbl thead tr{background:#1e3f85;}
.pg-tbl th{position:sticky;top:0;z-index:4;background:transparent;font-size:10px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:rgba(255,255,255,.70);padding:0 14px;height:40px;text-align:left;border-bottom:none;border-right:1px solid rgba(255,255,255,.08);white-space:nowrap;}
.pg-tbl th:last-child{border-right:none;}
.pg-tbl td{font-size:12.5px;color:#1e293b;padding:0 14px;height:46px;border-bottom:1px solid #f1f5f9;white-space:nowrap;vertical-align:middle;background:#fff;position:relative;border-right:1px solid #f1f5f9;}
.pg-tbl td:last-child{border-right:none;}
.pg-tr-alt td{background:#f8faff;}
/* sticky fixed cols */
.pg-f{position:sticky;z-index:2;}
.pg-tbl td.pg-f{background:#fff;}
.pg-tr-alt td.pg-f{background:#f8faff;}
.pg-tbl th.pg-f{z-index:5;background:#1e3f85;}
.pg-f-shadow{box-shadow:4px 0 10px -2px rgba(0,0,0,.10);}
.pg-tbl th.pg-f-shadow{box-shadow:4px 0 10px -2px rgba(0,0,0,.08);}

/* variable cols — all always visible; tabs scroll into view */
.pg-v{min-width:0;width:auto;white-space:nowrap;position:relative;z-index:0;}
.pg-tbl th.pg-v{z-index:4;background:#1e3f85;}

/* row hover — obvious for non-technical users */
.pg-tbl tbody tr:hover td{background:#e8f4fd !important;}
.pg-tbl tbody tr:hover .pg-f-num-cell{box-shadow:inset 4px 0 0 #284f9e;}
.pg-tbl tbody tr:hover .pg-row-num{background:#284f9e;color:#fff;transform:scale(1.1);}
/* row selection */
.pg-tbl .pg-row-sel td,.pg-tbl .pg-row-sel td.pg-f{background:#dbeafe !important;}
.pg-tbl .pg-row-sel:hover td,.pg-tbl .pg-row-sel:hover td.pg-f{background:#bfdbfe !important;}
.pg-f-num-cell{cursor:pointer;user-select:none;text-align:center;font-size:11px;font-weight:700;transition:color .12s;}
.pg-f-num-cell:hover{color:#2563eb;}
.pg-row-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:#eff6ff;color:#284f9e;font-size:11px;font-weight:800;transition:all .15s;}
.pg-row-sel .pg-f-num-cell .pg-row-num{background:#284f9e;color:#fff;}

/* inline edit */
.pg-ed{cursor:text;}
.pg-ed:hover{outline:1px solid #bfdbfe;outline-offset:-1px;}
.pg-float-wrap{position:fixed;z-index:99999;pointer-events:none;}
@keyframes pg-float-in{from{opacity:0;transform:scaleY(.6) scaleX(.97);box-shadow:none}to{opacity:1;transform:none;box-shadow:0 4px 20px rgba(37,99,235,.18);}}
.pg-float-input,.pg-float-select{position:absolute;inset:0;width:100%;height:100%;border:2px solid #2563eb;border-radius:3px;background:#fff;padding:0 12px;font-size:12.5px;font-family:inherit;color:#111827;outline:none;box-sizing:border-box;pointer-events:all;transform-origin:top center;animation:pg-float-in .14s cubic-bezier(.2,0,.2,1) both;}
.pg-float-select{padding:0 8px;cursor:pointer;}
.pg-ac-drop{position:fixed;z-index:100001;background:#fff;border:1.5px solid #e8e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.1);max-height:220px;overflow-y:auto;display:none;}
.pg-ac-item{padding:7px 13px;cursor:pointer;font-size:12.5px;color:#374151;white-space:nowrap;}
.pg-ac-item:hover,.pg-ac-item.pg-ac-active{background:#eff6ff;color:#1e40af;}
.pg-ac-create{color:#2563eb;border-top:1px solid #e8e8f0;margin-top:2px;}

/* contact popup action bar */
.pg-cp-actions{display:flex;gap:6px;padding:10px 14px 12px;border-top:1px solid rgba(0,0,0,.06);margin-top:2px;}
.pg-cp-act{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;cursor:pointer;text-decoration:none;border:none;transition:background .12s,transform .1s;flex-shrink:0;}
.pg-cp-act svg{width:15px;height:15px;}
.pg-cp-act:hover{transform:scale(1.08);}
.pg-cp-act-wa{background:#e7f5ee;color:#15803d;}
.pg-cp-act-wa:hover{background:#bbf7d0;}
.pg-cp-act-mail{background:#eff6ff;color:#1d4ed8;}
.pg-cp-act-mail:hover{background:#dbeafe;}

/* contact-link modal */
.pg-cm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px;}
.pg-cm-box{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:100%;max-width:420px;overflow:hidden;display:flex;flex-direction:column;}
.pg-cm-header{background:#1e3f85;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:700;letter-spacing:.02em;}
.pg-cm-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:22px;cursor:pointer;line-height:1;padding:0 2px;transition:color .12s;}
.pg-cm-close:hover{color:#fff;}
.pg-cm-body{padding:20px;display:flex;flex-direction:column;gap:12px;}
.pg-cm-row{display:flex;flex-direction:column;gap:4px;}
.pg-cm-label{font-size:11.5px;font-weight:700;color:#6b7280;letter-spacing:.04em;text-transform:uppercase;}
.pg-cm-req{color:#dc2626;}
.pg-cm-inp{border:1.5px solid #d1d5db;border-radius:8px;padding:8px 11px;font-size:13.5px;color:#111827;outline:none;transition:border-color .15s,box-shadow .15s;}
.pg-cm-inp:focus{border-color:#1e3f85;box-shadow:0 0 0 3px rgba(30,63,133,.12);}
.pg-cm-err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#dc2626;}
.pg-cm-footer{padding:14px 20px;border-top:1px solid #f0f0f4;display:flex;justify-content:flex-end;gap:10px;}
.pg-cm-btn-cancel{padding:8px 16px;border:1.5px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s;}
.pg-cm-btn-cancel:hover{background:#f9fafb;}
.pg-cm-btn-save{padding:8px 18px;border:none;border-radius:8px;background:#1e3f85;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:background .12s,opacity .12s;}
.pg-cm-btn-save:hover{background:#2d52a8;}
.pg-cm-btn-save:disabled{opacity:.6;cursor:not-allowed;}

/* status badges — blue family (prospect) + warm family (project) */
.pg-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:800;white-space:nowrap;letter-spacing:.01em;}
.pg-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;}
/* prospect status — blue family */
.pg-badge-blue   {background:#e8f4fd;color:#014486;border:1px solid #b0d4f1;}
.pg-badge-indigo {background:#ece9f5;color:#3e3794;border:1px solid #c5bde8;}
.pg-badge-purple {background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;}
.pg-badge-teal   {background:#e0f5f5;color:#0a5f6e;border:1px solid #8dd5d8;}
.pg-badge-green  {background:#eff9ef;color:#2e6b3e;border:1px solid #95d5a0;}
.pg-badge-emerald{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;}
.pg-badge-gray   {background:#f3f3f3;color:#706e6b;border:1px solid #c9c7c5;}
/* project status — warm family */
.pg-badge-amber  {background:#fef0d9;color:#9e4300;border:1px solid #f4b56a;}
.pg-badge-yellow {background:#fef9e3;color:#7a4f00;border:1px solid #f0d080;}
.pg-badge-orange {background:#fff3e0;color:#c2410c;border:1px solid #fdba74;}
.pg-badge-lime   {background:#eff9ef;color:#2e6b3e;border:1px solid #95d5a0;}
.pg-badge-red    {background:#fde8e8;color:#ba0517;border:1px solid #f5a0a0;}

/* cell types */
.pg-lnk{color:#2563eb;text-decoration:none;font-size:12.5px;display:inline-flex;align-items:center;gap:3px;cursor:default;}
.pg-lnk-ext{font-size:10px;color:#93c5fd;}
.pg-social-lnk{display:inline-flex;align-items:center;gap:4px;color:#2563eb;text-decoration:none;font-size:12.5px;border-radius:4px;transition:color .12s;}
.pg-social-lnk:hover{color:#1d4ed8;text-decoration:underline;}
.pg-email-btn{display:inline-flex;align-items:center;gap:5px;border:none;background:transparent;color:#2563eb;font-size:12.5px;font-family:inherit;cursor:pointer;padding:0;border-radius:4px;transition:color .12s;}
.pg-email-btn:hover{color:#1d4ed8;text-decoration:underline;}
.pg-ph{font-variant-numeric:tabular-nums;color:#374151;letter-spacing:.01em;}

/* email compose panel */
.pg-compose{position:fixed;bottom:0;right:28px;z-index:999995;width:480px;border-radius:12px 12px 0 0;box-shadow:0 -4px 32px rgba(0,0,0,.16);overflow:hidden;display:flex;flex-direction:column;background:#fff;border:1.5px solid #e8e8f0;border-bottom:none;animation:pg-compose-in .18s cubic-bezier(.2,0,.2,1) both;}
@keyframes pg-compose-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.pg-compose-head{background:#0176d3;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;user-select:none;}
.pg-compose-title{color:#fff;font-size:13px;font-weight:600;letter-spacing:.01em;display:flex;align-items:center;gap:7px;}
.pg-compose-head-btns{display:flex;gap:6px;align-items:center;}
.pg-compose-hbtn{background:rgba(255,255,255,.18);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,transform .1s;padding:0;flex-shrink:0;}
.pg-compose-hbtn:hover{background:rgba(255,255,255,.32);transform:scale(1.08);}
/* all rows: centered by default; TO row overrides to flex-start for tag wrapping */
.pg-compose-row{display:flex;align-items:center;border-bottom:1px solid #f0f0f5;padding:0 20px;position:relative;min-height:44px;}
.pg-compose-row.pg-compose-row--tags{align-items:flex-start;padding:8px 20px;}
.pg-compose-lbl{font-size:10.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;width:64px;flex-shrink:0;}
.pg-compose-row--tags .pg-compose-lbl{padding-top:6px;}
/* tag-input container */
.pg-compose-tags{flex:1;display:flex;flex-wrap:wrap;gap:5px;align-items:center;min-height:28px;}
.pg-compose-tag{display:inline-flex;align-items:center;gap:5px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:99px;padding:4px 6px 4px 10px;font-size:12px;color:#1e40af;font-weight:500;line-height:1;}
.pg-compose-tag-x{background:none;border:none;color:#93c5fd;cursor:pointer;padding:0;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;transition:color .1s,background .1s;}
.pg-compose-tag-x svg{display:block;}
.pg-compose-tag-x:hover{color:#dc2626;background:#fee2e2;}
.pg-compose-tag-inp{border:none;outline:none;font-size:13px;color:#111827;font-family:inherit;background:transparent;min-width:140px;padding:3px 0;line-height:1.4;}
.pg-compose-tag-inp::placeholder{color:#d1d5db;}
.pg-compose-bulk-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid #e0e0ea;background:#f8fafc;color:#6b7280;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .12s;padding:0;margin-left:6px;align-self:flex-start;margin-top:7px;}
.pg-compose-bulk-btn:hover{border-color:#1e3a8a;color:#1e3a8a;background:#eff6ff;}
.pg-compose-ac{position:absolute;top:100%;left:0;right:0;z-index:10;background:#fff;border:1.5px solid #e8e8f0;border-top:none;border-radius:0 0 10px 10px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:200px;overflow-y:auto;}
.pg-compose-ac-item{display:flex;flex-direction:column;padding:9px 20px;cursor:pointer;gap:1px;transition:background .1s;}
.pg-compose-ac-item:hover{background:#f0f5ff;}
.pg-compose-ac-name{font-size:12.5px;font-weight:600;color:#111827;}
.pg-compose-ac-email{font-size:11px;color:#6b7280;}
.pg-compose-inp{flex:1;border:none;outline:none;font-size:13px;color:#111827;padding:0;font-family:inherit;background:transparent;}
.pg-compose-inp::placeholder{color:#d1d5db;}
.pg-compose-body{flex:1;border:none;outline:none;font-size:13px;color:#374151;padding:16px 20px;font-family:inherit;resize:none;min-height:210px;line-height:1.7;}
.pg-compose-body::placeholder{color:#d1d5db;}
.pg-compose-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1.5px solid #e8e8f0;background:#fafafa;}
.pg-compose-send{display:inline-flex;align-items:center;gap:6px;padding:8px 22px;background:#0176d3;color:#fff;border:none;border-radius:99px;font-size:12.5px;font-weight:600;cursor:pointer;transition:opacity .14s;box-shadow:0 2px 8px rgba(30,58,138,.3);}
.pg-compose-send:hover{opacity:.88;}
.pg-compose-mailto{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;background:#fff;color:#6b7280;border:1.5px solid #e0e0ea;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s;}
.pg-compose-mailto:hover{border-color:#1e3a8a;color:#1e3a8a;background:#eff6ff;}
/* broadcast / bulk-select modal */
.pg-bcast-overlay{position:fixed;inset:0;z-index:999996;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;}
.pg-bcast-box{background:#fff;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.24);width:460px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;}
.pg-bcast-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1.5px solid #e8e8f0;flex-shrink:0;}
.pg-bcast-title{font-size:13.5px;font-weight:700;color:#111827;}
.pg-bcast-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;color:#6b7280;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:background .12s;}
.pg-bcast-close:hover{background:#fee2e2;color:#dc2626;}
.pg-bcast-search{padding:10px 16px;border-bottom:1px solid #f0f0f5;flex-shrink:0;}
.pg-bcast-search-inp{width:100%;height:32px;border:1.5px solid #e0e0ea;border-radius:99px;padding:0 14px;font-size:12.5px;font-family:inherit;outline:none;color:#374151;box-sizing:border-box;}
.pg-bcast-search-inp:focus{border-color:#1e3a8a;}
.pg-bcast-selall{display:flex;align-items:center;gap:8px;padding:8px 18px;border-bottom:1px solid #f0f0f5;flex-shrink:0;cursor:pointer;font-size:12px;font-weight:600;color:#6b7280;}
.pg-bcast-selall:hover{color:#111827;}
.pg-bcast-list{overflow-y:auto;flex:1;}
.pg-bcast-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;transition:background .1s;}
.pg-bcast-item:hover{background:#f0f5ff;}
.pg-bcast-item input[type=checkbox]{width:15px;height:15px;accent-color:#1e3a8a;flex-shrink:0;cursor:pointer;}
.pg-bcast-item-info{display:flex;flex-direction:column;gap:1px;min-width:0;}
.pg-bcast-item-name{font-size:12.5px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pg-bcast-item-email{font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pg-bcast-foot{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1.5px solid #e8e8f0;flex-shrink:0;background:#fafafa;}
.pg-bcast-count{font-size:12px;color:#6b7280;}
.pg-bcast-confirm{padding:8px 22px;background:#1e3a8a;color:#fff;border:none;border-radius:99px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .14s;}
.pg-bcast-confirm:hover{background:#1e40af;}
.pg-num-val{font-variant-numeric:tabular-nums;color:#374151;font-weight:600;}
.pg-mt{color:#d1d5db;}

/* maps */
.pg-maps-cell{display:inline-flex;align-items:center;gap:5px;}
.pg-maps-btn{display:inline-flex;align-items:center;gap:5px;color:#2563eb;text-decoration:none;font-size:12.5px;font-weight:500;padding:4px 10px 4px 8px;border-radius:20px;background:#eff6ff;transition:background .15s;white-space:nowrap;}
.pg-maps-btn:hover{background:#dbeafe;}
.pg-maps-pin{width:14px;height:14px;color:#ef4444;stroke:currentColor;flex-shrink:0;}
.pg-map-edit{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px solid #2563eb;background:#eff6ff;color:#2563eb;cursor:pointer;transition:background .15s,border-color .15s;flex-shrink:0;padding:0;}
.pg-map-edit:hover{background:#dbeafe;}
.pg-map-copy{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px solid #2563eb;background:#eff6ff;color:#2563eb;cursor:pointer;transition:background .15s,border-color .15s,color .15s;flex-shrink:0;padding:0;}
.pg-map-copy:hover{background:#dbeafe;}
.pg-map-copy.pg-copied{border-color:#16a34a;background:#dcfce7;color:#16a34a;}

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
.pg-popup-expand{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.88);border:1.5px solid #e8e8f0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;color:#6b7280;transition:background .12s,color .12s,border-color .12s;padding:0;flex-shrink:0;}
.pg-popup-expand:hover{background:#eff6ff;color:#2563eb;border-color:#2563eb;}
.pg-fp-expand-wrap{position:relative;}

/* large modal */
.pg-modal-overlay{position:fixed;inset:0;z-index:999990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;animation:pg-modal-in .18s ease both;}
@keyframes pg-modal-in{from{opacity:0}to{opacity:1}}
.pg-modal-box{background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.32);overflow:hidden;display:flex;flex-direction:column;width:80vw;height:80vh;}
.pg-modal-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1.5px solid #e8e8f0;flex-shrink:0;gap:12px;}
.pg-modal-title{font-size:13px;font-weight:600;color:#111827;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pg-modal-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;color:#6b7280;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,color .12s;padding:0;}
.pg-modal-close:hover{background:#fee2e2;color:#dc2626;}
.pg-modal-body{overflow:auto;flex:1;}
.pg-modal-map-iframe{width:700px;height:500px;border:none;display:block;}
.pg-modal-files-grid{display:flex;flex-wrap:wrap;gap:16px;padding:24px;align-items:flex-start;}
.pg-modal-file-link{display:block;text-decoration:none;color:inherit;}
.pg-modal-thumb{width:180px;height:180px;object-fit:cover;border-radius:12px;border:2px solid #e8e8f0;display:block;transition:transform .12s,box-shadow .12s,border-color .12s;}
.pg-modal-file-link:hover .pg-modal-thumb{transform:scale(1.03);box-shadow:0 6px 20px rgba(0,0,0,.16);border-color:#93c5fd;}
.pg-modal-file-item{width:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#f8fafc;border-radius:12px;border:1.5px solid #e8e8f0;padding:20px 10px;transition:border-color .12s,box-shadow .12s;}
.pg-modal-file-link:hover .pg-modal-file-item{border-color:#93c5fd;box-shadow:0 4px 14px rgba(0,0,0,.1);}
.pg-modal-fname{font-size:11px;color:#6b7280;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}
.pg-modal-empty{color:#9ca3af;font-size:13px;text-align:center;padding:60px;}

/* drawing button — circle matching file buttons */
.fd-icon-btn.fd-draw-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px dashed #cbd5e1;background:#f8fafc;color:#94a3b8;cursor:pointer;transition:background .15s,border-color .15s,color .15s;padding:0;}
.fd-icon-btn.fd-draw-btn:hover{background:#eff6ff;border-color:#2563eb;color:#2563eb;border-style:solid;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has{background:#eff6ff;border-color:#2563eb;border-style:solid;color:#2563eb;}
.fd-icon-btn.fd-draw-btn.fd-draw-btn--has:hover{background:#dbeafe;}

/* WhatsApp button */
.pg-wa-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#f0fdf4;color:#16a34a;text-decoration:none;transition:background .15s,color .15s;flex-shrink:0;margin-left:4px;}
.pg-wa-btn:hover{background:#dcfce7;color:#15803d;}
/* WhatsApp API button */
.pg-wa-api-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#f0fdf4;color:#16a34a;border:1.5px solid #86efac;cursor:pointer;transition:background .15s,color .15s,border-color .15s;flex-shrink:0;margin-left:3px;padding:0;}
.pg-wa-api-btn:hover{background:#dcfce7;color:#15803d;border-color:#4ade80;}
/* WhatsApp API compose panel */
.pg-wa-compose{position:fixed;bottom:0;right:28px;z-index:999995;width:480px;border-radius:12px 12px 0 0;box-shadow:0 -4px 32px rgba(0,0,0,.16);overflow:hidden;display:flex;flex-direction:column;background:#fff;border:1.5px solid #bbf7d0;border-bottom:none;animation:pg-compose-in .18s cubic-bezier(.2,0,.2,1) both;}
.pg-wa-compose .pg-compose-head{background:#15803d;}
.pg-wa-compose .pg-compose-tag{background:#f0fdf4;border-color:#86efac;color:#15803d;}
.pg-wa-compose .pg-compose-tag-x{color:#86efac;}
.pg-wa-compose .pg-compose-tag-x:hover{color:#dc2626;background:#fee2e2;}
.pg-wa-compose .pg-compose-ac-item:hover{background:#f0fdf4;}
.pg-wa-compose .pg-compose-bulk-btn:hover{border-color:#15803d;color:#15803d;background:#f0fdf4;}
.pg-wa-compose .pg-compose-send{background:#15803d;box-shadow:0 2px 8px rgba(21,128,61,.3);}
.pg-wa-compose .pg-wa-compose-open{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;background:#fff;color:#6b7280;border:1.5px solid #e0e0ea;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s;}
.pg-wa-compose .pg-wa-compose-open:hover{border-color:#15803d;color:#15803d;background:#f0fdf4;}

/* owner avatar */
.pg-owner-av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.02em;flex-shrink:0;cursor:pointer;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;box-shadow:0 2px 8px rgba(0,0,0,.18);}
.pg-owner-av:hover{transform:scale(1.18);box-shadow:0 4px 14px rgba(0,0,0,.26);}
.pg-contact-av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.02em;flex-shrink:0;cursor:pointer;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;box-shadow:0 2px 8px rgba(0,0,0,.18);}
.pg-contact-av:hover{transform:scale(1.18);box-shadow:0 4px 14px rgba(0,0,0,.26);}
.pg-cl-name{font-size:12px;color:#1e293b;cursor:pointer;}
/* owner popup */
.pg-owner-popup{position:fixed;z-index:99990;background:#fff;border-radius:14px;border:1px solid rgba(0,0,0,.08);box-shadow:0 12px 40px rgba(0,0,0,.14);padding:14px 14px 0;width:230px;opacity:0;transition:opacity .15s;pointer-events:none;overflow:hidden;}
.pg-owner-popup .pg-owner-popup-rows{padding-bottom:12px;}
.pg-owner-popup.pg-popup-vis{opacity:1;pointer-events:all;}
.pg-owner-popup-top{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.pg-owner-popup-av{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;}
.pg-owner-popup-name{font-size:13px;font-weight:700;color:#111827;line-height:1.3;}
.pg-owner-popup-rows{display:flex;flex-direction:column;gap:6px;}
.pg-owner-popup-row{display:flex;align-items:center;gap:8px;font-size:12px;color:#374151;}
.pg-owner-popup-icon{width:14px;height:14px;color:#9ca3af;flex-shrink:0;}
.pg-owner-popup-loc{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f5;}
.pg-cp-ref-row{border-top:1px solid #f0f0f5;margin-top:6px;padding-top:6px;}
.pg-cp-ref-sel{flex:1;border:none;outline:none;font-size:11.5px;color:#374151;font-family:inherit;background:transparent;cursor:pointer;min-width:0;}

/* search — ghost on gradient nav bar */
.pg-search-wrap{position:relative;display:flex;align-items:center;}
.pg-search-icon{position:absolute;left:11px;width:13px;height:13px;color:rgba(255,255,255,.5);pointer-events:none;flex-shrink:0;}
.pg-search{height:32px;padding:0 13px 0 32px;border:1.5px solid rgba(255,255,255,.22);border-radius:99px;font-size:12px;font-family:inherit;color:#fff;background:rgba(255,255,255,.12);outline:none;width:170px;transition:border-color .15s,background .15s,box-shadow .15s,width .2s;}
.pg-search::placeholder{color:rgba(255,255,255,.42);}
.pg-search:focus{border-color:rgba(255,255,255,.65);background:rgba(255,255,255,.2);box-shadow:0 0 0 3px rgba(255,255,255,.12);width:210px;}
.pg-search-wrap:focus-within .pg-search-icon{color:rgba(255,255,255,.8);}

/* toolbar buttons on gradient nav */
/* Add Row — most prominent; white pill with brand blue text */
.pg-tb-add{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border:none;border-radius:99px;background:#fff;color:#284f9e;font-size:12.5px;font-weight:800;cursor:pointer;transition:transform .15s,box-shadow .15s;white-space:nowrap;box-shadow:0 3px 12px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.8);}
.pg-tb-add:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.8);}
.pg-tb-add:active{transform:none;}
/* Export — outlined ghost on gradient */
.pg-tb-exp{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border:2px solid rgba(255,255,255,.4);border-radius:99px;background:transparent;color:rgba(255,255,255,.9);font-size:12px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap;}
.pg-tb-exp:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.8);color:#fff;transform:translateY(-1px);}
/* Delete — muted red ghost, hidden until rows selected */
.pg-tb-del{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border:1.5px solid rgba(252,165,165,.45);border-radius:99px;background:rgba(255,255,255,.1);color:#fca5a5;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap;opacity:0;pointer-events:none;max-width:0;overflow:hidden;padding-left:0;padding-right:0;border-width:0;}
.pg-tb-del.pg-tb-del-on{opacity:1;pointer-events:all;max-width:180px;padding:7px 14px;border-width:1.5px;}
.pg-tb-del:hover{background:rgba(239,68,68,.22);border-color:#fca5a5;color:#fff;}
.pg-tb-cnt{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:99px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:0 4px;}
.pg-notes-cell{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:text;font-size:12px;color:#374151;line-height:1.4;}.pg-notes-tip{position:fixed;z-index:9999;background:#fff;color:#374151;font-size:12px;line-height:1.6;padding:8px 12px;border-radius:8px;max-width:360px;white-space:pre-wrap;word-break:break-word;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,.15);border:1px solid #e5e7eb;opacity:0;transition:opacity 0s;}
.pg-notes-tip.pg-notes-tip-on{opacity:1;}
.pg-ic-cell{display:inline-flex;align-items:center;gap:4px;}
.pg-ic-icon{width:12px;height:12px;flex-shrink:0;opacity:.4;stroke:#475569;}
.pg-form-link{font-size:12px;font-weight:600;color:#1e3f85;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;text-decoration:none;}
.pg-form-link:hover{color:#3a6fd8;text-decoration:underline;}

/* load more */
.pg-load-more-wrap{display:flex;justify-content:center;padding:20px 16px;}
.pg-load-more-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 32px;border:2px solid #1e3f85;border-radius:99px;background:#fff;color:#1e3f85;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;}
.pg-load-more-btn:hover{background:#1e3f85;color:#fff;}
.pg-load-more-btn:disabled{opacity:.5;cursor:not-allowed;}

/* ── Mobile card view ──────────────────────────────────────── */
.pg-mob-cards{display:none;}

@media (max-width: 768px){
  html,body{overflow-y:auto!important;height:auto!important;}
  .pg-shell{background:#f0f4fb;border-radius:0;border:none;box-shadow:none;min-height:100vh;}

  /* Nav: hide pills, tabs, export, delete; show only add + search */
  .pg-nav-row{
    background:#f0f4fb;
    border-bottom:none;
    display:flex;
    align-items:center;
    gap:10px;
    padding:12px 14px 10px;
    grid-template-columns:none;
  }
  .pg-nav-center,.pg-tb-del,.pg-tb-exp{display:none!important;}
  .pg-nav-left{gap:0;}
  .pg-nav-right{flex:1;}

  /* Add button → blue square icon */
  .pg-tb-add{
    flex-shrink:0!important;
    width:44px!important;min-width:44px;height:44px!important;
    border-radius:12px!important;padding:0!important;
    background:linear-gradient(135deg,#1e3f85,#284f9e);
    color:#fff!important;border:none!important;
    box-shadow:0 8px 20px rgba(30,63,133,.25);
    display:inline-flex;align-items:center;justify-content:center;
    font-size:0!important;
  }
  .pg-tb-add svg{width:22px!important;
                 height:22px!important;}

  /* Search */
  .pg-search-wrap{width:100%;}
  .pg-search{
    width:100%!important;height:40px;
    background:#fff!important;border:1.5px solid #e2e8f4!important;
    border-radius:12px!important;color:#1e293b!important;
    padding-left:36px!important;font-size:13px!important;
    box-shadow:0 1px 4px rgba(0,0,0,.06)!important;
  }
  .pg-search::placeholder{color:#94a3b8!important;}
  .pg-search:focus{border-color:#1e3f85!important;box-shadow:0 0 0 3px rgba(30,63,133,.12);}
  .pg-search-icon{left:12px!important;color:#94a3b8!important;width:15px;height:15px;}
  .pg-search-wrap:focus-within .pg-search-icon{color:#2563eb!important;}

  /* Hide desktop table */
  .pg-tbl-outer{display:none!important;}

  /* Card list */
  .pg-mob-cards{display:block;padding:4px 14px 80px;}

  /* Individual card */
  .pg-mob-card{
    background:#fff;border-radius:18px;
    border:1.5px solid #e8edf8;
    box-shadow:0 2px 12px rgba(37,99,235,.07);
    margin-bottom:12px;overflow:hidden;
    transition:box-shadow .2s,border-color .2s;
  }
  .pg-mob-card.pg-mob-expanded{border-color:#bfdbfe;box-shadow:0 4px 20px rgba(37,99,235,.14);}

  /* Card header (always visible) */
  .pg-mob-head{display:flex;align-items:center;gap:12px;padding:14px 14px 0;}

  /* Avatar */
  .pg-mob-av{
    width:44px;height:44px;min-width:44px;border-radius:50%;
    background:linear-gradient(135deg,#1e3f85,#284f9e);
    color:#fff;display:flex;align-items:center;justify-content:center;
    font-size:17px;font-weight:800;flex-shrink:0;
    box-shadow:0 6px 18px rgba(30,63,133,.29);
  }

  /* Name + company */
  .pg-mob-info{flex:1;min-width:0;}
  .pg-mob-name{font-size:15px;font-weight:800;color:#0f172a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pg-mob-company{font-size:12px;color:#64748b;font-weight:500;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

  /* Status + chevron stacked on right */
  .pg-mob-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;}
  .pg-mob-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap;}
  .pg-mob-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .pg-mob-badge-blue  {background:#eff6ff;color:#2563eb;}
  .pg-mob-badge-amber {background:#fffbeb;color:#d97706;}
  .pg-mob-badge-gray  {background:#f3f4f6;color:#6b7280;}
  .pg-mob-badge-green {background:#ecfdf5;color:#059669;}
  .pg-mob-badge-red   {background:#fef2f2;color:#dc2626;}
  .pg-mob-chevron{width:18px;height:18px;color:#1e3f85;transition:transform .25s,color .15s;flex-shrink:0;}
  .pg-mob-expanded .pg-mob-chevron{transform:rotate(180deg);color:#2563eb;}

  /* Action row */
  .pg-mob-actions{display:flex;gap:10px;padding:12px 14px 14px;}
  .pg-mob-action{
    width:34px;height:34px;border-radius:50%;
    display:inline-flex;align-items:center;justify-content:center;
    text-decoration:none;border:none;cursor:pointer;
    transition:background .15s,transform .1s;flex-shrink:0;
    font-size:15px;
  }
  .pg-mob-action:hover{transform:scale(1.1);}
  .pg-mob-action-phone{background:#eff6ff;color:#1e3f85;border-color:#1e3f75;border:1.5px solid #1e3985;box-shadow:0 2px 8px rgba(37,99,235,.12);}
  .pg-mob-action-wa   {background:#f0fdf4;color:#16a34a;border:1.5px solid #1e3985;border-color:#1e3985;box-shadow:0 2px 8px rgba(37,99,235,.12);}
  .pg-mob-action-maps {background:#fef2f2;color:#1e3f85;border-color:#1e3f85;border:1.5px solid #1e3f85;box-shadow:0 2px 8px rgba(37,99,235,.12);}
  .pg-mob-action-edit {background:#fff;color:#1e3f85;border:1.5px solid #1e3985;border-color:#1e3f85;  box-shadow:0 2px 8px rgba(37,99,235,.12);}
  .pg-mob-action-edit:hover{
    background:#edf2fb;
    color:#143b80;
    border-color:#143b80;
}

  /* Expandable detail panel */
  .pg-mob-details{
    max-height:0;overflow:hidden;
    transition:max-height .38s cubic-bezier(.4,0,.2,1);
  }
  .pg-mob-expanded .pg-mob-details{max-height:600px;}
  .pg-mob-details-inner{border-top:1px solid #f0f4fb;padding:12px 14px 14px;}

  .pg-mob-section{
    font-size:10px;font-weight:800;color:#2563eb;
  S  text-transform:uppercase;letter-spacing:.6px;
    margin:10px 0 6px;padding-bottom:4px;
    border-bottom:1px solid #e8edf8;
  }
  .pg-mob-section:first-child{margin-top:0;}
  .pg-mob-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #f8fafc;}
  .pg-mob-row:last-child{border-bottom:none;}
  .pg-mob-lbl{font-size:11px;color:#64748b;font-weight:600;}
  .pg-mob-val{font-size:12px;color:#1e293b;font-weight:600;text-align:right;max-width:60%;word-break:break-word;}

  .pg-mob-view-btn{
    display:block;width:100%;margin-top:12px;padding:10px;
    border-radius:12px;background:#1e3f85;color:#fff;
    text-align:center;font-weight:700;font-size:13px;
    text-decoration:none;border:none;cursor:pointer;
    transition:background .15s,transform:.15s;
  }
  .pg-mob-view-btn:hover{background:#1d4ed8; color:#fff;
    transform:translateY(-1px);}

  /* ── Frappe dialog overrides on mobile ── */
  .modal-dialog{max-width:420px!important;margin:18px auto!important;}
  .modal-content{
    border-radius:24px!important;border:none!important;overflow:hidden;
    box-shadow:0 18px 45px rgba(37,99,235,.22)!important;
  }
  .modal-header{
    background:linear-gradient(135deg,#2563eb,#7c3aed)!important;
    color:#fff!important;border:none!important;padding:18px!important;background:#1e3f85!important;
  }
  .modal-title{color:#fff!important;font-weight:800!important;}
  .modal-header .btn-modal-close,.modal-header .close{color:rgba(255,255,255,.8)!important;opacity:1!important;}
  .modal-body{background:#fff!important;padding:20px!important;}
  .modal-footer{background:#fff!important;border-top:1px solid #e8edf8!important;padding:12px 20px!important;}
  .control-label,.frappe-control .control-label{
    color:#2563eb!important;font-size:11px!important;font-weight:800!important;
    text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px!important;
  }
  .form-control,input.form-control,select.form-control,textarea.form-control{
    border:1.5px solid #dbeafe!important;border-radius:12px!important;
    min-height:38px!important;background:#fff!important;
    padding:8px 12px!important;font-size:13px!important;
    transition:border-color .15s,box-shadow .15s;
  }
  .form-control:focus,input.form-control:focus,select.form-control:focus,textarea.form-control:focus{
    border-color:#2563eb!important;box-shadow:0 0 0 3px rgba(37,99,235,.12)!important;
  }
  .btn.btn-primary{
    background:linear-gradient(135deg,#2563eb,#7c3aed)!important;
    border:none!important;border-radius:14px!important;
    min-height:42px!important;font-weight:800!important;font-size:14px!important;
    box-shadow:0 4px 14px rgba(37,99,235,.35)!important;
    transition:opacity .15s!important;
  }
  .btn.btn-primary:hover{opacity:.9!important;}
  .btn.btn-secondary,.btn.btn-default{
    border-radius:14px!important;min-height:42px!important;
    font-weight:700!important;border:1.5px solid #dbeafe!important;
    background:#f8fbff!important;color:#2563eb!important;
  }
  /* Section picker buttons inside our edit menu */
  .pg-mob-section-btn{
    display:block;width:100%;margin-bottom:10px;padding:14px 16px;
    border:1px solid  #2e8ef0!important;;border-radius:14px;background:#eff6ff;color:#1e3f85;
    font-weight:800;font-size:14px;text-align:left;cursor:pointer;
    transition:background .15s;
  }
  .pg-mob-section-btn:hover{background:#dbeafe;}
}
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
        mail:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0"><rect x="1" y="3" width="14" height="10" rx="1.5"/><polyline points="1,3 8,9 15,3"/></svg>`,
        extlnk: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;flex-shrink:0;opacity:.5"><path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"/><path d="M8 1h3v3"/><line x1="11" y1="1" x2="5" y2="7"/></svg>`,
        wa:     `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
        waapi:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;flex-shrink:0"><path d="M2 11L8 2l6 9H2z"/><line x1="5" y1="8" x2="11" y2="8"/></svg>`,
        file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:22px;height:22px;color:#94a3b8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        person:  `<svg class="pg-ic-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`,
        building:`<svg class="pg-ic-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M6 14V9h4v5"/><line x1="2" y1="7" x2="14" y2="7"/></svg>`,
        lead_ic: `<svg class="pg-ic-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 4H14l-3.5 2.5 1.5 4L8 10.5 4 12.5l1.5-4L2 6h4.5z"/></svg>`,
        copy:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><rect x="5" y="5" width="8" height="9" rx="1.2"/><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h7a1 1 0 011 1v2"/></svg>`,
        check:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><polyline points="2,8 6,12 14,4"/></svg>`,
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
                if (empty) return `<span class="pg-mt">—</span>`;
                if (col.icon && SVG[col.icon]) return `<span class="pg-ic-cell">${SVG[col.icon]}<span>${_e(v)}</span></span>`;
                return `<span>${_e(v)}</span>`;
            case "select":
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
            case "link": {
                if (empty) return `<span class="pg-mt">—</span>`;
                const val = String(v);
                // Email → compose button
                if (col.key === "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    return `<button class="pg-email-btn" data-email="${_e(val)}" title="Compose email">${SVG.mail}<span>${_e(val)}</span></button>`;
                }
                // Social / URL → external link
                let href = val;
                if (!/^https?:\/\//i.test(href)) {
                    if (col.key === "instagram" && href.startsWith("@")) href = "https://instagram.com/" + href.slice(1);
                    else if (col.key === "telegram" && href.startsWith("@"))  href = "https://t.me/" + href.slice(1);
                    else if (col.key === "tiktok"   && href.startsWith("@"))  href = "https://tiktok.com/@" + href.slice(1);
                    else if (col.key === "x"        && href.startsWith("@"))  href = "https://x.com/" + href.slice(1);
                    else href = "https://" + href;
                }
                return `<a class="pg-social-lnk" href="${_e(href)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${_e(val)}${SVG.extlnk}</a>`;
            }
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
                    `<a class="pg-wa-btn" href="${_e(waUrl)}" target="_blank" title="WhatsApp" onclick="event.stopPropagation()">${SVG.wa}</a>` +
                    `<button class="pg-wa-api-btn" data-phone="${_e(digits)}" title="Send via WhatsApp API">${SVG.waapi}</button>`
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
                    `<button class="pg-map-copy" data-url="${_e(url)}" title="Copy link">${SVG.copy}</button>` +
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
            case "notes":
                return empty ? `<span class="pg-mt">—</span>` : `<span class="pg-notes-cell" data-notes="${_e(String(v))}">${_e(String(v))}</span>`;
            case "owner": {
                const initials = v || "?";
                const color    = _ownerColor(initials);
                const owner    = row.owner || "";
                return `<span class="pg-owner-av" style="background:${color}" data-owner="${_e(owner)}" data-initials="${_e(initials)}" data-color="${_e(color)}">${_e(initials)}</span>`;
            }
            case "dynselect":
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
            case "contact-link": {
                if (empty) return `<span class="pg-mt">—</span>`;
                const name = String(v);
                if (col.noAvatar) return `<span class="pg-cl-name" data-contact-name="${_e(name)}" data-row-owner="${_e(row.owner||"")}">${_e(name)}</span>`;
                const words = name.trim().split(/\s+/);
                const ini = words.length === 1
                    ? words[0][0].toUpperCase()
                    : (words[0][0] + words[words.length - 1][0]).toUpperCase();
                const color = _ownerColor(ini);
                const rowOwner = row.owner || "";
                return `<span class="pg-contact-av" style="background:${color}" data-contact-name="${_e(name)}" data-ini="${_e(ini)}" data-color="${_e(color)}" data-row-owner="${_e(rowOwner)}">${_e(ini)}</span>`;
            }
            case "form-link": {
                const dt = col.link_doctype || cfg.doctype || "";
                return v ? `<a class="pg-form-link" data-doctype="${_e(dt)}" data-docname="${_e(v)}">${_e(v)}</a>`
                         : `<span class="pg-mt">—</span>`;
            }
            case "locautocomplete":
                return empty ? `<span class="pg-mt">—</span>` : `<span>${_e(v)}</span>`;
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
            `<th class="pg-v pg-v-${c.tab}"${!cfg.autoFit && c.width ? ` style="min-width:${c.width}px;width:${c.width}px"` : ""}>${c.label}</th>`
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
            return `<td class="pg-v pg-v-${c.tab}${ed?" pg-ed":""}"${!cfg.autoFit && c.width ? ` style="min-width:${c.width}px;width:${c.width}px"` : ""}${ed?` data-ff="${_e(c.frappe_field)}" data-val="${_e(rawVal)}" data-ctype="${c.type||"text"}" data-ckey="${c.key}"`:""} data-row-name="${_e(name)}">${renderCell(c, row)}</td>`;
        }).join("");
        return `<tr class="${idx%2?"pg-tr-alt":""}" data-row-name="${_e(name)}">${fixed}${vars}</tr>`;
    }

    // ── Popup helpers ──────────────────────────────────────────────
    let _mapsPopup = null, _mapsTimer = null;
    let _filesPopup = null, _filesTimer = null;
    let _ownerPopup = null, _ownerTimer = null;
    const _filesCache = {}; // name → files array
    const _ownerCache = {}; // owner email → user data

    let _contactPopup = null, _contactTimer = null;
    const _contactCache = {}; // full_name → Contact record

    function _ensureContactPopup() {
        if (_contactPopup) return;
        _contactPopup = document.createElement("div");
        _contactPopup.className = "pg-owner-popup";
        _contactPopup.addEventListener("mouseenter", () => clearTimeout(_contactTimer));
        _contactPopup.addEventListener("mouseleave", () => { _contactTimer = setTimeout(_hideContactPopup, 120); });
        document.body.appendChild(_contactPopup);
    }

    function _hideContactPopup() {
        if (_contactPopup) _contactPopup.classList.remove("pg-popup-vis");
    }

    function _renderContactPopup(c, ini, color, root, rowOwner) {
        const name    = c.full_name || ini;
        const mobile  = c.mobile_no || "";
        const email   = c.email_id || "";
        const company = c.company_name || "";
        const rowName = c.name || "";
        const ref     = c.custom_reference_user || rowOwner || "";
        const refLabel = c.custom_reference_full_name || ref.split("@")[0] || ref;
        const bldgSvg  = `<svg class="pg-owner-popup-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 15V6l6-5 6 5v9"/><path d="M6 15v-4h4v4"/></svg>`;
        const phoneSvg = `<svg class="pg-owner-popup-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 2h3l1.5 3.5-1.5 1a8 8 0 003.5 3.5l1-1.5L14 10v3a1 1 0 01-1 1A11 11 0 012 3a1 1 0 011-1z"/></svg>`;
        const refSvg   = `<svg class="pg-owner-popup-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`;
        const digits   = mobile.replace(/\D/g, "");
        _contactPopup.innerHTML =
            `<div class="pg-owner-popup-top">` +
            `<span class="pg-owner-popup-av" style="background:${_e(color)}">${_e(ini)}</span>` +
            `<span class="pg-owner-popup-name">${_e(name)}</span>` +
            `</div>` +
            `<div class="pg-owner-popup-rows">` +
            (company ? `<div class="pg-owner-popup-row">${bldgSvg}<span>${_e(company)}</span></div>` : "") +
            (email   ? `<div class="pg-owner-popup-row">${SVG.mail}<span>${_e(email)}</span></div>` : "") +
            (mobile  ? `<div class="pg-owner-popup-row">${phoneSvg}<span>${_e(mobile)}</span></div>` : "") +
            `<div class="pg-owner-popup-row pg-cp-ref-row">` +
                refSvg +
                `<select class="pg-cp-ref-sel" data-contact-name="${_e(rowName)}" data-current="${_e(ref)}" title="Reference person">` +
                    `<option value="${_e(ref)}">${_e(refLabel || "Set reference…")}</option>` +
                `</select>` +
            `</div>` +
            `</div>` +
            ((mobile || email) ?
            `<div class="pg-cp-actions">` +
            (mobile ? `<a class="pg-cp-act pg-cp-act-wa" href="https://wa.me/${_e(digits)}" target="_blank" rel="noopener" title="WhatsApp">${SVG.wa}</a>` : "") +
            (email  ? `<button class="pg-cp-act pg-cp-act-mail pg-cp-mail" data-email="${_e(email)}" data-rowname="${_e(rowName)}" title="Send email">${SVG.mail}</button>` : "") +
            `</div>` : "");

        // Populate reference dropdown with User list
        const refSel = _contactPopup.querySelector(".pg-cp-ref-sel");
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: "User", filters: [["enabled", "=", 1], ["user_type", "=", "System User"]], fields: ["name", "full_name"], limit: 50 },
            callback(r) {
                if (!refSel.isConnected) return;
                const users = r.message || [];
                refSel.innerHTML = `<option value="">— No reference —</option>` +
                    users.map(u => `<option value="${_e(u.name)}"${u.name === ref ? " selected" : ""}>${_e(u.full_name || u.name)}</option>`).join("");
                if (ref && !users.find(u => u.name === ref)) {
                    refSel.innerHTML += `<option value="${_e(ref)}" selected>${_e(refLabel)}</option>`;
                }
            },
        });

        refSel.addEventListener("change", () => {
            const newRef = refSel.value;
            const cName  = refSel.dataset.contactName;
            if (!cName) return;
            frappe.db.set_value("Contact", cName, "custom_reference_user", newRef);
            if (_contactCache[name]) _contactCache[name].custom_reference_user = newRef;
        });

        // wire mail button
        const mailBtn = _contactPopup.querySelector(".pg-cp-mail");
        if (mailBtn) {
            mailBtn.addEventListener("click", () => {
                _hideContactPopup();
                if (root) _openCompose(email, rowName, root._pgCfg || {});
            });
        }
    }

    function _showContactPopup(anchor, contactName, ini, color, root, rowOwner) {
        _ensureContactPopup();
        _contactPopup.classList.add("pg-popup-vis");
        if (_contactCache[contactName]) {
            _renderContactPopup(_contactCache[contactName], ini, color, root, rowOwner);
            _positionPopup(_contactPopup, anchor);
            return;
        }
        _contactPopup.innerHTML = `<div style="padding:16px;font-size:12px;color:#9ca3af;text-align:center">Loading…</div>`;
        _positionPopup(_contactPopup, anchor);
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: "Contact", filters: [["full_name", "=", contactName]], fields: ["name", "full_name", "company_name", "mobile_no", "email_id", "custom_reference_user"], limit: 1 },
            callback(r) {
                const c = (r.message || [])[0] || { full_name: contactName };
                _contactCache[contactName] = c;
                if (_contactPopup.classList.contains("pg-popup-vis")) {
                    _renderContactPopup(c, ini, color, root, rowOwner);
                    _positionPopup(_contactPopup, anchor);
                }
            },
        });
    }

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
            `<button class="pg-popup-expand" data-expand="files" data-name="${_e(name)}" title="Expand files">${SVG.expand}</button>` +
            `<div class="pg-fp-items">${items}</div>` +
            `</div>`;
    }

    function _hideFilesPopup() {
        if (_filesPopup) _filesPopup.classList.remove("pg-popup-vis");
    }

    function _ensureOwnerPopup() {
        if (_ownerPopup) return;
        _ownerPopup = document.createElement("div");
        _ownerPopup.className = "pg-owner-popup";
        _ownerPopup.addEventListener("mouseenter", () => clearTimeout(_ownerTimer));
        _ownerPopup.addEventListener("mouseleave", () => { _ownerTimer = setTimeout(_hideOwnerPopup, 120); });
        document.body.appendChild(_ownerPopup);
    }

    function _hideOwnerPopup() {
        if (_ownerPopup) _ownerPopup.classList.remove("pg-popup-vis");
    }

    function _renderOwnerPopup(u, initials, color) {
        const name  = u.full_name  || initials;
        const email = u.email      || "";
        const phone = u.phone      || u.mobile_no || "";
        const loc   = "Beirut";
        _ownerPopup.innerHTML =
            `<div class="pg-owner-popup-top">` +
            `<span class="pg-owner-popup-av" style="background:${_e(color)}">${_e(initials)}</span>` +
            `<span class="pg-owner-popup-name">${_e(name)}</span>` +
            `</div>` +
            `<div class="pg-owner-popup-rows">` +
            (email ? `<div class="pg-owner-popup-row">${SVG.mail}<span>${_e(email)}</span></div>` : "") +
            (phone ? `<div class="pg-owner-popup-row"><svg class="pg-owner-popup-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 2h3l1.5 3.5-1.5 1a8 8 0 003.5 3.5l1-1.5L14 10v3a1 1 0 01-1 1A11 11 0 012 3a1 1 0 011-1z"/></svg><span>${_e(phone)}</span></div>` : "") +
            `</div>` +
            `<div class="pg-owner-popup-loc"><svg class="pg-owner-popup-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5z"/><circle cx="8" cy="6" r="1.5"/></svg><span>${_e(loc)}</span></div>`;
    }

    function _showOwnerPopup(anchor, owner, initials, color) {
        _ensureOwnerPopup();
        _ownerPopup.classList.add("pg-popup-vis");

        if (!owner) {
            _renderOwnerPopup({ full_name: initials }, initials, color);
            _positionPopup(_ownerPopup, anchor);
            return;
        }
        if (_ownerCache[owner]) {
            _renderOwnerPopup(_ownerCache[owner], initials, color);
            _positionPopup(_ownerPopup, anchor);
            return;
        }
        _ownerPopup.innerHTML = `<div style="padding:16px;font-size:12px;color:#9ca3af;text-align:center">Loading…</div>`;
        _positionPopup(_ownerPopup, anchor);
        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "User", name: owner },
            callback(r) {
                _ownerCache[owner] = r.message || { full_name: initials, email: owner };
                if (_ownerPopup.classList.contains("pg-popup-vis")) {
                    _renderOwnerPopup(_ownerCache[owner], initials, color);
                    _positionPopup(_ownerPopup, anchor);
                }
            },
            error() {
                _ownerCache[owner] = { full_name: initials, email: owner };
                if (_ownerPopup.classList.contains("pg-popup-vis")) {
                    _renderOwnerPopup(_ownerCache[owner], initials, color);
                    _positionPopup(_ownerPopup, anchor);
                }
            },
        });
    }

    // ── Email compose panel ────────────────────────────────────────
    function _openCompose(email, rowName, cfg) {
        const existing = document.querySelector(".pg-compose");
        if (existing) existing.remove();

        const panel = document.createElement("div");
        panel.className = "pg-compose";
        panel.innerHTML =
            `<div class="pg-compose-head">` +
            `<span class="pg-compose-title">${SVG.mail} New Message</span>` +
            `<div class="pg-compose-head-btns">` +
            `<button class="pg-compose-hbtn pg-compose-mailto-head" title="Open in mail app">${SVG.extlnk}</button>` +
            `<button class="pg-compose-hbtn pg-compose-close-btn">${SVG.close}</button>` +
            `</div></div>` +
            `<div class="pg-compose-row pg-compose-row--tags" id="pg-to-row">` +
            `<span class="pg-compose-lbl">To</span>` +
            `<div class="pg-compose-tags"><input class="pg-compose-tag-inp" type="text" placeholder="Add recipient…" autocomplete="off"></div>` +
            `<button class="pg-compose-bulk-btn" title="Broadcast / select multiple">${SVG.plus}</button>` +
            `</div>` +
            `<div class="pg-compose-row"><span class="pg-compose-lbl">Subject</span><input class="pg-compose-inp pg-compose-subject" type="text" placeholder="Subject…"></div>` +
            `<textarea class="pg-compose-body" placeholder="Write your message…"></textarea>` +
            `<div class="pg-compose-foot">` +
            `<button class="pg-compose-send">${SVG.mail} Send</button>` +
            `<button class="pg-compose-mailto">${SVG.extlnk} Open in mail app</button>` +
            `</div>`;

        document.body.appendChild(panel);

        const $toRow   = panel.querySelector("#pg-to-row");
        const $tags    = panel.querySelector(".pg-compose-tags");
        const $subject = panel.querySelector(".pg-compose-subject");
        const $body    = panel.querySelector(".pg-compose-body");
        const close    = () => panel.remove();
        let   _recipients = [];

        panel.querySelector(".pg-compose-close-btn").addEventListener("click", close);

        // ── Tag input helpers ──────────────────────────────────
        function _getInp() { return $tags.querySelector(".pg-compose-tag-inp"); }

        function _addTag(addr) {
            addr = addr.trim();
            if (!addr || _recipients.includes(addr)) return;
            _recipients.push(addr);
            const tag = document.createElement("span");
            tag.className = "pg-compose-tag";
            tag.innerHTML = `${_e(addr)}<button class="pg-compose-tag-x" title="Remove"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:8px;height:8px"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>`;
            tag.querySelector(".pg-compose-tag-x").addEventListener("click", () => {
                _recipients = _recipients.filter(r => r !== addr);
                tag.remove();
            });
            $tags.insertBefore(tag, _getInp());
            _getInp().value = "";
        }

        // Seed initial email as a tag
        if (email) _addTag(email);

        // Confirm on comma / Enter
        $tags.addEventListener("keydown", e => {
            const inp = _getInp();
            if ((e.key === "," || e.key === "Enter") && inp.value.trim()) {
                e.preventDefault();
                _addTag(inp.value.replace(",",""));
                _closeAc();
            }
            if (e.key === "Backspace" && !inp.value && _recipients.length) {
                const last = _recipients[_recipients.length - 1];
                _recipients.pop();
                [...$tags.querySelectorAll(".pg-compose-tag")].at(-1)?.remove();
            }
        });

        // Click anywhere in tags area focuses the input
        $tags.addEventListener("click", () => _getInp().focus());

        // ── Autocomplete ──────────────────────────────────────
        let _acTimer = null, _acDropdown = null;

        function _closeAc() {
            if (_acDropdown) { _acDropdown.remove(); _acDropdown = null; }
        }

        function _showAc(results) {
            _closeAc();
            const visible = results.filter(r => r.custom_email && !_recipients.includes(r.custom_email));
            if (!visible.length) return;
            _acDropdown = document.createElement("div");
            _acDropdown.className = "pg-compose-ac";
            visible.forEach(r => {
                const name = [r.custom_first_name, r.custom_last_name].filter(Boolean).join(" ") || r.company_name || r.name;
                const item = document.createElement("div");
                item.className = "pg-compose-ac-item";
                item.innerHTML = `<span class="pg-compose-ac-name">${_e(name)}</span><span class="pg-compose-ac-email">${_e(r.custom_email)}</span>`;
                item.addEventListener("mousedown", e => {
                    e.preventDefault();
                    _addTag(r.custom_email);
                    _closeAc();
                });
                _acDropdown.appendChild(item);
            });
            if (_acDropdown.children.length) $toRow.appendChild(_acDropdown);
        }

        $tags.addEventListener("input", e => {
            if (e.target !== _getInp()) return;
            clearTimeout(_acTimer);
            const seg = _getInp().value.trim();
            if (seg.length < 2) { _closeAc(); return; }
            _acTimer = setTimeout(() => {
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Prospect",
                        or_filters: [
                            ["custom_email",      "like", "%" + seg + "%"],
                            ["custom_first_name", "like", "%" + seg + "%"],
                            ["custom_last_name",  "like", "%" + seg + "%"],
                            ["company_name",      "like", "%" + seg + "%"],
                        ],
                        fields: ["name","custom_first_name","custom_last_name","company_name","custom_email"],
                        limit: 8,
                    },
                    callback(r) { _showAc(r.message || []); },
                });
            }, 200);
        });

        $tags.addEventListener("focusout", () => setTimeout(_closeAc, 150));

        // ── Broadcast / bulk select ────────────────────────────
        panel.querySelector(".pg-compose-bulk-btn").addEventListener("click", () => {
            _openBroadcast(cfg, selected => selected.forEach(_addTag));
        });

        // ── Open in mail app ───────────────────────────────────
        const openMailto = () => {
            const to  = _recipients.join(",");
            const sub = encodeURIComponent($subject.value.trim());
            const bod = encodeURIComponent($body.value.trim());
            window.open(`mailto:${to}?subject=${sub}&body=${bod}`);
        };
        panel.querySelector(".pg-compose-mailto-head").addEventListener("click", openMailto);
        panel.querySelector(".pg-compose-mailto").addEventListener("click", openMailto);

        // ── Send ───────────────────────────────────────────────
        panel.querySelector(".pg-compose-send").addEventListener("click", () => {
            // Confirm any pending typed address
            const pending = _getInp().value.trim();
            if (pending) _addTag(pending);

            const to      = _recipients.join(", ");
            const subject = $subject.value.trim();
            const content = $body.value.trim();
            if (!to || !subject || !content) {
                frappe.show_alert({ message: "Please fill To, Subject and message.", indicator: "orange" }, 4);
                return;
            }
            frappe.call({
                method: "frappe.core.doctype.communication.email.make",
                args: {
                    doctype:              cfg.doctype || "Prospect",
                    name:                 rowName,
                    subject,
                    content,
                    recipients:           to,
                    sent_or_received:     "Sent",
                    communication_medium: "Email",
                    send_email:           1,
                },
                callback() { frappe.show_alert({ message: "Email sent", indicator: "green" }, 3); close(); },
                error(err) {
                    const msg = (err && err.message) || "";
                    if (msg.includes("email account") || msg.includes("Email Account")) {
                        frappe.msgprint({
                            title: "Email account not configured",
                            message: 'No default outbound email account found.<br><br><a href="/app/email-account" style="color:#2563eb;font-weight:600">→ Go to Settings › Email Account</a> and set one as default.',
                            indicator: "orange",
                        });
                    } else {
                        frappe.show_alert({ message: "Send failed: " + (msg || "unknown error"), indicator: "red" }, 5);
                    }
                },
            });
        });

        requestAnimationFrame(() => $subject.focus());
    }

    // ── WhatsApp API compose panel ────────────────────────────────
    function _openWaCompose(phone, rowName, cfg) {
        const existing = document.querySelector(".pg-wa-compose");
        if (existing) existing.remove();

        const panel = document.createElement("div");
        panel.className = "pg-wa-compose pg-compose";
        panel.innerHTML =
            `<div class="pg-compose-head">` +
            `<span class="pg-compose-title">${SVG.wa} WhatsApp API</span>` +
            `<div class="pg-compose-head-btns">` +
            `<button class="pg-compose-hbtn pg-wac-settings-btn" title="API Settings">${SVG.pen}</button>` +
            `<button class="pg-compose-hbtn pg-compose-close-btn">${SVG.close}</button>` +
            `</div></div>` +
            `<div class="pg-compose-row pg-compose-row--tags" id="pg-wac-to-row">` +
            `<span class="pg-compose-lbl">To</span>` +
            `<div class="pg-compose-tags"><input class="pg-compose-tag-inp" type="text" placeholder="Phone number (with country code)…" autocomplete="off"></div>` +
            `<button class="pg-compose-bulk-btn" title="Select multiple">${SVG.plus}</button>` +
            `</div>` +
            `<textarea class="pg-compose-body" placeholder="Write your WhatsApp message…"></textarea>` +
            `<div class="pg-compose-foot">` +
            `<button class="pg-compose-send">${SVG.waapi} Send via API</button>` +
            `<button class="pg-wa-compose-open">${SVG.wa} Open in WhatsApp</button>` +
            `</div>`;

        document.body.appendChild(panel);

        const $toRow = panel.querySelector("#pg-wac-to-row");
        const $tags  = panel.querySelector(".pg-compose-tags");
        const $body  = panel.querySelector(".pg-compose-body");
        const close  = () => panel.remove();
        let _recipients = [];

        panel.querySelector(".pg-compose-close-btn").addEventListener("click", close);

        function _getInp() { return $tags.querySelector(".pg-compose-tag-inp"); }

        function _addTag(num) {
            num = num.trim().replace(/\D/g, "");
            if (!num || _recipients.includes(num)) return;
            _recipients.push(num);
            const tag = document.createElement("span");
            tag.className = "pg-compose-tag";
            tag.innerHTML = `+${_e(num)}<button class="pg-compose-tag-x" title="Remove"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:8px;height:8px"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>`;
            tag.querySelector(".pg-compose-tag-x").addEventListener("click", () => {
                _recipients = _recipients.filter(r => r !== num);
                tag.remove();
            });
            $tags.insertBefore(tag, _getInp());
            _getInp().value = "";
        }

        if (phone) _addTag(phone);

        $tags.addEventListener("keydown", e => {
            const inp = _getInp();
            if ((e.key === "," || e.key === "Enter") && inp.value.trim()) {
                e.preventDefault();
                _addTag(inp.value.replace(",", ""));
            }
            if (e.key === "Backspace" && !inp.value && _recipients.length) {
                _recipients.pop();
                [...$tags.querySelectorAll(".pg-compose-tag")].at(-1)?.remove();
            }
        });
        $tags.addEventListener("click", () => _getInp().focus());

        // Autocomplete from prospect mobiles
        let _acTimer = null, _acDropdown = null;
        function _closeAc() { if (_acDropdown) { _acDropdown.remove(); _acDropdown = null; } }
        function _showAc(results) {
            _closeAc();
            const visible = results.filter(r => r.custom_mobile && !_recipients.includes(String(r.custom_mobile).replace(/\D/g, "")));
            if (!visible.length) return;
            _acDropdown = document.createElement("div");
            _acDropdown.className = "pg-compose-ac";
            visible.forEach(r => {
                const name = [r.custom_first_name, r.custom_last_name].filter(Boolean).join(" ") || r.company_name || r.name;
                const item = document.createElement("div");
                item.className = "pg-compose-ac-item";
                item.innerHTML = `<span class="pg-compose-ac-name">${_e(name)}</span><span class="pg-compose-ac-email">${_e(r.custom_mobile)}</span>`;
                item.addEventListener("mousedown", e => {
                    e.preventDefault();
                    _addTag(String(r.custom_mobile).replace(/\D/g, ""));
                    _closeAc();
                });
                _acDropdown.appendChild(item);
            });
            if (_acDropdown.children.length) $toRow.appendChild(_acDropdown);
        }

        $tags.addEventListener("input", e => {
            if (e.target !== _getInp()) return;
            clearTimeout(_acTimer);
            const seg = _getInp().value.trim();
            if (seg.length < 2) { _closeAc(); return; }
            _acTimer = setTimeout(() => {
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Prospect",
                        or_filters: [
                            ["custom_mobile",     "like", "%" + seg + "%"],
                            ["custom_first_name", "like", "%" + seg + "%"],
                            ["custom_last_name",  "like", "%" + seg + "%"],
                            ["company_name",      "like", "%" + seg + "%"],
                        ],
                        fields: ["name","custom_first_name","custom_last_name","company_name","custom_mobile"],
                        limit: 8,
                    },
                    callback(r) { _showAc(r.message || []); },
                });
            }, 200);
        });
        $tags.addEventListener("focusout", () => setTimeout(_closeAc, 150));

        // Bulk select
        panel.querySelector(".pg-compose-bulk-btn").addEventListener("click", () => {
            _openWaBroadcast(cfg, selected => selected.forEach(_addTag));
        });

        // Open in WhatsApp app (first recipient)
        panel.querySelector(".pg-wa-compose-open").addEventListener("click", () => {
            const num = _recipients[0];
            if (!num) { frappe.show_alert({ message: "Add at least one recipient.", indicator: "orange" }, 3); return; }
            const msg = encodeURIComponent($body.value.trim());
            window.open(`https://wa.me/${num}${msg ? "?text=" + msg : ""}`, "_blank");
        });

        // Settings shortcut
        panel.querySelector(".pg-wac-settings-btn").addEventListener("click", () => {
            frappe.msgprint({
                title: "WhatsApp API Settings",
                message: 'Configure your WhatsApp Business API credentials in <b>Site Config</b>:<br><br>' +
                    '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">wa_api_token</code> — your Meta access token<br>' +
                    '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">wa_phone_number_id</code> — your WhatsApp Phone Number ID<br><br>' +
                    'Set these in <b>bench set-config</b> or via <a href="/app/system-settings" style="color:#15803d;font-weight:600">System Settings</a>.',
                indicator: "green",
            });
        });

        // Send
        panel.querySelector(".pg-compose-send").addEventListener("click", () => {
            const pending = _getInp().value.trim();
            if (pending) _addTag(pending);

            const message = $body.value.trim();
            if (!_recipients.length || !message) {
                frappe.show_alert({ message: "Add at least one recipient and a message.", indicator: "orange" }, 4);
                return;
            }
            const btn = panel.querySelector(".pg-compose-send");
            btn.disabled = true;
            btn.style.opacity = ".6";

            const sends = _recipients.map(num =>
                new Promise(resolve => {
                    frappe.call({
                        method: "erp_next_custom.erp_next_custom.api.send_whatsapp_message",
                        args: { to: num, message, prospect_name: rowName },
                        callback(r) { resolve({ num, ok: true, r }); },
                        error(err) { resolve({ num, ok: false, err }); },
                    });
                })
            );

            Promise.all(sends).then(results => {
                btn.disabled = false;
                btn.style.opacity = "";
                const failed = results.filter(r => !r.ok);
                if (!failed.length) {
                    frappe.show_alert({ message: `WhatsApp message sent to ${results.length} recipient${results.length > 1 ? "s" : ""}.`, indicator: "green" }, 4);
                    close();
                } else {
                    frappe.show_alert({ message: `Sent ${results.length - failed.length}/${results.length}. ${failed.length} failed.`, indicator: "orange" }, 5);
                }
            });
        });

        requestAnimationFrame(() => $body.focus());
    }

    // ── WhatsApp API broadcast modal ──────────────────────────────
    function _openWaBroadcast(cfg, onConfirm) {
        let _allProspects = [];
        let _selected     = new Set();

        const overlay = document.createElement("div");
        overlay.className = "pg-bcast-overlay";
        overlay.innerHTML =
            `<div class="pg-bcast-box">` +
            `<div class="pg-bcast-head"><span class="pg-bcast-title">Select Recipients</span><button class="pg-bcast-close">${SVG.close}</button></div>` +
            `<div class="pg-bcast-search"><input class="pg-bcast-search-inp" type="text" placeholder="Search by name, company or mobile…"></div>` +
            `<div class="pg-bcast-selall"><input type="checkbox" id="pg-wabcast-all"><label for="pg-wabcast-all" style="cursor:pointer">Select all visible</label></div>` +
            `<div class="pg-bcast-list"></div>` +
            `<div class="pg-bcast-foot"><span class="pg-bcast-count">0 selected</span><button class="pg-bcast-confirm">Add to recipients</button></div>` +
            `</div>`;
        document.body.appendChild(overlay);

        const $list   = overlay.querySelector(".pg-bcast-list");
        const $search = overlay.querySelector(".pg-bcast-search-inp");
        const $selAll = overlay.querySelector("#pg-wabcast-all");
        const $count  = overlay.querySelector(".pg-bcast-count");
        const closeOv = () => overlay.remove();

        overlay.querySelector(".pg-bcast-close").addEventListener("click", closeOv);
        overlay.addEventListener("click", e => { if (e.target === overlay) closeOv(); });

        function _updateCount() { $count.textContent = `${_selected.size} selected`; }

        function _renderList(prospects) {
            $list.innerHTML = "";
            if (!prospects.length) { $list.innerHTML = `<div class="pg-bcast-empty">No prospects with mobile numbers found.</div>`; return; }
            prospects.forEach(p => {
                const name = [p.custom_first_name, p.custom_last_name].filter(Boolean).join(" ") || p.company_name || p.name;
                const num  = String(p.custom_mobile || "").replace(/\D/g, "");
                if (!num) return;
                const checked = _selected.has(num);
                const row = document.createElement("label");
                row.className = "pg-bcast-item";
                row.innerHTML = `<input type="checkbox" value="${_e(num)}"${checked ? " checked" : ""}><span class="pg-bcast-item-name">${_e(name)}</span><span class="pg-bcast-item-email">+${_e(num)}</span>`;
                row.querySelector("input").addEventListener("change", ev => {
                    ev.target.checked ? _selected.add(num) : _selected.delete(num);
                    _updateCount();
                    $selAll.checked = [...$list.querySelectorAll("input[type=checkbox]")].every(c => c.checked);
                });
                $list.appendChild(row);
            });
        }

        $search.addEventListener("input", () => {
            const q = $search.value.toLowerCase();
            const filtered = _allProspects.filter(p => {
                const name = [p.custom_first_name, p.custom_last_name, p.company_name].filter(Boolean).join(" ").toLowerCase();
                return name.includes(q) || String(p.custom_mobile || "").includes(q);
            });
            _renderList(filtered);
        });

        $selAll.addEventListener("change", () => {
            $list.querySelectorAll("input[type=checkbox]").forEach(c => {
                c.checked = $selAll.checked;
                const num = c.value;
                $selAll.checked ? _selected.add(num) : _selected.delete(num);
            });
            _updateCount();
        });

        overlay.querySelector(".pg-bcast-confirm").addEventListener("click", () => {
            onConfirm([..._selected]);
            closeOv();
        });

        $list.innerHTML = `<div class="pg-bcast-empty">Loading…</div>`;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Prospect",
                filters: [["custom_mobile", "!=", ""]],
                fields: ["name","custom_first_name","custom_last_name","company_name","custom_mobile"],
                limit: 500,
            },
            callback(r) {
                _allProspects = (r.message || []).filter(p => p.custom_mobile);
                _renderList(_allProspects);
            },
        });
    }

    // ── Broadcast / bulk-select modal ─────────────────────────────
    function _openBroadcast(cfg, onConfirm) {
        let _allProspects = [];
        let _selected     = new Set();

        const overlay = document.createElement("div");
        overlay.className = "pg-bcast-overlay";
        overlay.innerHTML =
            `<div class="pg-bcast-box">` +
            `<div class="pg-bcast-head"><span class="pg-bcast-title">Select Recipients</span><button class="pg-bcast-close">${SVG.close}</button></div>` +
            `<div class="pg-bcast-search"><input class="pg-bcast-search-inp" type="text" placeholder="Search by name, company or email…"></div>` +
            `<div class="pg-bcast-selall"><input type="checkbox" id="pg-bcast-all"><label for="pg-bcast-all" style="cursor:pointer">Select all visible</label></div>` +
            `<div class="pg-bcast-list"></div>` +
            `<div class="pg-bcast-foot"><span class="pg-bcast-count">0 selected</span><button class="pg-bcast-confirm">Add to recipients</button></div>` +
            `</div>`;
        document.body.appendChild(overlay);

        const $list    = overlay.querySelector(".pg-bcast-list");
        const $search  = overlay.querySelector(".pg-bcast-search-inp");
        const $selAll  = overlay.querySelector("#pg-bcast-all");
        const $count   = overlay.querySelector(".pg-bcast-count");
        const close    = () => overlay.remove();

        overlay.querySelector(".pg-bcast-close").addEventListener("click", close);
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", function onKey(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } });

        function _updateCount() {
            $count.textContent = `${_selected.size} selected`;
        }

        function _renderList(prospects) {
            $list.innerHTML = "";
            prospects.forEach(p => {
                if (!p.custom_email) return;
                const label = [p.custom_first_name, p.custom_last_name].filter(Boolean).join(" ") || p.company_name || p.name;
                const item  = document.createElement("div");
                item.className = "pg-bcast-item";
                const checked = _selected.has(p.custom_email) ? "checked" : "";
                item.innerHTML =
                    `<input type="checkbox" ${checked} data-email="${_e(p.custom_email)}">` +
                    `<div class="pg-bcast-item-info"><span class="pg-bcast-item-name">${_e(label)}</span><span class="pg-bcast-item-email">${_e(p.custom_email)}</span></div>`;
                item.querySelector("input").addEventListener("change", function() {
                    if (this.checked) _selected.add(p.custom_email);
                    else              _selected.delete(p.custom_email);
                    _updateCount();
                    _syncSelAll(prospects);
                });
                item.addEventListener("click", e => { if (e.target.tagName !== "INPUT") item.querySelector("input").click(); });
                $list.appendChild(item);
            });
        }

        function _syncSelAll(visible) {
            const withEmail  = visible.filter(p => p.custom_email);
            const allChecked = withEmail.length > 0 && withEmail.every(p => _selected.has(p.custom_email));
            $selAll.checked  = allChecked;
            $selAll.indeterminate = !allChecked && withEmail.some(p => _selected.has(p.custom_email));
        }

        function _filtered() {
            const q = $search.value.trim().toLowerCase();
            if (!q) return _allProspects;
            return _allProspects.filter(p =>
                (p.custom_first_name || "").toLowerCase().includes(q) ||
                (p.custom_last_name  || "").toLowerCase().includes(q) ||
                (p.company_name      || "").toLowerCase().includes(q) ||
                (p.custom_email      || "").toLowerCase().includes(q)
            );
        }

        $search.addEventListener("input", () => {
            const vis = _filtered();
            _renderList(vis);
            _syncSelAll(vis);
        });

        $selAll.addEventListener("change", () => {
            const vis = _filtered();
            vis.filter(p => p.custom_email).forEach(p => {
                if ($selAll.checked) _selected.add(p.custom_email);
                else                 _selected.delete(p.custom_email);
            });
            _renderList(vis);
            _updateCount();
        });

        overlay.querySelector(".pg-bcast-confirm").addEventListener("click", () => {
            onConfirm([..._selected]);
            close();
        });

        // Load all prospects with emails
        $list.innerHTML = `<div style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">Loading…</div>`;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Prospect",
                filters:  [["custom_email", "!=", ""]],
                fields:   ["name","custom_first_name","custom_last_name","company_name","custom_email"],
                limit:    500,
            },
            callback(r) {
                _allProspects = (r.message || []).filter(p => p.custom_email);
                _renderList(_allProspects);
                requestAnimationFrame(() => $search.focus());
            },
        });
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
            bodyHtml = `<iframe src="${_e(src)}" loading="lazy" style="width:100%;height:100%;border:none;display:block;"></iframe>`;
        } else if (type === "files") {
            const name  = btn.dataset.name || "";
            const files = _filesCache[name] || [];
            const imgs  = ["jpg","jpeg","png","gif","webp","svg","bmp"];
            title = "Attached Files";
            if (!files.length) {
                bodyHtml = `<div class="pg-modal-empty">No files attached</div>`;
            } else {
                const items = files.map(f => {
                    const ext  = (f.file_name || "").split(".").pop().toLowerCase();
                    const href = _e(f.file_url);
                    if (imgs.includes(ext)) {
                        return `<a class="pg-modal-file-link" href="${href}" target="_blank" rel="noopener" title="${_e(f.file_name)}"><img class="pg-modal-thumb" src="${href}" loading="lazy"></a>`;
                    }
                    return `<a class="pg-modal-file-link" href="${href}" target="_blank" rel="noopener" title="${_e(f.file_name)}"><div class="pg-modal-file-item">${SVG.file}<span class="pg-modal-fname">${_e(f.file_name)}</span></div></a>`;
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

    // ── Mobile card builder ────────────────────────────────────────
    const _MOB_STAGE_CLS = {
    "Prospect":       "pg-mob-badge-gray",
    "Outreached":     "pg-mob-badge-blue",
    "Passby Visit":   "pg-mob-badge-indigo",
    "Lead":           "pg-mob-badge-teal",
    "Site Visit":     "pg-mob-badge-purple",
    "Quotation":      "pg-mob-badge-orange",
    "Negotiation":    "pg-mob-badge-yellow",
    "Won":            "pg-mob-badge-green",
    "Job Scheduled":  "pg-mob-badge-green",
    "Lost":           "pg-mob-badge-red",
};

    const _CHEVRON_SVG = `<svg class="pg-mob-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const _PHONE_SVG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8a19.79 19.79 0 01-3-8.57A2 2 0 012.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.16 6.16l1.27-.45a2 2 0 012.11.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
    const _PIN_SVG     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const _EDIT_SVG    = `<i class="fa fa-pencil" style="font-size:14px"></i>`;

    function _buildMobileCards(rows) {
        return rows.map(r => {
            const first    = r.first || "";
            const last     = r.last  || "";
            const initials = ((first[0] || "") + (last[0] || "")).toUpperCase() || (r.company || "?")[0].toUpperCase();
            const name     = _e(r.name || "");
            const stage   = r.stage || "Prospect";
            const badgeCls = _MOB_STAGE_CLS[stage] || "pg-mob-badge-gray";
            const digits   = String(r.mobile || "").replace(/\D/g, "");
            const phoneHtml = r.mobile
                ? `<a class="pg-mob-action pg-mob-action-phone" href="tel:${_e(r.mobile)}">${_PHONE_SVG}</a>
                   <a class="pg-mob-action pg-mob-action-wa" href="https://wa.me/${_e(digits)}" target="_blank">${SVG.wa}</a>`
                : "";
            const mapsHtml = r.maps
                ? `<a class="pg-mob-action pg-mob-action-maps" href="${_e(r.maps)}" target="_blank">${_PIN_SVG}</a>`
                : "";

            return `<div class="pg-mob-card" data-row-name="${name}">
  <div class="pg-mob-head">
    <div class="pg-mob-av">${_e(initials)}</div>
    <div class="pg-mob-info">
      <div class="pg-mob-name">${_e(first)} ${_e(last)}</div>
      <div class="pg-mob-company">${_e(r.company || "")}</div>
    </div>
    <div class="pg-mob-side">
      ${stage ? `<span class="pg-mob-badge ${badgeCls}">${_e(stage)}</span>` : ""}
      ${_CHEVRON_SVG}
    </div>
  </div>
  <div class="pg-mob-actions">
    ${phoneHtml}
    ${mapsHtml}
    <button class="pg-mob-action pg-mob-action-edit" data-name="${name}">${_EDIT_SVG}</button>
  </div>
  <div class="pg-mob-details">
  <div class="pg-mob-details-inner">
    <div class="pg-mob-section">Contact Information</div>

    ${r.owner ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Owner</span><span class="pg-mob-val">${_e(r.owner)}</span></div>` : ""}
    ${r.title ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Title</span><span class="pg-mob-val">${_e(r.title)}</span></div>` : ""}
    ${r.first ? `<div class="pg-mob-row"><span class="pg-mob-lbl">First Name</span><span class="pg-mob-val">${_e(r.first)}</span></div>` : ""}
    ${r.last ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Last Name</span><span class="pg-mob-val">${_e(r.last)}</span></div>` : ""}
    ${r.company ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Company</span><span class="pg-mob-val">${_e(r.company)}</span></div>` : ""}
    ${r.activity ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Activity Type</span><span class="pg-mob-val">${_e(r.activity)}</span></div>` : ""}
    ${r.source ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Source</span><span class="pg-mob-val">${_e(r.source)}</span></div>` : ""}
    ${r.role ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Role</span><span class="pg-mob-val">${_e(r.role)}</span></div>` : ""}
    ${r.stage ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Stage</span><span class="pg-mob-val">${_e(r.stage)}</span></div>` : ""}
    ${r.mobile ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Primary Mobile</span><span class="pg-mob-val">${_e(r.mobile)}</span></div>` : ""}
    ${r.email ? `<div class="pg-mob-row"><span class="pg-mob-lbl">Email</span><span class="pg-mob-val">${_e(r.email)}</span></div>` : ""}

    <button class="pg-mob-view-btn" data-name="${_e(name)}" type="button">View Full Record</button>
  </div>
</div>
</div>`;
        }).join("");
    }
  

    // ── Mount ──────────────────────────────────────────────────────
    function mount(el, cfg) {
        injectStyles();
        el._pgCfg = cfg;

        const n = cfg.tabs.length;

        let left = 0;
        cfg.fixed.forEach(f => { f._left = left; left += (f.width || 120); });

        const pillsHtml = cfg.tabs.map((label, i) =>
            `<button class="pg-pill${i===0?" active":""}" data-tab="${i}">${label}</button>`
        ).join("");
        const rowsHtml = cfg.rows.map((r, i) => buildRow(cfg, r, i)).join("");
        const cardsHtml = _buildMobileCards(cfg.rows);
        const bodyStyle = cfg.maxBodyHeight ? ` style="--pg-body-max-height:${_e(cfg.maxBodyHeight)}"` : "";

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
        <input type="text" class="pg-search" placeholder="${cfg.searchPlaceholder || 'Search prospects…'}">
      </div>
      <button class="pg-tb-exp">${SVG.export} ${cfg.exportLabel || 'Export'}</button>
    </div>
  </div>
  <div class="pg-tbl-outer"${bodyStyle}>
    <table class="pg-tbl" data-tab="0">
      <thead>${buildHeader(cfg)}</thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div class="pg-mob-cards">${cardsHtml}</div>
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
       
        // ── Load More button ───────────────────────────────────────
        const existingLM = el.querySelector(".pg-load-more-wrap");
        if (existingLM) existingLM.remove();
        if (cfg.hasMore && cfg.onLoadMore) {
            const lmWrap = document.createElement("div");
            lmWrap.className = "pg-load-more-wrap";
            lmWrap.innerHTML = `<button class="pg-load-more-btn">Load More</button>`;
            // append inside .pg-shell so it's not clipped by overflow:hidden on the shell
            const shell = el.querySelector(".pg-shell") || el;
            shell.appendChild(lmWrap);
            lmWrap.querySelector(".pg-load-more-btn").addEventListener("click", () => {
                lmWrap.querySelector(".pg-load-more-btn").textContent = "Loading…";
                lmWrap.querySelector(".pg-load-more-btn").disabled = true;
                cfg.onLoadMore();
            });
        }

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
    let _eDrop = null;
    let _hoverEdit = false;   // true when edit was opened by hover (not click)
    let _hoverCloseTimer = null;

    function _ensureFloat() {
        if (_eFl) return;
        _eFl = document.createElement("div");
        _eFl.className = "pg-float-wrap";
        document.body.appendChild(_eFl);
    }

    function _setEditDrop(drop) {
        if (_eDrop && _eDrop !== drop) _eDrop.remove();
        _eDrop = drop || null;
    }

    function _removeEditDrop() {
        if (_eDrop) {
            _eDrop.remove();
            _eDrop = null;
        }
    }

    function _growEditToValue(el) {
        if (!_eFl || !_eTd || !el || el.tagName !== "INPUT") return;
        const type = el.type || "text";
        if (!["text", "url", "search", "tel", "email"].includes(type)) return;
        const base = _eTd.getBoundingClientRect().width;
        const text = el.value || el.placeholder || "";
        _eFl.style.width = Math.max(base, Math.min(640, (text.length * 8) + 40)) + "px";
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
        } else if (ctype === "dynselect") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "text";
            el.value = val;
            el.setAttribute("autocomplete", "off");
            _eFl.style.overflow = "visible";

            const _dynKey = col.dynKey || "pg_dynselect";
            const _getOpts = () => {
                const base = col.options || [];
                try { return [...new Set([...base, ...JSON.parse(localStorage.getItem(_dynKey) || "[]")])].filter(Boolean); } catch(e) { return base; }
            };
            const _saveOpt = (v) => {
                const cur = _getOpts();
                if (!cur.includes(v)) { localStorage.setItem(_dynKey, JSON.stringify([...cur.filter(o => !(col.options||[]).includes(o)), v])); }
            };

            const drop = document.createElement("div");
            drop.className = "pg-ac-drop";
            const tdRect2 = td.getBoundingClientRect();
            drop.style.cssText = `top:${tdRect2.bottom + 2}px;left:${tdRect2.left}px;min-width:${Math.max(tdRect2.width, 220)}px;`;
            document.body.appendChild(drop);
            _setEditDrop(drop);

            const _renderDynDrop = (q) => {
                const opts = _getOpts();
                const filtered = q ? opts.filter(o => o.toLowerCase().includes(q.toLowerCase())) : opts;
                drop.innerHTML = "";
                filtered.forEach(o => {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item" + (o === val ? " pg-ac-active" : "");
                    d.textContent = o;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); el.value = o; drop.remove(); _closeEdit(true); });
                    drop.appendChild(d);
                });
                const exact = opts.some(o => o.toLowerCase() === (q || "").toLowerCase());
                if (q && !exact) {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item pg-ac-create";
                    d.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:5px;vertical-align:-1px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add "<strong>${_e(q)}</strong>"`;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); _saveOpt(q); el.value = q; drop.remove(); _closeEdit(true); });
                    drop.appendChild(d);
                }
                drop.style.display = drop.children.length ? "block" : "none";
            };

            el.addEventListener("focus", () => _renderDynDrop(""));
            el.addEventListener("input", () => _renderDynDrop(el.value.trim()));
            el.addEventListener("keydown", ev => {
                if (ev.key === "Escape") { drop.remove(); _closeEdit(false); ev.preventDefault(); return; }
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    const active = drop.querySelector(".pg-ac-active");
                    if (active) { active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); return; }
                    const q = el.value.trim();
                    if (q) _saveOpt(q);
                    drop.remove(); _closeEdit(true);
                }
            }, true);
            el.addEventListener("blur", () => { setTimeout(() => drop.remove(), 180); });
        } else if (ctype === "locautocomplete") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "text";
            el.value = val;
            el.setAttribute("autocomplete", "off");
            _eFl.style.overflow = "visible";

            const _locField = col.locField || "city"; // city | district | country | street
            const _locFields = Object.assign({
                country: "custom_site_country",
                district: "custom_site_district",
                city: "custom_site_city",
                street: "custom_site_street",
            }, cfg.locFields || {}, col.locFields || {});
            const _locKeys = Object.assign({
                country: "site_country",
                district: "site_district",
                city: "site_city",
                street: "site_street",
            }, cfg.locKeys || {}, col.locKeys || {});
            const drop = document.createElement("div");
            drop.className = "pg-ac-drop";
            const _tdR = td.getBoundingClientRect();
            drop.style.cssText = `top:${_tdR.bottom + 2}px;left:${_tdR.left}px;min-width:${Math.max(_tdR.width, 240)}px;max-width:320px;`;
            document.body.appendChild(drop);
            _setEditDrop(drop);

            let _locTimer = null;

            // Build Nominatim query scoped to the field type
            const _buildQuery = (q) => {
                const rowObj = (cfg.rows || []).find(r => r.name === td.dataset.rowName) || {};
                if (_locField === "street") return `${q}${rowObj[_locKeys.city] ? ", " + rowObj[_locKeys.city] : ""}`;
                if (_locField === "district") return `${q}${rowObj[_locKeys.country] ? ", " + rowObj[_locKeys.country] : ""}`;
                return q;
            };

            const _extractFromAddr = (a, locField) => {
                if (locField === "city")     return a.city || a.town || a.village || a.suburb || a.municipality;
                if (locField === "district") return a.state || a.state_district || a.county;
                if (locField === "country")  return a.country;
                if (locField === "street")   return a.road || a.pedestrian || a.footway;
                return null;
            };

            const _renderLocDrop = (results) => {
                drop.innerHTML = "";
                results.forEach(hit => {
                    const a = hit.address || {};
                    const primary = _extractFromAddr(a, _locField) || hit.display_name.split(",")[0];
                    const city    = a.city || a.town || a.village || a.suburb || "";
                    const district = a.state || a.state_district || a.county || "";
                    const country  = a.country || "";
                    // Build label e.g. "Zalka, Metn, Lebanon"
                    const parts = [primary, _locField !== "district" ? district : "", _locField !== "country" ? country : ""].filter((p, i) => p && (i === 0 || p !== primary));
                    const label = [...new Set(parts)].filter(Boolean).join(", ");
                    const d = document.createElement("div");
                    d.className = "pg-ac-item";
                    d.textContent = label;
                    d.addEventListener("mousedown", ev => {
                        ev.preventDefault();
                        el.value = primary;
                        drop.remove();
                        // Multi-fill: update related fields via cfg.onLocFill callback
                        if (cfg.onLocFill) {
                            cfg.onLocFill(td.dataset.rowName, {
                                [_locFields.country]:  a.country,
                                [_locFields.district]: a.state || a.state_district || a.county,
                                [_locFields.city]:     a.city || a.town || a.village || a.suburb,
                                [_locFields.street]:   _locField === "street" ? (a.road || a.pedestrian || a.footway) : undefined,
                            }, _locField);
                        }
                        _closeEdit(true);
                    });
                    drop.appendChild(d);
                });
                drop.style.display = drop.children.length ? "block" : "none";
            };

            const _searchLoc = (q) => {
                if (!q || q.length < 2) { drop.style.display = "none"; return; }
                const query = _buildQuery(q);
                fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`, {
                    headers: { "Accept-Language": "en" },
                })
                .then(r => r.json())
                .then(data => _renderLocDrop(data || []))
                .catch(() => { drop.style.display = "none"; });
            };

            el.addEventListener("input", () => { clearTimeout(_locTimer); _locTimer = setTimeout(() => _searchLoc(el.value.trim()), 280); });
            el.addEventListener("keydown", ev => {
                if (ev.key === "Escape") { drop.remove(); _closeEdit(false); ev.preventDefault(); return; }
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    const active = drop.querySelector(".pg-ac-active");
                    if (active) { active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); return; }
                    drop.remove(); _closeEdit(true);
                }
                if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                    ev.preventDefault();
                    const items = Array.from(drop.querySelectorAll(".pg-ac-item"));
                    const cur = drop.querySelector(".pg-ac-active");
                    const idx = cur ? items.indexOf(cur) : -1;
                    const next = ev.key === "ArrowDown" ? items[idx + 1] || items[0] : items[idx - 1] || items[items.length - 1];
                    if (cur) cur.classList.remove("pg-ac-active");
                    if (next) { next.classList.add("pg-ac-active"); el.value = next.textContent.split(",")[0].trim(); }
                }
            }, true);
            el.addEventListener("blur", () => { setTimeout(() => drop.remove(), 200); });
        } else if (ctype === "company") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "text";
            el.value = val;
            el.placeholder = "Search or create company…";
            _eFl.style.overflow = "visible";

            // Autocomplete dropdown
            const drop = document.createElement("div");
            drop.className = "pg-ac-drop";
            const tdRect = td.getBoundingClientRect();
            drop.style.cssText = `top:${tdRect.bottom + 2}px;left:${tdRect.left}px;min-width:${Math.max(tdRect.width, 200)}px;`;
            document.body.appendChild(drop);
            _setEditDrop(drop);

            let _acTimer = null, _acItems = [], _acIdx = -1;
            const _companySource = col.companySource || cfg.companySource || "";
            const _isClientCompany = _companySource === "client";

            const _renderDrop = (items, q) => {
                _acItems = items;
                drop.innerHTML = "";
                items.forEach((name, i) => {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item" + (i === _acIdx ? " pg-ac-active" : "");
                    d.textContent = name;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); el.value = name; drop.remove(); _closeEdit(true); });
                    drop.appendChild(d);
                });
                if (q && !items.find(n => n.toLowerCase() === q.toLowerCase())) {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item pg-ac-create";
                    d.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:5px;vertical-align:-1px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create "<strong>${q}</strong>"`;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); el.value = q; drop.remove(); _closeEdit(true); if (!_isClientCompany) _bgCreateCompany(q); });
                    drop.appendChild(d);
                }
                drop.style.display = drop.children.length ? "block" : "none";
            };

            const _bgCreateCompany = (name) => {
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: { doctype: "Company", company_name: name, abbr: name.substring(0, 3).toUpperCase(), default_currency: "USD" } },
                    error() { frappe.show_alert({ message: `Failed to create company "${name}"`, indicator: "red" }, 4); },
                });
            };

            const _query = (q) => {
                if (!q) { drop.style.display = "none"; return; }
                if (_isClientCompany) {
                    frappe.call({
                        method: "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.get_client_companies",
                        args: { txt: q, limit: 8 },
                        callback(r) { _renderDrop(r.message || [], q); },
                    });
                    return;
                }
                frappe.call({
                    method: "frappe.client.get_list",
                    args: { doctype: "Company", filters: [["company_name", "like", "%" + q + "%"]], fields: ["company_name"], limit: 8 },
                    callback(r) { _renderDrop((r.message || []).map(c => c.company_name), q); },
                });
            };

            el.addEventListener("input", () => {
                clearTimeout(_acTimer);
                _acIdx = -1;
                _acTimer = setTimeout(() => _query(el.value.trim()), 200);
            });

            el.addEventListener("keydown", ev => {
                const vis = drop.style.display !== "none";
                if (ev.key === "ArrowDown" && vis) {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    _acIdx = Math.min(_acIdx + 1, drop.children.length - 1);
                    Array.from(drop.children).forEach((c, i) => c.classList.toggle("pg-ac-active", i === _acIdx));
                    return;
                }
                if (ev.key === "ArrowUp" && vis) {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    _acIdx = Math.max(_acIdx - 1, 0);
                    Array.from(drop.children).forEach((c, i) => c.classList.toggle("pg-ac-active", i === _acIdx));
                    return;
                }
                if (ev.key === "Enter") {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    const active = drop.querySelector(".pg-ac-active");
                    if (active) { active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); return; }
                    const q = el.value.trim();
                    if (!q) { drop.remove(); _closeEdit(false); return; }
                    // Close immediately; verify/create in background
                    drop.remove();
                    _closeEdit(true);
                    if (!_isClientCompany) {
                        frappe.call({
                            method: "frappe.client.get_list",
                            args: { doctype: "Company", filters: [["company_name", "=", q]], fields: ["company_name"], limit: 1 },
                            callback(r) {
                                if (!r.message || !r.message.length) _bgCreateCompany(q);
                            },
                        });
                    }
                    return;
                }
            }, true);

            el.addEventListener("blur", () => { setTimeout(() => drop.remove(), 150); });
        } else if (ctype === "contact-link") {
            el = document.createElement("input");
            el.className = "pg-float-input";
            el.type = "text";
            el.value = val;
            el.placeholder = "Search contact…";
            el.setAttribute("autocomplete", "off");
            el.setAttribute("aria-label", "Search contact by name");
            el.setAttribute("aria-autocomplete", "list");
            el.setAttribute("aria-haspopup", "listbox");
            _eFl.style.overflow = "visible";

            const drop = document.createElement("div");
            drop.className = "pg-ac-drop";
            drop.setAttribute("role", "listbox");
            drop.setAttribute("aria-label", "Contact suggestions");
            const tdRect = td.getBoundingClientRect();
            drop.style.cssText = `top:${tdRect.bottom + 2}px;left:${tdRect.left}px;min-width:${Math.max(tdRect.width, 240)}px;`;
            document.body.appendChild(drop);
            _setEditDrop(drop);

            let _acTimer = null, _acIdx = -1, _acNames = [];

            const _pick = (fullName) => {
                el.value = fullName;
                drop.remove();
                _closeEdit(true);
            };

            const _renderDrop = (contacts, q) => {
                _acNames = contacts.map(c => [c.salutation, c.full_name || c.name].filter(Boolean).join(" "));
                drop.innerHTML = "";
                _acIdx = -1;
                _acNames.forEach((name, i) => {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item";
                    d.setAttribute("role", "option");
                    d.setAttribute("id", `pg-cl-opt-${i}`);
                    d.textContent = name;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); _pick(name); });
                    drop.appendChild(d);
                });
                const exact = _acNames.some(n => n.toLowerCase() === (q || "").toLowerCase());
                if (q && !exact) {
                    const d = document.createElement("div");
                    d.className = "pg-ac-item pg-ac-create";
                    d.setAttribute("role", "option");
                    d.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:5px;vertical-align:-1px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Create "<strong>${_e(q)}</strong>"`;
                    d.addEventListener("mousedown", ev => { ev.preventDefault(); drop.remove(); _closeEdit(false); _openContactModal(root, td, q, col.contactPre); });
                    drop.appendChild(d);
                }
                drop.style.display = drop.children.length ? "block" : "none";
            };

            const _query = (q) => {
                if (!q) { drop.style.display = "none"; return; }
                frappe.call({
                    method: "frappe.client.get_list",
                    args: { doctype: "Contact", filters: [["full_name", "like", q + "%"]], fields: ["name", "full_name", "salutation"], order_by: "full_name asc", limit: 8 },
                    callback(r) { _renderDrop(r.message || [], q); },
                });
            };

            el.addEventListener("input", () => {
                clearTimeout(_acTimer);
                _acIdx = -1;
                _acTimer = setTimeout(() => _query(el.value.trim()), 180);
            });

            el.addEventListener("keydown", ev => {
                const vis = drop.style.display !== "none";
                const items = Array.from(drop.children);
                if (ev.key === "ArrowDown" && vis) {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    _acIdx = Math.min(_acIdx + 1, items.length - 1);
                    items.forEach((c, i) => { c.classList.toggle("pg-ac-active", i === _acIdx); c.setAttribute("aria-selected", i === _acIdx); });
                    el.setAttribute("aria-activedescendant", `pg-cl-opt-${_acIdx}`);
                    return;
                }
                if (ev.key === "ArrowUp" && vis) {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    _acIdx = Math.max(_acIdx - 1, 0);
                    items.forEach((c, i) => { c.classList.toggle("pg-ac-active", i === _acIdx); c.setAttribute("aria-selected", i === _acIdx); });
                    el.setAttribute("aria-activedescendant", `pg-cl-opt-${_acIdx}`);
                    return;
                }
                if (ev.key === "Escape") { drop.remove(); _closeEdit(false); ev.preventDefault(); return; }
                if (ev.key === "Enter") {
                    ev.preventDefault(); ev.stopImmediatePropagation();
                    const active = drop.querySelector(".pg-ac-active");
                    if (active) { active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); return; }
                    const q = el.value.trim();
                    if (!q) { drop.remove(); _closeEdit(false); return; }
                    drop.remove(); _closeEdit(false); _openContactModal(root, td, q, col.contactPre);
                }
            }, true);

            el.addEventListener("blur", () => { setTimeout(() => drop.remove(), 180); });
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
        } else if (ctype === "notes") {
            const H = 160;
            _eFl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${Math.max(rect.width, 260)}px;height:${H}px;z-index:99999;pointer-events:none;`;
            el = document.createElement("textarea");
            el.className = "pg-float-input";
            el.style.padding = "6px 12px";
            el.style.resize = "none";
            el.value = val;
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
        _growEditToValue(el);
        el.addEventListener("input", () => _growEditToValue(el));
        el.focus();
        if (el.tagName === "INPUT") { try { el.select(); } catch(e){} }
        if (el.tagName === "SELECT") { setTimeout(() => { try { el.showPicker(); } catch(e) { el.click(); } }, 0); }

        el.addEventListener("focus",   () => { clearTimeout(_hoverCloseTimer); _hoverEdit = false; }); // click-in → no longer hover-managed
        el.addEventListener("blur",    () => { setTimeout(() => _closeEdit(true), 80); });
        el.addEventListener("keydown", e => {
            if (e.key === "Escape") { _closeEdit(false); e.preventDefault(); return; }
            if (e.key === "Tab")   { _closeEdit(true); e.preventDefault(); return; }
            // Notes (textarea): Enter = newline, Escape already handled above
            if (e.key === "Enter" && el.tagName === "TEXTAREA") return;
            if (e.key === "Enter") { e.preventDefault(); _closeEdit(true); _navCell(root, td, "right"); return; }

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

    function _openMapsLocationPopup(root, td) {
        const existing = document.getElementById("pg-loc-popup");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "pg-loc-popup";
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);";
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;width:340px;box-shadow:0 8px 40px rgba(0,0,0,.22);overflow:hidden;">
                <div style="background:linear-gradient(135deg,#1e3f85,#2563eb);padding:18px 20px 14px;color:#fff;">
                    <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Set Map Location</div>
                    <div style="font-size:11.5px;opacity:.8;">Use your current GPS position or paste a link</div>
                </div>
                <div style="padding:18px 20px;">
                    <button id="pg-loc-use-gps" style="width:100%;height:40px;border:none;border-radius:10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
                        <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5c0-2.49-2.01-4.5-4.5-4.5zm0 6.1a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/></svg>
                        Use My Current Location
                    </button>
                    <div style="font-size:11px;color:#9ca3af;text-align:center;margin-bottom:10px;">— or paste link manually —</div>
                    <input id="pg-loc-manual" type="text" placeholder="https://maps.google.com/…" style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:12px;outline:none;">
                </div>
                <div style="padding:0 20px 18px;display:flex;gap:8px;">
                    <button id="pg-loc-cancel" style="flex:1;height:36px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;color:#374151;font-size:12px;cursor:pointer;">Cancel</button>
                    <button id="pg-loc-save" style="flex:2;height:36px;border:none;border-radius:8px;background:#1e3f85;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Save Link</button>
                </div>
                <div id="pg-loc-status" style="padding:0 20px 14px;font-size:11.5px;color:#6b7280;min-height:18px;"></div>
            </div>`;

        document.body.appendChild(overlay);
        const statusEl = overlay.querySelector("#pg-loc-status");

        const _commit = (url) => {
            overlay.remove();
            const col = _colCfgForTd(root, td);
            td.dataset.val = url;
            const fakeRow = { [col ? col.key : "maps"]: url };
            if (col) td.innerHTML = renderCell(col, fakeRow);
            if (col && col.frappe_field) {
                frappe.db.set_value(cfg.doctype || "Prospect", td.dataset.rowName, col.frappe_field, url);
            }
            if (cfg.onEdit && td.dataset.rowName && col && col.frappe_field) {
                cfg.onEdit(td.dataset.rowName, col.frappe_field, url);
            }
        };

        overlay.querySelector("#pg-loc-use-gps").addEventListener("click", () => {
            if (!navigator.geolocation) { statusEl.textContent = "Geolocation not supported on this device."; return; }
            statusEl.textContent = "Getting your location…";
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const url = `https://www.google.com/maps?q=${lat},${lng}`;
                overlay.querySelector("#pg-loc-manual").value = url;
                statusEl.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }, () => { statusEl.textContent = "Could not get location. Please enable GPS."; });
        });

        overlay.querySelector("#pg-loc-save").addEventListener("click", () => {
            const url = overlay.querySelector("#pg-loc-manual").value.trim();
            if (!url) { statusEl.textContent = "Please enter a Maps URL or use GPS."; return; }
            _commit(url);
        });
        overlay.querySelector("#pg-loc-cancel").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("mousedown", e => { if (e.target === overlay) overlay.remove(); });
    }

    function _openContactModal(root, td, prefill, defaultPre) {
        const parts = (prefill || "").trim().split(/\s+/);
        const firstName = parts[0] || "";
        const lastName  = parts.slice(1).join(" ") || "";

        const overlay = document.createElement("div");
        overlay.className = "pg-cm-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Create Contact");

        overlay.innerHTML = `
            <div class="pg-cm-box" role="document">
                <div class="pg-cm-header">
                    <span>New Contact</span>
                    <button class="pg-cm-close" aria-label="Close">&times;</button>
                </div>
                <div class="pg-cm-body">
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Pre</label>
                        <select class="pg-cm-inp" id="pg-cm-pre">
                            <option value="">—</option>
                            <option value="Mr">Mr</option>
                            <option value="Ms">Ms</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Dr">Dr</option>
                            <option value="Eng" selected>Eng</option>
                            <option value="Arch" selected>Arch</option>
                        </select>
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">First Name <span class="pg-cm-req">*</span></label>
                        <input class="pg-cm-inp" id="pg-cm-first" type="text" value="${_e(firstName)}" required autocomplete="given-name">
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Last Name</label>
                        <input class="pg-cm-inp" id="pg-cm-last" type="text" value="${_e(lastName)}" autocomplete="family-name">
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Mobile</label>
                        <input class="pg-cm-inp" id="pg-cm-mobile" type="tel" autocomplete="tel">
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Email</label>
                        <input class="pg-cm-inp" id="pg-cm-email" type="email" autocomplete="email">
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Company</label>
                        <input class="pg-cm-inp" id="pg-cm-company" type="text" autocomplete="organization">
                    </div>
                    <div class="pg-cm-row">
                        <label class="pg-cm-label">Reference</label>
                        <select class="pg-cm-inp" id="pg-cm-ref">
                            <option value="${_e(frappe.session.user)}">${_e(frappe.session.user)}</option>
                        </select>
                    </div>
                    <div class="pg-cm-err" id="pg-cm-err" style="display:none;"></div>
                </div>
                <div class="pg-cm-footer">
                    <button class="pg-cm-btn-cancel">Cancel</button>
                    <button class="pg-cm-btn-save">Save Contact</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const box      = overlay.querySelector(".pg-cm-box");
        const selPre   = overlay.querySelector("#pg-cm-pre");
        const inpFirst = overlay.querySelector("#pg-cm-first");
        const inpLast  = overlay.querySelector("#pg-cm-last");
        const inpMob   = overlay.querySelector("#pg-cm-mobile");
        const inpEmail = overlay.querySelector("#pg-cm-email");
        const inpComp  = overlay.querySelector("#pg-cm-company");
        const selRef   = overlay.querySelector("#pg-cm-ref");
        const errEl    = overlay.querySelector("#pg-cm-err");
        const btnSave  = overlay.querySelector(".pg-cm-btn-save");
        const btnCxl   = overlay.querySelector(".pg-cm-btn-cancel");
        const btnClose = overlay.querySelector(".pg-cm-close");

        // Populate reference dropdown with system users
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: "User", filters: [["enabled", "=", 1], ["user_type", "=", "System User"]], fields: ["name", "full_name"], limit: 50 },
            callback(r) {
                const users = r.message || [];
                selRef.innerHTML = users.map(u =>
                    `<option value="${_e(u.name)}"${u.name === frappe.session.user ? " selected" : ""}>${_e(u.full_name || u.name)}</option>`
                ).join("");
            },
        });

        // Default Pre per column config (falls back to "Arch" for architect column)
        selPre.value = (defaultPre !== undefined ? defaultPre : "Arch");

        // Focus trap helpers
        const focusable = () => Array.from(box.querySelectorAll(
            'input, select, button:not([disabled])'
        )).filter(el => !el.closest("[disabled]"));

        const fields = [selPre, inpFirst, inpLast, inpMob, inpEmail, inpComp, selRef];

        setTimeout(() => inpFirst.focus(), 60);

        const close = () => { overlay.remove(); };

        const doSave = () => btnSave.click();

        // Enter moves focus top→bottom; on last field triggers save
        fields.forEach((inp, i) => {
            inp.addEventListener("keydown", e => {
                if (e.key !== "Enter") return;
                // For <select>, only intercept if not open (browser handles open state)
                if (inp.tagName === "SELECT" && inp.size > 1) return;
                e.preventDefault();
                if (i < fields.length - 1) {
                    fields[i + 1].focus();
                } else {
                    doSave();
                }
            });
        });

        const trapFocus = (e) => {
            if (e.key !== "Tab") return;
            const els = focusable();
            const first = els[0], last = els[els.length - 1];
            if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
            else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
        };

        overlay.addEventListener("keydown", e => {
            if (e.key === "Escape") { close(); return; }
            trapFocus(e);
        });

        overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
        btnClose.addEventListener("click", close);
        btnCxl.addEventListener("click", close);

        btnSave.addEventListener("click", () => {
            const fn = inpFirst.value.trim();
            if (!fn) {
                errEl.textContent = "First Name is required.";
                errEl.style.display = "block";
                inpFirst.focus();
                return;
            }
            errEl.style.display = "none";
            btnSave.disabled = true;
            btnSave.textContent = "Saving…";

            const doc = {
                doctype: "Contact",
                salutation: selPre.value || undefined,
                first_name: fn,
                last_name: inpLast.value.trim() || undefined,
                company_name: inpComp.value.trim() || undefined,
                custom_reference_user: selRef.value || frappe.session.user,
            };
            if (inpMob.value.trim()) {
                doc.phone_nos = [{ phone: inpMob.value.trim(), is_primary_mobile_no: 1 }];
            }
            if (inpEmail.value.trim()) {
                doc.email_ids = [{ email_id: inpEmail.value.trim(), is_primary: 1 }];
            }

            frappe.call({
                method: "frappe.client.insert",
                args: { doc },
                callback(r) {
                    close();
                    if (r.message) {
                        const fullName = [r.message.salutation, r.message.first_name, r.message.last_name].filter(Boolean).join(" ")
                            || [doc.salutation, doc.first_name, doc.last_name].filter(Boolean).join(" ")
                            || r.message.full_name;
                        // Update cell immediately with avatar rendering
                        const col = _colCfgForTd(root, td);
                        td.dataset.val = fullName;
                        const fakeRow = {};
                        if (col) fakeRow[col.key] = fullName;
                        td.innerHTML = col ? renderCell(col, fakeRow) : `<span>${_e(fullName)}</span>`;
                        // Persist to Frappe
                        if (col && col.frappe_field) {
                            frappe.call({
                                method: "frappe.client.set_value",
                                args: { doctype: "Prospect", name: td.dataset.rowName, fieldname: col.frappe_field, value: fullName },
                            });
                        }
                        if (_eIn && _eTd === td) { _eTd = null; _eIn = null; _eRoot = null; if (_eFl) _eFl.innerHTML = ""; }
                    }
                },
                error() {
                    btnSave.disabled = false;
                    btnSave.textContent = "Save Contact";
                    errEl.textContent = "Failed to create contact. Please try again.";
                    errEl.style.display = "block";
                },
            });
        });
    }

    function _colCfgForTd(root, td) {
        const key = td.dataset.ckey || td.dataset.key;
        if (!key || !root._pgCfg) return null;
        return (root._pgCfg.cols || []).find(c => c.key === key)
            || (root._pgCfg.fixed || []).find(c => c.key === key)
            || null;
    }

    function _closeEdit(save) {
        if (!_eIn || !_eTd) return;
        clearTimeout(_hoverCloseTimer);
        _hoverEdit = false;
        const newVal = _eIn.value;
        const td = _eTd, root = _eRoot;
        _eTd = null; _eIn = null; _eRoot = null;
        _removeEditDrop();
        if (_eFl) _eFl.innerHTML = "";

        if (!save || newVal === td.dataset.val) return;

        const name  = td.dataset.rowName;
        const ff    = td.dataset.ff;
        const ctype = td.dataset.ctype;
        const ckey  = td.dataset.ckey;

        td.dataset.val = newVal;

        const cfg   = root._pgCfg;
        const outer = root.querySelector(".pg-tbl-outer");
        const savedScroll = outer ? outer.scrollLeft : 0;

        const col = (cfg.cols || []).find(c => c.key === ckey)
                 || (cfg.fixed || []).find(f => f.key === ckey)
                 || {};
        const row = { [ckey || ""]: newVal, name };
        if (ckey) {
            td.innerHTML = renderCell(Object.assign({}, col, { key: ckey || "" }), row);
        } else {
            td.textContent = newVal;
        }

        if (outer) outer.scrollLeft = savedScroll;

        const rowObj = (cfg.rows || []).find(r => r.name === name);
        if (rowObj && ckey) rowObj[ckey] = newVal;

        if (cfg.onEdit && name && ff) cfg.onEdit(name, ff, newVal);
    }

    function _navCell(root, fromTd, direction) {
        const tbl     = root.querySelector(".pg-tbl");
        const rowName = fromTd.dataset.rowName;

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
        // All columns always visible — navigate across the full row
        const allEd = Array.from(tbl.querySelectorAll("td.pg-ed")).filter(td =>
            td.dataset.rowName === rowName
        );
        const idx  = allEd.indexOf(fromTd);
        if (idx === -1) return;
        const next = allEd[idx + hDir];
        if (next) { _openEdit(root, next); return; }

        // Past end/start of row → jump to first/last cell of next/prev row
        const rows    = Array.from(tbl.querySelectorAll("tbody tr")).filter(tr => tr.style.display !== "none");
        const curRow  = fromTd.closest("tr");
        const rowIdx  = rows.indexOf(curRow);
        const nextIdx = rowIdx + hDir;
        if (nextIdx < 0 || nextIdx >= rows.length) return;
        const nextRowName = rows[nextIdx].dataset.rowName;
        const newEd = Array.from(tbl.querySelectorAll("td.pg-ed")).filter(td =>
            td.dataset.rowName === nextRowName
        );
        const target = hDir > 0 ? newEd[0] : newEd[newEd.length - 1];
        if (target) _openEdit(root, target);
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

    // ── Mobile edit dialog ──────────────────────────────────────────
    function _openMobEdit(row, cfg, reload) {
        const sections = [
            {
                label: "Contact Information",
                fields: [
                      { label: "Owner", fn: "owner", ft: "Data", def: row.owner || "" },
                      { label: "Title", fn: "custom_salutation", ft: "Select", def: row.title || "" },
                      { label: "First Name", fn: "custom_first_name", ft: "Data", def: row.first || "" },
                      { label: "Last Name", fn: "custom_last_name", ft: "Data", def: row.last || "" },

                      { label: "Activity Type", fn: "custom_company_activity_type", ft: "Data", def: row.activity || "" },

                      { label: "Source", fn: "custom_lead_source", ft: "Data", def: row.source || "" },

                      { label: "Role", fn: "custom_position", ft: "Autocomplete", def: row.role || "" },

                      {
                       label: "Stage",
                       fn: "custom_stage",
                       ft: "Select",
                       def: row.stage || "Prospect",
                       options: "\nProspect\nOutreached\nPassby Visit\nLead\nSite Visit\nQuotation\nNegotiation\nWon\nJob Scheduled\nLost"
                        },

                      { label: "Primary Mobile", fn: "custom_mobile", ft: "Data", def: row.mobile || "" },

                      { label: "Email", fn: "custom_email", ft: "Data", def: row.email || "" },
                    ]
             },
            {
                label: "Site Information",
                fields: [
                     { label: "Country", fn: "custom_site_country", ft: "Data", def: row.country || "" },

                     { label: "District", fn: "custom_site_district", ft: "Data", def: row.district || "" },

                     { label: "City", fn: "custom_site_city", ft: "Data", def: row.city || "" },

                     { label: "Street", fn: "custom_site_street", ft: "Data", def: row.street || "" },

                     { label: "Google Maps", fn: "custom_maps_url", ft: "Data", def: row.maps || "" },

                     { label: "Description", fn: "custom_description", ft: "Small Text", def: row.description || "" },

                     { label: "Files", fn: "files", ft: "Data", def: row.files || "" },

                     { label: "Drawing", fn: "drawing", ft: "Data", def: row.drawing || "" },
                 ]
            },
           {
    label: "Scope & Specs",
    fields: [
        { label: "Project Status", fn: "custom_project_status", ft: "Select", def: row.status || "", options: "\nEmpty Lot\nExcavation\nConcrete structure\nTopped out\nFinishing\nMEP\nCompleted" },
        { label: "Start Date", fn: "custom_project_start", ft: "Date", def: row.pstart || "" },
        { label: "Floors", fn: "custom_floors", ft: "Int", def: row.floors || "" },
        { label: "Project Type", fn: "custom_project_type", ft: "Data", def: row.ptype || "" },
        { label: "Scaffold Type", fn: "custom_scaffold_type", ft: "Data", def: row.scaffold || "" },
        { label: "Area (sqm)", fn: "custom_area", ft: "Data", def: row.area || "" },
        { label: "Scope Notes", fn: "custom_scope_notes", ft: "Small Text", def: row.scope_notes || "" },
    ]
},
{
    label: "Site Team",
    fields: [
         { label: "Contact Person #1", fn: "custom_architect", ft: "Data", def: row.architect || "" },

        { label: "Contact Person #2", fn: "custom_project_owner", ft: "Data", def: row.cp1 || "" },

        { label: "Contact Person #3", fn: "custom_site_engineer", ft: "Data", def: row.cp2 || "" },

        { label: "Contact Person #4", fn: "custom_safety_officer", ft: "Data", def: row.cp3 || "" },

        { label: "Contact Person #5", fn: "custom_contact_person_4", ft: "Data", def: row.cp4 || "" },

        { label: "Workers on Site", fn: "custom_workers_count", ft: "Int", def: row.workers || "" },

        { label: "Contract Value", fn: "custom_contract_value", ft: "Currency", def: row.contract || "" },
    ]
},
          {
    label: "Social & Web",
    fields: [
        { label: "Instagram", fn: "custom_instagram", ft: "Data", def: row.instagram || "" },
        { label: "LinkedIn", fn: "custom_linkedin", ft: "Data", def: row.linkedin || "" },
        { label: "Facebook", fn: "custom_facebook", ft: "Data", def: row.facebook || "" },
        { label: "Telegram", fn: "custom_telegram", ft: "Data", def: row.telegram || "" },
        { label: "Website", fn: "website", ft: "Data", def: row.website || "" },
        { label: "TikTok", fn: "custom_tiktok", ft: "Data", def: row.tiktok || "" },
        { label: "X", fn: "custom_x", ft: "Data", def: row.x || "" },
    ]
},
        ];

        // Build menu dialog
        const menuDlg = new frappe.ui.Dialog({
            title: "Edit Prospect",
            fields: [{
                fieldtype: "HTML",
                fieldname: "menu_html",
                options: sections.map(s =>
                    `<button type="button" class="pg-mob-section-btn" data-section="${_e(s.label)}">${_e(s.label)}</button>`
                ).join(""),
            }],
        });
        menuDlg.show();

        setTimeout(() => {
            menuDlg.$wrapper.find("[data-section]").on("click", function () {
                const label = $(this).data("section");
                const sec   = sections.find(s => s.label === label);
                if (!sec) return;
                menuDlg.hide();

                const editDlg = new frappe.ui.Dialog({
                    title: sec.label,
                    fields: sec.fields.map(f => ({
                        label:    f.label,
                        fieldname:f.fn,
                        fieldtype:f.ft,
                        options:  f.options || undefined,
                        default:  f.def,
                    })),
                    primary_action_label: "Save",
                    primary_action(vals) {
                        if (!vals) return;
                        frappe.call({
                            method: "frappe.client.get",
                            args: { doctype: "Prospect", name: row.name },
                            callback(res) {
                                const doc = res.message;
                                Object.keys(vals).forEach(k => { doc[k] = vals[k]; });
                                frappe.call({
                                    method: "frappe.client.save",
                                    args: { doc },
                                    callback(sr) {
                                        if (sr.exc) { frappe.show_alert({ message: "Save failed", indicator: "red" }, 4); return; }
                                        editDlg.hide();
                                        frappe.show_alert({ message: "Saved", indicator: "green" }, 2);
                                        setTimeout(reload, 600);
                                    },
                                });
                            },
                        });
                    },
                });
                editDlg.show();
            });
        }, 200);
    }

// ── Full wiring ────────────────────────────────────────────────
    function _wire(root, cfg) {
        const tabCount = cfg.tabs.length;
        const outer = root.querySelector(".pg-tbl-outer");
        const tbody = root.querySelector("tbody");

        // ── Pill click ──────────────────────────────────────────
        root.addEventListener("click", e => {
            const pill = e.target.closest(".pg-pill");
            if (pill) _activatePill(root, pill, tabCount);
        });

        // ── Scroll: close edit + track active tab from position ────
        let _scrollRaf = null;
        outer.addEventListener("scroll", () => {
            if (_eIn) _closeEdit(true);
            if (_scrollRaf) return;
            _scrollRaf = requestAnimationFrame(() => {
                _scrollRaf = null;
                const tbl2   = root.querySelector(".pg-tbl");
                const fixedW = (cfg.fixed || []).reduce((s, f) => s + (f.width || 120), 0);
                const sl     = outer.scrollLeft;
                let activeN  = 0;
                for (let i = tabCount - 1; i >= 0; i--) {
                    const th = tbl2.querySelector(`th.pg-v-${i}`);
                    if (th && (th.offsetLeft - fixedW) <= sl + 20) { activeN = i; break; }
                }
                const cur = parseInt(tbl2.getAttribute("data-tab") || 0);
                if (activeN !== cur) {
                    const pill2 = root.querySelector(`.pg-pill[data-tab="${activeN}"]`);
                    if (pill2) _activatePill(root, pill2, tabCount, true);
                }
            });
        }, { passive: true });

        // ── Row number selection ─────────────────────────────────
        root.addEventListener("click", e => {
            const numTd = e.target.closest(".pg-f-num-cell");
            if (!numTd || !root.contains(numTd)) return;
            e.preventDefault();
            e.stopPropagation();
            const tr = numTd.closest("tr");
            if (!tr || !tbody.contains(tr)) return;
            const rows = Array.from(tbody.children);
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                _toggleRow(root, tr);
                return;
            }
            rows.forEach(r => r.classList.remove("pg-row-sel"));
            _toggleRow(root, tr, true);
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
                if (e.target.closest(".pg-maps-btn"))    return;
                if (e.target.closest(".pg-map-copy"))    return;
                if (e.target.closest(".pg-map-edit"))    return;
                if (e.target.closest(".pg-form-link"))   return;
                if (e.target.closest(".pg-wa-btn"))      return;
                if (e.target.closest(".pg-wa-api-btn"))  return;
                if (e.target.closest(".pg-email-btn"))   return;
                if (e.target.closest(".pg-social-lnk"))  return;
                const td = e.target.closest("td.pg-ed");
                if (!td) return;
                // Empty maps cell → offer current location
                if (td.dataset.ctype === "maps" && !td.dataset.val) {
                    _openMapsLocationPopup(root, td);
                    return;
                }
                _openEdit(root, td);
            });

            // Notes cells open immediately on hover — no click needed
            root.addEventListener("mouseenter", e => {
                const td = e.target.closest("td.pg-ed");
                if (!td || td.dataset.ctype !== "notes") return;
                clearTimeout(_hoverCloseTimer);
                if (_eTd === td) return; // already editing this cell
                _hoverEdit = true;
                _openEdit(root, td);
                // Keep open while mouse is over the float wrapper
                if (_eFl) {
                    _eFl.onmouseenter = () => clearTimeout(_hoverCloseTimer);
                    _eFl.onmouseleave = () => {
                        if (_hoverEdit) _hoverCloseTimer = setTimeout(() => _closeEdit(true), 120);
                    };
                }
            }, true);

            // Close on mouseleave of notes cell (grace period for moving to float)
            root.addEventListener("mouseleave", e => {
                const td = e.target.closest("td.pg-ed");
                if (!td || td.dataset.ctype !== "notes" || !_hoverEdit) return;
                _hoverCloseTimer = setTimeout(() => { if (_hoverEdit) _closeEdit(true); }, 120);
            }, true);
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

        // ── Form-link click → open document ─────────────────────
        root.addEventListener("click", e => {
            const a = e.target.closest(".pg-form-link");
            if (!a) return;
            e.stopPropagation();
            const dt   = a.dataset.doctype;
            const name = a.dataset.docname;
            if (dt && name) frappe.set_route("Form", dt, name);
        });

        // ── Maps copy button ─────────────────────────────────────
        root.addEventListener("click", e => {
            const btn = e.target.closest(".pg-map-copy");
            if (!btn) return;
            e.stopPropagation();
            const url = btn.dataset.url;
            if (!url) return;
            navigator.clipboard.writeText(url).then(() => {
                btn.innerHTML = SVG.check;
                btn.classList.add("pg-copied");
                setTimeout(() => {
                    btn.innerHTML = SVG.copy;
                    btn.classList.remove("pg-copied");
                }, 1800);
            }).catch(() => frappe.show_alert({ message: "Copy failed", indicator: "red" }, 2));
        });

        // ── Email compose button ─────────────────────────────────
        root.addEventListener("click", e => {
            const btn = e.target.closest(".pg-email-btn");
            if (!btn) return;
            e.stopPropagation();
            const td      = btn.closest("td");
            const rowName = td && td.dataset.rowName;
            _openCompose(btn.dataset.email, rowName || "", cfg);
        });

        // ── WhatsApp API compose button ──────────────────────────
        root.addEventListener("click", e => {
            const btn = e.target.closest(".pg-wa-api-btn");
            if (!btn) return;
            e.stopPropagation();
            const td      = btn.closest("td");
            const rowName = td && td.dataset.rowName;
            _openWaCompose(btn.dataset.phone, rowName || "", cfg);
        });

        // ── Maps edit button (opens text edit, not location popup) ──
        root.addEventListener("click", e => {
            const btn = e.target.closest(".pg-map-edit");
            if (!btn) return;
            e.stopPropagation();
            const td = btn.closest("td.pg-ed");
            if (td) _openEdit(root, td);
        });

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

        // ── Owner hover popup ────────────────────────────────────
        root.addEventListener("mouseenter", e => {
            const av = e.target.closest(".pg-owner-av");
            if (!av) return;
            const owner    = av.dataset.owner    || "";
            const initials = av.dataset.initials || "?";
            const color    = av.dataset.color    || "#6b7280";
            clearTimeout(_ownerTimer);
            _ownerTimer = setTimeout(() => _showOwnerPopup(av, owner, initials, color), 180);
        }, true);

        root.addEventListener("mouseleave", e => {
            if (!e.target.closest(".pg-owner-av")) return;
            clearTimeout(_ownerTimer);
            _ownerTimer = setTimeout(_hideOwnerPopup, 120);
        }, true);

        // ── Contact avatar hover popup ───────────────────────────
        root.addEventListener("mouseenter", e => {
            const av = e.target.closest(".pg-contact-av, .pg-cl-name");
            if (!av) return;
            const contactName = av.dataset.contactName || "";
            const ini         = av.dataset.ini          || contactName.split(/\s+/).map(w=>w[0]||"").join("").toUpperCase().slice(0,2) || "?";
            const color       = av.dataset.color        || "#6b7280";
            const rowOwner    = av.dataset.rowOwner     || "";
            clearTimeout(_contactTimer);
            _contactTimer = setTimeout(() => _showContactPopup(av, contactName, ini, color, root, rowOwner), 180);
        }, true);

        root.addEventListener("mouseleave", e => {
            if (!e.target.closest(".pg-contact-av, .pg-cl-name")) return;
            clearTimeout(_contactTimer);
            _contactTimer = setTimeout(_hideContactPopup, 120);
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
                delete _filesCache[name];
                frappe.show_alert({ message: `Uploading ${file.name}…`, indicator: "blue" }, 4);
                const fd = new FormData();
                fd.append("file", file, file.name);
                fd.append("doctype",  cfg.doctype || "Prospect");
                fd.append("docname",  name);
                fd.append("is_private", "0");
                fd.append("folder",   "Home/Attachments");
                fetch("/api/method/upload_file", {
                    method: "POST",
                    headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
                    body: fd,
                }).then(r => r.json()).then(data => {
                    if (data.message && data.message.file_name) {
                        frappe.show_alert({ message: `Uploaded: ${data.message.file_name}`, indicator: "green" }, 3);
                    } else {
                        frappe.show_alert({ message: "Upload failed", indicator: "red" }, 4);
                    }
                }).catch(() => {
                    frappe.show_alert({ message: "Upload failed", indicator: "red" }, 4);
                });
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

        // ── Mobile card expand/collapse ──────────────────────────
        root.addEventListener("click", e => {
            const card = e.target.closest(".pg-mob-card");
            if (!card) return;
            if (e.target.closest(".pg-mob-action")) return;
            card.classList.toggle("pg-mob-expanded");
        });

        // ── Mobile card edit button ──────────────────────────────
        root.addEventListener("click", e => {
            const btn = e.target.closest(".pg-mob-action-edit");
            if (!btn) return;
            e.stopPropagation();
            const name = btn.dataset.name;
            const row  = (cfg.rows || []).find(r => r.name === name);
            if (!row) return;
            _openMobEdit(row, cfg, () => _reload(root));
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
                root.querySelectorAll(".pg-mob-card").forEach(card => {
                    card.style.display = !q || card.textContent.toLowerCase().includes(q) ? "" : "none";
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
            if (cfg.onExport) cfg.onExport(cfg.rows, () => _reload(root));
            else if (cfg.onExportLeads) cfg.onExportLeads(cfg.rows, () => _reload(root));
        });

        // ── Notes hover tooltip ──────────────────────────────────
        let _notesTooltip = null;
        root.addEventListener("mouseenter", ev => {
            const span = ev.target.closest(".pg-notes-cell");
            if (!span) return;
            const text = span.dataset.notes;
            if (!text) return;
            if (!_notesTooltip) {
                _notesTooltip = document.createElement("div");
                _notesTooltip.className = "pg-notes-tip";
                document.body.appendChild(_notesTooltip);
            }
            _notesTooltip.textContent = text;
            const r = span.getBoundingClientRect();
            let top = r.bottom + 6;
            let left = r.left;
            if (top + 150 > window.innerHeight) top = r.top - 10;
            _notesTooltip.style.left = left + "px";
            _notesTooltip.style.top  = top + "px";
            _notesTooltip.classList.add("pg-notes-tip-on");
        }, true);
        root.addEventListener("mouseleave", ev => {
            if (!ev.target.closest(".pg-notes-cell") || !_notesTooltip) return;
            _notesTooltip.classList.remove("pg-notes-tip-on");
        }, true);
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

    function _activatePill(root, pill, _tabCount, skipScroll) {
        const tbl   = root.querySelector(".pg-tbl");
        const outer = root.querySelector(".pg-tbl-outer");
        const newN  = parseInt(pill.dataset.tab);
        root.querySelectorAll(".pg-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        _positionInd(pill);
        tbl.setAttribute("data-tab", newN);
        if (!skipScroll && outer) {
            const firstTh = tbl.querySelector(`th.pg-v-${newN}`);
            if (firstTh) {
                const fixedW = (root._pgCfg.fixed || []).reduce((s, f) => s + (f.width || 120), 0);
                outer.scrollTo({ left: Math.max(0, firstTh.offsetLeft - fixedW), behavior: "instant" });
            }
        }
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

    // ── Quick Stats strip ──────────────────────────────────────────
    // cards: [{ num, label, sub, icon, colorCls }]
    function renderStats(host, cards) {
        const existing = host.querySelector(".pg-qs-strip");
        if (existing) existing.remove();
        const strip = document.createElement("div");
        strip.className = "pg-qs-strip";
        strip.innerHTML = cards.map(c => `
<div class="pg-qs-card ${_e(c.colorCls || "pg-qs-c1")}">
  <div class="pg-qs-num">${_e(String(c.num))}</div>
  <div class="pg-qs-lbl">${_e(c.label)}</div>
  ${c.sub ? `<div class="pg-qs-sub">${_e(c.sub)}</div>` : ""}
  ${c.icon ? `<div class="pg-qs-icon">${c.icon}</div>` : ""}
</div>`).join("");
        host.insertBefore(strip, host.firstChild);
    }

    // ── Public API ─────────────────────────────────────────────────
    window.PG = { mount, setTab, injectStyles, getSelected, renderStats };
    injectStyles();
})();
