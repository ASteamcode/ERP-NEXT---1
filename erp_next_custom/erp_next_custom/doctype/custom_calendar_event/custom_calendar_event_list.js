// Custom Calendar Event — Outlook-style Weekly Calendar + Gantt
// ─────────────────────────────────────────────────────────────
(function () {
"use strict";

// ── Config ────────────────────────────────────────────────────────────────────
const CAL_DOCTYPE     = "Custom Calendar Event";
const CAL_SLOT_H      = 28;
const CAL_GUTTER_W    = 56;
const CAL_START_H     = 6;
const CAL_END_H       = 22;
const CAL_TOTAL_SLOTS = (CAL_END_H - CAL_START_H) * 2;
const CAL_TOTAL_H     = CAL_TOTAL_SLOTS * CAL_SLOT_H;
const CAL_STYLE_VER   = "v9";

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

const CAL_TYPE_GRAD = {
	"Meeting":      "linear-gradient(135deg,#4A90D9,#6AAFE0)",
	"Site Visit":   "linear-gradient(135deg,#27AE60,#48C97A)",
	"Installation": "linear-gradient(135deg,#E67E22,#F0A050)",
	"Survey":       "linear-gradient(135deg,#9B59B6,#B87DD4)",
	"Delivery":     "linear-gradient(135deg,#1ABC9C,#3DD9BA)",
	"Inspection":   "linear-gradient(135deg,#F39C12,#F5B942)",
	"Other":        "linear-gradient(135deg,#7F8C8D,#A0B0B1)",
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
let _CAL_WEEK_START = null;
let _CAL_EVENTS     = [];
let _CAL_HOST       = null;
let _CAL_TIMER      = null;
let _CAL_BUSY       = false;
let _CAL_VIEW       = "week";   // "week" | "gantt"
let _CAL_SEARCH     = "";
let _CAL_DRAG       = null;

// ── Frappe list settings ──────────────────────────────────────────────────────
frappe.listview_settings[CAL_DOCTYPE] = {
	add_fields: ["name"],
	page_length: 1,
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
			fields: ["name","title","status","event_type","color",
				"start_date","end_date","start_time","end_time",
				"assigned_to","contact_person","crew_number","location"],
			filters: [
				["start_date",">=",cal_fmt(_CAL_WEEK_START)],
				["start_date","<=",cal_fmt(we)],
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

// ── Filtered events ───────────────────────────────────────────────────────────
function cal_filtered() {
	if (!_CAL_SEARCH) return _CAL_EVENTS;
	const q = _CAL_SEARCH.toLowerCase();
	return _CAL_EVENTS.filter(e =>
		(e.title || "").toLowerCase().includes(q) ||
		(e.event_type || "").toLowerCase().includes(q) ||
		(e.assigned_to || "").toLowerCase().includes(q) ||
		(e.contact_person || "").toLowerCase().includes(q) ||
		(e.location || "").toLowerCase().includes(q)
	);
}

// ── Render orchestrator ───────────────────────────────────────────────────────
function cal_render() {
	if (!_CAL_HOST) return;
	if (_CAL_TIMER) { clearInterval(_CAL_TIMER); _CAL_TIMER = null; }

	const today = new Date(); today.setHours(0,0,0,0);
	const wrap = document.createElement("div");
	wrap.className = "cal-root";
	wrap.appendChild(cal_build_nav());

	if (_CAL_VIEW === "gantt") {
		wrap.appendChild(cal_build_gantt());
	} else {
		wrap.appendChild(cal_build_day_headers(today));
		wrap.appendChild(cal_build_body(today));
	}

	_CAL_HOST.innerHTML = "";
	_CAL_HOST.appendChild(wrap);
	cal_bind(_CAL_HOST);

	if (_CAL_VIEW === "week") {
		cal_start_timer(wrap, today);
		requestAnimationFrame(() => {
			const body = wrap.querySelector(".cal-body");
			if (!body) return;
			const now    = new Date();
			const nowMin = now.getHours() * 60 + now.getMinutes();
			body.scrollTop = Math.max(0, ((nowMin - CAL_START_H * 60 - 60) / 30) * CAL_SLOT_H);
		});
	}

	requestAnimationFrame(() => _positionViewInd(wrap));
}

// ── Navigation bar ────────────────────────────────────────────────────────────
function cal_build_nav() {
	const ws  = _CAL_WEEK_START;
	const we  = cal_add_days(ws, 6);
	const fmt = d => `${d.getDate()} ${CAL_MON_SHORT[d.getMonth()]}`;
	const searchVal = _CAL_SEARCH ? ` value="${_CAL_SEARCH.replace(/"/g,"&quot;")}"` : "";

	const nav = document.createElement("div");
	nav.className = "cal-nav";
	nav.innerHTML = `
		<div class="cal-nav-left">
			<button class="cal-nav-btn js-cal-prev">&#8249;</button>
			<button class="cal-nav-btn js-cal-today">Today</button>
			<button class="cal-nav-btn js-cal-next">&#8250;</button>
		</div>
		<div class="cal-nav-center">
			<span class="cal-week-label">${fmt(ws)} – ${fmt(we)}, ${we.getFullYear()}</span>
		</div>
		<div class="cal-nav-right">
			<div class="cal-search-wrap">
				<svg class="cal-search-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
				<input class="cal-search js-cal-search" type="text" placeholder="Search events…"${searchVal}>
			</div>
			<div class="cal-view-toggle">
				<div class="cal-vt-ind"></div>
				<button class="cal-vt-btn js-cal-week${_CAL_VIEW==="week"?" active":""}" data-view="week">
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><line x1="1" y1="7" x2="15" y2="7"/><line x1="5" y1="3" x2="5" y2="13"/><line x1="11" y1="3" x2="11" y2="13"/></svg>
					Week
				</button>
				<button class="cal-vt-btn js-cal-gantt${_CAL_VIEW==="gantt"?" active":""}" data-view="gantt">
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="2" y1="4" x2="2" y2="12"/><rect x="3" y="3" width="7" height="2.5" rx="1.2"/><rect x="3" y="7" width="10" height="2.5" rx="1.2"/><rect x="3" y="11" width="5" height="2.5" rx="1.2"/></svg>
					Gantt
				</button>
			</div>
		</div>`;
	return nav;
}

function _positionViewInd(wrap) {
	const active = wrap.querySelector(".cal-vt-btn.active");
	const ind    = wrap.querySelector(".cal-vt-ind");
	if (!active || !ind) return;
	const track = active.parentElement;
	const tr    = track.getBoundingClientRect();
	const ar    = active.getBoundingClientRect();
	ind.style.width  = ar.width  + "px";
	ind.style.height = ar.height + "px";
	ind.style.left   = (ar.left - tr.left) + "px";
	ind.style.top    = (ar.top  - tr.top)  + "px";
}

// ── Day header row (week view) ────────────────────────────────────────────────
function cal_build_day_headers(today) {
	const row = document.createElement("div");
	row.className = "cal-day-headers";
	const gutter = document.createElement("div");
	gutter.className = "cal-gutter-head";
	row.appendChild(gutter);
	for (let i = 0; i < 7; i++) {
		const day    = cal_add_days(_CAL_WEEK_START, i);
		const isToday = day.getTime() === today.getTime();
		const hd     = document.createElement("div");
		hd.className = `cal-day-head${isToday ? " cal-day-head--today" : ""}`;
		hd.innerHTML =
			`<span class="cal-day-name">${CAL_DAY_SHORT[day.getDay()]}</span>` +
			`<span class="cal-day-num${isToday ? " cal-day-num--today" : ""}">${day.getDate()}</span>`;
		row.appendChild(hd);
	}
	return row;
}

// ── Week body ─────────────────────────────────────────────────────────────────
function cal_build_body(today) {
	const body = document.createElement("div");
	body.className = "cal-body";
	const grid = document.createElement("div");
	grid.className = "cal-grid";
	grid.appendChild(cal_build_gutter());
	const evs = cal_filtered();
	for (let i = 0; i < 7; i++) {
		const day     = cal_add_days(_CAL_WEEK_START, i);
		const isToday = day.getTime() === today.getTime();
		const dateStr = cal_fmt(day);
		grid.appendChild(cal_build_day_col(day, isToday, evs.filter(e => e.start_date === dateStr)));
	}
	body.appendChild(grid);
	return body;
}

function cal_build_gutter() {
	const gutter = document.createElement("div");
	gutter.className = "cal-time-gutter";
	for (let h = CAL_START_H; h < CAL_END_H; h++) {
		const lbl = document.createElement("div");
		lbl.className    = "cal-time-label";
		lbl.style.height = `${CAL_SLOT_H * 2}px`;
		lbl.textContent  = `${String(h).padStart(2,"0")}:00`;
		gutter.appendChild(lbl);
	}
	return gutter;
}

function cal_build_day_col(day, isToday, dayEvents) {
	const col = document.createElement("div");
	col.className    = `cal-day-col${isToday ? " cal-day-col--today" : ""}`;
	col.dataset.date = cal_fmt(day);
	col.style.height = `${CAL_TOTAL_H}px`;
	for (let s = 0; s < CAL_TOTAL_SLOTS; s++) {
		const totalMin = CAL_START_H * 60 + s * 30;
		const h  = Math.floor(totalMin / 60);
		const m  = totalMin % 60;
		const sl = document.createElement("div");
		sl.className  = `cal-slot cal-slot--${m === 0 ? "hour" : "half"}`;
		sl.style.height = `${CAL_SLOT_H}px`;
		sl.dataset.time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
		col.appendChild(sl);
	}
	for (const ev of cal_layout(dayEvents)) {
		const block = cal_event_block(ev);
		if (block) col.appendChild(block);
	}
	return col;
}

// ── Gantt view ────────────────────────────────────────────────────────────────
function cal_build_gantt() {
	const evs    = cal_filtered();
	const days   = Array.from({length:7}, (_,i) => cal_add_days(_CAL_WEEK_START, i));
	const people = [...new Set(evs.map(e => e.assigned_to || "Unassigned"))].sort();
	if (!people.length) people.push("Unassigned");

	const wrap = document.createElement("div");
	wrap.className = "cal-gantt";

	// Header row
	const hdr = document.createElement("div");
	hdr.className = "cal-gantt-hdr";
	hdr.innerHTML = `<div class="cal-gantt-label-head">Assigned To</div>` +
		days.map(d => {
			const today = new Date(); today.setHours(0,0,0,0);
			const isT   = d.getTime() === today.getTime();
			return `<div class="cal-gantt-day-head${isT ? " cal-gantt-day--today" : ""}">
				<span class="cal-day-name">${CAL_DAY_SHORT[d.getDay()]}</span>
				<span class="cal-day-num${isT ? " cal-day-num--today" : ""}">${d.getDate()}</span>
			</div>`;
		}).join("");
	wrap.appendChild(hdr);

	// One row per person
	people.forEach(person => {
		const row = document.createElement("div");
		row.className = "cal-gantt-row";

		const lbl = document.createElement("div");
		lbl.className = "cal-gantt-label";
		const initials = person.split(/[\s@._-]+/).map(s=>s[0]?.toUpperCase()||"").join("").slice(0,2) || "?";
		lbl.innerHTML = `<span class="cal-gantt-av">${initials}</span><span class="cal-gantt-person">${frappe.utils.escape_html(person.split("@")[0])}</span>`;
		row.appendChild(lbl);

		days.forEach(day => {
			const dateStr  = cal_fmt(day);
			const cell     = document.createElement("div");
			cell.className = "cal-gantt-cell";
			cell.dataset.date   = dateStr;
			cell.dataset.person = person;

			const dayEvs = evs.filter(e =>
				e.start_date === dateStr &&
				(e.assigned_to || "Unassigned") === person
			).sort((a,b) => (a.start_time||"").localeCompare(b.start_time||""));

			dayEvs.forEach(ev => {
				const pill = document.createElement("div");
				pill.className    = "cal-gantt-pill";
				pill.dataset.name = ev.name;
				const grad = CAL_TYPE_GRAD[ev.event_type] || "linear-gradient(135deg,#4A90D9,#6AAFE0)";
				pill.style.background = grad;
				const st = cal_disp(ev.start_time);
				const et = cal_disp(ev.end_time);
				pill.innerHTML =
					`<span class="cal-gp-time">${st}${et !== "—" ? "–"+et : ""}</span>` +
					`<span class="cal-gp-title">${frappe.utils.escape_html(ev.title||"")}</span>`;
				if (ev.status === "Cancelled") pill.style.opacity = "0.45";
				cell.appendChild(pill);
			});

			row.appendChild(cell);
		});
		wrap.appendChild(row);
	});

	return wrap;
}

// ── Overlap layout ────────────────────────────────────────────────────────────
function cal_layout(events) {
	const timed = events.filter(e => e.start_time)
		.sort((a,b) => a.start_time.localeCompare(b.start_time));
	const cols = [];
	for (const ev of timed) {
		const startMin = cal_t2m(ev.start_time);
		ev._endTime    = ev.end_time || cal_m2t(startMin + 30);
		let placed = false;
		for (let c = 0; c < cols.length; c++) {
			if (startMin >= cal_t2m(cols[c]._endTime)) {
				ev._col = c; cols[c] = ev; placed = true; break;
			}
		}
		if (!placed) { ev._col = cols.length; cols.push(ev); }
	}
	for (const ev of timed) {
		const s0 = cal_t2m(ev.start_time), e0 = cal_t2m(ev._endTime);
		let mx = ev._col;
		for (const o of timed) {
			if (o === ev) continue;
			const s1 = cal_t2m(o.start_time), e1 = cal_t2m(o._endTime);
			if (s0 < e1 && s1 < e0) mx = Math.max(mx, o._col ?? 0);
		}
		ev._totalCols = mx + 1;
	}
	return timed;
}

// ── Event block ───────────────────────────────────────────────────────────────
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

	const grad   = CAL_TYPE_GRAD[ev.event_type] || "linear-gradient(135deg,#4A90D9,#6AAFE0)";
	const border = CAL_STATUS_BORDER[ev.status] || "#4A90D9";

	const block = document.createElement("div");
	block.className    = "cal-event";
	block.dataset.name = ev.name;
	block.style.cssText =
		`top:${top}px;height:${Math.max(height - 2,14)}px;` +
		`left:${lPct.toFixed(2)}%;width:${wPct.toFixed(2)}%;` +
		`background:${grad};border-left:3px solid ${border};` +
		`${ev.status==="Cancelled" ? "opacity:.45;" : ""}`;

	const timeStr  = `${cal_disp(ev.start_time)} – ${cal_disp(ev.end_time)}`;
	const showMeta = height >= CAL_SLOT_H * 1.8;
	const crewHtml = ev.crew_number > 0 ? `<span class="cal-ev-crew">👥 ${ev.crew_number}</span>` : "";
	const cntcHtml = ev.contact_person ? `<span class="cal-ev-contact">${frappe.utils.escape_html(ev.contact_person)}</span>` : "";
	const typeHtml = ev.event_type ? `<span class="cal-ev-type">${__(ev.event_type)}</span>` : "";

	block.innerHTML =
		`<div class="cal-ev-time">${timeStr}</div>` +
		`<div class="cal-ev-title">${frappe.utils.escape_html(ev.title||"")}</div>` +
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
}

// ── Event binding ─────────────────────────────────────────────────────────────
function cal_bind(hostEl) {
	const $host = $(hostEl);

	// Navigation
	$host.on("click.calnav", ".js-cal-prev",  () => cal_nav(-7));
	$host.on("click.calnav", ".js-cal-next",  () => cal_nav(+7));
	$host.on("click.calnav", ".js-cal-today", () => {
		_CAL_WEEK_START = cal_week_start(new Date()); cal_loading(); cal_fetch();
	});

	// View toggle
	$host.on("click.calview", ".cal-vt-btn", function () {
		_CAL_VIEW = this.dataset.view;
		cal_render();
	});

	// Search
	$host.on("input.calsearch", ".js-cal-search", function () {
		_CAL_SEARCH = this.value;
		cal_render_content(hostEl.querySelector(".cal-root"));
	});

	// Drag-select (week view)
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
		if (!slot || slot.closest(".cal-day-col") !== _CAL_DRAG.col) return;
		const t = slot.dataset.time;
		if (t >= _CAL_DRAG.startTime) _CAL_DRAG.endTime = t;
		else { _CAL_DRAG.startTime = t; }
		cal_drag_highlight(_CAL_DRAG);
	});

	document.addEventListener("mouseup", function () {
		if (!_CAL_DRAG) return;
		const { date, startTime, endTime } = _CAL_DRAG;
		_CAL_DRAG = null;
		cal_drag_clear(hostEl);
		if (date && startTime) cal_quick_create(date, startTime, cal_m2t(cal_t2m(endTime) + 30));
	});

	// Event click
	$host.on("click.calev", ".cal-event, .cal-gantt-pill", function (e) {
		e.stopPropagation();
		const name = this.dataset.name;
		if (name) frappe.set_route("Form", CAL_DOCTYPE, name);
	});

	// Gantt cell click → create
	$host.on("click.gangcell", ".cal-gantt-cell", function (e) {
		if (e.target.closest(".cal-gantt-pill")) return;
		const date   = this.dataset.date;
		const person = this.dataset.person;
		if (date) cal_quick_create(date, "09:00:00", "10:00:00", person !== "Unassigned" ? person : "");
	});
}

function cal_render_content(root) {
	if (!root) return;
	const today = new Date(); today.setHours(0,0,0,0);
	if (_CAL_VIEW === "gantt") {
		const old = root.querySelector(".cal-gantt");
		if (old) old.replaceWith(cal_build_gantt());
	} else {
		const old = root.querySelector(".cal-body");
		if (old) old.replaceWith(cal_build_body(today));
	}
}

function cal_drag_highlight(drag) {
	if (!drag.col) return;
	drag.col.querySelectorAll(".cal-slot").forEach(s => {
		s.classList.toggle("cal-slot--drag", s.dataset.time >= drag.startTime && s.dataset.time <= drag.endTime);
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
	if (_CAL_HOST) _CAL_HOST.innerHTML = `<div class="cal-loading">Loading…</div>`;
}

// ── Quick-create dialog ───────────────────────────────────────────────────────
function cal_quick_create(dateStr, startTime, presetEndTime, presetAssigned) {
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
					doctype: CAL_DOCTYPE, title: vals.title,
					event_type: vals.event_type || "", status: "Draft",
					start_date: dateStr, end_date: dateStr,
					start_time: vals.start_time || startTime,
					end_time:   vals.end_time   || endTime,
					contact_person: vals.contact_person || "",
					crew_number:    vals.crew_number    || 0,
					location:       vals.location       || "",
					assigned_to:    presetAssigned || "",
				}},
				callback({ exc, message }) {
					if (exc || !message) return;
					frappe.show_alert({ message: __("Event created"), indicator: "green" }, 1.5);
					dlg.hide(); cal_fetch();
				},
			});
		},
		secondary_action() {
			const title = dlg.get_value("title") || __("New Event");
			dlg.hide();
			frappe.call({
				method: "frappe.client.insert",
				args: { doc: {
					doctype: CAL_DOCTYPE, title, status: "Draft",
					start_date: dateStr, end_date: dateStr,
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
	const d = new Date(date); d.setHours(0,0,0,0);
	const day = d.getDay();
	d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
	return d;
}
function cal_add_days(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function cal_fmt(date) {
	return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function cal_t2m(t) { if (!t) return 0; const [h,m] = t.split(":").map(Number); return h*60+(m||0); }
function cal_m2t(min) {
	const h = Math.floor((min%1440)/60), m = min%60;
	return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
}
function cal_disp(t) { if (!t) return "—"; const [h,m] = t.split(":"); return `${h}:${m}`; }
function cal_hex_alpha(hex, alpha) {
	const h = hex.replace("#","");
	return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
}

// ── Styles ────────────────────────────────────────────────────────────────────
function cal_inject_styles() {
	if (document.getElementById("cal-styles")?.dataset.version === CAL_STYLE_VER) return;
	document.getElementById("cal-styles")?.remove();
	const s = Object.assign(document.createElement("style"), { id: "cal-styles" });
	s.dataset.version = CAL_STYLE_VER;
	s.textContent = `
		/* ── Host ── */
		.cal-gl-host { width:100%; padding:16px 20px 32px; box-sizing:border-box; }

		/* ── Root card ── */
		.cal-root {
			display:flex; flex-direction:column;
			border-radius:16px; overflow:hidden;
			box-shadow:0 4px 32px rgba(30,63,133,0.13);
			font-size:12px; user-select:none;
		}

		/* ── Brand gradient nav bar ── */
		.cal-nav {
			display:flex; align-items:center; gap:12px; padding:12px 16px;
			background:linear-gradient(135deg,#1a3576 0%,#1e3f85 40%,#3a6fd8 100%);
			flex-shrink:0;
		}
		.cal-nav-left  { display:flex; gap:6px; align-items:center; }
		.cal-nav-center { flex:1; text-align:center; }
		.cal-week-label { font-size:14px; font-weight:700; color:#fff; letter-spacing:.01em; }
		.cal-nav-right { display:flex; align-items:center; gap:10px; }

		/* Nav buttons */
		.cal-nav-btn {
			padding:5px 14px; border-radius:20px; cursor:pointer;
			border:1.5px solid rgba(255,255,255,.3); background:rgba(255,255,255,.12);
			font-size:12px; font-weight:600; color:#fff;
			transition:all .15s; min-width:32px;
		}
		.cal-nav-btn:hover { background:rgba(255,255,255,.25); border-color:rgba(255,255,255,.7); }

		/* Search */
		.cal-search-wrap { position:relative; display:flex; align-items:center; }
		.cal-search-ic { position:absolute; left:9px; width:13px; height:13px; color:rgba(255,255,255,.55); pointer-events:none; }
		.cal-search {
			height:30px; padding:0 12px 0 30px;
			border:1.5px solid rgba(255,255,255,.25); border-radius:99px;
			background:rgba(255,255,255,.13); color:#fff; font-size:12px;
			width:150px; outline:none; font-family:inherit;
			transition:width .2s,border-color .15s,background .15s;
		}
		.cal-search::placeholder { color:rgba(255,255,255,.45); }
		.cal-search:focus { width:200px; border-color:rgba(255,255,255,.7); background:rgba(255,255,255,.2); }

		/* View toggle pill */
		.cal-view-toggle {
			position:relative; display:flex; gap:2px;
			background:rgba(255,255,255,.15); border-radius:99px;
			padding:3px; border:1px solid rgba(255,255,255,.2);
		}
		.cal-vt-ind {
			position:absolute; border-radius:99px;
			background:#fff; transition:all .22s cubic-bezier(.4,0,.2,1);
			pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,.18);
		}
		.cal-vt-btn {
			position:relative; z-index:1; display:inline-flex; align-items:center;
			gap:5px; padding:4px 12px; border-radius:99px; cursor:pointer;
			border:none; background:transparent; font-size:11px; font-weight:600;
			color:rgba(255,255,255,.75); transition:color .2s;
		}
		.cal-vt-btn svg { width:13px; height:13px; }
		.cal-vt-btn.active { color:#1e3f85; }

		/* ── Day headers (week) ── */
		.cal-day-headers {
			display:flex; flex-shrink:0; background:#f8faff;
			border-bottom:1px solid #e0e7f5;
		}
		.cal-gutter-head { width:${CAL_GUTTER_W}px; flex-shrink:0; }
		.cal-day-head {
			flex:1; text-align:center; padding:8px 4px 10px;
			border-left:1px solid #e0e7f5;
		}
		.cal-day-head--today { background:rgba(58,111,216,.06); }
		.cal-day-name {
			display:block; font-size:10px; font-weight:700; color:#8d9ab5;
			text-transform:uppercase; letter-spacing:.08em;
		}
		.cal-day-num {
			display:inline-block; font-size:18px; font-weight:300;
			color:#2d3a50; margin-top:2px; line-height:1.2;
		}
		.cal-day-num--today {
			background:linear-gradient(135deg,#1e3f85,#3a6fd8); color:#fff;
			border-radius:50%; width:30px; height:30px;
			line-height:30px; text-align:center;
			font-size:14px; font-weight:700;
		}

		/* ── Scrollable body ── */
		.cal-body { overflow-y:auto; max-height:calc(100vh - 320px); flex:1; background:#fff; }

		/* ── Time grid ── */
		.cal-grid { display:flex; background:#fff; }
		.cal-time-gutter { width:${CAL_GUTTER_W}px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid #e0e7f5; background:#f8faff; }
		.cal-time-label {
			display:flex; align-items:flex-start; justify-content:flex-end;
			padding:0 8px 0 0; box-sizing:border-box;
			font-size:10px; color:#a0adc5; font-variant-numeric:tabular-nums;
			transform:translateY(-7px);
		}

		/* ── Day columns ── */
		.cal-day-col { flex:1; position:relative; border-left:1px solid #e8edf7; box-sizing:border-box; min-width:0; }
		.cal-day-col--today { background:rgba(58,111,216,.025); }

		/* ── Slots ── */
		.cal-slot { position:relative; width:100%; box-sizing:border-box; cursor:crosshair; }
		.cal-slot--hour { border-top:1px solid #e8edf7; }
		.cal-slot--half { border-top:1px dashed rgba(0,0,0,.05); }
		.cal-slot:hover { background:rgba(58,111,216,.06); }
		.cal-slot--drag { background:rgba(58,111,216,.18) !important; }

		/* ── Event blocks ── */
		.cal-event {
			position:absolute; border-radius:6px;
			padding:3px 6px; overflow:hidden; box-sizing:border-box;
			cursor:pointer; z-index:2; color:#fff;
			transition:filter .12s,box-shadow .12s,transform .1s;
		}
		.cal-event:hover { filter:brightness(0.92); box-shadow:0 4px 14px rgba(0,0,0,.22); z-index:10; transform:translateY(-1px); }
		.cal-ev-time    { font-size:9.5px; font-weight:600; opacity:.88; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
		.cal-ev-title   { font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3; }
		.cal-ev-meta    { display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:2px; }
		.cal-ev-type    { font-size:9px; font-weight:600; opacity:.85; padding:1px 5px; border-radius:4px; background:rgba(255,255,255,.25); white-space:nowrap; }
		.cal-ev-contact { font-size:10px; opacity:.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px; }
		.cal-ev-crew    { font-size:10px; opacity:.9; white-space:nowrap; }

		/* ── Now line ── */
		.cal-now-line { position:absolute; left:0; right:0; border-top:2px solid #e74c3c; z-index:20; pointer-events:none; }
		.cal-now-dot  { position:absolute; left:-4px; top:-5px; width:9px; height:9px; border-radius:50%; background:#e74c3c; box-shadow:0 0 0 2px #fff; }

		/* ── Loading ── */
		.cal-loading { padding:60px 20px; text-align:center; color:#8d9ab5; font-size:13px; }

		/* ── Gantt view ── */
		.cal-gantt { flex:1; overflow-y:auto; overflow-x:auto; max-height:calc(100vh - 260px); background:#fff; }
		.cal-gantt-hdr {
			display:grid; grid-template-columns:160px repeat(7,1fr);
			position:sticky; top:0; z-index:5;
			background:linear-gradient(135deg,#1a3576,#3a6fd8); color:#fff;
		}
		.cal-gantt-label-head {
			padding:10px 14px; font-size:11px; font-weight:700;
			border-right:1px solid rgba(255,255,255,.2);
		}
		.cal-gantt-day-head {
			padding:6px 4px 8px; text-align:center;
			border-left:1px solid rgba(255,255,255,.15);
		}
		.cal-gantt-day-head .cal-day-name { color:rgba(255,255,255,.75); }
		.cal-gantt-day-head .cal-day-num  { color:#fff; }
		.cal-gantt-day--today { background:rgba(255,255,255,.12); }

		.cal-gantt-row {
			display:grid; grid-template-columns:160px repeat(7,1fr);
			border-bottom:1px solid #e8edf7; min-height:52px;
			transition:background .12s;
		}
		.cal-gantt-row:hover { background:#f5f8ff; }
		.cal-gantt-label {
			padding:8px 12px; display:flex; align-items:center; gap:8px;
			border-right:1px solid #e0e7f5; position:sticky; left:0;
			background:inherit; z-index:2;
		}
		.cal-gantt-av {
			width:28px; height:28px; border-radius:50%; flex-shrink:0;
			background:linear-gradient(135deg,#1e3f85,#3a6fd8); color:#fff;
			display:flex; align-items:center; justify-content:center;
			font-size:10px; font-weight:700;
		}
		.cal-gantt-person { font-size:11px; font-weight:600; color:#2d3a50; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
		.cal-gantt-cell {
			padding:4px; border-left:1px solid #e8edf7;
			display:flex; flex-direction:column; gap:3px;
			cursor:pointer; transition:background .1s;
			min-height:52px;
		}
		.cal-gantt-cell:hover { background:rgba(58,111,216,.05); }
		.cal-gantt-pill {
			border-radius:5px; padding:3px 7px; cursor:pointer; color:#fff;
			transition:filter .12s,transform .1s; box-shadow:0 1px 4px rgba(0,0,0,.15);
		}
		.cal-gantt-pill:hover { filter:brightness(.9); transform:scale(1.02); }
		.cal-gp-time  { display:block; font-size:9px; font-weight:600; opacity:.85; }
		.cal-gp-title { display:block; font-size:10px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

		/* ── Hide Frappe chrome ── */
		[data-page-route="List/Custom Calendar Event/List"] .page-head,
		[data-page-route="List/Custom Calendar Event/List"] .page-form,
		[data-page-route="List/Custom Calendar Event/List"] .list-row-head,
		[data-page-route="List/Custom Calendar Event/List"] .list-headers,
		[data-page-route="List/Custom Calendar Event/List"] .list-subjects,
		[data-page-route="List/Custom Calendar Event/List"] .frappe-list-head { display:none !important; }

		/* ── Responsive ── */
		@media (max-width:860px) {
			.cal-day-num { font-size:14px; }
			.cal-ev-meta { display:none; }
			.cal-ev-title { font-size:10px; }
			.cal-search { width:120px; }
		}
	`;
	document.head.appendChild(s);
}

})(); // end IIFE
