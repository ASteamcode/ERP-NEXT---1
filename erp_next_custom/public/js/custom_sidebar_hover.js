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
  background: #032d60 !important;
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
  background: #e8f4fd !important;
  color: #014486 !important; border-color: #b0d4f1 !important;
}
.indicator-pill.purple, .indicator-pill[data-color="purple"],
.indicator-pill.indigo, .indicator-pill[data-color="indigo"] {
  background: #ece9f5 !important;
  color: #3e3794 !important; border-color: #c5bde8 !important;
}
.indicator-pill.cyan, .indicator-pill[data-color="cyan"],
.indicator-pill.teal, .indicator-pill[data-color="teal"] {
  background: #e0f5f5 !important;
  color: #0a5f6e !important; border-color: #8dd5d8 !important;
}
.indicator-pill.green, .indicator-pill[data-color="green"] {
  background: #eff9ef !important;
  color: #2e6b3e !important; border-color: #95d5a0 !important;
}
.indicator-pill.gray, .indicator-pill.grey,
.indicator-pill[data-color="gray"], .indicator-pill[data-color="grey"],
.indicator-pill.light-blue {
  background: #f3f3f3 !important;
  color: #706e6b !important; border-color: #c9c7c5 !important;
}
.indicator-pill.yellow, .indicator-pill[data-color="yellow"] {
  background: #fef9e3 !important;
  color: #7a4f00 !important; border-color: #f0d080 !important;
}
.indicator-pill.orange, .indicator-pill[data-color="orange"] {
  background: #fef0d9 !important;
  color: #9e4300 !important; border-color: #f4b56a !important;
}
.indicator-pill.red, .indicator-pill[data-color="red"] {
  background: #fde8e8 !important;
  color: #ba0517 !important; border-color: #f5a0a0 !important;
}
.indicator-pill.pink, .indicator-pill[data-color="pink"] {
  background: #fde8f3 !important;
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

  // ─── Inbox panel ─────────────────────────────────────────────────────────

  function injectInboxIcon() {
    if (document.getElementById("cst-inbox-btn")) return;
    const bottom = document.querySelector(".body-sidebar .body-sidebar-bottom");
    if (!bottom) return;

    // Inject styles
    if (!document.getElementById("cst-inbox-styles")) {
      const s = document.createElement("style");
      s.id = "cst-inbox-styles";
      s.textContent = `
        #cst-inbox-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; margin: 0 8px 6px;
          border-radius: 10px; cursor: pointer;
          border: none; background: linear-gradient(135deg,#2563eb,#1d4ed8);
          color: #fff; width: calc(100% - 16px); box-sizing: border-box;
          transition: opacity .15s, box-shadow .15s;
          box-shadow: 0 2px 10px rgba(37,99,235,.45);
          position: relative; overflow: hidden;
        }
        #cst-inbox-btn:hover { opacity: .92; box-shadow: 0 4px 16px rgba(37,99,235,.6); }
        #cst-inbox-btn .cst-ib-icon { flex-shrink: 0; width: 22px; height: 22px; display:flex; align-items:center; justify-content:center; }
        #cst-inbox-btn .cst-ib-label { font-size: 12.5px; font-weight: 700; letter-spacing: .01em; white-space: nowrap; }
        #cst-inbox-btn .cst-ib-badge {
          margin-left: auto; background: rgba(255,255,255,.25); border-radius: 99px;
          font-size: 10px; font-weight: 800; padding: 1px 6px; flex-shrink: 0;
        }

        /* ── Inbox panel ── */
        #cst-inbox-panel {
          position: fixed; inset: 0; z-index: 99990;
          background: rgba(0,0,0,.38); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; pointer-events: none; transition: opacity .18s ease;
        }
        #cst-inbox-panel.cst-ib-open { opacity: 1; pointer-events: auto; }
        .cst-ib-window {
          width: 540px; max-width: 95vw; max-height: 82vh;
          background: #f5f5f7; border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0,0,0,.35);
          display: flex; flex-direction: column; overflow: hidden;
          transform: scale(.95) translateY(8px); transition: transform .18s cubic-bezier(.2,0,.2,1);
        }
        #cst-inbox-panel.cst-ib-open .cst-ib-window { transform: none; }

        /* title bar */
        .cst-ib-titlebar {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px 10px; background: #f5f5f7;
          border-bottom: 1px solid rgba(0,0,0,.08);
          flex-shrink: 0;
        }
        .cst-ib-back {
          width: 28px; height: 28px; border-radius: 50%; border: none;
          background: rgba(0,0,0,.08); color: #333; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .12s; flex-shrink: 0;
        }
        .cst-ib-back:hover { background: rgba(0,0,0,.14); }
        .cst-ib-title { font-size: 13px; font-weight: 700; color: #1c1c1e; }

        /* search */
        .cst-ib-search-wrap {
          padding: 10px 14px 8px; background: #f5f5f7; flex-shrink: 0;
        }
        .cst-ib-search {
          width: 100%; box-sizing: border-box;
          background: #fff; border: 1px solid rgba(0,0,0,.1);
          border-radius: 10px; padding: 9px 14px 9px 36px;
          font-size: 13px; color: #1c1c1e; outline: none;
          box-shadow: 0 1px 3px rgba(0,0,0,.06);
          transition: border-color .12s;
        }
        .cst-ib-search:focus { border-color: #2563eb; }
        .cst-ib-search-icon {
          position: absolute; left: 24px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none;
        }
        .cst-ib-search-wrap { position: relative; }

        /* section label */
        .cst-ib-section {
          font-size: 15px; font-weight: 700; color: #1c1c1e;
          padding: 6px 16px 4px; flex-shrink: 0;
        }

        /* messages list */
        .cst-ib-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
        .cst-ib-item {
          display: flex; align-items: flex-start; gap: 11px;
          padding: 11px 10px; border-radius: 12px; cursor: pointer;
          transition: background .1s; position: relative;
          background: #fff; margin-bottom: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,.06);
        }
        .cst-ib-item:hover { background: #f0f0f5; }
        .cst-ib-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
        }
        .cst-ib-body { flex: 1; min-width: 0; }
        .cst-ib-row1 { display: flex; align-items: baseline; gap: 6px; }
        .cst-ib-name { font-size: 13px; font-weight: 700; color: #1c1c1e; }
        .cst-ib-time { font-size: 11px; color: #9ca3af; margin-left: auto; white-space: nowrap; }
        .cst-ib-preview { font-size: 12px; color: #6b7280; margin-top: 2px; line-height: 1.4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cst-ib-source { flex-shrink: 0; width: 22px; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
      `;
      document.head.appendChild(s);
    }

    // Button
    const btn = document.createElement("button");
    btn.id = "cst-inbox-btn";
    btn.innerHTML = `
      <span class="cst-ib-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
      <span class="cst-ib-label">Inbox</span>
      <span class="cst-ib-badge">3</span>
    `;
    bottom.insertAdjacentElement("beforebegin", btn);

    // Panel
    const _AVATAR_COLORS = ["#2563eb","#7c3aed","#0891b2","#059669","#d97706","#dc2626","#db2777"];
    const _avatarColor = name => { let h = 5381; for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) & 0x7fffffff; return _AVATAR_COLORS[h % _AVATAR_COLORS.length]; };
    const _ini = name => { const p = name.trim().split(/\s+/); return p.length === 1 ? p[0][0] : (p[0][0] + p[p.length-1][0]); };

    const _SOURCE_ICONS = {
      gmail:    `<svg width="14" height="14" viewBox="0 0 24 24"><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`,
      linkedin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
      slack:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="#4A154B"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>`,
    };

    const _DEMO_MSGS = [
      { name: "Natasha Corwin",  time: "3m",  preview: "Wants to share a sales contract from Brightstone Realty with all key details included", source: "gmail"    },
      { name: "Luke Rankin",     time: "8m",  preview: "Shares a project update for ITWA, including the latest progress and key milestones",   source: "linkedin" },
      { name: "Jack Callaghan",  time: "8m",  preview: "Shares the next month's team meet talan, including dates and agenda highlights",        source: "slack"    },
      { name: "Dan Monroe",      time: "15m", preview: "Following up on the proposal sent last week, asking for feedback and next steps",        source: "gmail"    },
      { name: "Sara Ellis",      time: "1h",  preview: "Sent over the revised budget breakdown for Q3 — needs your sign-off before EOD",        source: "slack"    },
      { name: "Michael Torres",  time: "2h",  preview: "Checking in on the partnership agreement draft and timeline for final approval",         source: "linkedin" },
    ];

    const panel = document.createElement("div");
    panel.id = "cst-inbox-panel";
    panel.innerHTML = `
      <div class="cst-ib-window">
        <div class="cst-ib-titlebar">
          <button class="cst-ib-back" id="cst-ib-back" title="Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="cst-ib-title">Inbox</span>
        </div>
        <div class="cst-ib-search-wrap">
          <svg class="cst-ib-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="cst-ib-search" placeholder="Start typing to ask or search…" />
        </div>
        <div class="cst-ib-section">Inbox</div>
        <div class="cst-ib-list">
          ${_DEMO_MSGS.map(m => `
            <div class="cst-ib-item">
              <div class="cst-ib-avatar" style="background:${_avatarColor(m.name)}">${_ini(m.name).toUpperCase()}</div>
              <div class="cst-ib-body">
                <div class="cst-ib-row1">
                  <span class="cst-ib-name">${m.name}</span>
                  <span class="cst-ib-time">${m.time}</span>
                </div>
                <div class="cst-ib-preview">${m.preview}</div>
              </div>
              <div class="cst-ib-source">${_SOURCE_ICONS[m.source] || ""}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    btn.addEventListener("click",    () => panel.classList.add("cst-ib-open"));
    document.getElementById("cst-ib-back").addEventListener("click", () => panel.classList.remove("cst-ib-open"));
    panel.addEventListener("click",  e => { if (e.target === panel) panel.classList.remove("cst-ib-open"); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") panel.classList.remove("cst-ib-open"); });
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  function init() {
    const container = document.querySelector(CONTAINER_SEL);
    if (container) wireSidebar(container);
    wireHomeButton();
    _watchAddBtn();
    watchLogo();
    injectInboxIcon();
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
    // also retry inbox icon injection when sidebar is rebuilt
    const _ibObs = new MutationObserver(() => injectInboxIcon());
    _ibObs.observe(document.body, { childList: true, subtree: true });
  }
})();