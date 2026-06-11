// frappe_drawing.js — Standalone AutoCAD-style drawing dialog
// Usage:
//   frappe_drawing.open({
//     doctype,          // e.g. "Site Survey"
//     docname,          // record name
//     drawing_field,    // fieldname that stores the JSON (default: "drawing")
//     has_drawing_field,// fieldname for the boolean flag  (default: "has_drawing")
//     on_saved,         // fn(hasShapes) called after a successful save
//   });

"use strict";

window.frappe_drawing = (() => {

    const GRID       = 20; // px between snap points
    const DRAW_UNITS = { "m": 1, "cm": 100, "mm": 1000, "ft": 3.28084, "in": 39.3701 };

    const SVG_PENCIL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    const SVG_RULER  = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`;

    // ── Public render helper (button cell for list views) ─────────────────────
    function render_btn(name, hasDrawing) {
        const cls = hasDrawing
            ? "fd-icon-btn fd-draw-btn fd-draw-btn--has"
            : "fd-icon-btn fd-draw-btn";
        const title = hasDrawing ? __("Edit drawing") : __("Add drawing");
        return `<button class="${cls}" data-name="${name}" title="${title}">${SVG_PENCIL}</button>`;
    }

    // ── JSON parse helper ─────────────────────────────────────────────────────
    function parse(raw) {
        if (!raw) return { shapes: [], scale: null };
        try {
            const p = JSON.parse(raw);
            if ((p?.version === 2 || p?.version === 3) && Array.isArray(p.shapes)) {
                return { shapes: p.shapes, scale: p.scale || null };
            }
        } catch { /* fall through */ }
        return { shapes: [], scale: null, _legacy_jpeg: raw };
    }

    // ── Main entry point ──────────────────────────────────────────────────────
    function open(opts) {
        const {
            doctype,
            docname,
            drawing_field     = "drawing",
            has_drawing_field = "has_drawing",
            on_saved          = null,
        } = opts;

        frappe.db.get_value(doctype, docname, drawing_field, (r) => {
            _show(doctype, docname, drawing_field, has_drawing_field, on_saved, r?.[drawing_field] || "");
        });
    }

    // ── Dialog ────────────────────────────────────────────────────────────────
    function _show(doctype, docname, drawing_field, has_drawing_field, on_saved, existingData) {
        const saved  = parse(existingData);
        let shapes   = saved.shapes;
        const scale  = saved.scale && saved.scale.pxPerMeter > 0
            ? { pxPerMeter: saved.scale.pxPerMeter, unit: DRAW_UNITS[saved.scale.unit] ? saved.scale.unit : "m" }
            : { pxPerMeter: GRID, unit: "m" };

        let displayPxPerMeter = scale.pxPerMeter;
        let scaleAnimFrame    = null;
        let history           = [];

        const saveState = () => {
            const json = JSON.stringify(shapes);
            if (!history.length || history[history.length - 1] !== json) history.push(json);
        };

        let tool                 = "line";
        let color                = "#1f272e";
        let selectedShapeIndices = [];
        let transformState       = null;
        let draftShape           = null;
        let boxSelectDraft       = null;
        let textInputEl          = null;
        let propsPanelEl         = null;
        let chainStart           = null;
        let anchorJustPlaced     = false;
        let pointerDown          = false;
        let downPos              = null;
        let pointerMoved         = false;
        let freeDrawing          = false;
        let freePoints           = [];
        let eraseMode            = false;
        let eraseModeSaved       = false;
        let dimDraft             = null;
        let dimDragIdx           = null;
        let dimHitWasLabel       = false;
        let _valInputEl          = null;
        let _valShapeIdx         = null;

        const dialog = new frappe.ui.Dialog({
            title: __("Drawing — {0}", [docname]),
            size:  "extra-large",
            fields: [{ fieldname: "draw_wrap", fieldtype: "HTML" }],
            primary_action_label: __("Save"),
            primary_action() {
                const payload = JSON.stringify({ version: 3, shapes, scale: { pxPerMeter: scale.pxPerMeter, unit: scale.unit } });
                frappe.call({
                    method: "frappe.client.set_value",
                    args: { doctype, name: docname, fieldname: drawing_field, value: payload },
                    callback: ({ exc }) => {
                        if (exc) return;
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: { doctype, name: docname, fieldname: has_drawing_field, value: shapes.length ? 1 : 0 },
                            callback: () => {
                                frappe.show_alert({ message: __("Drawing saved"), indicator: "green" }, 1.0);
                                if (on_saved) on_saved(shapes.length > 0);
                                dialog.hide();
                            },
                        });
                    },
                });
            },
        });

        dialog.show();
        const $wrap  = dialog.fields_dict.draw_wrap.$wrapper;
        const unitOpts = Object.keys(DRAW_UNITS).map(u =>
            `<option value="${u}"${u === scale.unit ? " selected" : ""}>${u}</option>`
        ).join("");

        $wrap.html(`
            <div class="fd-draw-dialog">
                <div class="fd-draw-toolbar">
                    <div class="fd-draw-tools">
                        <button class="fd-draw-tool" data-tool="select" title="${__("Select / move / scale")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                        </button>
                        <button class="fd-draw-tool fd-draw-tool--active" data-tool="line" title="${__("Draw lines")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="rect" title="${__("Draw rectangle")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="circle" title="${__("Draw circle")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="text" title="${__("Add text")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="freehand" title="${__("Freehand draw")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 Q7 10 10 14 Q13 18 16 10 Q19 2 21 8"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="eraser" title="${__("Eraser")}">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l11-11 6 6-4.5 4.5"/><path d="M6.5 17.5l4-4"/></svg>
                        </button>
                        <button class="fd-draw-tool" data-tool="measure" title="${__("Dimension")}">
                            ${SVG_RULER}
                        </button>
                        <div class="fd-draw-sep"></div>
                        <button class="fd-draw-tool fd-draw-color-btn fd-draw-color-active" data-color="#1f272e" title="Black"><span class="fd-draw-swatch" style="background:#1f272e"></span></button>
                        <button class="fd-draw-tool fd-draw-color-btn" data-color="#e74c3c" title="Red"><span class="fd-draw-swatch" style="background:#e74c3c"></span></button>
                        <button class="fd-draw-tool fd-draw-color-btn" data-color="#378ADD" title="Blue"><span class="fd-draw-swatch" style="background:#378ADD"></span></button>
                        <button class="fd-draw-tool fd-draw-color-btn" data-color="#27ae60" title="Green"><span class="fd-draw-swatch" style="background:#27ae60"></span></button>
                        <button class="fd-draw-tool fd-draw-color-btn" data-color="#f39c12" title="Orange"><span class="fd-draw-swatch" style="background:#f39c12"></span></button>
                        <div class="fd-draw-sep"></div>
                        <select class="fd-draw-unit" title="${__("Display unit")}">${unitOpts}</select>
                        <button class="fd-draw-undo-btn" title="${__("Undo")}">${__("Undo")}</button>
                    </div>
                    <button class="fd-draw-clear-btn">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                        ${__("Clear")}
                    </button>
                </div>
                <div class="fd-draw-canvas-wrap">
                    <canvas class="fd-draw-canvas"></canvas>
                </div>
            </div>`);

        _inject_styles();

        const canvas = $wrap.find(".fd-draw-canvas")[0];
        const wrapEl = $wrap.find(".fd-draw-canvas-wrap")[0];
        const dpr    = window.devicePixelRatio || 1;
        const cssW   = Math.max(wrapEl.offsetWidth || 800, 600);
        const cssH   = Math.round(cssW * 0.52);

        canvas.style.width  = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width        = Math.round(cssW * dpr);
        canvas.height       = Math.round(cssH * dpr);

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);

        if (saved._legacy_jpeg) {
            const img = new Image();
            img.onload = () => { ctx.drawImage(img, 0, 0, cssW, cssH); render(); };
            img.src = saved._legacy_jpeg;
        }

        // ── coordinate / snap helpers ─────────────────────────────────────────
        const canvasPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const src  = (e.touches && e.touches.length) ? e.touches[0]
                : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
                : e;
            return { x: src.clientX - rect.left, y: src.clientY - rect.top };
        };
        const snap    = (v)  => Math.round(v / GRID) * GRID;
        const snapPt  = (pt) => ({ x: snap(pt.x), y: snap(pt.y) });
        const snapDimPt = (raw) => {
            let best = null, bd = 14;
            for (const s of shapes) {
                if (s.type !== "line") continue;
                for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
                    const d = Math.hypot(raw.x - px, raw.y - py);
                    if (d < bd) { bd = d; best = { x: px, y: py }; }
                }
            }
            return best || snapPt(raw);
        };

        // ── geometry ─────────────────────────────────────────────────────────
        const distSeg = (px, py, ax, ay, bx, by) => {
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            if (!len2) return Math.hypot(px - ax, py - ay);
            const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
            return Math.hypot(px - ax - t * dx, py - ay - t * dy);
        };

        const getBBox = (s) => {
            if (!s) return null;
            if (s.type === "line" || s.type === "dim") return { minX: Math.min(s.x1, s.x2), minY: Math.min(s.y1, s.y2), maxX: Math.max(s.x1, s.x2), maxY: Math.max(s.y1, s.y2) };
            if (s.type === "rect")     return { minX: Math.min(s.x, s.x + s.w), minY: Math.min(s.y, s.y + s.h), maxX: Math.max(s.x, s.x + s.w), maxY: Math.max(s.y, s.y + s.h) };
            if (s.type === "circle")   return { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r };
            if (s.type === "freehand") {
                if (!s.points.length) return null;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const p of s.points) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
                return { minX, minY, maxX, maxY };
            }
            if (s.type === "text") {
                ctx.save(); ctx.font = s.font || "14px sans-serif";
                const m = ctx.measureText(s.text); ctx.restore();
                return { minX: s.x, minY: s.y - 14, maxX: s.x + m.width, maxY: s.y + 4 };
            }
            return null;
        };

        const getGroupBBox = (indices) => {
            if (!indices?.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const idx of indices) {
                const bb = getBBox(shapes[idx]);
                if (bb) { if (bb.minX < minX) minX = bb.minX; if (bb.minY < minY) minY = bb.minY; if (bb.maxX > maxX) maxX = bb.maxX; if (bb.maxY > maxY) maxY = bb.maxY; }
            }
            return minX === Infinity ? null : { minX, minY, maxX, maxY };
        };

        const dimGeom = (s) => {
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            const nx = -uy, ny = ux;
            const off = typeof s.offset === "number" ? s.offset : 26;
            return { len, ux, uy, nx, ny, off,
                ax: s.x1 + nx * off, ay: s.y1 + ny * off,
                bx: s.x2 + nx * off, by: s.y2 + ny * off,
                mx: (s.x1 + s.x2) / 2 + nx * off,
                my: (s.y1 + s.y2) / 2 + ny * off };
        };

        const dimText = (lenPx) => {
            const val     = (lenPx / displayPxPerMeter) * DRAW_UNITS[scale.unit];
            const rounded = Math.round(val * 100) / 100;
            return `${rounded} ${scale.unit}`;
        };

        const hitShape = (x, y, s, tol = 10) => {
            if (s.type === "line") return distSeg(x, y, s.x1, s.y1, s.x2, s.y2) < tol;
            if (s.type === "freehand") {
                for (let i = 1; i < s.points.length; i++) {
                    const [ax, ay] = s.points[i - 1], [bx, by] = s.points[i];
                    if (distSeg(x, y, ax, ay, bx, by) < tol) return true;
                }
                return false;
            }
            if (s.type === "dim") return hitDim(x, y, s).hit;
            if (s.type === "rect") {
                const minX = Math.min(s.x, s.x + s.w), maxX = Math.max(s.x, s.x + s.w);
                const minY = Math.min(s.y, s.y + s.h), maxY = Math.max(s.y, s.y + s.h);
                return x >= minX - tol && x <= maxX + tol && y >= minY - tol && y <= maxY + tol;
            }
            if (s.type === "circle") return Math.hypot(x - s.x, y - s.y) <= s.r + tol;
            if (s.type === "text") {
                const bb = getBBox(s);
                return bb && x >= bb.minX - tol && x <= bb.maxX + tol && y >= bb.minY - tol && y <= bb.maxY + tol;
            }
            return false;
        };

        const hitDim = (x, y, s) => {
            const g = dimGeom(s);
            ctx.save(); ctx.font = "bold 11px sans-serif";
            const tw = ctx.measureText(dimText(g.len)).width; ctx.restore();
            const onLabel = Math.abs(x - g.mx) < tw / 2 + 8 && Math.abs(y - g.my) < 12;
            const onLine  = distSeg(x, y, g.ax, g.ay, g.bx, g.by) < 9;
            return { hit: onLabel || onLine, label: onLabel };
        };

        const checkOverlap = (box, s) => {
            const bb = getBBox(s); if (!bb) return false;
            const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2);
            const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2);
            return !(bb.minX > maxX || bb.maxX < minX || bb.minY > maxY || bb.maxY < minY);
        };

        // ── rendering ─────────────────────────────────────────────────────────
        const drawArrow = (x, y, ux, uy, c) => {
            const sz = 9, w = 3.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + ux * sz - (-uy) * w, y + uy * sz - ux * w);
            ctx.lineTo(x + ux * sz + (-uy) * w, y + uy * sz + ux * w);
            ctx.closePath(); ctx.fillStyle = c; ctx.fill();
        };

        const drawDim = (s, hl, ghost) => {
            const g = dimGeom(s);
            const c = hl ? "#f39c12" : (s.color || "#1f272e");
            ctx.save(); ctx.globalAlpha = ghost ? 0.5 : 1;
            ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(s.x1 + g.nx * 4, s.y1 + g.ny * 4);
            ctx.lineTo(s.x1 + g.nx * (g.off + (g.off >= 0 ? 5 : -5)), s.y1 + g.ny * (g.off + (g.off >= 0 ? 5 : -5)));
            ctx.moveTo(s.x2 + g.nx * 4, s.y2 + g.ny * 4);
            ctx.lineTo(s.x2 + g.nx * (g.off + (g.off >= 0 ? 5 : -5)), s.y2 + g.ny * (g.off + (g.off >= 0 ? 5 : -5)));
            ctx.stroke();
            ctx.beginPath(); ctx.moveTo(g.ax, g.ay); ctx.lineTo(g.bx, g.by); ctx.stroke();
            drawArrow(g.ax, g.ay, g.ux, g.uy, c);
            drawArrow(g.bx, g.by, -g.ux, -g.uy, c);
            const text = dimText(g.len);
            ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            const tw = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(g.mx - tw / 2 - 5, g.my - 9, tw + 10, 18);
            ctx.fillStyle = c; ctx.fillText(text, g.mx, g.my);
            ctx.restore();
        };

        const drawSelectionBox = (bb) => {
            if (!bb) return;
            ctx.save(); ctx.strokeStyle = "#378ADD"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            const pad = 4;
            ctx.strokeRect(bb.minX - pad, bb.minY - pad, bb.maxX - bb.minX + pad * 2, bb.maxY - bb.minY + pad * 2);
            ctx.setLineDash([]); ctx.fillStyle = "#fff";
            const handles = [[bb.minX - pad, bb.minY - pad], [bb.maxX + pad, bb.minY - pad], [bb.minX - pad, bb.maxY + pad], [bb.maxX + pad, bb.maxY + pad]];
            for (const [hx, hy] of handles) { ctx.fillRect(hx - 4, hy - 4, 8, 8); ctx.strokeRect(hx - 4, hy - 4, 8, 8); }
            ctx.restore();
        };

        const drawShape = (s, hl, ghost) => {
            if (s.type === "dim") { drawDim(s, hl, ghost); return; }
            ctx.save(); ctx.globalAlpha = ghost ? 0.45 : 1;
            ctx.strokeStyle = hl ? "#f39c12" : s.color; ctx.fillStyle = hl ? "#f39c12" : s.color;
            ctx.lineWidth = hl ? 3 : 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
            if (s.type === "line") {
                ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
                [[s.x1, s.y1], [s.x2, s.y2]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); });
            } else if (s.type === "freehand") {
                ctx.beginPath(); s.points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
            } else if (s.type === "rect") {
                ctx.strokeRect(s.x, s.y, s.w, s.h);
                ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
            } else if (s.type === "circle") {
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
            } else if (s.type === "text") {
                ctx.font = s.font || "14px sans-serif"; ctx.textBaseline = "top"; ctx.fillText(s.text, s.x, s.y);
            }
            if (s.height || s.floors) {
                const bb = getBBox(s);
                if (bb) {
                    const label = `${s.height ? s.height + "m" : ""}${s.height && s.floors ? " | " : ""}${s.floors ? s.floors + " fl" : ""}`;
                    ctx.font = "bold 10px sans-serif";
                    const tw = ctx.measureText(label).width;
                    const bx = bb.maxX - tw, by = bb.maxY + 6;
                    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(bx - 4, by - 2, tw + 8, 14);
                    ctx.fillStyle = s.color || "#1f272e"; ctx.fillText(label, bx, by + 9);
                }
            }
            ctx.restore();
        };

        const render = (ghost) => {
            ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cssW, cssH);
            ctx.fillStyle = "#d0d5dd";
            for (let gx = 0; gx <= cssW; gx += GRID) for (let gy = 0; gy <= cssH; gy += GRID) { ctx.beginPath(); ctx.arc(gx, gy, 1.3, 0, Math.PI * 2); ctx.fill(); }
            shapes.forEach((s, i) => drawShape(s, i === _valShapeIdx || selectedShapeIndices.includes(i), false));
            if (ghost) drawShape(ghost, false, true);
            if (selectedShapeIndices.length > 0) drawSelectionBox(getGroupBBox(selectedShapeIndices));
            if (boxSelectDraft) {
                ctx.save(); ctx.fillStyle = "rgba(55,138,221,0.15)"; ctx.strokeStyle = "#378ADD"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
                const x = Math.min(boxSelectDraft.x1, boxSelectDraft.x2), y = Math.min(boxSelectDraft.y1, boxSelectDraft.y2);
                const w = Math.abs(boxSelectDraft.x2 - boxSelectDraft.x1), h = Math.abs(boxSelectDraft.y2 - boxSelectDraft.y1);
                ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.restore();
            }
            if (tool === "line" && chainStart) {
                ctx.beginPath(); ctx.arc(chainStart.x, chainStart.y, 5, 0, Math.PI * 2);
                ctx.strokeStyle = "#378ADD"; ctx.lineWidth = 1.5; ctx.stroke();
            }
            ctx.restore();
        };

        render();

        // ── scale animation ───────────────────────────────────────────────────
        const animateScaleTo = (target) => {
            if (scaleAnimFrame) cancelAnimationFrame(scaleAnimFrame);
            const start = displayPxPerMeter, t0 = performance.now(), dur = 420;
            const step = (t) => {
                const k = Math.min(1, (t - t0) / dur);
                displayPxPerMeter = start + (target - start) * (1 - Math.pow(1 - k, 3));
                render();
                if (k < 1) { scaleAnimFrame = requestAnimationFrame(step); }
                else { scale.pxPerMeter = target; displayPxPerMeter = target; scaleAnimFrame = null; render(); }
            };
            scaleAnimFrame = requestAnimationFrame(step);
        };

        // ── overlays ──────────────────────────────────────────────────────────
        const removeOverlayInputs = () => {
            if (_valInputEl?.parentNode)  _valInputEl.parentNode.removeChild(_valInputEl);
            if (textInputEl?.parentNode)  textInputEl.parentNode.removeChild(textInputEl);
            _valInputEl = null; _valShapeIdx = null; textInputEl = null;
        };

        const showValInput = (idx) => {
            removeOverlayInputs(); _valShapeIdx = idx;
            const s = shapes[idx], g = dimGeom(s);
            const inp = document.createElement("input");
            inp.type = "text"; inp.inputMode = "decimal"; inp.placeholder = "e.g. 2.5";
            inp.value = String(Math.round((g.len / displayPxPerMeter) * DRAW_UNITS[scale.unit] * 100) / 100);
            inp.style.cssText = `position:absolute;left:${g.mx - 42}px;top:${g.my - 14}px;width:84px;font-size:12px;font-weight:600;border:2px solid #f39c12;border-radius:5px;padding:2px 4px;text-align:center;background:#fffbe6;color:#333;box-shadow:0 2px 8px rgba(0,0,0,.22);z-index:20;`;
            wrapEl.style.position = "relative"; wrapEl.appendChild(inp); _valInputEl = inp; inp.focus(); inp.select();
            const commit = () => {
                const v = parseFloat(inp.value), wasIdx = _valShapeIdx;
                removeOverlayInputs();
                if (wasIdx !== null && shapes[wasIdx] && !isNaN(v) && v > 0) {
                    animateScaleTo(dimGeom(shapes[wasIdx]).len / (v / DRAW_UNITS[scale.unit]));
                } else { render(); }
            };
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.stopPropagation(); commit(); } if (e.key === "Escape") { e.stopPropagation(); removeOverlayInputs(); render(); } });
            inp.addEventListener("blur", commit);
            render();
        };

        const showTextInput = (x, y) => {
            removeOverlayInputs(); hidePropsPanel(); selectedShapeIndices = [];
            const inp = document.createElement("input");
            inp.type = "text"; inp.placeholder = "Enter text...";
            inp.style.cssText = `position:absolute;left:${x}px;top:${y - 10}px;font-size:14px;font-family:sans-serif;border:1px solid #378ADD;border-radius:4px;padding:4px 6px;background:#fff;z-index:20;outline:none;`;
            wrapEl.style.position = "relative"; wrapEl.appendChild(inp); textInputEl = inp; inp.focus();
            const commit = () => {
                const val = inp.value.trim(); removeOverlayInputs();
                if (val) { saveState(); shapes.push({ type: "text", text: val, x, y, font: "14px sans-serif", color }); }
                render();
            };
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.stopPropagation(); commit(); } if (e.key === "Escape") { e.stopPropagation(); removeOverlayInputs(); render(); } });
            inp.addEventListener("blur", commit);
        };

        const hidePropsPanel = () => {
            if (propsPanelEl?.parentNode) propsPanelEl.parentNode.removeChild(propsPanelEl);
            propsPanelEl = null;
        };

        const showPropsPanel = () => {
            hidePropsPanel();
            if (selectedShapeIndices.length !== 1) return;
            const idx = selectedShapeIndices[0], s = shapes[idx];
            if (!s) return;
            const bb = getBBox(s); if (!bb) return;
            const panel = document.createElement("div");
            panel.style.cssText = `position:absolute;left:${bb.maxX + 15}px;top:${bb.minY}px;background:#fff;border:1px solid var(--border-color,#e2e6ea);border-radius:8px;padding:10px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:30;display:flex;flex-direction:column;gap:8px;width:160px;font-size:12px;`;
            panel.innerHTML = `<div style="font-weight:600;margin-bottom:2px;">Region Properties</div><div style="display:flex;justify-content:space-between;align-items:center;"><label style="margin:0;color:#8d96a0;">Height (m)</label><input type="number" class="fd-prop-h" value="${s.height || ""}" style="width:60px;padding:2px 4px;border:1px solid #e2e6ea;border-radius:4px;" step="any"></div><div style="display:flex;justify-content:space-between;align-items:center;"><label style="margin:0;color:#8d96a0;">Floors</label><input type="number" class="fd-prop-f" value="${s.floors || ""}" style="width:60px;padding:2px 4px;border:1px solid #e2e6ea;border-radius:4px;"></div>`;
            wrapEl.style.position = "relative"; wrapEl.appendChild(panel); propsPanelEl = panel;
            let propsSaveTriggered = false;
            const updateProps = () => {
                if (!shapes[idx]) return;
                if (!propsSaveTriggered) { saveState(); propsSaveTriggered = true; }
                shapes[idx].height = panel.querySelector(".fd-prop-h").value ? parseFloat(panel.querySelector(".fd-prop-h").value) : null;
                shapes[idx].floors = panel.querySelector(".fd-prop-f").value ? parseInt(panel.querySelector(".fd-prop-f").value, 10) : null;
                render();
            };
            panel.querySelector(".fd-prop-h").addEventListener("focus", () => propsSaveTriggered = false);
            panel.querySelector(".fd-prop-f").addEventListener("focus", () => propsSaveTriggered = false);
            panel.querySelector(".fd-prop-h").addEventListener("input", updateProps);
            panel.querySelector(".fd-prop-f").addEventListener("input", updateProps);
        };

        // ── pointer events ────────────────────────────────────────────────────
        function checkHandleHit(x, y, bb) {
            if (!bb) return null;
            const pad = 4;
            for (const h of [{ id: "tl", x: bb.minX - pad, y: bb.minY - pad }, { id: "tr", x: bb.maxX + pad, y: bb.minY - pad }, { id: "bl", x: bb.minX - pad, y: bb.maxY + pad }, { id: "br", x: bb.maxX + pad, y: bb.maxY + pad }]) {
                if (x >= h.x - 8 && x <= h.x + 8 && y >= h.y - 8 && y <= h.y + 8) return h.id;
            }
            return null;
        }

        function applyTransform(s, origS, state, dx, dy, shiftKey) {
            if (state.mode === "move") {
                if (s.type === "rect" || s.type === "circle" || s.type === "text") { s.x = origS.x + dx; s.y = origS.y + dy; }
                else if (s.type === "line" || s.type === "dim") { s.x1 = origS.x1 + dx; s.y1 = origS.y1 + dy; s.x2 = origS.x2 + dx; s.y2 = origS.y2 + dy; }
                else if (s.type === "freehand") { s.points = origS.points.map(p => [p[0] + dx, p[1] + dy]); }
            } else if (state.mode === "scale") {
                const bb = state.groupBB; if (!bb) return;
                let nMinX = bb.minX, nMinY = bb.minY, nMaxX = bb.maxX, nMaxY = bb.maxY;
                if (state.handle.includes("l")) nMinX += dx; if (state.handle.includes("r")) nMaxX += dx;
                if (state.handle.includes("t")) nMinY += dy; if (state.handle.includes("b")) nMaxY += dy;
                if (nMaxX < nMinX) { const t = nMinX; nMinX = nMaxX; nMaxX = t; }
                if (nMaxY < nMinY) { const t = nMinY; nMinY = nMaxY; nMaxY = t; }
                let scaleX = (nMaxX - nMinX) / (bb.maxX - bb.minX || 1);
                let scaleY = (nMaxY - nMinY) / (bb.maxY - bb.minY || 1);
                if (shiftKey) {
                    const sVal = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                    scaleX = scaleX < 0 ? -sVal : sVal; scaleY = scaleY < 0 ? -sVal : sVal;
                    if (state.handle.includes("l")) nMinX = bb.maxX - (bb.maxX - bb.minX) * Math.abs(scaleX); else nMaxX = bb.minX + (bb.maxX - bb.minX) * Math.abs(scaleX);
                    if (state.handle.includes("t")) nMinY = bb.maxY - (bb.maxY - bb.minY) * Math.abs(scaleY); else nMaxY = bb.minY + (bb.maxY - bb.minY) * Math.abs(scaleY);
                }
                if (s.type === "rect") { s.x = nMinX + (origS.x - bb.minX) * scaleX; s.y = nMinY + (origS.y - bb.minY) * scaleY; s.w = origS.w * scaleX; s.h = origS.h * scaleY; }
                else if (s.type === "circle") { s.x = nMinX + (origS.x - bb.minX) * scaleX; s.y = nMinY + (origS.y - bb.minY) * scaleY; s.r = origS.r * Math.max(Math.abs(scaleX), Math.abs(scaleY)); }
                else if (s.type === "line" || s.type === "dim") { s.x1 = nMinX + (origS.x1 - bb.minX) * scaleX; s.y1 = nMinY + (origS.y1 - bb.minY) * scaleY; s.x2 = nMinX + (origS.x2 - bb.minX) * scaleX; s.y2 = nMinY + (origS.y2 - bb.minY) * scaleY; }
                else if (s.type === "freehand") { s.points = origS.points.map(p => [nMinX + (p[0] - bb.minX) * scaleX, nMinY + (p[1] - bb.minY) * scaleY]); }
                else if (s.type === "text") { s.x = nMinX + (origS.x - bb.minX) * scaleX; s.y = nMinY + (origS.y - bb.minY) * scaleY; }
            }
        }

        function onDown(e) {
            e.preventDefault();
            const raw = canvasPos(e); downPos = raw; pointerMoved = false; pointerDown = true;
            removeOverlayInputs();

            if (tool === "select") {
                let hitGroupBB = false, groupBB = null;
                if (selectedShapeIndices.length > 0) {
                    groupBB = getGroupBBox(selectedShapeIndices);
                    const handle = checkHandleHit(raw.x, raw.y, groupBB);
                    if (handle) { transformState = { mode: "scale", handle, startX: raw.x, startY: raw.y, origShapes: selectedShapeIndices.map(i => JSON.parse(JSON.stringify(shapes[i]))), groupBB, saved: false }; return; }
                    if (!e.shiftKey && groupBB && raw.x >= groupBB.minX && raw.x <= groupBB.maxX && raw.y >= groupBB.minY && raw.y <= groupBB.maxY) hitGroupBB = true;
                }
                let hitIdx = null;
                for (let i = shapes.length - 1; i >= 0; i--) { if (hitShape(raw.x, raw.y, shapes[i])) { hitIdx = i; break; } }
                if (e.shiftKey && hitIdx !== null) {
                    const pos = selectedShapeIndices.indexOf(hitIdx);
                    if (pos === -1) selectedShapeIndices.push(hitIdx); else selectedShapeIndices.splice(pos, 1);
                    showPropsPanel(); render(); return;
                }
                if ((hitGroupBB && hitIdx === null) || (hitIdx !== null && selectedShapeIndices.includes(hitIdx))) {
                    transformState = { mode: "move", startX: raw.x, startY: raw.y, origShapes: selectedShapeIndices.map(i => JSON.parse(JSON.stringify(shapes[i]))), saved: false }; return;
                }
                if (hitIdx !== null) {
                    selectedShapeIndices = [hitIdx]; showPropsPanel();
                    transformState = { mode: "move", startX: raw.x, startY: raw.y, origShapes: [JSON.parse(JSON.stringify(shapes[hitIdx]))], saved: false };
                    render(); return;
                }
                if (!e.shiftKey) { selectedShapeIndices = []; hidePropsPanel(); }
                boxSelectDraft = { x1: raw.x, y1: raw.y, x2: raw.x, y2: raw.y }; render(); return;
            }

            selectedShapeIndices = []; hidePropsPanel();

            if (tool === "measure") {
                for (let i = shapes.length - 1; i >= 0; i--) {
                    if (shapes[i].type !== "dim") continue;
                    const h = hitDim(raw.x, raw.y, shapes[i]);
                    if (h.hit) { dimDragIdx = i; dimHitWasLabel = h.label; return; }
                }
                for (let i = shapes.length - 1; i >= 0; i--) {
                    const s = shapes[i];
                    if ((s.type === "rect" || s.type === "circle" || s.type === "line") && hitShape(raw.x, raw.y, s)) {
                        saveState();
                        if (s.type === "rect") { shapes.push({ type: "dim", x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y, offset: -26, color }); shapes.push({ type: "dim", x1: s.x + s.w, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, offset: 26, color }); }
                        else if (s.type === "circle") { shapes.push({ type: "dim", x1: s.x, y1: s.y, x2: s.x + s.r, y2: s.y, offset: -26, color }); }
                        else if (s.type === "line") { shapes.push({ type: "dim", x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, offset: 26, color }); }
                        render(); return;
                    }
                }
                dimDraft = snapDimPt(raw); return;
            }

            if (tool === "eraser") {
                eraseMode = true; eraseModeSaved = false;
                for (let i = shapes.length - 1; i >= 0; i--) { if (hitShape(raw.x, raw.y, shapes[i])) { if (!eraseModeSaved) { saveState(); eraseModeSaved = true; } shapes.splice(i, 1); render(); return; } }
                return;
            }
            if (tool === "line") { if (!chainStart) { chainStart = snapPt(raw); anchorJustPlaced = true; render(); } return; }
            if (tool === "rect")   { draftShape = { type: "rect",   x: snap(raw.x), y: snap(raw.y), w: 0, h: 0, color }; return; }
            if (tool === "circle") { draftShape = { type: "circle", x: snap(raw.x), y: snap(raw.y), r: 0, color }; return; }
            if (tool === "text")   { showTextInput(raw.x, raw.y); return; }
            if (tool === "freehand") { freeDrawing = true; freePoints = [[raw.x, raw.y]]; }
        }

        function onMove(e) {
            const raw = canvasPos(e);
            if (pointerDown && downPos && Math.hypot(raw.x - downPos.x, raw.y - downPos.y) > 4) pointerMoved = true;

            if (tool === "select" && boxSelectDraft && pointerDown) { e.preventDefault(); boxSelectDraft.x2 = raw.x; boxSelectDraft.y2 = raw.y; render(); return; }
            if (tool === "select" && transformState && selectedShapeIndices.length > 0 && pointerDown) {
                e.preventDefault();
                if (!transformState.saved && pointerMoved) { saveState(); transformState.saved = true; }
                selectedShapeIndices.forEach((idx, arrIdx) => applyTransform(shapes[idx], transformState.origShapes[arrIdx], transformState, raw.x - transformState.startX, raw.y - transformState.startY, e.shiftKey));
                render();
                if (propsPanelEl && selectedShapeIndices.length === 1) {
                    const bb = getBBox(shapes[selectedShapeIndices[0]]);
                    if (bb) { propsPanelEl.style.left = `${bb.maxX + 15}px`; propsPanelEl.style.top = `${bb.minY}px`; }
                }
                return;
            }
            if (tool === "eraser" && eraseMode && pointerDown) {
                e.preventDefault();
                let erased = false;
                for (let i = shapes.length - 1; i >= 0; i--) { if (hitShape(raw.x, raw.y, shapes[i])) { if (!eraseModeSaved) { saveState(); eraseModeSaved = true; } shapes.splice(i, 1); erased = true; } }
                if (erased) render(); return;
            }
            if (tool === "line" && chainStart) { e.preventDefault(); render({ type: "line", x1: chainStart.x, y1: chainStart.y, x2: snapPt(raw).x, y2: snapPt(raw).y, color, measurement: "" }); return; }
            if (tool === "rect" && draftShape && pointerDown) { e.preventDefault(); const pt = snapPt(raw); draftShape.w = pt.x - draftShape.x; draftShape.h = pt.y - draftShape.y; render(draftShape); return; }
            if (tool === "circle" && draftShape && pointerDown) { e.preventDefault(); const pt = snapPt(raw); draftShape.r = Math.hypot(pt.x - draftShape.x, pt.y - draftShape.y); render(draftShape); return; }
            if (tool === "measure") {
                if (dimDragIdx !== null && pointerDown) {
                    e.preventDefault();
                    if (pointerMoved && !transformState?.saved) { saveState(); transformState = { saved: true }; }
                    const s = shapes[dimDragIdx], g = dimGeom(s);
                    s.offset = (raw.x - s.x1) * g.nx + (raw.y - s.y1) * g.ny; render(); return;
                }
                if (dimDraft && pointerDown) { e.preventDefault(); const pt = snapDimPt(raw); render({ type: "dim", x1: dimDraft.x, y1: dimDraft.y, x2: pt.x, y2: pt.y, offset: 26, color }); return; }
                return;
            }
            if (tool === "freehand" && freeDrawing) { e.preventDefault(); freePoints.push([raw.x, raw.y]); render({ type: "freehand", points: freePoints, color }); }
        }

        function onUp(e) {
            const raw = canvasPos(e); pointerDown = false; eraseMode = false; eraseModeSaved = false;
            if (tool === "select" && boxSelectDraft) {
                for (let i = 0; i < shapes.length; i++) { if (checkOverlap(boxSelectDraft, shapes[i]) && !selectedShapeIndices.includes(i)) selectedShapeIndices.push(i); }
                boxSelectDraft = null; showPropsPanel(); render(); return;
            }
            if (tool === "select" && transformState) { transformState = null; return; }
            if (tool === "line" && chainStart) {
                const end = snapPt(raw), d = Math.hypot(end.x - chainStart.x, end.y - chainStart.y);
                if (d > 2) { saveState(); shapes.push({ type: "line", x1: chainStart.x, y1: chainStart.y, x2: end.x, y2: end.y, color, measurement: "" }); chainStart = end; }
                else if (!anchorJustPlaced) { chainStart = null; }
                anchorJustPlaced = false; render(); return;
            }
            if ((tool === "rect" || tool === "circle") && draftShape) {
                if ((tool === "rect" && Math.abs(draftShape.w) > 2 && Math.abs(draftShape.h) > 2) || (tool === "circle" && draftShape.r > 2)) {
                    saveState();
                    if (draftShape.type === "rect") { if (draftShape.w < 0) { draftShape.x += draftShape.w; draftShape.w = Math.abs(draftShape.w); } if (draftShape.h < 0) { draftShape.y += draftShape.h; draftShape.h = Math.abs(draftShape.h); } }
                    shapes.push(draftShape);
                }
                draftShape = null; render(); return;
            }
            if (tool === "measure") {
                if (dimDragIdx !== null) { const idx = dimDragIdx; dimDragIdx = null; transformState = null; if (!pointerMoved && dimHitWasLabel) showValInput(idx); else render(); return; }
                if (dimDraft) {
                    const end = snapDimPt(raw);
                    if (Math.hypot(end.x - dimDraft.x, end.y - dimDraft.y) > 4) { saveState(); shapes.push({ type: "dim", x1: dimDraft.x, y1: dimDraft.y, x2: end.x, y2: end.y, offset: 26, color }); }
                    dimDraft = null; render(); return;
                }
                return;
            }
            if (tool === "freehand" && freeDrawing) {
                freeDrawing = false;
                if (freePoints.length > 1) { saveState(); shapes.push({ type: "freehand", points: [...freePoints], color }); }
                freePoints = []; render();
            }
        }

        canvas.addEventListener("mousedown",  onDown);
        canvas.addEventListener("mousemove",  onMove);
        canvas.addEventListener("mouseup",    onUp);
        canvas.addEventListener("mouseleave", () => { if (freeDrawing) { freeDrawing = false; render(); } eraseMode = false; eraseModeSaved = false; });
        canvas.addEventListener("touchstart", onDown, { passive: false });
        canvas.addEventListener("touchmove",  onMove, { passive: false });
        canvas.addEventListener("touchend",   onUp,   { passive: false });
        canvas.addEventListener("dblclick",   (e) => { e.preventDefault(); if (chainStart) { chainStart = null; render(); } });
        canvas.addEventListener("contextmenu",(e) => { e.preventDefault(); if (chainStart) { chainStart = null; render(); } });

        const keydownHandler = (e) => {
            if ((e.key === "Delete" || e.key === "Backspace") && tool === "select" && selectedShapeIndices.length > 0) {
                const tag = document.activeElement?.tagName.toLowerCase();
                if (tag !== "input" && tag !== "textarea") {
                    e.preventDefault(); e.stopPropagation();
                    saveState();
                    [...selectedShapeIndices].sort((a, b) => b - a).forEach(i => shapes.splice(i, 1));
                    selectedShapeIndices = []; hidePropsPanel(); render();
                }
            }
            if (e.key === "Escape" && chainStart) { e.preventDefault(); e.stopPropagation(); chainStart = null; render(); }
        };
        document.addEventListener("keydown", keydownHandler, true);

        const prevOnHide = dialog.onhide;
        dialog.onhide = () => {
            document.removeEventListener("keydown", keydownHandler, true);
            if (scaleAnimFrame) cancelAnimationFrame(scaleAnimFrame);
            if (typeof prevOnHide === "function") prevOnHide();
        };

        // ── toolbar ───────────────────────────────────────────────────────────
        const $toolbar = $wrap.find(".fd-draw-toolbar");

        $toolbar.on("click", ".fd-draw-tool[data-tool]", function () {
            tool = $(this).attr("data-tool");
            chainStart = null; dimDraft = null; dimDragIdx = null; draftShape = null;
            transformState = null; selectedShapeIndices = []; boxSelectDraft = null;
            removeOverlayInputs(); hidePropsPanel();
            $toolbar.find(".fd-draw-tool[data-tool]").removeClass("fd-draw-tool--active");
            $(this).addClass("fd-draw-tool--active");
            canvas.style.cursor = tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
            render();
        });

        $toolbar.on("click", ".fd-draw-color-btn", function () {
            color = $(this).attr("data-color");
            $toolbar.find(".fd-draw-color-btn").removeClass("fd-draw-color-active");
            $(this).addClass("fd-draw-color-active");
            if (tool === "select" && selectedShapeIndices.length > 0) {
                saveState();
                for (const idx of selectedShapeIndices) { if (shapes[idx]) shapes[idx].color = color; }
                render();
            }
        });

        $toolbar.on("change", ".fd-draw-unit", function () { scale.unit = $(this).val(); render(); });

        $toolbar.on("click", ".fd-draw-undo-btn", () => {
            if (history.length > 0) {
                shapes = JSON.parse(history.pop());
                chainStart = null; draftShape = null; selectedShapeIndices = []; transformState = null; boxSelectDraft = null;
                removeOverlayInputs(); hidePropsPanel(); render();
            }
        });

        $toolbar.on("click", ".fd-draw-clear-btn", () => {
            if (!shapes.length || confirm(__("Clear all? Cannot be undone."))) {
                saveState(); shapes = [];
                chainStart = null; dimDraft = null; dimDragIdx = null; draftShape = null;
                selectedShapeIndices = []; transformState = null; boxSelectDraft = null;
                removeOverlayInputs(); hidePropsPanel(); render();
            }
        });

        canvas.style.cursor = "crosshair";
    }

    // ── Styles (injected once) ────────────────────────────────────────────────
    function _inject_styles() {
        if (document.getElementById("fd-draw-styles")) return;
        const style = Object.assign(document.createElement("style"), { id: "fd-draw-styles" });
        style.textContent = `
            .fd-draw-dialog { display:flex; flex-direction:column; gap:0; }
            .fd-draw-toolbar {
                display:flex; align-items:center; justify-content:space-between;
                padding:8px 12px; border-bottom:0.5px solid var(--border-color,#e2e6ea);
                background:var(--card-bg,#fff); flex-wrap:wrap; gap:6px;
            }
            .fd-draw-tools { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
            .fd-draw-tool {
                display:inline-flex; align-items:center; justify-content:center;
                width:28px; height:28px; border:0.5px solid transparent; border-radius:6px;
                background:transparent; cursor:pointer; color:var(--text-muted,#8d96a0);
                transition:background .1s, border-color .1s, color .1s;
            }
            .fd-draw-tool:hover               { background:var(--bg-light-gray,#f4f5f6); border-color:var(--border-color,#e2e6ea); color:var(--text-color,#1f272e); }
            .fd-draw-tool--active             { background:#EBF3FF; border-color:#378ADD; color:#378ADD; }
            .fd-draw-sep                      { width:1px; height:20px; background:var(--border-color,#e2e6ea); margin:0 2px; }
            .fd-draw-swatch                   { display:block; width:12px; height:12px; border-radius:3px; }
            .fd-draw-color-active             { border-color:#378ADD !important; }
            .fd-draw-unit {
                height:28px; border:0.5px solid var(--border-color,#e2e6ea); border-radius:6px;
                padding:0 6px; font-size:12px; background:var(--card-bg,#fff); cursor:pointer;
            }
            .fd-draw-undo-btn, .fd-draw-clear-btn {
                height:28px; padding:0 10px; border:0.5px solid var(--border-color,#e2e6ea);
                border-radius:6px; background:transparent; cursor:pointer; font-size:12px;
                color:var(--text-muted,#8d96a0); display:inline-flex; align-items:center; gap:4px;
                transition:background .1s, border-color .1s, color .1s;
            }
            .fd-draw-undo-btn:hover, .fd-draw-clear-btn:hover { background:var(--bg-light-gray,#f4f5f6); border-color:var(--border-color,#e2e6ea); color:var(--text-color,#1f272e); }
            .fd-draw-canvas-wrap { overflow:hidden; border-radius:0 0 8px 8px; }
            .fd-draw-canvas      { display:block; cursor:crosshair; }

            /* list-view button (shared across consumers) */
            .fd-icon-btn {
                display:inline-flex; align-items:center; justify-content:center;
                width:26px; height:26px; border:0.5px solid transparent; border-radius:8px;
                background:transparent; cursor:pointer; color:var(--text-muted,#8d96a0);
                transition:background .12s, border-color .12s, color .12s;
            }
            .fd-draw-btn      { pointer-events:none; }
            .fd-draw-btn--has { color:#378ADD; }
        `;
        document.head.appendChild(style);
    }

    return { open, render_btn };
})();
