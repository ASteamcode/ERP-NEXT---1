/* ─────────────────────────────────────────────────────────────────
   Project Board  —  Full-screen Task Kanban
   Drag & drop between columns · Click card for detail panel
───────────────────────────────────────────────────────────────── */
"use strict";

const _T = [
    { key: "a", email: "karamanthony08@gmail.com",      name: "Anthony", color: "#7c3aed" },
    { key: "g", email: "grece.jack.khoury@gmail.com",   name: "Grece",   color: "#2563eb" },
    { key: "p", email: "pascalalkhouri.2004@gmail.com",  name: "Pascale", color: "#059669" },
];

const _STATUS_FOR_COL = { open: "Open", doing: "Working On", overdue: "Open", done: "Completed" };

// ── lifecycle ──────────────────────────────────────────────────────
frappe.pages["project-board"].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({ parent: wrapper, title: "Project Board", single_column: true });
    _pb_inject_styles();
    _pb_takeover(wrapper);
    wrapper._pb_fresh_load = true;
    _pb_build(wrapper);
    _pb_load(wrapper);
};
frappe.pages["project-board"].on_page_show = function (wrapper) {
    if (!wrapper._pb_fresh_load) {
        // Arrived via SPA navigation — force a clean reload so layout is pristine.
        window.location.reload();
        return;
    }
    wrapper._pb_fresh_load = false;
    _pb_takeover(wrapper);
};
frappe.pages["project-board"].on_page_hide = function (wrapper) {
    _pb_restore(wrapper);
    $(document).off("keydown.pb");
};

// ── full-screen takeover (covers navbar too) ───────────────────────
function _pb_takeover(w) {
    $("body").addClass("pb-fs");
}
function _pb_restore(w) {
    $("body").removeClass("pb-fs");
}

// ── shell ──────────────────────────────────────────────────────────
function _pb_build(wrapper) {
    $(wrapper).find(".layout-main-section").html(`
<div class="pb-shell">

  <!-- sidebar -->
  <aside class="pb-sidebar">
    <div class="pb-brand">
      <div class="pb-brand-icon"><svg viewBox="0 0 20 20" fill="none">
        <rect x="2"  y="2"  width="7" height="7" rx="1.8" fill="url(#pbg0)"/>
        <rect x="11" y="2"  width="7" height="7" rx="1.8" fill="url(#pbg0)" opacity=".6"/>
        <rect x="2"  y="11" width="7" height="7" rx="1.8" fill="url(#pbg0)" opacity=".4"/>
        <rect x="11" y="11" width="7" height="7" rx="1.8" fill="url(#pbg0)" opacity=".2"/>
        <defs><linearGradient id="pbg0" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#60a5fa"/>
        </linearGradient></defs>
      </svg></div>
      <span class="pb-brand-label">Project Board</span>
    </div>

    <div class="pb-sidebar-sec">
      <div class="pb-sec-hd">Views</div>
      <button class="pb-nav active" data-view="tasks">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2.5" rx="1.2" fill="currentColor"/><rect x="1" y="6.5" width="14" height="2.5" rx="1.2" fill="currentColor" opacity=".55"/><rect x="1" y="11" width="14" height="2.5" rx="1.2" fill="currentColor" opacity=".3"/></svg>
        Tasks
      </button>
      <button class="pb-nav" data-view="board">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.2" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.2" fill="currentColor" opacity=".5"/><rect x="1" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".5"/><rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".25"/></svg>
        Board
      </button>
      <button class="pb-nav" data-view="templates">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="5" rx="1.2" fill="currentColor" opacity=".9"/><rect x="1" y="8" width="6" height="7" rx="1.2" fill="currentColor" opacity=".55"/><rect x="9" y="8" width="6" height="7" rx="1.2" fill="currentColor" opacity=".3"/></svg>
        Templates
      </button>
    </div>

    <div class="pb-sidebar-sec pb-projs-sec">
      <div class="pb-sec-hd">Projects <span class="pb-proj-ct" id="pb-proj-ct"></span></div>
      <button class="pb-nav pb-proj-item active" data-name="">
        <span class="pb-dot" style="background:rgba(255,255,255,.3)"></span>All
      </button>
      <div id="pb-proj-list"></div>
    </div>

    <div class="pb-sidebar-sec pb-team-sec">
      <div class="pb-sec-hd">Team</div>
      ${_T.map(m=>`<button class="pb-nav pb-member-filt" data-email="${m.email}">
        <span class="pb-av-sm" style="background:${m.color}">${m.name[0]}</span>${m.name}
      </button>`).join("")}
    </div>

    <div class="pb-sidebar-foot">
      <button class="pb-new-task-btn pb-new-btn">
        <svg viewBox="0 0 14 14" fill="none"><line x1="7" y1="1.5" x2="7" y2="12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        New Task
      </button>
      <button class="pb-back-btn">
        <svg viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5L3 7l5.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back to Desk
      </button>
    </div>
  </aside>

  <!-- main -->
  <div class="pb-center">
    <header class="pb-main-hd">
      <div class="pb-mhd-l">
        <h1 class="pb-title" id="pb-title">Tasks</h1>
        <span class="pb-subtitle" id="pb-subtitle"></span>
      </div>
      <div class="pb-mhd-r">
        <label class="pb-search-box">
          <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.6"/><line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input id="pb-search" type="search" placeholder="Search tasks…" autocomplete="off">
        </label>
        <button class="pb-icon-btn" id="pb-refresh" title="Refresh">
          <svg viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3a5 5 0 0 1 3.54 1.46L13 3v3.5h-3.5L11 5a3 3 0 1 0 .88 3.12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </header>
    <div id="pb-view-area" class="pb-view-area">
      <div class="pb-loading"><div class="pb-spinner"></div></div>
    </div>
  </div>

  <!-- task detail panel -->
  <div class="pb-detail-wrap" id="pb-detail-wrap">
    <div class="pb-detail" id="pb-detail"></div>
  </div>

</div>`);
    _pb_wire(wrapper);
}

// ── event wiring ───────────────────────────────────────────────────
function _pb_wire(wrapper) {
    wrapper._pb_view   = "tasks";
    wrapper._pb_sel    = "";
    wrapper._pb_member = "";
    wrapper._pb_search = "";
    wrapper._pb_detail = null;
    wrapper._pb_drag   = null;

    const $sh = $(wrapper).find(".pb-shell");

    // views
    $sh.on("click", ".pb-nav[data-view]", function () {
        $sh.find(".pb-nav[data-view]").removeClass("active");
        $(this).addClass("active");
        wrapper._pb_view = $(this).data("view");
        _pb_close_detail(wrapper);
        _pb_render(wrapper);
        _pb_update_header(wrapper);
    });

    // project filter
    $sh.on("click", ".pb-proj-item", function () {
        $sh.find(".pb-proj-item").removeClass("active");
        $(this).addClass("active");
        wrapper._pb_sel = $(this).data("name") || "";
        _pb_render(wrapper);
        _pb_update_header(wrapper);
    });

    // member filter
    $sh.on("click", ".pb-member-filt", function () {
        const email = $(this).data("email");
        if (wrapper._pb_member === email) {
            wrapper._pb_member = "";
            $sh.find(".pb-member-filt").removeClass("active");
        } else {
            wrapper._pb_member = email;
            $sh.find(".pb-member-filt").removeClass("active");
            $(this).addClass("active");
        }
        _pb_render(wrapper);
    });

    // search
    $sh.on("input", "#pb-search", function () {
        wrapper._pb_search = $(this).val().toLowerCase();
        _pb_render(wrapper);
    });

    $sh.on("click", ".pb-back-btn", () => { window.location.href = "/desk"; });
    $sh.on("click", "#pb-refresh",  () => _pb_load(wrapper));
    $sh.on("click", ".pb-new-task-btn", () => _pb_new_task_modal(wrapper, "Open"));

    // ── DRAG & DROP ─────────────────────────────────────────────────
    $sh.on("dragstart", ".pb-tk", function (e) {
        const $tk = $(this);
        wrapper._pb_drag = { task: $tk.data("name"), col: $tk.closest(".pb-col").data("col") };
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("text/plain", $tk.data("name"));
        setTimeout(() => $tk.addClass("pb-tk-dragging"), 0);
    });
    $sh.on("dragend", ".pb-tk", function () {
        $(this).removeClass("pb-tk-dragging");
        $sh.find(".pb-col").removeClass("pb-col-over");
        wrapper._pb_drag = null;
    });
    $sh.on("dragover", ".pb-col", function (e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = "move";
        $sh.find(".pb-col").removeClass("pb-col-over");
        $(this).addClass("pb-col-over");
    });
    $sh.on("dragleave", ".pb-col", function (e) {
        if (!$(e.relatedTarget).closest(".pb-col").is(this)) $(this).removeClass("pb-col-over");
    });
    $sh.on("drop", ".pb-col", function (e) {
        e.preventDefault();
        $(this).removeClass("pb-col-over");
        const drag = wrapper._pb_drag;
        if (!drag) return;
        const targetCol = $(this).data("col");
        if (targetCol === drag.col) return;
        const newStatus = _STATUS_FOR_COL[targetCol];
        const t = (wrapper._pb_tasks || []).find(x => x.name === drag.task);
        if (t) t.status = newStatus;
        _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper));
        frappe.call({
            method: "erp_next_custom.erp_next_custom.page.project_board.project_board.set_task_status",
            args: { task_name: drag.task, new_status: newStatus },
        });
    });

    // ── TASK CARD CLICK → detail ────────────────────────────────────
    $sh.on("click", ".pb-tk", function (e) {
        if ($(e.target).closest(".pb-tk-acts, .pb-av-btn").length) return;
        const name = $(this).data("name");
        if (wrapper._pb_detail === name) _pb_close_detail(wrapper);
        else _pb_open_detail(wrapper, name);
    });

    // detail close / delete / status / assignee
    $sh.on("click", "#pb-detail-close",  () => _pb_close_detail(wrapper));
    $(document).on("keydown.pb", e => { if (e.key === "Escape") _pb_close_detail(wrapper); });

    $sh.on("click", "#pb-detail-delete", function () {
        const task = wrapper._pb_detail;
        if (!confirm("Delete this task?")) return;
        _pb_close_detail(wrapper);
        wrapper._pb_tasks = (wrapper._pb_tasks || []).filter(x => x.name !== task);
        _pb_render(wrapper);
        frappe.call({ method: "frappe.client.delete", args: { doctype: "Task", name: task } });
    });

    $sh.on("change", "#pb-detail-status", function () {
        const task = wrapper._pb_detail, val = $(this).val();
        const t = (wrapper._pb_tasks || []).find(x => x.name === task);
        if (t) t.status = val;
        _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper));
        frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.set_task_status", args: { task_name: task, new_status: val } });
    });

    $sh.on("click", ".pb-detail-av", function () {
        const $b = $(this), task = $b.data("task"), email = $b.data("email"), on = $b.hasClass("pb-av-on");
        $b.toggleClass("pb-av-on", !on).toggleClass("pb-av-off", on);
        const m = _T.find(x => x.email === email);
        $b.css("--avc", !on && m ? m.color : "");
        const t = (wrapper._pb_tasks || []).find(x => x.name === task);
        if (t) {
            try {
                let a = JSON.parse(t._assign || "[]");
                if (on) a = a.filter(x => x !== email); else if (!a.includes(email)) a.push(email);
                t._assign = JSON.stringify(a);
            } catch (_) {}
        }
        _pb_sync_card_assigns(wrapper, task);
        frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.toggle_assignee", args: { task_name: task, user_email: email } });
    });

    // ── KANBAN inline add ─────────────────────────────────────────
    $sh.on("click", ".pb-col-add-btn", function () {
        const col = $(this).data("col");
        const $a = $sh.find(`.pb-col-adder[data-col="${col}"]`);
        $a.show().find("input").focus();
        $(this).hide();
    });
    $sh.on("click", ".pb-adder-cancel", function () {
        const $a = $(this).closest(".pb-col-adder"), col = $a.data("col");
        $a.hide().find("input").val("");
        $sh.find(`.pb-col-add-btn[data-col="${col}"]`).show();
    });
    $sh.on("keydown", ".pb-adder-input", function (e) {
        if (e.key === "Enter")  $(this).closest(".pb-col-adder").find(".pb-adder-ok").click();
        if (e.key === "Escape") $(this).closest(".pb-col-adder").find(".pb-adder-cancel").click();
    });
    $sh.on("click", ".pb-adder-ok", function () {
        const $a = $(this).closest(".pb-col-adder");
        const subject = $a.find("input").val().trim(), col = $a.data("col");
        if (!subject) return;
        const projName = wrapper._pb_sel || ((wrapper._pb_projects || [])[0] || {}).name;
        if (!projName) { frappe.show_alert("Select a project first", 2); return; }
        $a.find("input").prop("disabled", true);
        frappe.call({
            method: "frappe.client.insert",
            args: { doc: { doctype: "Task", subject, project: projName, status: _STATUS_FOR_COL[col] || "Open" } },
            callback(r) {
                $a.find("input").prop("disabled", false).val("");
                $a.hide();
                $sh.find(`.pb-col-add-btn[data-col="${col}"]`).show();
                if (r.message) { wrapper._pb_tasks = [r.message, ...(wrapper._pb_tasks || [])]; _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper)); }
            },
            error() { $a.find("input").prop("disabled", false); },
        });
    });

    // ── KANBAN card: assignee toggle ──────────────────────────────
    $sh.on("click", ".pb-av-btn", function (e) {
        e.stopPropagation();
        const $b = $(this), task = $b.data("task"), email = $b.data("email"), on = $b.hasClass("pb-av-on");
        $b.toggleClass("pb-av-on", !on).toggleClass("pb-av-off", on);
        const m = _T.find(x => x.email === email);
        $b.css("--avc", !on && m ? m.color : "");
        const t = (wrapper._pb_tasks || []).find(x => x.name === task);
        if (t) {
            try {
                let a = JSON.parse(t._assign || "[]");
                if (on) a = a.filter(x => x !== email); else if (!a.includes(email)) a.push(email);
                t._assign = JSON.stringify(a);
            } catch (_) {}
        }
        frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.toggle_assignee", args: { task_name: task, user_email: email } });
    });

    // ── KANBAN card: status advance ───────────────────────────────
    $sh.on("click", ".pb-tk-adv", function (e) {
        e.stopPropagation();
        const task = $(this).data("task"), next = $(this).data("next");
        const t = (wrapper._pb_tasks || []).find(x => x.name === task);
        if (t) t.status = next;
        _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper));
        frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.set_task_status", args: { task_name: task, new_status: next } });
    });

    // ── KANBAN card: delete ───────────────────────────────────────
    $sh.on("click", ".pb-tk-del", function (e) {
        e.stopPropagation();
        const task = $(this).data("task");
        $(this).closest(".pb-tk").addClass("pb-tk-removing");
        wrapper._pb_tasks = (wrapper._pb_tasks || []).filter(x => x.name !== task);
        setTimeout(() => _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper)), 220);
        frappe.call({ method: "frappe.client.delete", args: { doctype: "Task", name: task } });
    });

    // ── TEMPLATES ────────────────────────────────────────────────
    $sh.on("click", ".pb-tpl-tab", function () {
        wrapper._pb_tpl_type = $(this).data("tpl");
        _pb_render_templates(wrapper);
    });
    $sh.on("input", "#pb-tpl-code", function () {
        const type = wrapper._pb_tpl_type || "prospect";
        if (!wrapper._pb_tpl_codes) wrapper._pb_tpl_codes = {};
        wrapper._pb_tpl_codes[type] = $(this).val();
        _pb_tpl_refresh_preview(wrapper);
    });
    $sh.on("click", ".pb-tpl-tb", function () {
        const snip = $(this).data("snip");
        if (snip === "reset") {
            const type = wrapper._pb_tpl_type || "prospect";
            if (!wrapper._pb_tpl_codes) wrapper._pb_tpl_codes = {};
            wrapper._pb_tpl_codes[type] = _TPL_DEFAULT[type];
            _pb_render_templates(wrapper);
            return;
        }
        const $ta = $("#pb-tpl-code");
        const el = $ta[0];
        if (!el) return;
        const snippet = _TPL_SNIPPETS[snip] || "";
        const pos = el.selectionStart;
        const val = $ta.val();
        const newVal = val.slice(0, pos) + snippet + val.slice(pos);
        $ta.val(newVal);
        el.setSelectionRange(pos + snippet.length, pos + snippet.length);
        $ta.trigger("input");
        el.focus();
    });
    $sh.on("change", "#pb-tpl-upload-input", function () {
        const type = wrapper._pb_tpl_type || "prospect";
        if (!wrapper._pb_tpl_files) wrapper._pb_tpl_files = { prospect:[], log:[], lead:[] };
        const files = Array.from(this.files || []);
        wrapper._pb_tpl_files[type] = [...wrapper._pb_tpl_files[type], ...files];
        _pb_tpl_render_files(wrapper);
        this.value = "";
    });
    $sh.on("click", ".pb-tpl-file-del", function () {
        const idx = parseInt($(this).data("idx"));
        const type = wrapper._pb_tpl_type || "prospect";
        if (!wrapper._pb_tpl_files) return;
        wrapper._pb_tpl_files[type].splice(idx, 1);
        _pb_tpl_render_files(wrapper);
    });

    // ── BOARD card click → panel ──────────────────────────────────
    $sh.on("click", ".pb-card", function () { _pb_open_board_panel(wrapper, $(this).data("name")); });
    $sh.on("click", "#pb-ph-close", () => _pb_close_board_panel(wrapper));
    $sh.on("click", ".pb-tc-btn", function (e) {
        e.stopPropagation();
        const $b = $(this), task = $b.data("task"), cur = $b.data("status");
        const next = { Open: "Working On", "Working On": "Completed", Completed: "Open" }[cur] || "Open";
        $b.data("status", next).html(_tc_icon(next));
        $b.next(".pb-task-subj").toggleClass("pb-task-done", next === "Completed");
        frappe.call({ method: "frappe.client.set_value", args: { doctype: "Task", name: task, fieldname: "status", value: next } });
    });
    $sh.on("click", ".pb-panel-task-del", function (e) {
        e.stopPropagation();
        const task = $(this).data("task");
        $(this).closest(".pb-task-item").addClass("pb-task-removing");
        frappe.call({ method: "frappe.client.delete", args: { doctype: "Task", name: task }, callback() { $(`.pb-task-item[data-task="${task}"]`).remove(); } });
    });
    $sh.on("click", "#pb-task-add-btn", () => _pb_do_add_panel_task(wrapper));
    $sh.on("keydown", "#pb-task-input", e => { if (e.key === "Enter") _pb_do_add_panel_task(wrapper); });
}

// ── data ───────────────────────────────────────────────────────────
function _pb_load(wrapper) {
    $("#pb-view-area").html(`<div class="pb-loading"><div class="pb-spinner"></div></div>`);
    Promise.all([
        new Promise(res => frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.get_board_data", callback(r) { wrapper._pb_projects = r.message || []; res(); } })),
        new Promise(res => frappe.call({ method: "erp_next_custom.erp_next_custom.page.project_board.project_board.get_tasks_data",  callback(r) { wrapper._pb_tasks    = r.message || []; res(); } })),
    ]).then(() => { _pb_fill_sidebar(wrapper); _pb_update_header(wrapper); _pb_render(wrapper); });
}

function _pb_fill_sidebar(wrapper) {
    const projs = wrapper._pb_projects || [], today = frappe.datetime.now_date();
    $("#pb-proj-ct").text(projs.length);
    $("#pb-proj-list").html(projs.map(p => {
        const sk = _pb_ov(p, today) ? "overdue" : _pb_sk(p.status);
        return `<button class="pb-nav pb-proj-item" data-name="${_e(p.name)}"><span class="pb-dot" style="background:${_dot_c(sk)}"></span>${_e(p.project_name||p.name)}</button>`;
    }).join(""));
}

function _pb_update_header(wrapper) {
    if (wrapper._pb_view === "templates") {
        $("#pb-title").text("Templates");
        $("#pb-subtitle").text("Visual designer playground");
        $("#pb-search").attr("placeholder", "Search templates…");
    } else if (wrapper._pb_view === "board") {
        $("#pb-title").text("Projects");
        $("#pb-subtitle").text((wrapper._pb_projects||[]).length + " projects");
        $("#pb-search").attr("placeholder", "Search projects…");
    } else {
        const proj = (wrapper._pb_projects||[]).find(p => p.name === wrapper._pb_sel);
        $("#pb-title").text(proj ? (proj.project_name||proj.name) : "All Tasks");
        const open = _pb_visible_tasks(wrapper).filter(t => !["Completed","Cancelled"].includes(t.status)).length;
        $("#pb-subtitle").text(open + " open");
        $("#pb-search").attr("placeholder", "Search tasks…");
    }
}

function _pb_render(wrapper) {
    if (wrapper._pb_view === "board") _pb_render_board(wrapper);
    else if (wrapper._pb_view === "templates") _pb_render_templates(wrapper);
    else _pb_render_kanban(wrapper, _pb_visible_tasks(wrapper));
}

function _pb_visible_tasks(wrapper) {
    return (wrapper._pb_tasks||[]).filter(t => {
        if (wrapper._pb_sel && t.project !== wrapper._pb_sel) return false;
        if (wrapper._pb_member) { try { if (!(JSON.parse(t._assign||"[]")||[]).includes(wrapper._pb_member)) return false; } catch(_){ return false; } }
        if (wrapper._pb_search && !(t.subject||"").toLowerCase().includes(wrapper._pb_search) && !(t.project||"").toLowerCase().includes(wrapper._pb_search)) return false;
        return true;
    });
}

// ── kanban ─────────────────────────────────────────────────────────
function _pb_render_kanban(wrapper, tasks) {
    const today = frappe.datetime.now_date();
    const projMap = {};
    (wrapper._pb_projects||[]).forEach(p => { projMap[p.name] = p.project_name||p.name; });

    const cats = { open: [], doing: [], overdue: [], done: [] };
    tasks.forEach(t => {
        const ov = t.exp_end_date && t.exp_end_date < today && !["Completed","Cancelled"].includes(t.status);
        if (["Completed","Cancelled"].includes(t.status)) cats.done.push(t);
        else if (ov) cats.overdue.push(t);
        else if (["Working On","Pending Review"].includes(t.status)) cats.doing.push(t);
        else cats.open.push(t);
    });

    const COLS = [
        { key:"open",    label:"To Do",       dot:"#3b82f6", next:"Working On", next_label:"Start",   adv:"▶", adv_cls:"" },
        { key:"doing",   label:"In Progress", dot:"#f59e0b", next:"Completed",  next_label:"Done",    adv:"✓", adv_cls:"pb-tk-adv-done" },
        { key:"overdue", label:"Overdue",     dot:"#ef4444", next:"Completed",  next_label:"Resolve", adv:"✓", adv_cls:"pb-tk-adv-done" },
        { key:"done",    label:"Done",        dot:"#10b981", next:"Open",       next_label:"Reopen",  adv:"↺", adv_cls:"pb-tk-adv-reset" },
    ];

    const html = COLS.map(col => {
        const list = cats[col.key];
        const cards = list.map(t => _tk_html(t, col, projMap, today, wrapper._pb_detail)).join("");
        return `
<div class="pb-col" data-col="${col.key}">
  <div class="pb-col-hd">
    <span class="pb-col-dot" style="background:${col.dot}"></span>
    <span class="pb-col-name">${col.label}</span>
    <span class="pb-col-ct">${list.length}</span>
  </div>
  <div class="pb-col-body">${cards || `<div class="pb-col-empty">—</div>`}</div>
  <div class="pb-col-foot">
    <button class="pb-col-add-btn" data-col="${col.key}">+ Add task</button>
    <div class="pb-col-adder" data-col="${col.key}" style="display:none">
      <input class="pb-adder-input" type="text" placeholder="Task name…">
      <div class="pb-adder-row"><button class="pb-adder-ok">Add</button><button class="pb-adder-cancel">✕</button></div>
    </div>
  </div>
</div>`;
    }).join("");

    $("#pb-view-area").html(`<div class="pb-kanban">${html}</div>`);
}

function _tk_html(t, col, projMap, today, openDetail) {
    const assigns = (() => { try { return JSON.parse(t._assign||"[]")||[]; } catch(_){ return []; } })();
    const ov  = t.exp_end_date && t.exp_end_date < today && !["Completed","Cancelled"].includes(t.status);
    const proj = projMap[t.project] || t.project || "";
    const sel  = openDetail === t.name ? " pb-tk-selected" : "";
    const avBtns = _T.map(m => {
        const on = assigns.includes(m.email);
        return `<button class="pb-av-btn ${on?"pb-av-on":"pb-av-off"}" data-task="${_e(t.name)}" data-email="${_e(m.email)}" ${on?`style="--avc:${m.color}"`:""}  title="${m.name}">${m.name[0]}</button>`;
    }).join("");
    const dueHtml = t.exp_end_date ? `<span class="pb-tk-due${ov?" pb-tk-late":""}">${frappe.datetime.str_to_user(t.exp_end_date)}</span>` : "";
    return `
<div class="pb-tk${ov?" pb-tk-ov":""}${sel}" data-name="${_e(t.name)}" draggable="true">
  <div class="pb-tk-top">${proj?`<span class="pb-tk-proj">${_e(proj)}</span>`:""} ${dueHtml}</div>
  <div class="pb-tk-subj">${_e(t.subject||"")}</div>
  <div class="pb-tk-foot">
    <div class="pb-tk-assigns">${avBtns}</div>
    <div class="pb-tk-acts">
      <button class="pb-tk-adv ${col.adv_cls}" data-task="${_e(t.name)}" data-next="${_e(col.next)}" title="${col.next_label}">${col.adv}</button>
      <button class="pb-tk-del" data-task="${_e(t.name)}" title="Delete">×</button>
    </div>
  </div>
</div>`;
}

// ── task detail panel ──────────────────────────────────────────────
function _pb_open_detail(wrapper, taskName) {
    wrapper._pb_detail = taskName;
    const t    = (wrapper._pb_tasks||[]).find(x => x.name === taskName);
    const proj = (wrapper._pb_projects||[]).find(p => t && p.name === t.project);
    const assigns = (() => { try { return JSON.parse((t||{})._assign||"[]")||[]; } catch(_){ return []; } })();
    const today = frappe.datetime.now_date();
    const ov = t && t.exp_end_date && t.exp_end_date < today && !["Completed","Cancelled"].includes(t.status||"");

    const avHtml = _T.map(m => {
        const on = assigns.includes(m.email);
        return `<button class="pb-detail-av ${on?"pb-av-on":"pb-av-off"}" data-task="${_e(taskName)}" data-email="${_e(m.email)}" ${on?`style="--avc:${m.color}"`:""}><span class="pb-dav-lbl">${m.name[0]}</span><span class="pb-dav-name">${m.name}</span></button>`;
    }).join("");

    const statusOpts = ["Open","Working On","Pending Review","Completed","Cancelled"]
        .map(s => `<option value="${s}" ${(t&&t.status)===s?"selected":""}>${s}</option>`).join("");

    const dueText = t && t.exp_end_date
        ? `<span class="${ov?"pb-detail-overdue":""}">${frappe.datetime.str_to_user(t.exp_end_date)}</span>`
        : `<span style="color:#9ca3af">—</span>`;

    $("#pb-detail").html(`
<div class="pb-detail-hd">
  <div class="pb-detail-hd-top">
    <span class="pb-detail-label">Task</span>
    <div style="display:flex;gap:4px">
      <button id="pb-detail-delete" class="pb-detail-del-btn" title="Delete task">
        <svg viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5h3v1M5.5 6v5M8.5 6v5M3 3.5l.5 8h7l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button id="pb-detail-close" class="pb-detail-close-btn">
        <svg viewBox="0 0 14 14" fill="none"><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
  <h2 class="pb-detail-title">${_e((t||{}).subject||"")}</h2>
  ${proj?`<div class="pb-detail-proj">${_e(proj.project_name||proj.name)}</div>`:""}
</div>
<div class="pb-detail-body">
  <div class="pb-detail-row">
    <span class="pb-detail-row-label">Status</span>
    <select id="pb-detail-status" class="pb-detail-select">${statusOpts}</select>
  </div>
  <div class="pb-detail-row">
    <span class="pb-detail-row-label">Due date</span>
    <span class="pb-detail-row-val">${dueText}</span>
  </div>
  <div class="pb-detail-section-hd">Assignees</div>
  <div class="pb-detail-avs">${avHtml}</div>
</div>`);

    $("#pb-detail-wrap").addClass("open");
    $(wrapper).find(".pb-tk").removeClass("pb-tk-selected");
    $(wrapper).find(`.pb-tk[data-name="${CSS.escape(taskName)}"]`).addClass("pb-tk-selected");
}

function _pb_close_detail(wrapper) {
    wrapper._pb_detail = null;
    $("#pb-detail-wrap").removeClass("open");
    $(wrapper).find(".pb-tk").removeClass("pb-tk-selected");
}

function _pb_sync_card_assigns(wrapper, taskName) {
    const t = (wrapper._pb_tasks||[]).find(x => x.name === taskName);
    if (!t) return;
    const assigns = (() => { try { return JSON.parse(t._assign||"[]")||[]; } catch(_){ return []; } })();
    const $card = $(wrapper).find(`.pb-tk[data-name="${CSS.escape(taskName)}"]`);
    _T.forEach(m => {
        const on = assigns.includes(m.email);
        $card.find(`.pb-av-btn[data-email="${m.email}"]`).toggleClass("pb-av-on", on).toggleClass("pb-av-off", !on).css("--avc", on ? m.color : "");
    });
}

// ── template constants ─────────────────────────────────────────────
const _TPL_STYLES = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;background:#f5f5f8;color:#1f2937;}
body{padding:16px;overflow-y:auto;}
.tg{display:flex;flex-direction:column;gap:10px;}
.tr{display:flex;gap:10px;align-items:stretch;}
.tc{display:flex;flex-direction:column;gap:8px;min-width:0;}
.card{background:#fff;border-radius:10px;border:1.5px solid #eeeef4;padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,.05);flex:1;}
.lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9ca3af;margin-bottom:5px;}
.val{font-size:14px;font-weight:600;color:#111827;}
.sub{font-size:11px;color:#9ca3af;margin-top:3px;}
.badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:650;}
.badge-green{background:#ecfdf5;color:#059669;}
.badge-blue{background:#eff6ff;color:#2563eb;}
.badge-red{background:#fef2f2;color:#dc2626;}
.badge-yellow{background:#fffbeb;color:#d97706;}
.badge-purple{background:#f5f3ff;color:#7c3aed;}
.badge-gray{background:#f3f4f6;color:#6b7280;}
.divider{height:1px;background:#f0f0f5;margin:6px 0;}
.txt{font-size:12.5px;color:#374151;line-height:1.5;}
.hd{font-size:18px;font-weight:750;color:#111827;letter-spacing:-.02em;}
.prog-rail{height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;margin-top:6px;}
.prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:99px;}
.avatar{width:32px;height:32px;border-radius:50%;background:#7c3aed;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;}
.row{display:flex;align-items:center;gap:8px;}
.col{display:flex;flex-direction:column;gap:3px;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9ca3af;padding:6px 10px;text-align:left;border-bottom:1px solid #f0f0f5;}
td{font-size:12.5px;color:#374151;padding:7px 10px;border-bottom:1px solid #f9f9fb;}
tr:last-child td{border-bottom:none;}
.tag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;background:#f3f4f6;color:#374151;font-size:11px;font-weight:550;}
</style></head><body>`;

const _TPL_DEFAULT = {
    prospect: `<div class="tg">
  <div class="tr">
    <div class="tc" style="flex:2">
      <div class="card">
        <div class="lbl">Company</div>
        <div class="val">Acme Corp</div>
        <div class="sub">acme.com · Enterprise</div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Status</div>
        <span class="badge badge-green">Qualified</span>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Deal Value</div>
        <div class="val">$12,000</div>
      </div>
    </div>
  </div>
  <div class="tr">
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Contact</div>
        <div class="val">Jane Smith</div>
        <div class="sub">jane@acme.com</div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Next Action</div>
        <div class="val">Follow-up call</div>
        <div class="sub" style="color:#ef4444">Due yesterday</div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Progress</div>
        <div class="val">60%</div>
        <div class="prog-rail"><div class="prog-fill" style="width:60%"></div></div>
      </div>
    </div>
  </div>
</div>`,
    log: `<div class="tg">
  <div class="tr">
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Activity Log</div>
        <table>
          <tr><th>Date</th><th>Type</th><th>Description</th><th>By</th></tr>
          <tr><td>Jan 15</td><td><span class="badge badge-blue">Call</span></td><td>Initial discovery call</td><td>Anthony</td></tr>
          <tr><td>Jan 14</td><td><span class="badge badge-purple">Email</span></td><td>Sent proposal document</td><td>Grece</td></tr>
          <tr><td>Jan 13</td><td><span class="badge badge-yellow">Meeting</span></td><td>Demo scheduled for next week</td><td>Pascale</td></tr>
          <tr><td>Jan 12</td><td><span class="badge badge-gray">Note</span></td><td>Client requested custom pricing</td><td>Anthony</td></tr>
        </table>
      </div>
    </div>
  </div>
  <div class="tr">
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Summary</div>
        <div class="val" style="font-size:13px">4 activities · Last contact 1 day ago</div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Next Step</div>
        <div class="val" style="font-size:13px">Demo on Jan 22nd</div>
        <span class="badge badge-green" style="margin-top:6px">Scheduled</span>
      </div>
    </div>
  </div>
</div>`,
    lead: `<div class="tg">
  <div class="tr">
    <div class="tc" style="flex:2">
      <div class="card">
        <div class="lbl">Lead</div>
        <div class="hd">John Doe</div>
        <div class="sub">john@example.com · +1 555 0100</div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Stage</div>
        <span class="badge badge-blue">New</span>
        <div class="prog-rail" style="margin-top:8px"><div class="prog-fill" style="width:20%"></div></div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Source</div>
        <div class="val">Website</div>
        <div class="sub">Organic Search</div>
      </div>
    </div>
  </div>
  <div class="tr">
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Pipeline Stage</div>
        <div class="row" style="margin-top:8px;gap:4px;flex-wrap:wrap">
          <span class="badge badge-blue">New</span>
          <span class="badge badge-gray">Contacted</span>
          <span class="badge badge-gray">Qualified</span>
          <span class="badge badge-gray">Proposal</span>
          <span class="badge badge-gray">Closed</span>
        </div>
      </div>
    </div>
    <div class="tc" style="flex:1">
      <div class="card">
        <div class="lbl">Assigned To</div>
        <div class="row" style="margin-top:4px">
          <div class="avatar">A</div>
          <div class="col">
            <div class="val" style="font-size:13px">Anthony</div>
            <div class="sub">Sales Rep</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`,
};

const _TPL_SNIPPETS = {
    row:   `\n<div class="tr">\n  <div class="tc" style="flex:1">\n    <div class="card">\n      <div class="lbl">Label</div>\n      <div class="val">Value</div>\n    </div>\n  </div>\n</div>`,
    col:   `\n  <div class="tc" style="flex:1">\n    <div class="card">\n      <div class="lbl">Label</div>\n      <div class="val">Value</div>\n    </div>\n  </div>`,
    card:  `\n<div class="card">\n  <div class="lbl">Label</div>\n  <div class="val">Value</div>\n</div>`,
    badge: `<span class="badge badge-blue">Status</span>`,
    text:  `\n<div class="txt">Text content here</div>`,
    table: `\n<div class="card">\n  <div class="lbl">Table</div>\n  <table>\n    <tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>\n    <tr><td>Cell A</td><td>Cell B</td><td>Cell C</td></tr>\n    <tr><td>Cell D</td><td>Cell E</td><td>Cell F</td></tr>\n  </table>\n</div>`,
    prog:  `\n<div class="card">\n  <div class="lbl">Progress</div>\n  <div class="val">75%</div>\n  <div class="prog-rail"><div class="prog-fill" style="width:75%"></div></div>\n</div>`,
    avatar:`\n<div class="row">\n  <div class="avatar">AB</div>\n  <div class="col"><div class="val" style="font-size:13px">Name</div><div class="sub">Role</div></div>\n</div>`,
};

// ── templates view ─────────────────────────────────────────────────
function _pb_render_templates(wrapper) {
    if (!wrapper._pb_tpl_codes) {
        wrapper._pb_tpl_codes = {
            prospect: _TPL_DEFAULT.prospect,
            log:      _TPL_DEFAULT.log,
            lead:     _TPL_DEFAULT.lead,
        };
    }
    if (!wrapper._pb_tpl_files) {
        wrapper._pb_tpl_files = { prospect: [], log: [], lead: [] };
    }
    const type  = wrapper._pb_tpl_type || "prospect";
    const code  = wrapper._pb_tpl_codes[type];
    const files = wrapper._pb_tpl_files[type];

    const tabsHtml = ["prospect","log","lead"].map(t =>
        `<button class="pb-tpl-tab${t===type?" active":""}" data-tpl="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`
    ).join("");

    const filesHtml = files.length
        ? files.map((f,i) => `<div class="pb-tpl-file-chip">${_tpl_file_icon(f.name)}<span>${_e(f.name)}</span><button class="pb-tpl-file-del" data-idx="${i}">×</button></div>`).join("")
        : `<span class="pb-tpl-no-files">No files uploaded yet</span>`;

    $("#pb-view-area").html(`<div class="pb-tpl-shell">
  <div class="pb-tpl-tabs">${tabsHtml}</div>
  <div class="pb-tpl-section">
    <div class="pb-tpl-sec-hd">
      <span>Uploaded Files</span>
      <label class="pb-tpl-upload-btn">
        <input type="file" multiple hidden id="pb-tpl-upload-input" accept=".pdf,.html,.css,.js,.png,.jpg,.jpeg,.svg,.fig,.sketch">
        + Upload
      </label>
    </div>
    <div class="pb-tpl-files-row" id="pb-tpl-files-row">${filesHtml}</div>
  </div>
  <div class="pb-tpl-section pb-tpl-design-section">
    <div class="pb-tpl-sec-hd">
      <span>Custom Design <span class="pb-tpl-badge">Visual Only</span></span>
      <div class="pb-tpl-toolbar">
        <button class="pb-tpl-tb" data-snip="row">+ Row</button>
        <button class="pb-tpl-tb" data-snip="col">+ Column</button>
        <button class="pb-tpl-tb" data-snip="card">+ Card</button>
        <button class="pb-tpl-tb" data-snip="badge">+ Badge</button>
        <button class="pb-tpl-tb" data-snip="table">+ Table</button>
        <button class="pb-tpl-tb" data-snip="prog">+ Progress</button>
        <button class="pb-tpl-tb" data-snip="avatar">+ Avatar</button>
        <button class="pb-tpl-tb" data-snip="text">+ Text</button>
        <button class="pb-tpl-tb pb-tpl-tb-reset" data-snip="reset">↺ Reset</button>
      </div>
    </div>
    <div class="pb-tpl-playground">
      <iframe id="pb-tpl-iframe" class="pb-tpl-iframe" frameborder="0"></iframe>
      <div class="pb-tpl-editor-pane">
        <div class="pb-tpl-editor-hd">HTML <span class="pb-tpl-editor-hint">— edits update preview instantly</span></div>
        <textarea id="pb-tpl-code" class="pb-tpl-code" spellcheck="false"></textarea>
      </div>
    </div>
  </div>
</div>`);

    document.getElementById("pb-tpl-code").value = code;
    _pb_tpl_refresh_preview(wrapper);
}

function _pb_tpl_refresh_preview(wrapper) {
    const type  = wrapper._pb_tpl_type || "prospect";
    const code  = (wrapper._pb_tpl_codes || {})[type] || "";
    const frame = document.getElementById("pb-tpl-iframe");
    if (frame) frame.srcdoc = _TPL_STYLES + code + `</body></html>`;
}

function _pb_tpl_render_files(wrapper) {
    const type  = wrapper._pb_tpl_type || "prospect";
    const files = (wrapper._pb_tpl_files || {})[type] || [];
    const html  = files.length
        ? files.map((f,i) => `<div class="pb-tpl-file-chip">${_tpl_file_icon(f.name)}<span>${_e(f.name)}</span><button class="pb-tpl-file-del" data-idx="${i}">×</button></div>`).join("")
        : `<span class="pb-tpl-no-files">No files uploaded yet</span>`;
    $("#pb-tpl-files-row").html(html);
}

function _tpl_file_icon(name) {
    const ext = (name.split(".").pop()||"").toLowerCase();
    const m = {pdf:"📄",html:"🌐",css:"🎨",js:"⚙️",png:"🖼️",jpg:"🖼️",jpeg:"🖼️",svg:"✏️",fig:"🎭",sketch:"🎭"};
    return `<span class="pb-tpl-file-icon">${m[ext]||"📎"}</span>`;
}

// ── board view ─────────────────────────────────────────────────────
function _pb_render_board(wrapper) {
    const projs = wrapper._pb_projects||[], search = wrapper._pb_search, today = frappe.datetime.now_date();
    const vis = projs.filter(p => !search || (p.project_name||p.name).toLowerCase().includes(search));
    if (!vis.length) { $("#pb-view-area").html(`<div class="pb-empty"><p>No projects.</p></div>`); return; }

    const cards = vis.map(p => {
        const ov = _pb_ov(p, today), sk = ov ? "overdue" : _pb_sk(p.status);
        const pct = Math.round(p.percent_complete||0);
        const t = p.tasks||{}, done=t.completed||0, open=t.open||0, prog=t.in_progress||0, tot=t.total||0;
        const due = p.expected_end_date ? `<span class="pb-card-due${ov?" pb-due-late":""}">${frappe.datetime.str_to_user(p.expected_end_date)}</span>` : "";
        const avs = (p.assignees||[]).slice(0,4).map(e=>`<div class="pb-av" style="background:${_avc(e)}" title="${_e(e)}">${_ini(e)}</div>`).join("")
            + ((p.assignees||[]).length>4?`<div class="pb-av pb-av-x">+${p.assignees.length-4}</div>`:"");
        const chips = tot > 0
            ? `<div class="pb-card-tasks"><span class="pb-task-chip pb-tc-open">${open} open</span>${prog?`<span class="pb-task-chip pb-tc-prog">${prog} active</span>`:""}<span class="pb-task-chip pb-tc-done">${done} done</span></div>`
            : `<div class="pb-card-tasks pb-ct-empty">No tasks</div>`;
        return `
<article class="pb-card pb-card-${sk}${wrapper._pb_panel===p.name?" pb-card-sel":""}" data-name="${_e(p.name)}">
  <div class="pb-card-stripe"></div>
  <div class="pb-card-body">
    <div class="pb-card-toprow"><h3 class="pb-card-title">${_e(p.project_name||p.name)}</h3>${due}</div>
    <div class="pb-prog-row"><div class="pb-prog-rail"><div class="pb-prog-fill" style="width:${pct}%"></div></div><span class="pb-prog-pct">${pct}%</span></div>
    ${chips}
    <div class="pb-card-foot"><div class="pb-avs">${avs||'<span class="pb-unassigned">Unassigned</span>'}</div><span class="pb-open-hint">Tasks →</span></div>
  </div>
</article>`;
    }).join("");

    const panelHtml = `
<div class="pb-panel-wrap" id="pb-panel-wrap">
  <aside class="pb-panel">
    <div class="pb-panel-head">
      <div class="pb-ph-toprow"><span class="pb-ph-label">Project</span>
        <button class="pb-ph-close" id="pb-ph-close"><svg viewBox="0 0 14 14" fill="none"><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </div>
      <h2 class="pb-ph-title" id="pb-ph-title">—</h2>
      <div class="pb-ph-meta-row">
        <div class="pb-ph-avs" id="pb-ph-avs"></div>
        <div class="pb-ph-prog-row"><div class="pb-ph-rail"><div class="pb-ph-fill" id="pb-ph-fill"></div></div><span class="pb-ph-pct" id="pb-ph-pct">0%</span></div>
      </div>
    </div>
    <div class="pb-panel-body">
      <div class="pb-tasks-hd"><span>Tasks</span><span class="pb-tasks-ct" id="pb-tasks-ct"></span></div>
      <div class="pb-task-list" id="pb-task-list"></div>
    </div>
    <div class="pb-panel-foot">
      <input class="pb-task-input" id="pb-task-input" type="text" placeholder="Add a task…" autocomplete="off">
      <button class="pb-task-add-btn" id="pb-task-add-btn"><svg viewBox="0 0 12 12" fill="none"><line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    </div>
  </aside>
</div>`;

    const wasOpen = !!wrapper._pb_panel;
    const openProj = wrapper._pb_panel;
    $("#pb-view-area").html(`<div class="pb-board-wrap"><div class="pb-board-grid">${cards}</div>${panelHtml}</div>`);
    if (wasOpen && openProj) {
        const p = (wrapper._pb_projects||[]).find(x => x.name === openProj);
        if (p) _pb_fill_panel_header(p);
        $("#pb-panel-wrap").addClass("open");
        _pb_panel_load_tasks(wrapper, openProj);
    }
}

function _pb_open_board_panel(wrapper, pname) {
    wrapper._pb_panel = pname;
    const p = (wrapper._pb_projects||[]).find(x => x.name === pname);
    if (p) _pb_fill_panel_header(p);
    $("#pb-panel-wrap").addClass("open");
    $(wrapper).find(".pb-card").removeClass("pb-card-sel");
    $(wrapper).find(`.pb-card[data-name="${CSS.escape(pname)}"]`).addClass("pb-card-sel");
    $("#pb-task-input").val("");
    $("#pb-task-list").html(`<div class="pb-loading" style="min-height:80px"><div class="pb-spinner pb-spinner-sm"></div></div>`);
    _pb_panel_load_tasks(wrapper, pname);
}

function _pb_close_board_panel(wrapper) {
    wrapper._pb_panel = null;
    $("#pb-panel-wrap").removeClass("open");
    $(wrapper).find(".pb-card").removeClass("pb-card-sel");
}

function _pb_fill_panel_header(p) {
    const tot = (p.tasks||{}).total||0, done = (p.tasks||{}).completed||0;
    const pct = tot > 0 ? Math.round((done/tot)*100) : 0;
    $("#pb-ph-title").text(p.project_name||p.name);
    $("#pb-ph-fill").css("width", pct+"%");
    $("#pb-ph-pct").text(pct+"%");
    $("#pb-ph-avs").html((p.assignees||[]).map(e=>`<div class="pb-av" style="background:${_avc(e)}" title="${_e(e)}">${_ini(e)}</div>`).join(""));
}

function _pb_panel_load_tasks(wrapper, pname) {
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype:"Task", filters:{project:pname}, fields:["name","subject","status","exp_end_date"], order_by:"creation asc", limit:100 },
        callback(r) { _pb_render_panel_tasks(wrapper, r.message||[]); },
    });
}

function _pb_render_panel_tasks(wrapper, tasks) {
    $("#pb-tasks-ct").text(tasks.length||"");
    if (!tasks.length) { $("#pb-task-list").html(`<div class="pb-empty-tasks">No tasks yet.</div>`); return; }
    $("#pb-task-list").html(tasks.map(t=>`
<div class="pb-task-item" data-task="${_e(t.name)}">
  <button class="pb-tc-btn" data-task="${_e(t.name)}" data-status="${_e(t.status||"Open")}">${_tc_icon(t.status)}</button>
  <span class="pb-task-subj ${t.status==="Completed"?"pb-task-done":""}">${_e(t.subject||"")}</span>
  <button class="pb-panel-task-del pb-task-del" data-task="${_e(t.name)}" title="Delete"><svg viewBox="0 0 12 12" fill="none"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
</div>`).join(""));
}

function _pb_do_add_panel_task(wrapper) {
    const subject = $("#pb-task-input").val().trim();
    if (!subject || !wrapper._pb_panel) return;
    $("#pb-task-input").val("").prop("disabled", true);
    frappe.call({
        method: "frappe.client.insert",
        args: { doc: { doctype:"Task", subject, project:wrapper._pb_panel, status:"Open" } },
        callback(r) {
            $("#pb-task-input").prop("disabled", false);
            if (!r.message) return;
            const $list = $("#pb-task-list");
            $list.find(".pb-empty-tasks").remove();
            $list.append(`<div class="pb-task-item" data-task="${_e(r.message.name)}">
              <button class="pb-tc-btn" data-task="${_e(r.message.name)}" data-status="Open">${_tc_icon("Open")}</button>
              <span class="pb-task-subj">${_e(r.message.subject||"")}</span>
              <button class="pb-panel-task-del pb-task-del" data-task="${_e(r.message.name)}" title="Delete"><svg viewBox="0 0 12 12" fill="none"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            </div>`);
            const c = $("#pb-task-list .pb-task-item").length;
            $("#pb-tasks-ct").text(c||"");
        },
        error() { $("#pb-task-input").prop("disabled", false); },
    });
}

// ── new task modal ─────────────────────────────────────────────────
function _pb_new_task_modal(wrapper, default_status) {
    const projs = wrapper._pb_projects||[];
    const selProj = wrapper._pb_sel ? projs.find(p => p.name === wrapper._pb_sel) : null;
    const d = new frappe.ui.Dialog({
        title: "New Task",
        fields: [
            { fieldname:"subject",         label:"Task Name", fieldtype:"Data",   reqd:1 },
            { fieldname:"project_display", label:"Project",   fieldtype:"Select",
              options: projs.map(p=>p.project_name||p.name).join("\n"), reqd:1,
              default: selProj?(selProj.project_name||selProj.name):"" },
            { fieldname:"status",          label:"Status",    fieldtype:"Select",
              options:"Open\nWorking On\nCompleted", default:default_status||"Open" },
            { fieldname:"exp_end_date",    label:"Due Date",  fieldtype:"Date" },
        ],
        primary_action_label: "Create",
        primary_action(v) {
            const proj = projs.find(p=>(p.project_name||p.name)===v.project_display);
            if (!proj) return;
            d.hide();
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype:"Task", subject:v.subject, project:proj.name, status:v.status, exp_end_date:v.exp_end_date } },
                callback(r) {
                    if (!r.message) return;
                    frappe.show_alert({ message:"Task created", indicator:"green" }, 2);
                    wrapper._pb_tasks = [r.message, ...(wrapper._pb_tasks||[])];
                    _pb_render(wrapper);
                },
            });
        },
    });
    d.show();
}

// ── helpers ────────────────────────────────────────────────────────
function _e(s) { return frappe.utils.escape_html(String(s||"")); }
function _pb_ov(p, today) { return p && p.expected_end_date && p.expected_end_date < today && !["Completed","Cancelled"].includes(p.status||""); }
function _pb_sk(s) { s=(s||"").toLowerCase(); if(s==="completed")return"completed"; if(s==="cancelled")return"cancelled"; if(s.includes("working")||s.includes("progress"))return"in_progress"; return"open"; }
function _dot_c(sk) { return {open:"#60a5fa",in_progress:"#fb923c",overdue:"#f87171",completed:"#4ade80",cancelled:"#6b7280"}[sk]||"#6b7280"; }
function _ini(email) { return email.split("@")[0].replace(/[._-]/g," ").split(" ").slice(0,2).map(w=>(w[0]||"").toUpperCase()).join("")||"?"; }
function _avc(email) { const c=["#7C3AED","#2563EB","#059669","#D97706","#DC2626","#0891B2","#9333EA","#65A30D"]; let h=0; for(let i=0;i<email.length;i++) h=(h*31+email.charCodeAt(i))&0xffff; return c[h%c.length]; }
function _tc_icon(s) {
    if(s==="Completed") return `<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#10b981"/><path d="M4 7l2 2 4-4" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if(s==="Working On") return `<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#3b82f6"/><path d="M7 4v3l2 1.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    return `<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#d1d5db" stroke-width="1.5"/></svg>`;
}

// ── styles ─────────────────────────────────────────────────────────
function _pb_inject_styles() {
    if (document.getElementById("pb-s6")) return;
    const s = document.createElement("style");
    s.id = "pb-s6";
    s.textContent = `

/* ── hide navbar + frappe chrome ─────────────────────────────── */
body.pb-fs .navbar,
body.pb-fs .navbar-expand,
body.pb-fs [class*="navbar"],
body.pb-fs .body-sidebar-container,
body.pb-fs .layout-side-section,
body.pb-fs .sidebar-toggle-btn,
body.pb-fs .collapse-sidebar-link,
body.pb-fs .sidebar-resize-handle
{ display:none !important; }

body.pb-fs .main-section,
body.pb-fs .desk-main,
body.pb-fs .container.page-container
{ padding:0 !important; margin:0 !important; max-width:100% !important; }

/* ── shell: full screen ──────────────────────────────────────── */
.pb-shell {
    position:fixed !important;
    top:0; left:0; right:0; bottom:0;
    z-index:1100;
    display:flex;
    background:#0f0f17;
    font-family:-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    overflow:hidden;
}

/* ── sidebar ──────────────────────────────────────────────────── */
.pb-sidebar { width:220px; min-width:220px; flex-shrink:0; background:#111118; display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; border-right:1px solid rgba(255,255,255,.04); }
.pb-sidebar::-webkit-scrollbar { display:none; }
.pb-brand { display:flex; align-items:center; gap:9px; padding:18px 13px 13px; border-bottom:1px solid rgba(255,255,255,.04); }
.pb-brand-icon { width:24px; height:24px; flex-shrink:0; }
.pb-brand-icon svg { width:100%; height:100%; }
.pb-brand-label { font-size:12.5px; font-weight:650; color:#e0e0e8; letter-spacing:-.01em; }
.pb-sidebar-sec { padding:4px 7px 10px; }
.pb-projs-sec { flex:1; overflow-y:auto; scrollbar-width:none; }
.pb-projs-sec::-webkit-scrollbar { display:none; }
.pb-sec-hd { font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#333348; padding:4px 6px 5px; display:flex; align-items:center; gap:6px; }
.pb-proj-ct { background:rgba(255,255,255,.05); color:#44445c; font-size:9px; padding:1px 5px; border-radius:99px; font-weight:700; }
.pb-nav { display:flex; align-items:center; gap:8px; width:100%; padding:6px 7px; border-radius:7px; border:none; background:transparent; color:#44445c; font-size:12px; font-weight:450; cursor:pointer; text-align:left; transition:background .1s, color .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pb-nav svg { width:13px; height:13px; flex-shrink:0; }
.pb-nav:hover  { background:rgba(255,255,255,.05); color:#b0b0c8; }
.pb-nav.active { background:rgba(139,92,246,.14); color:#a78bfa; font-weight:580; }
.pb-dot    { width:7px; height:7px; border-radius:50%; flex-shrink:0; display:inline-block; }
.pb-av-sm  { width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8.5px; font-weight:700; color:#fff; flex-shrink:0; }
.pb-sidebar-foot { padding:10px 7px 18px; border-top:1px solid rgba(255,255,255,.04); display:flex; flex-direction:column; gap:5px; }
.pb-new-btn  { display:flex; align-items:center; gap:7px; width:100%; padding:7px 9px; border-radius:7px; border:1.5px dashed rgba(255,255,255,.08); background:transparent; color:#44445c; font-size:12px; font-weight:500; cursor:pointer; transition:all .1s; }
.pb-new-btn svg { width:11px; height:11px; }
.pb-new-btn:hover { border-color:rgba(139,92,246,.4); color:#a78bfa; background:rgba(139,92,246,.08); }
.pb-back-btn { display:flex; align-items:center; gap:7px; width:100%; padding:6px 9px; border-radius:7px; border:none; background:transparent; color:#2d2d42; font-size:11.5px; font-weight:500; cursor:pointer; transition:all .1s; }
.pb-back-btn svg { width:11px; height:11px; }
.pb-back-btn:hover { background:rgba(255,255,255,.05); color:#5c5c78; }

/* ── center ──────────────────────────────────────────────────── */
.pb-center { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; background:#f5f5f8; }
.pb-main-hd { display:flex; align-items:center; gap:10px; padding:13px 22px 11px; background:#fff; border-bottom:1px solid #e8e8f0; flex-shrink:0; }
.pb-mhd-l   { flex:1; display:flex; align-items:baseline; gap:9px; min-width:0; }
.pb-title    { font-size:16px; font-weight:750; color:#111827; margin:0; letter-spacing:-.02em; }
.pb-subtitle { font-size:11.5px; color:#9ca3af; font-weight:500; }
.pb-mhd-r   { display:flex; align-items:center; gap:7px; }
.pb-search-box { display:flex; align-items:center; gap:6px; background:#f5f5fa; border:1px solid #e5e7eb; border-radius:7px; padding:5px 9px; cursor:text; transition:border-color .12s; }
.pb-search-box:focus-within { border-color:#8b5cf6; }
.pb-search-box svg { width:12px; height:12px; color:#9ca3af; flex-shrink:0; }
.pb-search-box input { border:none; background:transparent; font-size:12.5px; color:#374151; outline:none; width:130px; font-family:inherit; }
.pb-search-box input::placeholder { color:#9ca3af; }
.pb-icon-btn { width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:7px; border:1px solid #e5e7eb; background:#fff; color:#6b7280; cursor:pointer; transition:all .1s; }
.pb-icon-btn svg { width:13px; height:13px; }
.pb-icon-btn:hover { background:#f5f5fa; color:#374151; }
.pb-view-area { flex:1; overflow:hidden; display:flex; }

/* ── kanban ──────────────────────────────────────────────────── */
.pb-kanban { display:flex; gap:14px; padding:18px 20px; width:100%; box-sizing:border-box; overflow-x:auto; align-items:flex-start; overflow-y:hidden; }

.pb-col { width:272px; min-width:272px; display:flex; flex-direction:column; background:rgba(0,0,0,.025); border-radius:13px; border:1.5px solid rgba(0,0,0,.06); height:100%; transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
.pb-col-over { border-color:#8b5cf6 !important; box-shadow:0 0 0 3px rgba(139,92,246,.2) !important; background:rgba(139,92,246,.03) !important; }

.pb-col-hd   { display:flex; align-items:center; gap:7px; padding:11px 13px 9px; border-bottom:1px solid rgba(0,0,0,.05); flex-shrink:0; background:rgba(255,255,255,.7); border-radius:12px 12px 0 0; backdrop-filter:blur(8px); }
.pb-col-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.pb-col-name { font-size:12px; font-weight:700; color:#374151; flex:1; letter-spacing:.01em; }
.pb-col-ct   { font-size:11px; font-weight:700; color:#9ca3af; background:rgba(0,0,0,.05); padding:1px 7px; border-radius:99px; }

.pb-col-body { flex:1; overflow-y:auto; padding:10px 10px 4px; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,.08) transparent; min-height:0; }
.pb-col-body::-webkit-scrollbar { width:3px; }
.pb-col-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,.1); border-radius:99px; }
.pb-col-empty { text-align:center; padding:32px 0; color:#c4c4d0; font-size:22px; }

.pb-col-foot { padding:6px 10px 10px; flex-shrink:0; }
.pb-col-add-btn { width:100%; padding:7px; border-radius:7px; border:none; background:transparent; color:#9ca3af; font-size:12px; cursor:pointer; text-align:left; transition:background .1s, color .1s; }
.pb-col-add-btn:hover { background:rgba(0,0,0,.04); color:#374151; }
.pb-col-adder { padding-top:4px; }
.pb-adder-input { width:100%; padding:6px 9px; border-radius:7px; border:1.5px solid #8b5cf6; outline:none; font-size:12.5px; color:#374151; background:#fff; font-family:inherit; box-sizing:border-box; }
.pb-adder-row { display:flex; gap:5px; margin-top:5px; }
.pb-adder-ok { flex:1; padding:5px; border-radius:6px; border:none; background:#7c3aed; color:#fff; font-size:12px; font-weight:600; cursor:pointer; }
.pb-adder-ok:hover { background:#6d28d9; }
.pb-adder-cancel { padding:5px 8px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; color:#6b7280; font-size:12px; cursor:pointer; }

/* ── task card ───────────────────────────────────────────────── */
.pb-tk { background:#fff; border-radius:10px; border:1.5px solid #eeeef4; box-shadow:0 1px 2px rgba(0,0,0,.04),0 2px 8px rgba(0,0,0,.03); padding:10px 11px 9px; margin-bottom:8px; cursor:pointer; transition:box-shadow .15s, transform .15s, border-color .15s, opacity .2s; animation:pb-tk-in .18s ease both; user-select:none; }
.pb-tk:last-child { margin-bottom:0; }
.pb-tk:hover { box-shadow:0 3px 12px rgba(0,0,0,.09); transform:translateY(-1px); }
.pb-tk-selected { border-color:#8b5cf6 !important; box-shadow:0 0 0 3px rgba(139,92,246,.15) !important; }
.pb-tk-ov { border-left:3px solid #f87171; padding-left:8px; }
.pb-tk-dragging { opacity:.35; transform:scale(.95) rotate(1.5deg) !important; box-shadow:0 16px 40px rgba(0,0,0,.18) !important; cursor:grabbing !important; }
.pb-tk-removing { opacity:.3; pointer-events:none; }
@keyframes pb-tk-in { from { opacity:0; transform:translateY(5px); } }

.pb-tk-top  { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:5px; }
.pb-tk-proj { font-size:10px; font-weight:650; letter-spacing:.03em; color:#9ca3af; background:#f5f5fa; padding:1px 6px; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%; }
.pb-tk-due  { font-size:10px; color:#9ca3af; white-space:nowrap; }
.pb-tk-late { color:#ef4444; font-weight:650; }
.pb-tk-subj { font-size:12.5px; font-weight:600; color:#1f2937; line-height:1.35; margin-bottom:9px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pb-tk-foot    { display:flex; align-items:center; justify-content:space-between; }
.pb-tk-assigns { display:flex; gap:3px; }
.pb-tk-acts    { display:flex; align-items:center; gap:3px; }

.pb-av-btn { width:24px; height:24px; border-radius:50%; border:2px solid transparent; display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:800; cursor:pointer; transition:all .15s; user-select:none; }
.pb-av-off { background:#f3f4f6; color:#9ca3af; border-color:#f3f4f6; }
.pb-av-off:hover { border-color:#d1d5db; color:#6b7280; }
.pb-av-on  { background:var(--avc,#7c3aed)!important; border-color:var(--avc,#7c3aed)!important; color:#fff!important; box-shadow:0 0 0 3px color-mix(in srgb, var(--avc,#7c3aed) 20%, transparent); }
.pb-av-on:hover { filter:brightness(1.1); }

.pb-tk-adv { width:22px; height:22px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; background:#f0f0f5; color:#6b7280; font-size:9px; font-weight:700; cursor:pointer; transition:all .12s; flex-shrink:0; }
.pb-tk-adv:hover       { background:#3b82f6; color:#fff; }
.pb-tk-adv-done:hover  { background:#10b981; color:#fff; }
.pb-tk-adv-reset:hover { background:#6b7280; color:#fff; }
.pb-tk-del { width:20px; height:20px; border-radius:5px; border:none; background:transparent; color:#d1d5db; font-size:14px; line-height:1; cursor:pointer; transition:all .1s; display:flex; align-items:center; justify-content:center; opacity:0; }
.pb-tk:hover .pb-tk-del { opacity:1; }
.pb-tk-del:hover { background:#fee2e2; color:#dc2626; }

/* ── TASK DETAIL PANEL (right edge of kanban) ─────────────────── */
.pb-detail-wrap { width:0; flex-shrink:0; transition:width .22s cubic-bezier(.4,0,.2,1); overflow:hidden; background:#fff; border-left:1px solid #e8e8f0; }
.pb-detail-wrap.open { width:290px; }
.pb-detail { width:290px; height:100%; display:flex; flex-direction:column; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#e5e7eb transparent; }

.pb-detail-hd { padding:16px 15px 12px; border-bottom:1px solid #f0f0f5; flex-shrink:0; background:#fdfcff; }
.pb-detail-hd-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.pb-detail-label { font-size:9px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#9ca3af; }
.pb-detail-del-btn   { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px; border:none; background:transparent; color:#d1d5db; cursor:pointer; transition:all .1s; }
.pb-detail-del-btn svg { width:13px; height:13px; }
.pb-detail-del-btn:hover { background:#fee2e2; color:#dc2626; }
.pb-detail-close-btn { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px; border:none; background:transparent; color:#9ca3af; cursor:pointer; transition:all .1s; }
.pb-detail-close-btn svg { width:11px; height:11px; }
.pb-detail-close-btn:hover { background:#f5f5fa; color:#374151; }
.pb-detail-title { font-size:14.5px; font-weight:750; color:#111827; margin:0 0 4px; line-height:1.3; letter-spacing:-.01em; }
.pb-detail-proj  { font-size:10.5px; color:#9ca3af; font-weight:550; }

.pb-detail-body { flex:1; padding:14px 15px; display:flex; flex-direction:column; gap:14px; }
.pb-detail-row  { display:flex; align-items:center; gap:10px; }
.pb-detail-row-label { font-size:11px; font-weight:650; color:#9ca3af; min-width:65px; }
.pb-detail-row-val   { font-size:12.5px; color:#374151; }
.pb-detail-overdue   { color:#dc2626; font-weight:650; }
.pb-detail-select    { border:1.5px solid #e5e7eb; border-radius:7px; padding:4px 8px; font-size:12px; color:#374151; background:#fff; outline:none; cursor:pointer; font-family:inherit; transition:border-color .12s; }
.pb-detail-select:focus { border-color:#8b5cf6; }
.pb-detail-section-hd { font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#9ca3af; margin-top:4px; }
.pb-detail-avs { display:flex; flex-direction:column; gap:5px; }

.pb-detail-av { display:flex; align-items:center; gap:9px; width:100%; padding:7px 9px; border-radius:8px; border:1.5px solid #f0f0f5; background:#fafafa; cursor:pointer; transition:all .12s; }
.pb-detail-av.pb-av-on  { border-color:var(--avc,#7c3aed); background:color-mix(in srgb, var(--avc,#7c3aed) 8%, #fff); }
.pb-detail-av.pb-av-off:hover { border-color:#d1d5db; }
.pb-dav-lbl  { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff; flex-shrink:0; background:var(--avc, #9ca3af); }
.pb-av-off .pb-dav-lbl  { background:#d1d5db; }
.pb-dav-name { font-size:12.5px; font-weight:550; color:#374151; }
.pb-av-on .pb-dav-name  { color:var(--avc, #7c3aed); font-weight:650; }

/* ── board view ──────────────────────────────────────────────── */
.pb-board-wrap  { display:flex; height:100%; overflow:hidden; width:100%; }
.pb-board-grid  { flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(268px,1fr)); gap:14px; padding:18px 20px; align-items:start; }

.pb-card { background:#fff; border-radius:13px; border:1.5px solid #ebebf2; box-shadow:0 1px 3px rgba(0,0,0,.05),0 3px 10px rgba(0,0,0,.04); overflow:hidden; cursor:pointer; transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s, border-color .15s; }
.pb-card:hover { transform:translateY(-3px); box-shadow:0 6px 20px rgba(0,0,0,.09); }
.pb-card-sel   { border-color:#8b5cf6!important; box-shadow:0 0 0 3px rgba(139,92,246,.18)!important; }
.pb-card-stripe { height:3px; }
.pb-card-open        .pb-card-stripe { background:linear-gradient(90deg,#3b82f6,#60a5fa); }
.pb-card-in_progress .pb-card-stripe { background:linear-gradient(90deg,#f59e0b,#fbbf24); }
.pb-card-overdue     .pb-card-stripe { background:linear-gradient(90deg,#ef4444,#f87171); }
.pb-card-completed   .pb-card-stripe { background:linear-gradient(90deg,#10b981,#34d399); }
.pb-card-cancelled   .pb-card-stripe { background:#e5e7eb; }
.pb-card-body { padding:12px 14px 12px; }
.pb-card-toprow { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; }
.pb-card-title  { font-size:13px; font-weight:700; color:#111827; line-height:1.35; margin:0; flex:1; }
.pb-card-due    { font-size:10.5px; color:#9ca3af; white-space:nowrap; margin-top:2px; }
.pb-due-late    { color:#dc2626; font-weight:650; }
.pb-prog-row    { display:flex; align-items:center; gap:7px; margin-bottom:8px; }
.pb-prog-rail   { flex:1; height:4px; background:#f3f4f6; border-radius:99px; overflow:hidden; }
.pb-prog-fill   { height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); border-radius:99px; transition:width .35s; }
.pb-prog-pct    { font-size:10.5px; font-weight:700; color:#7c3aed; min-width:24px; text-align:right; }
.pb-card-tasks  { display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-bottom:10px; min-height:20px; }
.pb-ct-empty    { color:#d1d5db; font-size:11px; }
.pb-task-chip   { font-size:10px; font-weight:650; padding:2px 7px; border-radius:99px; }
.pb-tc-open  { background:#eff6ff; color:#2563eb; }
.pb-tc-prog  { background:#fffbeb; color:#d97706; }
.pb-tc-done  { background:#ecfdf5; color:#059669; }
.pb-card-foot { border-top:1px solid #f5f5fa; padding-top:9px; display:flex; align-items:center; justify-content:space-between; }
.pb-avs { display:flex; }
.pb-av  { width:23px; height:23px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:8.5px; font-weight:700; color:#fff; margin-right:-5px; flex-shrink:0; }
.pb-av-x { background:#e5e7eb; color:#6b7280; font-size:8px; }
.pb-unassigned { font-size:11px; color:#d1d5db; }
.pb-open-hint  { font-size:10.5px; color:#c4b5f5; font-weight:550; transition:color .12s; }
.pb-card:hover .pb-open-hint { color:#7c3aed; }

/* ── board right panel ───────────────────────────────────────── */
.pb-panel-wrap { width:0; overflow:hidden; transition:width .26s cubic-bezier(.4,0,.2,1); flex-shrink:0; }
.pb-panel-wrap.open { width:320px; }
.pb-panel { width:320px; height:100%; background:#fff; border-left:1px solid #e8e8f0; display:flex; flex-direction:column; overflow:hidden; }
.pb-panel-head { padding:16px 16px 12px; border-bottom:1px solid #f0f0f5; flex-shrink:0; background:#fdfcff; }
.pb-ph-toprow  { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.pb-ph-label   { font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#9ca3af; }
.pb-ph-close   { width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:5px; border:none; background:transparent; color:#9ca3af; cursor:pointer; transition:all .1s; }
.pb-ph-close svg { width:11px; height:11px; }
.pb-ph-close:hover { background:#f5f5fa; color:#374151; }
.pb-ph-title   { font-size:14px; font-weight:700; color:#111827; margin:0 0 10px; letter-spacing:-.01em; line-height:1.3; }
.pb-ph-meta-row{ display:flex; align-items:center; gap:9px; }
.pb-ph-avs     { display:flex; }
.pb-ph-prog-row{ display:flex; align-items:center; gap:6px; flex:1; }
.pb-ph-rail    { flex:1; height:4px; background:#f3f4f6; border-radius:99px; overflow:hidden; }
.pb-ph-fill    { height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); border-radius:99px; transition:width .4s; }
.pb-ph-pct     { font-size:10.5px; font-weight:700; color:#7c3aed; min-width:24px; text-align:right; }
.pb-panel-body { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#e5e7eb transparent; }
.pb-tasks-hd   { display:flex; align-items:center; justify-content:space-between; padding:11px 16px 7px; font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#9ca3af; position:sticky; top:0; background:#fff; border-bottom:1px solid #f5f5fa; }
.pb-tasks-ct   { background:#f0f0f5; color:#6b7280; font-size:9.5px; padding:1px 6px; border-radius:99px; font-weight:700; }
.pb-task-item  { display:flex; align-items:center; gap:8px; padding:7px 16px; transition:background .08s; animation:pb-tk-in .18s ease both; }
.pb-task-item:hover { background:#faf8ff; }
.pb-task-item.pb-task-removing { opacity:.3; pointer-events:none; }
.pb-tc-btn  { width:22px; height:22px; flex-shrink:0; border:none; background:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; transition:transform .12s; }
.pb-tc-btn:hover { transform:scale(1.15); }
.pb-tc-btn svg { width:22px; height:22px; }
.pb-task-subj { flex:1; font-size:12.5px; color:#374151; line-height:1.35; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pb-task-done { text-decoration:line-through; color:#9ca3af; }
.pb-task-del  { width:20px; height:20px; flex-shrink:0; border:none; background:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; color:#d1d5db; border-radius:5px; opacity:0; transition:opacity .1s, background .1s; }
.pb-task-del svg { width:10px; height:10px; }
.pb-task-item:hover .pb-task-del { opacity:1; }
.pb-task-del:hover { background:#fee2e2; color:#dc2626; }
.pb-empty-tasks { padding:24px 16px; text-align:center; font-size:12px; color:#9ca3af; }
.pb-panel-foot { display:flex; align-items:center; gap:7px; padding:9px 12px 12px; border-top:1px solid #f0f0f5; background:#fafafa; flex-shrink:0; }
.pb-task-input { flex:1; border:1.5px solid #e5e7eb; border-radius:7px; padding:6px 9px; font-size:12px; color:#374151; outline:none; background:#fff; transition:border-color .12s; font-family:inherit; }
.pb-task-input:focus { border-color:#8b5cf6; }
.pb-task-input::placeholder { color:#b0b0c0; }
.pb-task-add-btn { width:30px; height:30px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#7c3aed; border:none; border-radius:7px; cursor:pointer; color:#fff; transition:background .1s; }
.pb-task-add-btn svg { width:11px; height:11px; }
.pb-task-add-btn:hover { background:#6d28d9; }

/* ── loading / empty ─────────────────────────────────────────── */
.pb-loading { display:flex; align-items:center; justify-content:center; width:100%; min-height:260px; }
.pb-spinner  { width:26px; height:26px; border:2.5px solid #ede9fa; border-top-color:#7c3aed; border-radius:50%; animation:pb-spin .7s linear infinite; }
.pb-spinner-sm { width:18px; height:18px; border-width:2px; }
@keyframes pb-spin { to { transform:rotate(360deg); } }
.pb-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:260px; gap:8px; color:#c4c4d0; font-size:12.5px; }
.pb-empty p { margin:0; }

/* ── templates view ──────────────────────────────────────────── */
.pb-tpl-shell { display:flex; flex-direction:column; width:100%; height:100%; overflow:hidden; }
.pb-tpl-tabs { display:flex; gap:2px; padding:10px 20px 0; background:#fff; border-bottom:1px solid #e8e8f0; flex-shrink:0; }
.pb-tpl-tab { padding:7px 14px; border-radius:8px 8px 0 0; border:none; border-bottom:2px solid transparent; background:transparent; color:#9ca3af; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .12s; margin-bottom:-1px; }
.pb-tpl-tab:hover { color:#374151; background:#f9f9fb; }
.pb-tpl-tab.active { color:#7c3aed; border-bottom-color:#7c3aed; background:rgba(139,92,246,.05); }

.pb-tpl-section { padding:12px 20px 14px; flex-shrink:0; background:#fff; border-bottom:1px solid #f0f0f5; }
.pb-tpl-design-section { flex:1; display:flex; flex-direction:column; overflow:hidden; border-bottom:none; }
.pb-tpl-sec-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:10px; }
.pb-tpl-sec-hd > span:first-child { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#9ca3af; display:flex; align-items:center; gap:7px; }

.pb-tpl-badge { background:#fef3c7; color:#d97706; font-size:9px; font-weight:700; padding:2px 6px; border-radius:4px; letter-spacing:.03em; text-transform:uppercase; }

.pb-tpl-upload-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:7px; border:1.5px dashed #d1d5db; background:transparent; color:#6b7280; font-size:11.5px; font-weight:600; cursor:pointer; transition:all .12s; white-space:nowrap; }
.pb-tpl-upload-btn:hover { border-color:#8b5cf6; color:#7c3aed; background:rgba(139,92,246,.04); }

.pb-tpl-files-row { display:flex; flex-wrap:wrap; gap:7px; align-items:center; min-height:28px; }
.pb-tpl-no-files { font-size:12px; color:#d1d5db; }
.pb-tpl-file-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 8px 4px 7px; background:#f5f5fa; border:1px solid #e5e7eb; border-radius:7px; font-size:11.5px; color:#374151; }
.pb-tpl-file-icon { font-size:13px; line-height:1; }
.pb-tpl-file-del { border:none; background:transparent; color:#d1d5db; cursor:pointer; font-size:14px; line-height:1; padding:0 0 0 3px; transition:color .1s; }
.pb-tpl-file-del:hover { color:#dc2626; }

.pb-tpl-toolbar { display:flex; gap:5px; flex-wrap:wrap; }
.pb-tpl-tb { padding:4px 10px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; color:#374151; font-size:11.5px; font-weight:550; cursor:pointer; transition:all .1s; white-space:nowrap; }
.pb-tpl-tb:hover { border-color:#8b5cf6; color:#7c3aed; background:rgba(139,92,246,.05); }
.pb-tpl-tb-reset { color:#9ca3af; }
.pb-tpl-tb-reset:hover { border-color:#d1d5db; color:#6b7280; background:#f9fafb; }

.pb-tpl-playground { flex:1; display:flex; overflow:hidden; }
.pb-tpl-iframe { flex:1; border:none; background:#f5f5f8; min-width:0; border-right:1px solid #e8e8f0; }
.pb-tpl-editor-pane { width:360px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; background:#fafafa; }
.pb-tpl-editor-hd { padding:8px 12px; font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#9ca3af; background:#f5f5f8; border-bottom:1px solid #eeeef4; display:flex; align-items:center; gap:6px; flex-shrink:0; }
.pb-tpl-editor-hint { font-size:10px; font-weight:400; color:#c4c4d0; letter-spacing:0; text-transform:none; }
.pb-tpl-code { flex:1; resize:none; border:none; outline:none; padding:14px; font-family:"SF Mono","Fira Code","Cascadia Code","Consolas",monospace; font-size:11.5px; line-height:1.65; color:#374151; background:#fafafa; width:100%; box-sizing:border-box; tab-size:2; }
`;
    document.head.appendChild(s);
}
