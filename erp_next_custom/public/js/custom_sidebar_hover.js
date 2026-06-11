(function () {
  "use strict";

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