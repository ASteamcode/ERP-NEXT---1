/* ─────────────────────────────────────────────────────────────────
   Overview  —  Company workspace
   Modular full-screen page · Company sidebar · main content area
───────────────────────────────────────────────────────────────── */
"use strict";

// ── lifecycle ──────────────────────────────────────────────────────
frappe.pages["overview"].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({ parent: wrapper, title: "Overview", single_column: true });
    _ov_inject_styles();
    _ov_takeover(wrapper);
    wrapper._ov_fresh_load = true;
    _ov_build(wrapper);
    _ov_load(wrapper);
};

frappe.pages["overview"].on_page_show = function (wrapper) {
    if (!wrapper._ov_fresh_load) {
        window.location.reload();
        return;
    }
    wrapper._ov_fresh_load = false;
    _ov_takeover(wrapper);
};

frappe.pages["overview"].on_page_hide = function (wrapper) {
    _ov_restore(wrapper);
    $(document).off("keydown.ov");
};

// ── full-screen takeover ───────────────────────────────────────────
function _ov_takeover() {
    $("body").addClass("ov-fs");
}
function _ov_restore() {
    $("body").removeClass("ov-fs");
}

// ── shell ──────────────────────────────────────────────────────────
function _ov_build(wrapper) {
    $(wrapper).find(".layout-main-section").html(`
<div class="ov-shell">

  <!-- sidebar -->
  <aside class="ov-sidebar">
    <div class="ov-brand">
      <div class="ov-logo-wrap" id="ov-logo-wrap">
        <div class="ov-logo-fallback">
          <svg viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#ovbg)"/>
            <rect x="6"  y="6"  width="8" height="8" rx="2" fill="rgba(255,255,255,.9)"/>
            <rect x="18" y="6"  width="8" height="8" rx="2" fill="rgba(255,255,255,.6)"/>
            <rect x="6"  y="18" width="8" height="8" rx="2" fill="rgba(255,255,255,.4)"/>
            <rect x="18" y="18" width="8" height="8" rx="2" fill="rgba(255,255,255,.2)"/>
            <defs>
              <linearGradient id="ovbg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7c3aed"/>
                <stop offset="100%" stop-color="#2563eb"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div class="ov-brand-info">
        <div class="ov-brand-name" id="ov-brand-name">Loading…</div>
        <div class="ov-brand-sub">Overview</div>
      </div>
    </div>

    <nav class="ov-nav-sections">
      <div class="ov-nav-section">
        <div class="ov-sec-hd">CRM</div>
        <a class="ov-nav-item" href="/app/prospect" data-route="prospect">
          <span class="ov-nav-icon">
            <svg viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="3" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 13.5c0-2.761 2.686-5 6-5s6 2.239 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          Prospects
        </a>
      </div>
    </nav>

    <div class="ov-sidebar-foot">
      <button class="ov-back-btn" id="ov-back-btn">
        <svg viewBox="0 0 14 14" fill="none">
          <path d="M8.5 2.5L3 7l5.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back to Desk
      </button>
    </div>
  </aside>

  <!-- main content -->
  <div class="ov-main">
    <header class="ov-header">
      <div class="ov-header-l">
        <h1 class="ov-title" id="ov-title">Overview</h1>
      </div>
    </header>

    <div class="ov-content" id="ov-content">
      <div class="ov-loading"><div class="ov-spinner"></div></div>
    </div>
  </div>

</div>`);

    _ov_wire(wrapper);
}

// ── event wiring ───────────────────────────────────────────────────
function _ov_wire(wrapper) {
    const $sh = $(wrapper).find(".ov-shell");

    $sh.on("click", "#ov-back-btn", () => { window.location.href = "/desk"; });

    // highlight active nav item based on current hash / route
    $sh.on("click", ".ov-nav-item", function () {
        $sh.find(".ov-nav-item").removeClass("active");
        $(this).addClass("active");
    });
}

// ── data ───────────────────────────────────────────────────────────
function _ov_load(wrapper) {
    frappe.call({
        method: "erp_next_custom.erp_next_custom.page.overview.overview.get_company_info",
        callback(r) {
            const co = r.message || {};
            _ov_fill_sidebar(co);
            _ov_render_content(wrapper, co);
        },
    });
}

function _ov_fill_sidebar(co) {
    const name = co.company_name || co.name || "Company";
    $("#ov-brand-name").text(name);
    $("#ov-title").text(name);

    if (co.company_logo) {
        $("#ov-logo-wrap").html(
            `<img class="ov-logo-img" src="${frappe.utils.escape_html(co.company_logo)}" alt="${frappe.utils.escape_html(name)}">`
        );
    }
}

function _ov_render_content(wrapper, co) {
    $("#ov-content").html(`
<div class="ov-welcome">
  <div class="ov-welcome-icon">
    <svg viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="url(#owbg)"/>
      <rect x="10" y="10" width="12" height="12" rx="3" fill="rgba(255,255,255,.9)"/>
      <rect x="26" y="10" width="12" height="12" rx="3" fill="rgba(255,255,255,.55)"/>
      <rect x="10" y="26" width="12" height="12" rx="3" fill="rgba(255,255,255,.35)"/>
      <rect x="26" y="26" width="12" height="12" rx="3" fill="rgba(255,255,255,.18)"/>
      <defs>
        <linearGradient id="owbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
    </svg>
  </div>
  <h2 class="ov-welcome-title">Welcome to Overview</h2>
  <p class="ov-welcome-sub">Your company workspace is ready. Use the sidebar to navigate.</p>
  <div class="ov-quick-links">
    <a class="ov-ql-card" href="/app/prospect">
      <span class="ov-ql-icon">
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="ov-ql-label">Prospects</span>
      <span class="ov-ql-arrow">→</span>
    </a>
  </div>
</div>`);
}

// ── styles ─────────────────────────────────────────────────────────
function _ov_inject_styles() {
    if (document.getElementById("ov-styles")) return;
    const s = document.createElement("style");
    s.id = "ov-styles";
    s.textContent = `

/* ── hide frappe chrome ─────────────────────────────────────── */
body.ov-fs .navbar,
body.ov-fs .navbar-expand,
body.ov-fs [class*="navbar"],
body.ov-fs .body-sidebar-container,
body.ov-fs .layout-side-section,
body.ov-fs .sidebar-toggle-btn,
body.ov-fs .collapse-sidebar-link,
body.ov-fs .sidebar-resize-handle
{ display:none !important; }

body.ov-fs .main-section,
body.ov-fs .desk-main,
body.ov-fs .container.page-container
{ padding:0 !important; margin:0 !important; max-width:100% !important; }

/* ── shell ──────────────────────────────────────────────────── */
.ov-shell {
    position: fixed !important;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 1100;
    display: flex;
    background: #f5f5f8;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    overflow: hidden;
}

/* ── sidebar ──────────────────────────────────────────────────── */
.ov-sidebar {
    width: 240px;
    min-width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    background: linear-gradient(160deg, #1a0533 0%, #0d1a3a 100%);
    border-right: 1px solid rgba(255,255,255,.06);
}
.ov-sidebar::-webkit-scrollbar { display: none; }

/* brand / company header */
.ov-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 20px 16px 16px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
}
.ov-logo-wrap {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.35);
}
.ov-logo-wrap svg { width: 36px; height: 36px; }
.ov-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 9px;
}
.ov-logo-fallback { width: 36px; height: 36px; }
.ov-brand-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ov-brand-name {
    font-size: 13px;
    font-weight: 700;
    color: #f0eeff;
    letter-spacing: -.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ov-brand-sub {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    background: linear-gradient(90deg, #a78bfa, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* nav sections */
.ov-nav-sections { flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 18px; }
.ov-nav-section  { display: flex; flex-direction: column; gap: 2px; }
.ov-sec-hd {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(255,255,255,.2);
    padding: 4px 8px 5px;
}
.ov-nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    border-radius: 8px;
    color: rgba(255,255,255,.45);
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: none;
    transition: background .12s, color .12s;
    cursor: pointer;
}
.ov-nav-item:hover {
    background: rgba(255,255,255,.07);
    color: rgba(255,255,255,.85);
    text-decoration: none;
}
.ov-nav-item.active {
    background: linear-gradient(90deg, rgba(124,58,237,.35), rgba(37,99,235,.25));
    color: #c4b5fd;
    font-weight: 650;
    box-shadow: inset 0 0 0 1px rgba(167,139,250,.2);
}
.ov-nav-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.ov-nav-icon svg { width: 15px; height: 15px; }

/* footer */
.ov-sidebar-foot {
    padding: 10px 8px 20px;
    border-top: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
}
.ov-back-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 9px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,.2);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background .12s, color .12s;
    font-family: inherit;
}
.ov-back-btn svg { width: 11px; height: 11px; }
.ov-back-btn:hover {
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.5);
}

/* ── main ──────────────────────────────────────────────────────── */
.ov-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
}
.ov-header {
    display: flex;
    align-items: center;
    padding: 16px 28px 13px;
    background: #fff;
    border-bottom: 1px solid #e8e8f0;
    flex-shrink: 0;
    gap: 10px;
}
.ov-header-l { flex: 1; min-width: 0; }
.ov-title {
    font-size: 17px;
    font-weight: 750;
    color: #111827;
    margin: 0;
    letter-spacing: -.025em;
}
.ov-content {
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
}

/* ── loading ──────────────────────────────────────────────────── */
.ov-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
}
.ov-spinner {
    width: 26px;
    height: 26px;
    border: 2.5px solid #ede9fa;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: ov-spin .7s linear infinite;
}
@keyframes ov-spin { to { transform: rotate(360deg); } }

/* ── welcome / empty state ────────────────────────────────────── */
.ov-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    gap: 12px;
}
.ov-welcome-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 4px;
    filter: drop-shadow(0 6px 16px rgba(124,58,237,.35));
}
.ov-welcome-icon svg { width: 64px; height: 64px; }
.ov-welcome-title {
    font-size: 20px;
    font-weight: 750;
    color: #111827;
    margin: 0;
    letter-spacing: -.03em;
}
.ov-welcome-sub {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
    max-width: 340px;
    line-height: 1.55;
}

/* quick links */
.ov-quick-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 12px;
}
.ov-ql-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background: #fff;
    border: 1.5px solid #ebebf2;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    text-decoration: none;
    cursor: pointer;
    transition: box-shadow .16s, border-color .16s, transform .16s;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
    min-width: 160px;
}
.ov-ql-card:hover {
    border-color: #8b5cf6;
    box-shadow: 0 4px 16px rgba(124,58,237,.15);
    transform: translateY(-2px);
    color: #7c3aed;
    text-decoration: none;
}
.ov-ql-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #7c3aed, #2563eb);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
}
.ov-ql-icon svg { width: 16px; height: 16px; }
.ov-ql-label { flex: 1; }
.ov-ql-arrow {
    color: #c4b5fd;
    font-size: 14px;
    transition: transform .12s;
}
.ov-ql-card:hover .ov-ql-arrow { transform: translateX(3px); }
`;

    document.head.appendChild(s);
}
