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
        let open        = false;
        let annotations = [];
        let $overlay    = null;

        const TAG_COLOR = {
            "Note":        "#378ADD",
            "Edit this":   "#e67e22",
            "Remove this": "#e74c3c",
            "Change this": "#8e44ad",
            "Add here":    "#27ae60",
        };

        // ── 💬 Toggle button ───────────────────────────────────────────────────
        const $btn = $(`<button class="adm-ann-btn" title="${__("Annotations")}">💬</button>`).appendTo("body");

        $btn.on("click", () => open ? _closeSidebar() : _openSidebar());

        // ── ESC closes sidebar ─────────────────────────────────────────────────
        $(document).on("keydown.ann-esc", (e) => {
            if (e.key === "Escape" && open) _closeSidebar();
        });

        // ── Route change ───────────────────────────────────────────────────────
        $(document).on("page-change.ann", () => {
            _clearPins();
            if (open) _load(_showSidebar);
        });

        // ── Right-click on page (sidebar open) → add annotation ───────────────
        $(document).on("contextmenu.ann", (e) => {
            if (!open) return;
            if ($(e.target).closest(".frappe-dialog, .modal, #ann-sidebar, .adm-ann-btn, .ann-overlay").length) return;
            e.preventDefault();
            const pos_x = +(e.clientX / window.innerWidth  * 100).toFixed(2);
            const pos_y = +(e.clientY / window.innerHeight * 100).toFixed(2);
            _openAddDialog(pos_x, pos_y);
        });

        // ── Helpers ────────────────────────────────────────────────────────────
        function _route() {
            try { return frappe.get_route().join("/"); } catch { return ""; }
        }

        function _load(cb) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "UI Annotation",
                    filters:  { page_route: _route() },
                    fields:   ["name","pos_x","pos_y","tag","comment","resolved","author","creation"],
                    limit_page_length: 500,
                },
                callback({ message }) {
                    annotations = message || [];
                    _renderPins();
                    if (cb) cb(annotations);
                },
            });
        }

        function _clearPins() {
            if ($overlay) { $overlay.remove(); $overlay = null; }
        }

        function _openSidebar() {
            open = true;
            $btn.addClass("adm-btn--active");
            $("body").addClass("adm-crosshair");
            _load(_showSidebar);
        }

        function _closeSidebar() {
            open = false;
            $btn.removeClass("adm-btn--active");
            $("body").removeClass("adm-crosshair");
            _clearPins();
            $("#ann-sidebar").removeClass("ann-sidebar--open");
        }

        // ── Render pins ────────────────────────────────────────────────────────
        function _renderPins() {
            _clearPins();
            if (!annotations.length) return;
            $overlay = $(`<div class="ann-overlay"></div>`).appendTo("body");
            annotations.forEach((ann, i) => {
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

        // ── Pin events: × delete, drag to move ────────────────────────────────
        function _attachPinEvents($pin, ann, num) {
            const $del = $pin.find(".ann-del");

            $del.on("click", (e) => {
                e.stopPropagation();
                _confirmDelete(ann);
            });

            // Drag (left mouse only)
            const THRESH = 5;
            let dragging = false, sX, sY, sPX, sPY;

            $pin.on("mousedown.drag", (e) => {
                if (e.button !== 0 || e.target === $del[0]) return;
                e.preventDefault();
                dragging = false;
                sX = e.clientX; sY = e.clientY;
                sPX = ann.pos_x; sPY = ann.pos_y;
                const ns = ".pin-" + ann.name;

                $(document).on("mousemove" + ns, (me) => {
                    const dx = me.clientX - sX, dy = me.clientY - sY;
                    if (!dragging && (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH)) {
                        dragging = true;
                        $pin.addClass("ann-pin--dragging");
                    }
                    if (dragging) {
                        $pin.css({
                            left: _clamp(sPX + dx / window.innerWidth  * 100) + "%",
                            top:  _clamp(sPY + dy / window.innerHeight * 100) + "%",
                        });
                    }
                });

                $(document).on("mouseup" + ns, (ue) => {
                    $(document).off("mousemove" + ns).off("mouseup" + ns);
                    $pin.removeClass("ann-pin--dragging");
                    if (dragging) {
                        const dx = ue.clientX - sX, dy = ue.clientY - sY;
                        ann.pos_x = _clamp(sPX + dx / window.innerWidth  * 100);
                        ann.pos_y = _clamp(sPY + dy / window.innerHeight * 100);
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

        function _confirmDelete(ann) {
            frappe.confirm(__("Delete this annotation?"), () => {
                frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: "UI Annotation", name: ann.name },
                    callback() {
                        frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.5);
                        _load(_showSidebar);
                    },
                });
            });
        }

        // ── Sidebar ────────────────────────────────────────────────────────────
        function _showSidebar(list) {
            let $sb = $("#ann-sidebar");
            if (!$sb.length) {
                $sb = $(`
                    <div class="ann-sidebar" id="ann-sidebar">
                        <div class="ann-sb-hdr">
                            <span class="ann-sb-title"></span>
                            <button class="ann-sb-close" title="${__("Close")}">×</button>
                        </div>
                        <div class="ann-sb-hint">${__("Right-click anywhere to add a pin")}</div>
                        <div class="ann-sb-body"></div>
                    </div>
                `).appendTo("body");
                $sb.find(".ann-sb-close").on("click", _closeSidebar);
            }

            const nOpen     = list.filter(a => !a.resolved).length;
            const nResolved = list.filter(a =>  a.resolved).length;
            const parts = [`${nOpen} ${__("open")}`];
            if (nResolved) parts.push(`${nResolved} ${__("resolved")}`);
            $sb.find(".ann-sb-title").text(`${__("Annotations")} (${parts.join(", ")})`);

            const $body = $sb.find(".ann-sb-body").empty();

            if (!list.length) {
                $body.append(`<p class="ann-sb-empty">${__("Right-click anywhere to add the first annotation.")}</p>`);
            } else {
                list.forEach((ann, i) => {
                    const color = TAG_COLOR[ann.tag] || "#378ADD";
                    const date  = frappe.datetime.prettyDate(ann.creation);
                    const $item = $(`
                        <div class="ann-sb-item${ann.resolved ? " ann-sb-item--done" : ""}" data-name="${ann.name}">
                            <div class="ann-sb-dot" style="background:${color}"><span>${i + 1}</span></div>
                            <div class="ann-sb-info">
                                <div class="ann-sb-tag">${frappe.utils.escape_html(ann.tag || "Note")}</div>
                                <div class="ann-sb-cmt">${frappe.utils.escape_html(ann.comment)}</div>
                                <div class="ann-sb-meta">${frappe.utils.escape_html(ann.author)} · ${date}</div>
                            </div>
                            <div class="ann-sb-acts">
                                <button class="ann-sb-edit-btn" title="${__("Edit")}">✎</button>
                                <button class="ann-sb-del-btn"  title="${__("Delete")}">🗑</button>
                            </div>
                        </div>
                    `).appendTo($body);

                    // Flash pin on row hover
                    $item.on("mouseenter", () => _flashPin(i))
                         .on("mouseleave", () => _unflashPin(i));

                    $item.find(".ann-sb-edit-btn").on("click", (e) => {
                        e.stopPropagation();
                        _openEditDialog(ann, i + 1);
                    });

                    $item.find(".ann-sb-del-btn").on("click", (e) => {
                        e.stopPropagation();
                        _confirmDelete(ann);
                    });
                });
            }

            $sb.addClass("ann-sidebar--open");
        }

        function _flashPin(idx) {
            if (!$overlay) return;
            $overlay.children(".ann-pin").eq(idx).addClass("ann-pin--highlight");
        }
        function _unflashPin(idx) {
            if (!$overlay) return;
            $overlay.children(".ann-pin").eq(idx).removeClass("ann-pin--highlight");
        }

        // ── Add dialog (right-click) ───────────────────────────────────────────
        function _openAddDialog(pos_x, pos_y) {
            const d = new frappe.ui.Dialog({
                title: __("New Annotation"),
                fields: [
                    {
                        fieldname: "tag",
                        fieldtype: "Select",
                        label:     __("Tag"),
                        options:   "Note\nEdit this\nRemove this\nChange this\nAdd here",
                        default:   "Note",
                        reqd: 1,
                    },
                    {
                        fieldname: "comment",
                        fieldtype: "Small Text",
                        label:     __("Comment"),
                        reqd: 1,
                    },
                ],
                primary_action_label: __("Add"),
                primary_action({ tag, comment }) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype:    "UI Annotation",
                                page_route: _route(),
                                pos_x, pos_y, tag, comment,
                                author: frappe.session.user,
                            },
                        },
                        callback() {
                            frappe.show_alert({ message: __("Annotation added"), indicator: "green" }, 1.5);
                            d.hide();
                            _load(_showSidebar);
                        },
                    });
                },
            });
            d.show();
        }

        // ── Edit dialog (from sidebar) ─────────────────────────────────────────
        function _openEditDialog(ann, num) {
            const d = new frappe.ui.Dialog({
                title: `#${num} — ${ann.tag}`,
                fields: [
                    {
                        fieldname: "comment",
                        fieldtype: "Small Text",
                        label:     __("Comment"),
                        default:   ann.comment,
                        reqd: 1,
                    },
                    {
                        fieldname: "resolved",
                        fieldtype: "Check",
                        label:     __("Mark as resolved"),
                        default:   ann.resolved ? 1 : 0,
                    },
                    {
                        fieldname: "_meta",
                        fieldtype: "HTML",
                        options:   `<p class="ann-meta">By <b>${frappe.utils.escape_html(ann.author)}</b> · ${frappe.datetime.str_to_user(ann.creation)}</p>`,
                    },
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
                                    _load(_showSidebar);
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
    background: var(--card-bg, #fff);
    box-shadow: 0 2px 10px rgba(0,0,0,.14);
    font-size: 17px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: box-shadow .15s, transform .12s; line-height: 1;
}
.adm-ann-btn:hover { box-shadow: 0 4px 18px rgba(0,0,0,.22); transform: scale(1.08); }
.adm-btn--active   { background: #378ADD !important; box-shadow: 0 4px 18px rgba(55,138,221,.4) !important; }

.ann-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 100; }

.ann-pin {
    position: absolute; width: 22px; height: 22px; border-radius: 50%;
    background: var(--pc, #378ADD); border: 2px solid rgba(255,255,255,.9);
    box-shadow: 0 2px 8px rgba(0,0,0,.22);
    display: flex; align-items: center; justify-content: center;
    cursor: grab; pointer-events: auto;
    transform: translate(-50%,-50%);
    transition: transform .12s, box-shadow .12s; z-index: 101; user-select: none;
}
.ann-pin:hover,
.ann-pin--highlight { transform: translate(-50%,-50%) scale(1.35); box-shadow: 0 4px 16px rgba(0,0,0,.3); }
.ann-pin--done      { opacity: .35; }
.ann-pin--dragging  { cursor: grabbing; transform: translate(-50%,-50%) scale(1.15); transition: none; }
.ann-n { font-size: 9px; font-weight: 700; color: #fff; user-select: none; line-height: 1; pointer-events: none; }

.ann-del {
    display: none; position: absolute; top: -6px; right: -6px;
    width: 14px; height: 14px; border-radius: 50%;
    background: #e74c3c; border: 1.5px solid #fff;
    color: #fff; font-size: 10px; line-height: 1; cursor: pointer;
    align-items: center; justify-content: center; padding: 0;
    z-index: 102; font-family: sans-serif;
}
.ann-pin:hover .ann-del { display: flex; }
.ann-del:hover { background: #c0392b; }

.ann-meta { font-size: 11px; color: var(--text-muted, #8d96a0); margin-top: 4px; }

/* ── Sidebar ───────────────────────────────────────────────────────────────── */
.ann-sidebar {
    position: fixed; top: 0; right: -340px;
    width: 320px; height: 100vh;
    background: var(--card-bg, #fff);
    border-left: 1px solid var(--border-color, #e2e8f0);
    box-shadow: -6px 0 28px rgba(0,0,0,.12);
    z-index: 1060;
    display: flex; flex-direction: column;
    transition: right .22s cubic-bezier(.4,0,.2,1); overflow: hidden;
}
.ann-sidebar--open { right: 0; }

.ann-sb-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--border-color, #e2e8f0); flex-shrink: 0;
}
.ann-sb-title {
    flex: 1; font-size: 13px; font-weight: 600;
    color: var(--text-color, #1f272e); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ann-sb-close {
    border: none; background: none; font-size: 18px; line-height: 1;
    color: var(--text-muted, #8d96a0); cursor: pointer; padding: 0 2px;
    transition: color .1s; flex-shrink: 0;
}
.ann-sb-close:hover { color: var(--text-color, #1f272e); }

.ann-sb-hint {
    padding: 7px 16px; font-size: 11px;
    color: var(--text-muted, #8d96a0);
    background: var(--bg-light-gray, #f7f8fa);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    flex-shrink: 0;
}

.ann-sb-body { flex: 1; overflow-y: auto; padding: 6px 0; }
.ann-sb-empty { padding: 28px 16px; font-size: 13px; color: var(--text-muted, #8d96a0); text-align: center; }

.ann-sb-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px 10px 16px;
    border-bottom: 1px solid var(--border-color, #f0f2f5);
    transition: background .1s;
}
.ann-sb-item:hover      { background: var(--bg-light-gray, #f7f8fa); }
.ann-sb-item--done      { opacity: .5; }
.ann-sb-item--done .ann-sb-cmt { text-decoration: line-through; }

.ann-sb-dot {
    flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; margin-top: 1px;
}
.ann-sb-dot span { font-size: 9px; font-weight: 700; color: #fff; line-height: 1; }

.ann-sb-info { flex: 1; min-width: 0; }
.ann-sb-tag  {
    font-size: 10px; font-weight: 600; color: var(--text-muted, #8d96a0);
    text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px;
}
.ann-sb-cmt  {
    font-size: 13px; color: var(--text-color, #1f272e);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
}
.ann-sb-meta { font-size: 11px; color: var(--text-muted, #8d96a0); margin-top: 3px; }

.ann-sb-acts { display: flex; align-items: center; gap: 2px; flex-shrink: 0; opacity: 0; transition: opacity .1s; }
.ann-sb-item:hover .ann-sb-acts { opacity: 1; }
.ann-sb-edit-btn,
.ann-sb-del-btn {
    border: none; background: none; cursor: pointer;
    font-size: 14px; padding: 3px 4px; border-radius: 4px;
    color: var(--text-muted, #8d96a0); transition: background .1s, color .1s;
    line-height: 1;
}
.ann-sb-edit-btn:hover { background: var(--bg-light-gray, #eef); color: #378ADD; }
.ann-sb-del-btn:hover  { background: #fdecea; color: #e74c3c; }

/* Crosshair when sidebar open */
body.adm-crosshair *                 { cursor: crosshair !important; }
body.adm-crosshair .adm-ann-btn,
body.adm-crosshair .ann-pin,
body.adm-crosshair .ann-del,
body.adm-crosshair #ann-sidebar *   { cursor: auto !important; }
body.adm-crosshair .ann-pin         { cursor: grab !important; }
body.adm-crosshair .ann-pin--dragging { cursor: grabbing !important; }
body.adm-crosshair .ann-del         { cursor: pointer !important; }
body.adm-crosshair .frappe-dialog,
body.adm-crosshair .frappe-dialog * { cursor: auto !important; }
        `;
        document.head.appendChild(s);
    }
})();
