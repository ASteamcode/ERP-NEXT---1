// Custom Calendar Event — Outlook-style Weekly Calendar
// Built on GL (grid_core.js) for host / style management.
// ─────────────────────────────────────────────────────────────────────────────
// • 30-min time slots (06:00–22:00), hour rows split into two half-hour cells
// • Events positioned absolutely by start/end time with overlap column layout
// • Red current-time indicator, auto-scrolls to now on load
// • Click empty slot → quick-create dialog (date + time pre-filled)
// • Click event block → open full form
// • Prev / Next / Today week navigation
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ── Config ────────────────────────────────────────────────────────────────────

const CAL_DOCTYPE     = "Custom Calendar Event";
const CAL_SLOT_H      = 28;                              // px per 30-min slot
const CAL_GUTTER_W    = 56;                              // px for the time-label gutter
const CAL_START_H     = 6;                               // 06:00
const CAL_END_H       = 22;                              // 22:00 (exclusive)
const CAL_TOTAL_SLOTS = (CAL_END_H - CAL_START_H) * 2;  // 32 half-hour rows
const CAL_TOTAL_H     = CAL_TOTAL_SLOTS * CAL_SLOT_H;   // 896px total column height
const CAL_STYLE_VER   = "v5";

const CAL_DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CAL_MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CAL_TYPE_COLOR = {
	"Meeting":      "#4A90D9",
	"Site Visit":   "#27AE60",
	"Installation": "#E67E22",
	"Survey":       "#9B59B6",
	"Delivery":     "#1ABC9C",
	"Inspection":   "#F39C12",
	"Other":        "#7F8C8D",
};

const CAL_STATUS_BORDER = {
	"Draft":       "#BDC3C7",
	"Scheduled":   "#3498DB",
	"Confirmed":   "#27AE60",
	"In Progress": "#E67E22",
	"Completed":   "#16A085",
	"Cancelled":   "#E74C3C",
};

// ── State ─────────────────────────────────────────────────────────────────────

let _CAL_WEEK_START = null;   // Date — Monday of visible week
let _CAL_EVENTS     = [];     // records for the visible week
let _CAL_HOST       = null;   // DOM element (managed by GL.bootstrap)
let _CAL_TIMER      = null;   // setInterval id for the current-time line
let _CAL_BUSY       = false;  // fetch guard

// ── Frappe list settings ──────────────────────────────────────────────────────

frappe.listview_settings[CAL_DOCTYPE] = {
	add_fields: ["name"],
	page_length: 1,   // we fetch our own data; ignore Frappe's result set

	onload(lv) {
		GL.suppressRefresh(lv);
		GL.hideChrome(lv);
		cal_inject_styles();
		if (!_CAL_WEEK_START) _CAL_WEEK_START = cal_week_start(new Date());
	},

	refresh(lv) {
		GL.suppressRefresh(lv);
		GL.hideChrome(lv);
		cal_inject_styles();

		// Use GL.bootstrap so injectDoctypeHide + gl-host creation is consistent.
		_CAL_HOST = GL.bootstrap(lv, { doctype: CAL_DOCTYPE, hostClass: "cal-gl-host" });
		if (!_CAL_HOST) return;

		if (!_CAL_BUSY) cal_fetch();
	},
};

// ── Data fetch ────────────────────────────────────────────────────────────────

function cal_fetch() {
	if (!_CAL_HOST || !_CAL_WEEK_START) return;
	const we = cal_add_days(_CAL_WEEK_START, 6);

	_CAL_BUSY = true;
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: CAL_DOCTYPE,
			fields: [
				"name","title","status","event_type","color",
				"start_date","end_date","start_time","end_time",
				"assigned_to","contact_person","crew_number","location",
			],
			filters: [
				["start_date", ">=", cal_fmt(_CAL_WEEK_START)],
				["start_date", "<=", cal_fmt(we)],
			],
			limit_page_length: 500,
			order_by: "start_date asc, start_time asc",
		},
		callback({ message }) {
			_CAL_BUSY   = false;
			_CAL_EVENTS = message || [];
			cal_render();
		},
		error() { _CAL_BUSY = false; },
	});
}

// ── Render orchestrator ───────────────────────────────────────────────────────

function cal_render() {
	if (!_CAL_HOST) return;
	if (_CAL_TIMER) { clearInterval(_CAL_TIMER); _CAL_TIMER = null; }

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Build everything into a fragment then swap — avoids flash.
	const wrap = document.createElement("div");
	wrap.className = "cal-root";
	wrap.appendChild(cal_build_nav());
	wrap.appendChild(cal_build_day_headers(today));
	wrap.appendChild(cal_build_body(today));

	_CAL_HOST.innerHTML = "";
	_CAL_HOST.appendChild(wrap);

	cal_bind(_CAL_HOST);
	cal_start_timer(wrap, today);
}

// ── Navigation bar ────────────────────────────────────────────────────────────

function cal_build_nav() {
	const ws  = _CAL_WEEK_START;
	const we  = cal_add_days(ws, 6);
	const fmt = d => `${CAL_DAY_SHORT[d.getDay()]} ${d.getDate()} ${CAL_MON_SHORT[d.getMonth()]}`;

	const nav = document.createElement("div");
	nav.className = "cal-nav";
	nav.innerHTML = `
		<button class="cal-nav-btn js-cal-prev">&#8249; Prev</button>
		<div class="cal-nav-center">
			<span class="cal-week-label">${fmt(ws)} – ${fmt(we)} ${we.getFullYear()}</span>
		</div>
		<button class="cal-nav-btn js-cal-today">Today</button>
		<button class="cal-nav-btn js-cal-next">Next &#8250;</button>`;
	return nav;
}

// ── Day header row ────────────────────────────────────────────────────────────

function cal_build_day_headers(today) {
	const row = document.createElement("div");
	row.className = "cal-day-headers";

	const gutter = document.createElement("div");
	gutter.className = "cal-gutter-head";
	row.appendChild(gutter);

	for (let i = 0; i < 7; i++) {
		const day     = cal_add_days(_CAL_WEEK_START, i);
		const isToday = day.getTime() === today.getTime();
		const hd      = document.createElement("div");
		hd.className  = `cal-day-head${isToday ? " cal-day-head--today" : ""}`;
		hd.innerHTML  =
			`<span class="cal-day-name">${CAL_DAY_SHORT[day.getDay()]}</span>` +
			`<span class="cal-day-num${isToday ? " cal-day-num--today" : ""}">${day.getDate()}</span>`;
		row.appendChild(hd);
	}
	return row;
}

// ── Scrollable body ───────────────────────────────────────────────────────────

function cal_build_body(today) {
	const body = document.createElement("div");
	body.className = "cal-body";

	const grid = document.createElement("div");
	grid.className = "cal-grid";
	grid.appendChild(cal_build_gutter());

	for (let i = 0; i < 7; i++) {
		const day     = cal_add_days(_CAL_WEEK_START, i);
		const isToday = day.getTime() === today.getTime();
		const dateStr = cal_fmt(day);
		const evs     = _CAL_EVENTS.filter(e => e.start_date === dateStr);
		grid.appendChild(cal_build_day_col(day, isToday, evs));
	}

	body.appendChild(grid);
	return body;
}

// ── Time-label gutter ─────────────────────────────────────────────────────────

function cal_build_gutter() {
	const gutter = document.createElement("div");
	gutter.className = "cal-time-gutter";

	for (let h = CAL_START_H; h < CAL_END_H; h++) {
		const lbl = document.createElement("div");
		lbl.className   = "cal-time-label";
		lbl.style.height = `${CAL_SLOT_H * 2}px`;
		lbl.textContent = `${String(h).padStart(2, "0")}:00`;
		gutter.appendChild(lbl);
	}
	return gutter;
}

// ── Day column ────────────────────────────────────────────────────────────────

function cal_build_day_col(day, isToday, dayEvents) {
	const col = document.createElement("div");
	col.className   = `cal-day-col${isToday ? " cal-day-col--today" : ""}`;
	col.dataset.date = cal_fmt(day);
	col.style.height = `${CAL_TOTAL_H}px`;

	// Half-hour slot cells (grid lines + click-to-create targets)
	for (let s = 0; s < CAL_TOTAL_SLOTS; s++) {
		const totalMin = CAL_START_H * 60 + s * 30;
		const h        = Math.floor(totalMin / 60);
		const m        = totalMin % 60;
		const slot     = document.createElement("div");
		slot.className  = `cal-slot cal-slot--${m === 0 ? "hour" : "half"}`;
		slot.style.height = `${CAL_SLOT_H}px`;
		slot.dataset.time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
		col.appendChild(slot);
	}

	// Event blocks
	for (const ev of cal_layout(dayEvents)) {
		const block = cal_event_block(ev);
		if (block) col.appendChild(block);
	}

	return col;
}

// ── Overlap layout (greedy column packing) ────────────────────────────────────

function cal_layout(events) {
	const timed = events
		.filter(e => e.start_time)
		.sort((a, b) => a.start_time.localeCompare(b.start_time));

	// cols[i] = the last event placed in that column
	const cols = [];

	for (const ev of timed) {
		const startMin = cal_t2m(ev.start_time);
		ev._endTime    = ev.end_time || cal_m2t(startMin + 30);
		let placed = false;

		for (let c = 0; c < cols.length; c++) {
			if (startMin >= cal_t2m(cols[c]._endTime)) {
				ev._col = c;
				cols[c] = ev;
				placed  = true;
				break;
			}
		}
		if (!placed) { ev._col = cols.length; cols.push(ev); }
	}

	// _totalCols: widest concurrent group covering each event
	for (const ev of timed) {
		const s0 = cal_t2m(ev.start_time);
		const e0 = cal_t2m(ev._endTime);
		let   mx = ev._col;
		for (const o of timed) {
			if (o === ev) continue;
			const s1 = cal_t2m(o.start_time);
			const e1 = cal_t2m(o._endTime);
			if (s0 < e1 && s1 < e0) mx = Math.max(mx, o._col ?? 0);
		}
		ev._totalCols = mx + 1;
	}

	return timed;
}

// ── Event block element ───────────────────────────────────────────────────────

function cal_event_block(ev) {
	const startMin = cal_t2m(ev.start_time);
	const endMin   = cal_t2m(ev._endTime);
	const duration = Math.max(15, endMin - startMin);
	const top      = ((startMin - CAL_START_H * 60) / 30) * CAL_SLOT_H;
	const height   = (duration / 30) * CAL_SLOT_H;

	if (top < 0 || top >= CAL_TOTAL_H) return null;

	const tc   = ev._totalCols || 1;
	const col  = ev._col       || 0;
	const GAP  = 2;
	const wPct = (100 / tc) - (GAP * (tc - 1) / tc);
	const lPct = (col / tc) * 100 + (col > 0 ? GAP * col / tc : 0);

	const base   = ev.color || CAL_TYPE_COLOR[ev.event_type] || "#4A90D9";
	const border = CAL_STATUS_BORDER[ev.status] || base;
	const bg     = cal_hex_alpha(base, 0.13);

	const block = document.createElement("div");
	block.className    = "cal-event";
	block.dataset.name = ev.name;
	block.style.cssText = `top:${top}px;height:${Math.max(height - 2, 14)}px;`
		+ `left:${lPct.toFixed(2)}%;width:${wPct.toFixed(2)}%;`
		+ `background:${bg};border-left:3px solid ${border};color:${base};`;

	const timeStr  = `${cal_disp(ev.start_time)} – ${cal_disp(ev.end_time)}`;
	const showMeta = height >= CAL_SLOT_H * 1.8;

	const crewHtml = ev.crew_number > 0
		? `<span class="cal-ev-crew">&#128101; ${ev.crew_number}</span>` : "";
	const cntcHtml = ev.contact_person
		? `<span class="cal-ev-contact">${frappe.utils.escape_html(ev.contact_person)}</span>` : "";
	const typeHtml = ev.event_type
		? `<span class="cal-ev-type">${__(ev.event_type)}</span>` : "";

	block.innerHTML =
		`<div class="cal-ev-time">${timeStr}</div>` +
		`<div class="cal-ev-title">${frappe.utils.escape_html(ev.title || "")}</div>` +
		(showMeta ? `<div class="cal-ev-meta">${typeHtml}${cntcHtml}${crewHtml}</div>` : "");

	return block;
}

// ── Current-time indicator ────────────────────────────────────────────────────

function cal_start_timer(wrap, today) {
	const todayStr = cal_fmt(today);
	const wsStr    = cal_fmt(_CAL_WEEK_START);
	const weStr    = cal_fmt(cal_add_days(_CAL_WEEK_START, 6));
	if (todayStr < wsStr || todayStr > weStr) return;

	const update = () => {
		const col = wrap.querySelector(`.cal-day-col[data-date="${todayStr}"]`);
		if (!col) return;
		const now    = new Date();
		const nowMin = now.getHours() * 60 + now.getMinutes();
		if (nowMin < CAL_START_H * 60 || nowMin > CAL_END_H * 60) return;

		let line = col.querySelector(".cal-now-line");
		if (!line) {
			line = document.createElement("div");
			line.className = "cal-now-line";
			line.innerHTML = `<div class="cal-now-dot"></div>`;
			col.appendChild(line);
		}
		line.style.top = `${((nowMin - CAL_START_H * 60) / 30) * CAL_SLOT_H}px`;
	};

	update();
	_CAL_TIMER = setInterval(update, 60_000);

	// Auto-scroll to current time
	requestAnimationFrame(() => {
		const body = wrap.querySelector(".cal-body");
		if (!body) return;
		const now    = new Date();
		const nowMin = now.getHours() * 60 + now.getMinutes();
		body.scrollTop = Math.max(0, ((nowMin - CAL_START_H * 60 - 60) / 30) * CAL_SLOT_H);
	});
}

// ── Event binding ─────────────────────────────────────────────────────────────

let _CAL_DRAG = null; // { col, startSlot, endSlot, date }

function cal_bind(hostEl) {
	const $host = $(hostEl);

	// Navigation
	$host.on("click.calnav", ".js-cal-prev",  () => cal_nav(-7));
	$host.on("click.calnav", ".js-cal-next",  () => cal_nav(+7));
	$host.on("click.calnav", ".js-cal-today", () => { _CAL_WEEK_START = cal_week_start(new Date()); cal_loading(); cal_fetch(); });

	// Drag-select across slots (mousedown → mousemove → mouseup)
	hostEl.addEventListener("mousedown", function (e) {
		const slot = e.target.closest(".cal-slot");
		if (!slot || e.target.closest(".cal-event")) return;
		e.preventDefault();
		const col = slot.closest(".cal-day-col");
		_CAL_DRAG = { col, date: col.dataset.date, startTime: slot.dataset.time, endTime: slot.dataset.time };
		cal_drag_highlight(_CAL_DRAG);
	}, { passive: false });

	hostEl.addEventListener("mousemove", function (e) {
		if (!_CAL_DRAG) return;
		const slot = e.target.closest(".cal-slot");
		if (!slot) return;
		const sameCol = slot.closest(".cal-day-col") === _CAL_DRAG.col;
		if (!sameCol) return;
		const t = slot.dataset.time;
		if (t > _CAL_DRAG.startTime) _CAL_DRAG.endTime = t;
		else { _CAL_DRAG.startTime = t; }
		cal_drag_highlight(_CAL_DRAG);
	});

	document.addEventListener("mouseup", function () {
		if (!_CAL_DRAG) return;
		const { date, startTime, endTime } = _CAL_DRAG;
		_CAL_DRAG = null;
		cal_drag_clear(hostEl);
		if (date && startTime) {
			// endTime is the START of the last highlighted slot — add 30min for end
			const endMin = cal_t2m(endTime) + 30;
			cal_quick_create(date, startTime, cal_m2t(endMin));
		}
	});

	// Event click → full form
	$host.on("click.calev", ".cal-event", function (e) {
		e.stopPropagation();
		const name = this.dataset.name;
		if (name) frappe.set_route("Form", CAL_DOCTYPE, name);
	});
}

function cal_drag_highlight(drag) {
	if (!drag.col) return;
	const slots = drag.col.querySelectorAll(".cal-slot");
	slots.forEach(s => {
		const t = s.dataset.time;
		const on = t >= drag.startTime && t <= drag.endTime;
		s.classList.toggle("cal-slot--drag", on);
	});
}

function cal_drag_clear(hostEl) {
	hostEl.querySelectorAll(".cal-slot--drag").forEach(s => s.classList.remove("cal-slot--drag"));
}

function cal_nav(days) {
	_CAL_WEEK_START = cal_add_days(_CAL_WEEK_START, days);
	cal_loading();
	cal_fetch();
}

function cal_loading() {
	if (_CAL_HOST) _CAL_HOST.innerHTML = `<div class="cal-loading">${__("Loading…")}</div>`;
}

// ── Quick-create dialog ───────────────────────────────────────────────────────

function cal_quick_create(dateStr, startTime, presetEndTime) {
	const endTime  = presetEndTime || cal_m2t(cal_t2m(startTime) + 30);
	const [y,m,d]  = dateStr.split("-");
	const dt       = new Date(+y, +m - 1, +d);
	const dateDisp = `${CAL_DAY_SHORT[dt.getDay()]} ${d} ${CAL_MON_SHORT[+m - 1]} ${y}`;

	const dlg = new frappe.ui.Dialog({
		title:  __("New Event — {0}", [dateDisp]),
		fields: [
			{ label: __("Title"),          fieldname: "title",          fieldtype: "Data",   reqd: 1 },
			{ label: __("Event Type"),     fieldname: "event_type",     fieldtype: "Select",
			  options: "\nMeeting\nSite Visit\nInstallation\nSurvey\nDelivery\nInspection\nOther" },
			{ label: __("Contact Person"), fieldname: "contact_person", fieldtype: "Data"    },
			{ label: __("Crew No."),       fieldname: "crew_number",    fieldtype: "Int"     },
			{ fieldtype: "Column Break" },
			{ label: __("Start Time"),     fieldname: "start_time",     fieldtype: "Time",   default: startTime },
			{ label: __("End Time"),       fieldname: "end_time",       fieldtype: "Time",   default: endTime   },
			{ label: __("Location"),       fieldname: "location",       fieldtype: "Data"    },
		],
		primary_action_label:   __("Save"),
		secondary_action_label: __("Edit Full Form"),

		primary_action(vals) {
			frappe.call({
				method: "frappe.client.insert",
				args: { doc: {
					doctype:        CAL_DOCTYPE,
					title:          vals.title,
					event_type:     vals.event_type || "",
					status:         "Draft",
					start_date:     dateStr,
					end_date:       dateStr,
					start_time:     vals.start_time || startTime,
					end_time:       vals.end_time   || endTime,
					contact_person: vals.contact_person || "",
					crew_number:    vals.crew_number    || 0,
					location:       vals.location       || "",
				}},
				callback({ exc, message }) {
					if (exc || !message) return;
					frappe.show_alert({ message: __("Event created"), indicator: "green" }, 1.5);
					dlg.hide();
					cal_fetch();
				},
			});
		},

		secondary_action() {
			const title = dlg.get_value("title") || __("New Event");
			dlg.hide();
			frappe.call({
				method: "frappe.client.insert",
				args: { doc: {
					doctype:    CAL_DOCTYPE,
					title,
					status:     "Draft",
					start_date: dateStr,
					end_date:   dateStr,
					start_time: dlg.get_value("start_time") || startTime,
					end_time:   dlg.get_value("end_time")   || endTime,
				}},
				callback({ exc, message }) {
					if (!exc && message) frappe.set_route("Form", CAL_DOCTYPE, message.name);
				},
			});
		},
	});

	dlg.show();
	setTimeout(() => dlg.fields_dict.title?.$input?.focus(), 120);
}

// ── Date / time utilities ─────────────────────────────────────────────────────

function cal_week_start(date) {
	const d   = new Date(date);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay();
	d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
	return d;
}

function cal_add_days(date, n) {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

function cal_fmt(date) {
	return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

/** "HH:MM[:SS]" → total minutes */
function cal_t2m(t) {
	if (!t) return 0;
	const [h, m] = t.split(":").map(Number);
	return h * 60 + (m || 0);
}

/** total minutes → "HH:MM:00" (Frappe Time field requires seconds) */
function cal_m2t(min) {
	const h = Math.floor((min % 1440) / 60);
	const m = min % 60;
	return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
}

/** "HH:MM:SS" → "HH:MM" for display */
function cal_disp(t) {
	if (!t) return "—";
	const [h, m] = t.split(":");
	return `${h}:${m}`;
}

/** hex colour + alpha → rgba() */
function cal_hex_alpha(hex, alpha) {
	const h = hex.replace("#", "");
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

// ── Calendar-specific styles ──────────────────────────────────────────────────
// (GL.bootstrap already injects doctype-hide CSS via injectDoctypeHide.)

function cal_inject_styles() {
	if (document.getElementById("cal-styles")?.dataset.version === CAL_STYLE_VER) return;
	document.getElementById("cal-styles")?.remove();

	const s = Object.assign(document.createElement("style"), { id: "cal-styles" });
	s.dataset.version = CAL_STYLE_VER;
	s.textContent = `
		/* ── GL host wrapper for the calendar ── */
		.cal-gl-host { width: 100%; }

		/* ── Root ── */
		.cal-root {
			--cb:    #e2e6ea;
			--chb:   var(--card-bg, #fff);
			--cbg:   var(--card-bg, #fff);
			--ctb:   rgba(55,138,221,0.04);
			--cthb:  rgba(55,138,221,0.10);
			--ct:    var(--text-color, #1f272e);
			--cm:    var(--text-muted, #8d96a0);
			--ca:    #378ADD;
			display: flex; flex-direction: column;
			background: var(--cbg); border-radius: 12px;
			border: 0.5px solid var(--cb);
			overflow: hidden; font-size: 12px; color: var(--ct);
			box-shadow: 0 1px 10px rgba(0,0,0,0.07);
			margin-bottom: 24px; user-select: none;
		}

		/* ── Navigation bar ── */
		.cal-nav {
			display: flex; align-items: center; gap: 8px;
			padding: 10px 14px; border-bottom: 0.5px solid var(--cb);
			background: var(--chb); flex-shrink: 0;
		}
		.cal-nav-center { flex: 1; text-align: center; }
		.cal-week-label { font-size: 13px; font-weight: 600; }
		.cal-nav-btn {
			padding: 4px 13px; border-radius: 8px; cursor: pointer;
			border: 0.5px solid var(--cb); background: var(--cbg);
			font-size: 12px; font-weight: 500; color: var(--ct);
			transition: background .12s, border-color .12s, color .12s;
		}
		.cal-nav-btn:hover { background: var(--ctb); border-color: var(--ca); color: var(--ca); }

		/* ── Day header row ── */
		.cal-day-headers {
			display: flex; flex-shrink: 0;
			border-bottom: 0.5px solid var(--cb); background: var(--chb);
		}
		.cal-gutter-head { width: ${CAL_GUTTER_W}px; flex-shrink: 0; }
		.cal-day-head {
			flex: 1; text-align: center; padding: 8px 4px;
			border-left: 0.5px solid var(--cb);
		}
		.cal-day-head--today { background: var(--cthb); }
		.cal-day-name {
			display: block; font-size: 10px; font-weight: 600; color: var(--cm);
			text-transform: uppercase; letter-spacing: .07em;
		}
		.cal-day-num {
			display: inline-block; font-size: 18px; font-weight: 300;
			color: var(--ct); margin-top: 2px; line-height: 1.2;
		}
		.cal-day-num--today {
			background: var(--ca); color: #fff;
			border-radius: 50%; width: 30px; height: 30px;
			line-height: 30px; text-align: center;
			font-size: 14px; font-weight: 600;
		}

		/* ── Scrollable body ── */
		.cal-body { overflow-y: auto; max-height: calc(100vh - 290px); flex: 1; }

		/* ── Time grid ── */
		.cal-grid { display: flex; background: var(--cbg); }

		/* ── Time gutter ── */
		.cal-time-gutter {
			width: ${CAL_GUTTER_W}px; flex-shrink: 0; display: flex; flex-direction: column;
			border-right: 0.5px solid var(--cb);
		}
		.cal-time-label {
			display: flex; align-items: flex-start; justify-content: flex-end;
			padding: 0 7px 0 0; box-sizing: border-box;
			font-size: 10px; color: var(--cm); font-variant-numeric: tabular-nums;
			transform: translateY(-7px);
		}

		/* ── Day columns ── */
		.cal-day-col {
			flex: 1; position: relative; border-left: 0.5px solid var(--cb);
			box-sizing: border-box; min-width: 0;
		}
		.cal-day-col--today { background: var(--ctb); }

		/* ── Slot cells (30-min rows) ── */
		.cal-slot { position: relative; width: 100%; box-sizing: border-box; cursor: crosshair; }
		.cal-slot--hour { border-top: 0.5px solid var(--cb); }
		.cal-slot--half { border-top: 0.5px dashed rgba(0,0,0,0.06); }
		.cal-slot:hover { background: rgba(55,138,221,0.07); }

		/* ── Event blocks ── */
		.cal-event {
			position: absolute; border-radius: 5px;
			padding: 2px 5px; overflow: hidden; box-sizing: border-box;
			cursor: pointer; z-index: 2;
			transition: filter .12s, box-shadow .12s;
		}
		.cal-event:hover { filter: brightness(0.93); box-shadow: 0 3px 10px rgba(0,0,0,0.18); z-index: 10; }
		.cal-ev-time    { font-size: 10px; font-weight: 500; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.cal-ev-title   { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
		.cal-ev-meta    { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
		.cal-ev-type    { font-size: 9px; font-weight: 500; opacity: .72; padding: 1px 4px; border-radius: 4px; background: rgba(0,0,0,0.09); white-space: nowrap; }
		.cal-ev-contact { font-size: 10px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
		.cal-ev-crew    { font-size: 10px; opacity: .85; white-space: nowrap; }

		/* ── Current-time indicator ── */
		.cal-now-line { position: absolute; left: 0; right: 0; border-top: 2px solid #E74C3C; z-index: 20; pointer-events: none; }
		.cal-now-dot  { position: absolute; left: -4px; top: -5px; width: 8px; height: 8px; border-radius: 50%; background: #E74C3C; }

		/* ── Loading placeholder ── */
		.cal-loading { padding: 48px 20px; text-align: center; color: var(--cm); font-size: 13px; }

		/* ── Drag selection highlight ── */
		.cal-slot--drag { background: rgba(55,138,221,0.22) !important; }

		/* ── Hide Frappe native chrome for this list ── */
		[data-page-route="List/Custom Calendar Event/List"] .page-head,
		[data-page-route="List/Custom Calendar Event/List"] .page-form,
		[data-page-route="List/Custom Calendar Event/List"] .list-row-head,
		[data-page-route="List/Custom Calendar Event/List"] .list-headers,
		[data-page-route="List/Custom Calendar Event/List"] .list-subjects,
		[data-page-route="List/Custom Calendar Event/List"] .frappe-list-head { display: none !important; }

		/* ── Responsive ── */
		@media (max-width: 860px) {
			.cal-day-num  { font-size: 14px; }
			.cal-ev-meta  { display: none; }
			.cal-ev-title { font-size: 10px; }
		}
	`;
	document.head.appendChild(s);
}
