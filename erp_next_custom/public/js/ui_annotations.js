// ui_annotations.js — admin annotation overlay (System Manager only)
"use strict";

(function () {
    // ── Bootstrap ──────────────────────────────────────────────────────────────
    let _inited = false;

    $(document).on("page-change.ann-boot", function () {
        if (_inited) return;
        if (!frappe.session?.user || frappe.session.user === "Guest") return;
        if (!frappe.user?.has_role("System Manager")) {
            $(document).off("page-change.ann-boot");
            return;
        }
        $(document).off("page-change.ann-boot");
        _inited = true;
        _init();
    });

    function _init() {
        let open          = false;
        let _allAnns      = [];
        let _currentAnns  = [];
        let _pendingFlash = null;
        let $overlay      = null;
        const _openSecs   = new Set(); // which sections are expanded

        const TAG_COLOR = {
            "Note":        "#378ADD",
            "Edit this":   "#e67e22",
            "Remove this": "#e74c3c",
            "Change this": "#8e44ad",
            "Add here":    "#27ae60",
        };

        function _section(route) {
            const part = (route || "").split("/")[0];
            const MAP = {
                "crm-log": "Log", "contact": "Contact", "lead": "Lead",
                "item": "Item", "quotation": "Quotation", "task": "Task",
                "project": "Project", "workspaces": "Workspace",
                "customer": "Customer", "supplier": "Supplier",
                "overview": "Overview", "": "Home",
            };
            return MAP[part]
                || part.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                || "General";
        }

        // ── 💬 Toggle button ───────────────────────────────────────────────────
        // Hidden — the quick_launch FAB hosts the visible trigger instead.
        const $btn = $(`<button class="adm-ann-btn" title="${__("Annotations (Alt+Shift+C)")}">💬</button>`)
            .css("display", "none")
            .appendTo("body");
        $btn.on("click", () => open ? _closeSidebar() : _openSidebar());

        // Expose toggle so quick_launch.js can drive this from its FAB
        window.__annToggle   = () => open ? _closeSidebar() : _openSidebar();
        window.__annIsOpen   = () => open;

        $(document).on("keydown.ann-esc", (e) => {
            if (e.key === "Escape" && open) { _closeSidebar(); return; }
            if (e.altKey && e.shiftKey && e.code === "KeyC") {
                e.preventDefault();
                open ? _closeSidebar() : _openSidebar();
            }
        });

        $(document).on("page-change.ann", () => {
            _loadCurrent();
            if (open) _loadAll(_showSidebar);
        });

        $(document).on("contextmenu.ann", (e) => {
            if (!open) return;
            if ($(e.target).closest(".frappe-dialog,.modal,#ann-sidebar,.adm-ann-btn,.ann-overlay").length) return;
            e.preventDefault();
            _openAddDialog(
                +(e.clientX / window.innerWidth  * 100).toFixed(2),
                +(e.clientY / window.innerHeight * 100).toFixed(2)
            );
        });

        function _route() {
            try { return frappe.get_route().join("/"); } catch { return ""; }
        }

        // ── Load all annotations ───────────────────────────────────────────────
        function _loadAll(cb) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "UI Annotation",
                    fields:  ["name","page_route","pos_x","pos_y","tag","comment","resolved","author","creation"],
                    order_by: "creation asc",
                    limit_page_length: 500,
                },
                callback({ message }) {
                    _allAnns = message || [];
                    if (cb) cb(_allAnns);
                },
            });
        }

        // ── Load current-page annotations → render pins ────────────────────────
        function _loadCurrent() {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "UI Annotation",
                    filters:  { page_route: _route() },
                    fields:   ["name","pos_x","pos_y","tag","comment","resolved","author","creation"],
                    order_by: "creation asc",
                    limit_page_length: 200,
                },
                callback({ message }) {
                    _currentAnns = message || [];
                    _renderPins();
                    if (_pendingFlash) {
                        const idx = _currentAnns.findIndex(a => a.name === _pendingFlash);
                        _pendingFlash = null;
                        if (idx >= 0) setTimeout(() => _flashPin(idx), 350);
                    }
                },
            });
        }

        function _openSidebar() {
            open = true;
            $btn.addClass("adm-btn--active");
            $("body").addClass("adm-crosshair");
            _loadCurrent();
            _loadAll(_showSidebar);
        }

        function _closeSidebar() {
            open = false;
            $btn.removeClass("adm-btn--active");
            $("body").removeClass("adm-crosshair");
            _clearPins();
            $("#ann-sidebar").removeClass("ann-sidebar--open");
        }

        // ── Pins ───────────────────────────────────────────────────────────────
        function _clearPins() {
            if ($overlay) { $overlay.remove(); $overlay = null; }
        }

        function _renderPins() {
            _clearPins();
            if (!open || !_currentAnns.length) return;
            $overlay = $(`<div class="ann-overlay"></div>`).appendTo("body");
            _currentAnns.forEach((ann, i) => {
                const color = TAG_COLOR[ann.tag] || "#378ADD";
                const $pin  = $(`
                    <div class="ann-pin${ann.resolved ? " ann-pin--done" : ""}"
                         style="left:${ann.pos_x}%;top:${ann.pos_y}%;--pc:${color}"
                         title="${frappe.utils.escape_html(ann.comment)}">
                        <span class="ann-n">${i + 1}</span>
                        <button class="ann-del" title="${__("Delete")}">×</button>
                    </div>
                `).appendTo($overlay);
                _attachPinEvents($pin, ann, i + 1);
            });
        }

        function _attachPinEvents($pin, ann, num) {
            const $del = $pin.find(".ann-del");

            $pin.on("click.ann", (e) => {
                if (e.target === $del[0]) return;
                if ($pin.data("_dragged")) { $pin.removeData("_dragged"); return; }
                _openEditDialog(ann, num);
            });
            $del.on("click", (e) => { e.stopPropagation(); _confirmDelete(ann); });

            const THRESH = 5;
            let dragging = false, sX, sY, sPX, sPY;
            $pin.on("mousedown.drag", (e) => {
                if (e.button !== 0 || e.target === $del[0]) return;
                e.preventDefault();
                dragging = false; sX = e.clientX; sY = e.clientY;
                sPX = ann.pos_x; sPY = ann.pos_y;
                const ns = ".pin-" + ann.name;
                $(document).on("mousemove" + ns, (me) => {
                    const dx = me.clientX - sX, dy = me.clientY - sY;
                    if (!dragging && (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH)) {
                        dragging = true; $pin.addClass("ann-pin--dragging");
                    }
                    if (dragging) {
                        $pin.css({
                            left: _clamp(sPX + dx / window.innerWidth  * 100) + "%",
                            top:  _clamp(sPY + dy / window.innerHeight * 100) + "%",
                        });
                    }
                });
                $(document).on("mouseup" + ns, (ue) => {
                    $(document).off("mousemove" + ns + " mouseup" + ns);
                    $pin.removeClass("ann-pin--dragging");
                    if (dragging) {
                        $pin.data("_dragged", true);
                        ann.pos_x = _clamp(sPX + (ue.clientX - sX) / window.innerWidth  * 100);
                        ann.pos_y = _clamp(sPY + (ue.clientY - sY) / window.innerHeight * 100);
                        _savePosition(ann);
                    }
                    dragging = false;
                });
            });
        }

        function _clamp(v) { return +Math.max(1, Math.min(99, v)).toFixed(2); }

        function _savePosition(ann) {
            frappe.call({
                method: "frappe.client.get",
                args: { doctype: "UI Annotation", name: ann.name },
                callback({ message: doc }) {
                    if (!doc) return;
                    doc.pos_x = ann.pos_x;
                    doc.pos_y = ann.pos_y;
                    frappe.call({ method: "frappe.client.save", args: { doc } });
                },
            });
        }

        function _flashPin(idx) {
            if (!$overlay) return;
            const $p = $overlay.children(".ann-pin").eq(idx);
            $p.addClass("ann-pin--highlight");
            setTimeout(() => $p.removeClass("ann-pin--highlight"), 2000);
        }

        function _confirmDelete(ann) {
            frappe.confirm(__("Delete this annotation?"), () => {
                frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: "UI Annotation", name: ann.name },
                    callback() {
                        frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.5);
                        _loadCurrent();
                        if (open) _loadAll(_showSidebar);
                    },
                });
            });
        }

        // ── Sidebar — collapsible sections ─────────────────────────────────────
        function _showSidebar(list) {
            let $sb = $("#ann-sidebar");
            if (!$sb.length) {
                $sb = $(`
                    <div class="ann-sidebar" id="ann-sidebar">
                        <div class="ann-sb-hdr">
                            <span class="ann-sb-title">${__("Annotations")}</span>
                            <button class="ann-sb-close" title="${__("Close")}">×</button>
                        </div>
                        <div class="ann-sb-hint">${__("Right-click to add · click a pin to edit")}</div>
                        <div class="ann-sb-body"></div>
                    </div>
                `).appendTo("body");
                $sb.find(".ann-sb-close").on("click", _closeSidebar);
            }

            const $body = $sb.find(".ann-sb-body").empty();
            $sb.addClass("ann-sidebar--open");

            if (!list.length) {
                $body.append(`<p class="ann-sb-empty">${__("No annotations yet.")}</p>`);
                return;
            }

            // Group by exact page_route (one section per page, not per doctype)
            const groups = new Map();
            list.forEach(ann => {
                if (!groups.has(ann.page_route)) groups.set(ann.page_route, []);
                groups.get(ann.page_route).push(ann);
            });

            // Auto-open the current page on first open
            if (_openSecs.size === 0) _openSecs.add(_route());

            const currentRoute = _route();

            groups.forEach((anns, route) => {
                const isOpen    = _openSecs.has(route);
                const open_anns = anns.filter(a => !a.resolved).length;

                // Build a readable label: "Contact › John Doe" or just "Overview"
                const parts = route.split("/");
                const sec   = _section(parts[0]);
                const label = parts.length > 1
                    ? `${sec} <span class="ann-sec-sub">› ${frappe.utils.escape_html(parts.slice(1).join("/"))}</span>`
                    : frappe.utils.escape_html(sec);

                // Section header
                const $hdr = $(`
                    <div class="ann-sec-hdr${isOpen ? " ann-sec-hdr--open" : ""}">
                        <span class="ann-sec-arrow">${isOpen ? "▾" : "▸"}</span>
                        <span class="ann-sec-name">${label}</span>
                        <span class="ann-sec-count">${open_anns || anns.length}</span>
                    </div>
                `).appendTo($body);

                // Section body
                const $secBody = $(`<div class="ann-sec-body"></div>`).appendTo($body);
                if (!isOpen) $secBody.hide();

                $hdr.on("click", () => {
                    const nowOpen = !_openSecs.has(route);
                    if (nowOpen) { _openSecs.add(route); $secBody.slideDown(160); }
                    else         { _openSecs.delete(route); $secBody.slideUp(160); }
                    $hdr.toggleClass("ann-sec-hdr--open", nowOpen);
                    $hdr.find(".ann-sec-arrow").text(nowOpen ? "▾" : "▸");
                });

                // Items
                anns.forEach((ann, i) => {
                    const color  = TAG_COLOR[ann.tag] || "#378ADD";
                    const onPage = ann.page_route === currentRoute;

                    const $item = $(`
                        <div class="ann-item${ann.resolved ? " ann-item--done" : ""}" data-name="${ann.name}">
                            <div class="ann-item-num" style="background:${color}">${i + 1}</div>
                            <div class="ann-item-body">
                                <div class="ann-item-preview">${frappe.utils.escape_html(ann.comment)}</div>
                            </div>
                            <div class="ann-item-acts">
                                <button class="ann-item-edit-btn" title="${__("Edit")}">✎</button>
                                <button class="ann-item-del-btn"  title="${__("Delete")}">🗑</button>
                            </div>
                        </div>
                    `).appendTo($secBody);

                    // Click item body → flash or navigate
                    $item.find(".ann-item-body").on("click", () => {
                        if (onPage) {
                            const idx = _currentAnns.findIndex(a => a.name === ann.name);
                            if (idx >= 0) _flashPin(idx);
                        } else {
                            _pendingFlash = ann.name;
                            frappe.set_route(ann.page_route.split("/"));
                        }
                    });

                    // Hover → preview-flash pin (current page only)
                    if (onPage) {
                        $item.on("mouseenter", () => {
                            const idx = _currentAnns.findIndex(a => a.name === ann.name);
                            if (idx >= 0) $overlay?.children(".ann-pin").eq(idx).addClass("ann-pin--highlight");
                        }).on("mouseleave", () => {
                            $overlay?.children(".ann-pin").removeClass("ann-pin--highlight");
                        });
                    }

                    $item.find(".ann-item-edit-btn").on("click", (e) => {
                        e.stopPropagation();
                        _openEditDialog(ann, i + 1);
                    });
                    $item.find(".ann-item-del-btn").on("click", (e) => {
                        e.stopPropagation();
                        _confirmDelete(ann);
                    });
                });
            });
        }

        // ── Log annotation as a project task ──────────────────────────────────
        const _DEFAULT_PROJECT = "Achi ERP — Intern Build";
        const _TAG_PRIORITY = {
            "Edit this": "Medium", "Remove this": "Medium", "Change this": "Medium",
            "Add here": "Low", "Note": "Low",
        };

        function _logToProject(tag, comment, page_route) {
            frappe.db.get_value("Project", { project_name: _DEFAULT_PROJECT }, "name", r => {
                if (!r?.name) return;
                const subject = `[${tag}] ${_section(page_route.split("/")[0])} — ${comment.substring(0, 80)}`;
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype:        "Task",
                            project:        r.name,
                            subject:        subject,
                            status:         "Open",
                            priority:       _TAG_PRIORITY[tag] || "Low",
                            assigned_to:    frappe.session.user,
                            description:    `Page: /app/${page_route}\n\n${comment}`,
                        },
                    },
                    // silent — don't block the annotation flow on failure
                    error() {},
                });
            });
        }

        // ── Add dialog ─────────────────────────────────────────────────────────
        function _openAddDialog(pos_x, pos_y) {
            const d = new frappe.ui.Dialog({
                title: __("New Annotation"),
                fields: [
                    { fieldname: "tag",     fieldtype: "Select",    label: __("Tag"),
                      options: "Note\nEdit this\nRemove this\nChange this\nAdd here",
                      default: "Note", reqd: 1 },
                    { fieldname: "comment", fieldtype: "Small Text", label: __("Comment"), reqd: 1 },
                ],
                primary_action_label: __("Add"),
                primary_action({ tag, comment }) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "UI Annotation",
                                page_route: _route(),
                                pos_x, pos_y, tag, comment,
                                author: frappe.session.user,
                            },
                        },
                        callback() {
                            frappe.show_alert({ message: __("Annotation added"), indicator: "green" }, 1.5);
                            d.hide();
                            _logToProject(tag, comment, _route());
                            _loadCurrent();
                            _loadAll(_showSidebar);
                        },
                    });
                },
            });
            d.show();
        }

        // ── Edit dialog ────────────────────────────────────────────────────────
        function _openEditDialog(ann, num) {
            const d = new frappe.ui.Dialog({
                title: `#${num} — ${frappe.utils.escape_html(ann.tag)}`,
                fields: [
                    { fieldname: "comment",  fieldtype: "Small Text", label: __("Comment"),
                      default: ann.comment, reqd: 1 },
                    { fieldname: "resolved", fieldtype: "Check", label: __("Mark as resolved"),
                      default: ann.resolved ? 1 : 0 },
                    { fieldname: "_meta",    fieldtype: "HTML",
                      options: `<p class="ann-meta">By <b>${frappe.utils.escape_html(ann.author)}</b> · ${frappe.datetime.str_to_user(ann.creation)}</p>` },
                ],
                primary_action_label: __("Save"),
                primary_action({ comment, resolved }) {
                    frappe.call({
                        method: "frappe.client.get",
                        args: { doctype: "UI Annotation", name: ann.name },
                        callback({ message: doc }) {
                            if (!doc) return;
                            doc.comment  = comment;
                            doc.resolved = resolved;
                            frappe.call({
                                method: "frappe.client.save",
                                args: { doc },
                                callback() {
                                    frappe.show_alert({ message: __("Saved"), indicator: "green" }, 1.5);
                                    d.hide();
                                    _loadCurrent();
                                    if (open) _loadAll(_showSidebar);
                                },
                            });
                        },
                    });
                },
            });
            d.show();
        }

        // ── Styles ─────────────────────────────────────────────────────────────
        const s = document.createElement("style");
        s.id = "adm-styles";
        s.textContent = `
.adm-ann-btn {
    position: fixed; bottom: 24px; right: 24px; z-index: 1040;
    width: 40px; height: 40px; border-radius: 50%; border: none;
    background: var(--card-bg, #fff); box-shadow: 0 2px 10px rgba(0,0,0,.14);
    font-size: 17px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: box-shadow .15s, transform .12s;
}
.adm-ann-btn:hover { box-shadow: 0 4px 18px rgba(0,0,0,.22); transform: scale(1.08); }
.adm-btn--active   { background: #378ADD !important; box-shadow: 0 4px 18px rgba(55,138,221,.4) !important; }

/* ── Overlay + pins ─────────────────────────────────────────────────────────── */
.ann-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 100; }

.ann-pin {
    position: absolute; width: 22px; height: 22px; border-radius: 50%;
    background: var(--pc, #378ADD); border: 2px solid rgba(255,255,255,.9);
    box-shadow: 0 2px 8px rgba(0,0,0,.22);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; pointer-events: auto;
    transform: translate(-50%,-50%);
    transition: transform .12s, box-shadow .12s; z-index: 101; user-select: none;
}
.ann-pin:hover,
.ann-pin--highlight { transform: translate(-50%,-50%) scale(1.35); box-shadow: 0 4px 16px rgba(0,0,0,.3); }
.ann-pin--done     { opacity: .35; }
.ann-pin--dragging { cursor: grabbing; transform: translate(-50%,-50%) scale(1.15); transition: none; }
.ann-n { font-size: 9px; font-weight: 700; color: #fff; user-select: none; line-height: 1; pointer-events: none; }

.ann-del {
    display: none; position: absolute; top: -6px; right: -6px;
    width: 14px; height: 14px; border-radius: 50%;
    background: #e74c3c; border: 1.5px solid #fff;
    color: #fff; font-size: 10px; line-height: 1; cursor: pointer;
    align-items: center; justify-content: center; padding: 0; z-index: 102;
}
.ann-pin:hover .ann-del { display: flex; }
.ann-del:hover { background: #c0392b; }

.ann-meta { font-size: 11px; color: var(--text-muted, #8d96a0); margin-top: 4px; }

/* ── Sidebar shell ──────────────────────────────────────────────────────────── */
.ann-sidebar {
    position: fixed; top: 0; right: -300px; width: 280px; height: 100vh;
    background: var(--card-bg, #fff);
    border-left: 1px solid var(--border-color, #e2e8f0);
    box-shadow: -6px 0 28px rgba(0,0,0,.12);
    z-index: 1060; display: flex; flex-direction: column;
    transition: right .22s cubic-bezier(.4,0,.2,1); overflow: hidden;
}
.ann-sidebar--open { right: 0; }

.ann-sb-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--border-color, #e2e8f0); flex-shrink: 0;
}
.ann-sb-title { font-size: 13px; font-weight: 600; color: var(--text-color, #1f272e); }
.ann-sb-close {
    border: none; background: none; font-size: 18px; line-height: 1;
    color: var(--text-muted, #8d96a0); cursor: pointer; padding: 0 2px;
}
.ann-sb-close:hover { color: var(--text-color, #1f272e); }
.ann-sb-hint {
    padding: 6px 14px; font-size: 11px; color: var(--text-muted, #8d96a0);
    background: var(--bg-light-gray, #f7f8fa);
    border-bottom: 1px solid var(--border-color, #e2e8f0); flex-shrink: 0;
}
.ann-sb-body  { flex: 1; overflow-y: auto; }
.ann-sb-empty { padding: 28px 16px; font-size: 13px; color: var(--text-muted, #8d96a0); text-align: center; }

/* ── Section header ─────────────────────────────────────────────────────────── */
.ann-sec-hdr {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 14px; cursor: pointer; user-select: none;
    border-bottom: 1px solid var(--border-color, #e8eaed);
    transition: background .1s;
}
.ann-sec-hdr:hover { background: var(--bg-light-gray, #f7f8fa); }
.ann-sec-hdr--open { border-bottom-color: transparent; }

.ann-sec-arrow { font-size: 10px; color: var(--text-muted, #adb5bd); width: 10px; flex-shrink: 0; }
.ann-sec-name  {
    flex: 1; font-size: 11px; font-weight: 600; letter-spacing: .05em;
    text-transform: uppercase; color: var(--text-color, #1f272e);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ann-sec-sub { font-weight: 400; letter-spacing: 0; color: var(--text-muted, #8d96a0); }
.ann-sec-count {
    font-size: 11px; font-weight: 500; color: var(--text-muted, #8d96a0);
    background: var(--bg-light-gray, #f0f2f5);
    border-radius: 10px; padding: 1px 7px;
}

/* ── Section body ───────────────────────────────────────────────────────────── */
.ann-sec-body { border-bottom: 1px solid var(--border-color, #e8eaed); }

/* ── Item row ───────────────────────────────────────────────────────────────── */
.ann-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 12px 7px 22px;
    border-bottom: 1px solid var(--border-color, #f3f4f5);
    transition: background .1s;
}
.ann-item:last-child { border-bottom: none; }
.ann-item:hover      { background: var(--bg-light-gray, #f7f8fa); }
.ann-item--done      { opacity: .45; }
.ann-item--done .ann-item-preview { text-decoration: line-through; }

.ann-item-num {
    flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,.18);
}
.ann-item-body {
    flex: 1; min-width: 0; cursor: pointer;
}
.ann-item-preview {
    font-size: 12px; color: var(--text-color, #1f272e);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
}
.ann-item-acts {
    display: flex; gap: 1px; flex-shrink: 0; opacity: 0; transition: opacity .1s;
}
.ann-item:hover .ann-item-acts { opacity: 1; }
.ann-item-edit-btn,
.ann-item-del-btn {
    border: none; background: none; cursor: pointer;
    font-size: 13px; padding: 3px 4px; border-radius: 4px;
    color: var(--text-muted, #8d96a0); transition: background .1s, color .1s; line-height: 1;
}
.ann-item-edit-btn:hover { background: #eef4ff; color: #378ADD; }
.ann-item-del-btn:hover  { background: #fdecea; color: #e74c3c; }

/* Crosshair when sidebar open */
body.adm-crosshair *                  { cursor: crosshair !important; }
body.adm-crosshair .adm-ann-btn,
body.adm-crosshair .ann-pin,
body.adm-crosshair .ann-del,
body.adm-crosshair #ann-sidebar *    { cursor: auto !important; }
body.adm-crosshair .ann-pin          { cursor: pointer !important; }
body.adm-crosshair .ann-pin--dragging { cursor: grabbing !important; }
body.adm-crosshair .ann-del          { cursor: pointer !important; }
body.adm-crosshair .frappe-dialog,
body.adm-crosshair .frappe-dialog *  { cursor: auto !important; }
        `;
        document.head.appendChild(s);
    }
})();
