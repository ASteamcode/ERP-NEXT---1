(function () {
  "use strict";

  // ─── Sidebar brand redesign ───────────────────────────────────────────────
  (function injectSidebarStyles() {
    if (document.getElementById("cst-sidebar-styles")) return;
    const s = document.createElement("style");
    s.id = "cst-sidebar-styles";
    s.textContent = `
/* ── Core sidebar background ── */
.body-sidebar {
  background: linear-gradient(180deg, #1a3576 0%, #1e3f85 40%, #2a52a8 100%) !important;
  border-right: none !important;
  box-shadow: 3px 0 18px rgba(20,40,110,.28) !important;
}

/* ── CSS variable overrides for sidebar states ── */
.body-sidebar { --sidebar-hover-color: rgba(255,255,255,.10); --sidebar-active-color: rgba(255,255,255,.18); --sidebar-border-color: transparent; }

/* ── All text / icons inside sidebar → white ── */
.body-sidebar .item-anchor,
.body-sidebar .sidebar-item-label,
.body-sidebar .section-break,
.body-sidebar .collapse-sidebar-link span,
.body-sidebar .onboarding-sidebar span,
.body-sidebar .nav-link,
.body-sidebar .dropdown-navbar-user .avatar-name-email,
.body-sidebar .avatar-abbreviation { color: rgba(255,255,255,.82) !important; }

/* ── Icons ── */
.body-sidebar .sidebar-item-icon svg,
.body-sidebar .menu-icon svg,
.body-sidebar .sidebar-item-icon img { filter: brightness(0) invert(1) !important; opacity: .7; }

/* ── Section labels (section-break) ── */
.body-sidebar .section-break {
  color: rgba(255,255,255,.38) !important;
  font-size: 9.5px !important;
  font-weight: 700 !important;
  letter-spacing: .08em !important;
  text-transform: uppercase !important;
  margin-left: 10px !important;
}

/* ── Hover state ── */
.body-sidebar .standard-sidebar-item:not(.active-sidebar):has(a:not(.section-break)):hover {
  background: rgba(255,255,255,.10) !important;
  border-radius: 10px !important;
}
.body-sidebar .standard-sidebar-item:not(.active-sidebar):has(a:not(.section-break)):hover .item-anchor,
.body-sidebar .standard-sidebar-item:not(.active-sidebar):has(a:not(.section-break)):hover .sidebar-item-label { color: #fff !important; }
.body-sidebar .standard-sidebar-item:not(.active-sidebar):has(a:not(.section-break)):hover .sidebar-item-icon svg { opacity: 1; }

/* ── Active state — white pill ── */
.body-sidebar .active-sidebar {
  background: rgba(255,255,255,.18) !important;
  box-shadow: 0 2px 12px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.2) !important;
  border-radius: 10px !important;
}
.body-sidebar .active-sidebar .item-anchor,
.body-sidebar .active-sidebar .sidebar-item-label { color: #fff !important; font-weight: 700 !important; }
.body-sidebar .active-sidebar .sidebar-item-icon svg { opacity: 1 !important; }

/* ── Left accent bar on active ── */
.body-sidebar .active-sidebar::before {
  content: "";
  position: absolute;
  left: 0; top: 4px; bottom: 4px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #fff;
  opacity: .8;
}

/* ── Bottom user section ── */
.body-sidebar .body-sidebar-bottom .dropdown-navbar-user:hover {
  background: rgba(255,255,255,.10) !important;
  border-radius: 10px !important;
}
.body-sidebar .body-sidebar-bottom .avatar-abbreviation {
  background: rgba(255,255,255,.22) !important;
  color: #fff !important;
  border: 1.5px solid rgba(255,255,255,.3) !important;
}
.body-sidebar .body-sidebar-bottom .avatar-name-email * { color: rgba(255,255,255,.8) !important; }

/* ── Divider ── */
.body-sidebar .divider { border-color: rgba(255,255,255,.12) !important; }

/* ── Resize handle ── */
.sidebar-resize-handle::after { background: rgba(255,255,255,.18) !important; }

/* ── Scrollbar inside sidebar ── */
.body-sidebar .body-sidebar-top::-webkit-scrollbar { width: 3px; }
.body-sidebar .body-sidebar-top::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 3px; }
.body-sidebar .body-sidebar-top::-webkit-scrollbar-track { background: transparent; }

/* ── Sidebar toggle btn (the little circle) ── */
.body-sidebar .sidebar-toggle-btn {
  background: rgba(255,255,255,.15) !important;
  border-color: rgba(255,255,255,.25) !important;
}
.body-sidebar .sidebar-toggle-btn svg { stroke: #fff !important; }
.body-sidebar .sidebar-toggle-btn:hover { background: rgba(255,255,255,.25) !important; }

/* ── Sidebar placeholder (keeps layout stable) ── */
.body-sidebar-placeholder { background: transparent !important; }

/* ── Notification bell / dropdown icons in bottom standard items ── */
.body-sidebar .standard-items-sections svg { stroke: rgba(255,255,255,.7) !important; }
.body-sidebar .standard-items-sections .badge { background: #ef4444 !important; }

/* ── drop-icon (submenu chevron) ── */
.body-sidebar .drop-icon svg { stroke: rgba(255,255,255,.55) !important; }

/* ── Bigger nav icons ── */
.body-sidebar .sidebar-item-icon { padding: 5px !important; }
.body-sidebar .standard-sidebar-item .sidebar-item-icon svg,
.body-sidebar .standard-sidebar-item .sidebar-item-icon img:not(.cst-logo) {
  width: 22px !important; height: 22px !important;
}

/* ── Remove Frappe CRM promo banner ── */
.body-sidebar .promotional-banners { display: none !important; }

/* ═══════════════════════════════════════════════════════════════
   GLOBAL INDICATOR PILL REDESIGN — matches pg-badge gradient style
   ═══════════════════════════════════════════════════════════════ */

/* Base reset — remove Frappe's flat dot+text style */
.indicator-pill, .indicator-pill.no-margin {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 4px 11px !important;
  border-radius: 99px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: .01em !important;
  white-space: nowrap !important;
  border-width: 1px !important;
  border-style: solid !important;
  line-height: 1 !important;
}
/* The dot */
.indicator-pill::before {
  content: '' !important;
  width: 6px !important; height: 6px !important;
  border-radius: 50% !important;
  background: currentColor !important;
  flex-shrink: 0 !important;
}

/* Color map — gradient fills matching pg-badge */
.indicator-pill.blue, .indicator-pill[data-color="blue"] {
  background: linear-gradient(135deg,#dbeafe,#bfdbfe) !important;
  color: #1d4ed8 !important; border-color: #93c5fd !important;
}
.indicator-pill.purple, .indicator-pill[data-color="purple"],
.indicator-pill.indigo, .indicator-pill[data-color="indigo"] {
  background: linear-gradient(135deg,#e0e7ff,#c7d2fe) !important;
  color: #3730a3 !important; border-color: #a5b4fc !important;
}
.indicator-pill.cyan, .indicator-pill[data-color="cyan"],
.indicator-pill.teal, .indicator-pill[data-color="teal"] {
  background: linear-gradient(135deg,#cffafe,#a5f3fc) !important;
  color: #0e7490 !important; border-color: #67e8f9 !important;
}
.indicator-pill.green, .indicator-pill[data-color="green"] {
  background: linear-gradient(135deg,#d1fae5,#a7f3d0) !important;
  color: #065f46 !important; border-color: #6ee7b7 !important;
}
.indicator-pill.gray, .indicator-pill.grey,
.indicator-pill[data-color="gray"], .indicator-pill[data-color="grey"],
.indicator-pill.light-blue {
  background: linear-gradient(135deg,#f1f5f9,#e2e8f0) !important;
  color: #475569 !important; border-color: #cbd5e1 !important;
}
.indicator-pill.yellow, .indicator-pill[data-color="yellow"] {
  background: linear-gradient(135deg,#fef9c3,#fef08a) !important;
  color: #854d0e !important; border-color: #fde047 !important;
}
.indicator-pill.orange, .indicator-pill[data-color="orange"] {
  background: linear-gradient(135deg,#ffedd5,#fed7aa) !important;
  color: #9a3412 !important; border-color: #fb923c !important;
}
.indicator-pill.red, .indicator-pill[data-color="red"] {
  background: linear-gradient(135deg,#fde8d8,#fcd3b3) !important;
  color: #7c2d12 !important; border-color: #fdba74 !important;
}
.indicator-pill.pink, .indicator-pill[data-color="pink"] {
  background: linear-gradient(135deg,#fce7f3,#fbcfe8) !important;
  color: #9d174d !important; border-color: #f9a8d4 !important;
}

/* ── Form select elements — brand border + clean look ── */
.frappe-control select.input-with-feedback,
.form-control[data-fieldtype="Select"],
select.form-control {
  border-color: #c7d3ec !important;
  border-radius: 7px !important;
  font-size: 12.5px !important;
  color: #1e3a5f !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231e3f85' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
  padding-right: 28px !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  transition: border-color .15s !important;
}
.frappe-control select.input-with-feedback:focus,
select.form-control:focus {
  border-color: #3a6fd8 !important;
  box-shadow: 0 0 0 3px rgba(58,111,216,.12) !important;
  outline: none !important;
}

/* ── Company logo in sidebar header ── */
.body-sidebar .sidebar-header .sidebar-item-icon {
  background: transparent !important;
  padding: 0 !important;
  display: flex; align-items: center; justify-content: center;
  width: 36px !important; height: 36px !important;
}
.body-sidebar .sidebar-header .header-logo { display: flex; align-items: center; justify-content: center; }
.body-sidebar .sidebar-header .header-logo img.cst-logo {
  width: 34px !important; height: 34px !important;
  object-fit: contain; border-radius: 8px;
  filter: none !important; opacity: 1 !important;
}
    `;
    document.head.appendChild(s);
  })();

  const CONTAINER_SEL     = ".body-sidebar-container";
  const TOGGLE_BTN_SEL    = ".collapse-sidebar-link";
  const HEADER_SEL        = ".sidebar-header";
  const AVATAR_LABEL_SEL  = ".avatar-name-email";
  const DROP_ICON_SEL     = ".drop-icon";
  const COLLAPSE_DELAY_MS = 120;

  // ─── Force styles that Frappe keeps overriding ───────────────────────────

  function enforceStaticStyles(container) {
    // .sidebar-header must always have zero horizontal padding.
    const header = container.querySelector(HEADER_SEL);
    if (header) {
      header.style.paddingLeft  = "0px";
      header.style.paddingRight = "0px";
    }

    // .avatar-name-email must never be hidden.
    const avatarLabel = container.querySelector(AVATAR_LABEL_SEL);
    if (avatarLabel) {
      avatarLabel.style.display = "";  // clear inline display:none back to stylesheet
    }
  }

  // Watch for Frappe mutating inline styles OR data-state on relevant elements
  // and immediately re-apply our forced values.
  function observeStyleOverrides(container) {
    const observer = new MutationObserver(() => enforceStaticStyles(container));

    // Watch inline style changes on header and avatar label.
    [HEADER_SEL, AVATAR_LABEL_SEL]
      .map(sel => container.querySelector(sel))
      .filter(Boolean)
      .forEach(el => observer.observe(el, {
        attributes: true,
        attributeFilter: ["style"],
      }));

    // Watch data-state changes on all .drop-icon buttons (sub-item expanders).
    // When Frappe toggles a submenu open/closed it sets data-state="opened"|"closed"
    // on these buttons and re-applies padding to .sidebar-header in the same tick.
    container.querySelectorAll(DROP_ICON_SEL).forEach(btn =>
      observer.observe(btn, {
        attributes: true,
        attributeFilter: ["data-state"],
      })
    );
  }

  // ─── Sidebar wiring ───────────────────────────────────────────────────────

  function wireSidebar(container) {
    if (container.dataset.hoverWired) return;
    container.dataset.hoverWired = "1";

    // Start collapsed.
    container.classList.remove("expanded");

    // Kill the toggle button.
    const toggleBtn = container.querySelector(TOGGLE_BTN_SEL);
    if (toggleBtn) toggleBtn.style.display = "none";

    // Apply static style overrides and keep them enforced.
    enforceStaticStyles(container);
    observeStyleOverrides(container);

    let collapseTimer = null;

    const expand           = () => container.classList.add("expanded");
    const collapse         = () => container.classList.remove("expanded");
    const scheduleCollapse = () => { collapseTimer = setTimeout(collapse, COLLAPSE_DELAY_MS); };
    const cancelCollapse   = () => { if (collapseTimer !== null) { clearTimeout(collapseTimer); collapseTimer = null; } };

    container.addEventListener("mouseenter", () => { cancelCollapse(); expand(); });
    container.addEventListener("mouseleave", scheduleCollapse);
  }

  // ─── Company logo injection ───────────────────────────────────────────────

  const LOGO_URL = "/assets/erp_next_custom/images/logo.jpg";

  function injectLogo() {
    const logoWrap = document.querySelector(".body-sidebar .sidebar-header .header-logo");
    if (!logoWrap) return;
    if (logoWrap.querySelector("img.cst-logo")) return; // already injected
    logoWrap.innerHTML = `<img class="cst-logo" src="${LOGO_URL}" alt="Logo">`;
  }

  // Re-inject whenever Frappe rebuilds the sidebar header (route changes, workspace switch)
  const _logoObserver = new MutationObserver(injectLogo);
  function watchLogo() {
    const sidebar = document.querySelector(".body-sidebar");
    if (sidebar) _logoObserver.observe(sidebar, { childList: true, subtree: true });
    injectLogo();
  }

  // ─── Simplify "Add {DocType}" → "+ Add" ──────────────────────────────────

  function simplifyAddButton() {
    document.querySelectorAll(".page-head .btn-primary, .page-head .page-actions .btn").forEach(btn => {
      const txt = btn.textContent.trim();
      if (txt === "+ Add") return; // already done
      if (/\b(Add|New)\s+[A-Z]/.test(txt)) {
        btn.textContent = "+ Add";
      }
    });
  }

  // Watch document.body so we catch the button no matter when Frappe renders it
  const _addBtnObserver = new MutationObserver(simplifyAddButton);
  const _watchAddBtn = () => {
    _addBtnObserver.disconnect();
    _addBtnObserver.observe(document.body, { childList: true, subtree: true });
    simplifyAddButton();
  };

  // ─── Home button → Overview ───────────────────────────────────────────────

  function wireHomeButton() {
    // Frappe renders the breadcrumb home as an <a> wrapping a home icon.
    // Select any breadcrumb home link that points to /app or /app/ (the desk root).
    document.querySelectorAll('.breadcrumb-container a[href="/app"], .breadcrumb-container a[href="/app/"]').forEach(a => {
      if (a.dataset.ovWired) return;
      a.dataset.ovWired = "1";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        frappe.set_route("overview");
      });
    });
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  function init() {
    const container = document.querySelector(CONTAINER_SEL);
    if (container) wireSidebar(container);
    wireHomeButton();
    _watchAddBtn();
    watchLogo();
  }

  document.addEventListener("DOMContentLoaded", init);

  if (window.frappe?.router) {
    frappe.router.on("change", init);
  } else {
    const observer = new MutationObserver(() => {
      const container = document.querySelector(CONTAINER_SEL);
      if (container && !container.dataset.hoverWired) wireSidebar(container);
      simplifyAddButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();