// ui_annotations.js — admin annotation overlay
// Visible only to System Manager. Pins are draggable; hover shows × to delete.
"use strict";

(function () {
    // ── Bootstrap: fire once after login ───────────────────────────────────────
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
        let annotating  = false;
        let annotations = [];
        let $overlay    = null;

        // ── Floating toggle button ─────────────────────────────────────────────
        const $btn = $(`<button class="adm-ann-btn" title="${__("Toggle Annotations")}">💬</button>`).appendTo("body");

        $btn.on("click", () => {
            annotating = !annotating;
            $btn.toggleClass("adm-btn--active", annotating);
            $("body").toggleClass("adm-crosshair", annotating);
            annotating ? _load() : _clearPins();
        });

        // ── ESC exits annotation mode ──────────────────────────────────────────
        $(document).on("keydown.ann-esc", (e) => {
            if (e.key !== "Escape" || !annotating) return;
            annotating = false;
            $btn.removeClass("adm-btn--active");
            $("body").removeClass("adm-crosshair");
            _clearPins();
        });

        // ── Reload on route change ─────────────────────────────────────────────
        $(document).on("page-change.ann", () => {
            _clearPins();
            if (annotating) _load();
        });

        // ── Click on backdrop to place new annotation ──────────────────────────
        $(document).on("click.ann-place", (e) => {
            if (!annotating) return;
            if ($(e.target).closest(".adm-ann-btn, .frappe-dialog, .modal, .ann-overlay").length) return;

            const pos_x = +(e.clientX / window.innerWidth  * 100).toFixed(2);
            const pos_y = +(e.clientY / window.innerHeight * 100).toFixed(2);
            _openAddDialog(pos_x, pos_y);
        });

        // ── Helpers ────────────────────────────────────────────────────────────
        function _route() {
            try { return frappe.get_route().join("/"); } catch { return ""; }
        }

        function _load() {
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
                },
            });
        }

        function _clearPins() {
            if ($overlay) { $overlay.remove(); $overlay = null; }
        }

        const TAG_COLOR = {
            "Note":        "#378ADD",
            "Edit this":   "#e67e22",
            "Remove this": "#e74c3c",
            "Change this": "#8e44ad",
            "Add here":    "#27ae60",
        };

        // ── Render all pins ────────────────────────────────────────────────────
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

        // ── Per-pin events: drag + click to open + X to delete ─────────────────
        function _attachPinEvents($pin, ann, num) {
            const $del = $pin.find(".ann-del");

            // X button — confirm + delete
            $del.on("click", (e) => {
                e.stopPropagation();
                frappe.confirm(__("Delete this annotation?"), () => {
                    frappe.call({
                        method: "frappe.client.delete",
                        args: { doctype: "UI Annotation", name: ann.name },
                        callback() {
                            frappe.show_alert({ message: __("Annotation deleted"), indicator: "red" }, 1.5);
                            annotations = annotations.filter(a => a.name !== ann.name);
                            _renderPins();
                        },
                    });
                });
            });

            // Drag + click (distinguish by movement threshold)
            const THRESH = 5;
            let dragging = false, sX, sY, sPX, sPY;

            $pin.on("mousedown.drag", (e) => {
                if (e.target === $del[0]) return;
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
                        const nx = _clamp(sPX + dx / window.innerWidth  * 100);
                        const ny = _clamp(sPY + dy / window.innerHeight * 100);
                        $pin.css({ left: nx + "%", top: ny + "%" });
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
                    } else {
                        _openViewDialog(ann, num);
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

        // ── Add dialog ─────────────────────────────────────────────────────────
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
                            _load();
                        },
                    });
                },
            });
            d.show();
        }

        // ── View / edit dialog ─────────────────────────────────────────────────
        function _openViewDialog(ann, num) {
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
                                    _load();
                                },
                            });
                        },
                    });
                },
            });

            d.set_secondary_action(__("Delete"), () => {
                frappe.confirm(__("Delete this annotation?"), () => {
                    frappe.call({
                        method: "frappe.client.delete",
                        args: { doctype: "UI Annotation", name: ann.name },
                        callback() {
                            frappe.show_alert({ message: __("Annotation deleted"), indicator: "red" }, 1.5);
                            d.hide();
                            _load();
                        },
                    });
                });
            });

            d.show();
        }

        // ── Styles ─────────────────────────────────────────────────────────────
        const s = document.createElement("style");
        s.id = "adm-styles";
        s.textContent = `
/* Toggle button */
.adm-ann-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1040;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--card-bg, #fff);
    box-shadow: 0 2px 10px rgba(0,0,0,.14);
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow .15s, transform .12s;
    line-height: 1;
}
.adm-ann-btn:hover    { box-shadow: 0 4px 18px rgba(0,0,0,.22); transform: scale(1.08); }
.adm-btn--active      { background: #378ADD !important; box-shadow: 0 4px 18px rgba(55,138,221,.4) !important; }

/* Pin overlay (fixed, full viewport) */
.ann-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
}

/* Individual pin */
.ann-pin {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--pc, #378ADD);
    border: 2px solid rgba(255,255,255,.9);
    box-shadow: 0 2px 8px rgba(0,0,0,.22);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    pointer-events: auto;
    transform: translate(-50%, -50%);
    transition: transform .12s, box-shadow .12s;
    z-index: 101;
    user-select: none;
}
.ann-pin:hover      { transform: translate(-50%,-50%) scale(1.25); box-shadow: 0 4px 14px rgba(0,0,0,.3); }
.ann-pin--done      { opacity: .35; }
.ann-pin--dragging  { cursor: grabbing; transform: translate(-50%,-50%) scale(1.15); box-shadow: 0 6px 20px rgba(0,0,0,.3); transition: none; }
.ann-n {
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    user-select: none;
    line-height: 1;
    pointer-events: none;
}

/* × delete button — shows on hover */
.ann-del {
    display: none;
    position: absolute;
    top: -6px;
    right: -6px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #e74c3c;
    border: 1.5px solid #fff;
    color: #fff;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 102;
    font-family: sans-serif;
}
.ann-pin:hover .ann-del { display: flex; }
.ann-del:hover { background: #c0392b; transform: scale(1.15); }

/* Dialog meta line */
.ann-meta { font-size: 11px; color: var(--text-muted, #8d96a0); margin-top: 4px; }

/* Crosshair mode */
body.adm-crosshair *                 { cursor: crosshair !important; }
body.adm-crosshair .ann-pin          { cursor: grab      !important; }
body.adm-crosshair .ann-pin--dragging{ cursor: grabbing  !important; }
body.adm-crosshair .ann-del,
body.adm-crosshair .adm-ann-btn      { cursor: pointer   !important; }
body.adm-crosshair .frappe-dialog,
body.adm-crosshair .frappe-dialog *  { cursor: auto      !important; }
        `;
        document.head.appendChild(s);
    }
})();
