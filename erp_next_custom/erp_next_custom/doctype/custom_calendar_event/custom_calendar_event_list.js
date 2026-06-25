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
const CAL_STYLE_VER   = "v10";

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
	// Normalize HH:mm → HH:mm:ss to avoid Frappe validation errors
	const _norm = t => t && t.split(":").length === 2 ? t + ":00" : (t || "");
	startTime        = _norm(startTime);
	const endTime    = _norm(presetEndTime) || cal_m2t(cal_t2m(startTime) + 60);

	const [y,m,d]   = dateStr.split("-");
	const dt        = new Date(+y, +m - 1, +d);
	const dateDisp  = `${CAL_DAY_SHORT[dt.getDay()]} ${+d} ${CAL_MON_SHORT[+m - 1]} ${y}`;

	// Time helper: HH:mm:ss → HH:mm for <input type="time">
	const toInput = t => t ? t.slice(0, 5) : "";
	// <input type="time"> value → HH:mm:ss
	const fromInput = v => v ? v + ":00" : "";

	const TYPES = ["Meeting","Site Visit","Installation","Survey","Delivery","Inspection","Other"];
	const TYPE_ICONS = {
		"Meeting":      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="5" r="2"/><circle cx="10.5" cy="5" r="2"/><path d="M1.5 13c0-2.21 1.79-4 4-4h5c2.21 0 4 1.79 4 4"/></svg>`,
		"Site Visit":   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.49-2.01-4.5-4.5-4.5z"/><circle cx="8" cy="6" r="1.5"/></svg>`,
		"Installation": `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l1.5 1.5-7 7-2 .5.5-2 7-7z"/><path d="M9 4l2 2"/></svg>`,
		"Survey":       `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><line x1="5" y1="5.5" x2="11" y2="5.5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="10.5" x2="8.5" y2="10.5"/></svg>`,
		"Delivery":     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="9" height="7" rx="1"/><path d="M10 7h2.5l2 3v2H10V7z"/><circle cx="4" cy="13" r="1.2"/><circle cx="12.5" cy="13" r="1.2"/></svg>`,
		"Inspection":   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="9.9" y1="9.9" x2="14" y2="14"/><line x1="5" y1="6.5" x2="8" y2="6.5"/><line x1="6.5" y1="5" x2="6.5" y2="8"/></svg>`,
		"Other":        `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></svg>`,
	};

	const PALETTE = ["#4A90D9","#27AE60","#E67E22","#9B59B6","#1ABC9C","#F39C12","#E74C3C","#2C3E50","#7F8C8D"];

	let selType  = "";
	let selColor = "";

	// ── Build overlay ────────────────────────────────────────────────────────────
	const overlay = document.createElement("div");
	overlay.className = "cce-overlay";
	overlay.innerHTML = `
<div class="cce-modal" role="dialog" aria-modal="true">

  <div class="cce-header" id="cce-hdr">
    <div class="cce-header-top">
      <span class="cce-date-label"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" style="display:inline-block;vertical-align:middle;margin-right:5px;opacity:.85"><rect x="1" y="2" width="12" height="11" rx="1.5"/><line x1="1" y1="5.5" x2="13" y2="5.5"/><line x1="4.5" y1="1" x2="4.5" y2="3.5"/><line x1="9.5" y1="1" x2="9.5" y2="3.5"/></svg>${dateDisp}</span>
      <button class="cce-close-btn" id="cce-close" title="Close">
        <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
          <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <input class="cce-title-inp" id="cce-title" type="text" placeholder="Event title…" autocomplete="off">
  </div>

  <div class="cce-body">

    <!-- Type chips -->
    <div class="cce-section">
      <div class="cce-section-label">Event Type</div>
      <div class="cce-type-chips" id="cce-types">
        ${TYPES.map(t => `
          <button class="cce-type-chip" data-type="${t}" style="--chip-color:${CAL_TYPE_COLOR[t]}">
            <span class="cce-chip-icon">${TYPE_ICONS[t]}</span>
            <span class="cce-chip-label">${t}</span>
          </button>`).join("")}
      </div>
    </div>

    <!-- Time row -->
    <div class="cce-row-2">
      <div class="cce-field">
        <label class="cce-label">
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="5.5"/><polyline points="7,4 7,7 9.5,8.5"/></svg>
          Start Time
        </label>
        <input class="cce-input" id="cce-start" type="time" value="${toInput(startTime)}">
      </div>
      <div class="cce-field-arrow">→</div>
      <div class="cce-field">
        <label class="cce-label">
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="5.5"/><polyline points="7,4 7,7 9.5,8.5"/></svg>
          End Time
        </label>
        <input class="cce-input" id="cce-end" type="time" value="${toInput(endTime)}">
      </div>
    </div>

    <!-- Contact + Location -->
    <div class="cce-row-2">
      <div class="cce-field">
        <label class="cce-label">
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="5" r="2.5"/><path d="M2.5 12.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5"/></svg>
          Contact Person
        </label>
        <input class="cce-input" id="cce-contact" type="text" placeholder="Name…" autocomplete="off">
      </div>
      <div class="cce-field">
        <label class="cce-label">
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 1.5C4.79 1.5 3 3.29 3 5.5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z"/><circle cx="7" cy="5.5" r="1.2"/></svg>
          Location
        </label>
        <input class="cce-input" id="cce-location" type="text" placeholder="Address or place…" autocomplete="off">
      </div>
    </div>

    <!-- Crew -->
    <div class="cce-row-crew">
      <div class="cce-field" style="max-width:140px">
        <label class="cce-label"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><circle cx="5" cy="4.5" r="2"/><circle cx="9.5" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4h1"/><path d="M7 12c0-2.21 1.79-4 4-4"/></svg> Crew No.</label>
        <input class="cce-input" id="cce-crew" type="number" min="0" placeholder="0">
      </div>
    </div>

    <!-- Color override -->
    <div class="cce-section">
      <div class="cce-section-label">Color Override <span class="cce-section-hint">(optional — leave blank to use type color)</span></div>
      <div class="cce-palette" id="cce-palette">
        ${PALETTE.map(c => `<button class="cce-swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
        <button class="cce-swatch cce-swatch-none" data-color="" title="Use type color">✕</button>
      </div>
    </div>

  </div>

  <div class="cce-footer">
    <button class="cce-btn-ghost" id="cce-cancel">Cancel</button>
    <button class="cce-btn-outline" id="cce-full">Edit Full Form</button>
    <button class="cce-btn-primary" id="cce-save">
      <svg viewBox="0 0 14 14" fill="none" width="12" height="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,7 6,11 12,3"/></svg>
      Save Event
    </button>
  </div>

</div>`;

	document.body.appendChild(overlay);
	requestAnimationFrame(() => overlay.classList.add("cce-overlay--in"));

	const modal  = overlay.querySelector(".cce-modal");
	const header = overlay.querySelector("#cce-hdr");
	const titleI = overlay.querySelector("#cce-title");

	// ── Color helpers ────────────────────────────────────────────────────────────
	function updateHeaderColor() {
		const color = selColor || CAL_TYPE_COLOR[selType] || "#0176d3";
		header.style.background = color;
	}

	function selectType(type) {
		selType = type;
		overlay.querySelectorAll(".cce-type-chip").forEach(ch => {
			ch.classList.toggle("cce-type-chip--active", ch.dataset.type === type);
		});
		updateHeaderColor();
	}

	function selectColor(color) {
		selColor = color;
		overlay.querySelectorAll(".cce-swatch").forEach(sw => {
			sw.classList.toggle("cce-swatch--active", sw.dataset.color === color);
		});
		updateHeaderColor();
	}

	// Init header color
	updateHeaderColor();

	// ── Close ────────────────────────────────────────────────────────────────────
	function closeModal() {
		overlay.classList.remove("cce-overlay--in");
		setTimeout(() => overlay.remove(), 220);
	}

	overlay.querySelector("#cce-close").addEventListener("click", closeModal);
	overlay.querySelector("#cce-cancel").addEventListener("click", closeModal);
	overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeModal(); });
	document.addEventListener("keydown", function _esc(e) {
		if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", _esc); }
	});

	// ── Type chips ───────────────────────────────────────────────────────────────
	overlay.querySelectorAll(".cce-type-chip").forEach(ch => {
		ch.addEventListener("click", () => selectType(
			selType === ch.dataset.type ? "" : ch.dataset.type
		));
	});

	// ── Palette ──────────────────────────────────────────────────────────────────
	overlay.querySelectorAll(".cce-swatch").forEach(sw => {
		sw.addEventListener("click", () => selectColor(sw.dataset.color));
	});

	// ── Save ─────────────────────────────────────────────────────────────────────
	function doSave(andOpen) {
		const title = titleI.value.trim();
		if (!title) { titleI.focus(); titleI.classList.add("cce-inp-err"); return; }
		titleI.classList.remove("cce-inp-err");

		const btn = overlay.querySelector("#cce-save");
		btn.disabled = true;
		btn.textContent = "Saving…";

		const start = fromInput(overlay.querySelector("#cce-start").value) || startTime;
		const end   = fromInput(overlay.querySelector("#cce-end").value)   || endTime;

		frappe.call({
			method: "frappe.client.insert",
			args: { doc: {
				doctype: CAL_DOCTYPE, title,
				event_type: selType || "",
				status: "Draft",
				start_date: dateStr, end_date: dateStr,
				start_time: start, end_time: end,
				contact_person: overlay.querySelector("#cce-contact").value.trim(),
				crew_number:    parseInt(overlay.querySelector("#cce-crew").value) || 0,
				location:       overlay.querySelector("#cce-location").value.trim(),
				assigned_to:    presetAssigned || "",
				color:          selColor || "",
			}},
			callback({ exc, message }) {
				btn.disabled = false;
				btn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" width="12" height="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,7 6,11 12,3"/></svg> Save Event`;
				if (exc || !message) return;
				closeModal();
				if (andOpen) frappe.set_route("Form", CAL_DOCTYPE, message.name);
				else { frappe.show_alert({ message: "Event created", indicator: "green" }, 1.5); cal_fetch(); }
			},
		});
	}

	overlay.querySelector("#cce-save").addEventListener("click", () => doSave(false));
	overlay.querySelector("#cce-full").addEventListener("click", () => doSave(true));

	setTimeout(() => titleI.focus(), 80);
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

		/* ══════════════════════════════════════════════════════════
		   QUICK-CREATE MODAL
		══════════════════════════════════════════════════════════ */
		.cce-overlay {
			position:fixed; inset:0; z-index:9999;
			background:rgba(15,25,50,.45); backdrop-filter:blur(4px);
			display:flex; align-items:center; justify-content:center;
			opacity:0; transition:opacity .2s ease;
		}
		.cce-overlay--in { opacity:1; }
		.cce-overlay--in .cce-modal {
			transform:translateY(0) scale(1);
			opacity:1;
		}

		.cce-modal {
			background:#fff; border-radius:20px;
			width:520px; max-width:calc(100vw - 32px);
			box-shadow:0 24px 80px rgba(0,0,0,.22), 0 4px 16px rgba(0,0,0,.12);
			overflow:hidden; display:flex; flex-direction:column;
			transform:translateY(18px) scale(.97); opacity:0;
			transition:transform .22s cubic-bezier(.2,0,.2,1), opacity .22s ease;
			font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;
		}

		/* ── Modal header (color-changing) ── */
		.cce-header {
			padding:18px 20px 16px;
			background:#0176d3;
			transition:background .3s ease;
			flex-shrink:0;
		}
		.cce-header-top {
			display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;
		}
		.cce-date-label {
			font-size:11px; font-weight:600; color:rgba(255,255,255,.8); letter-spacing:.03em;
		}
		.cce-close-btn {
			width:26px; height:26px; border-radius:50%; border:none;
			background:rgba(255,255,255,.18); color:#fff; cursor:pointer;
			display:flex; align-items:center; justify-content:center;
			transition:background .15s;
		}
		.cce-close-btn:hover { background:rgba(255,255,255,.32); }
		.cce-title-inp {
			width:100%; border:none; outline:none; background:transparent;
			font-size:20px; font-weight:700; color:#fff;
			placeholder-color:rgba(255,255,255,.5);
			caret-color:#fff; letter-spacing:-.02em;
		}
		.cce-title-inp::placeholder { color:rgba(255,255,255,.5); }
		.cce-title-inp.cce-inp-err { animation:cce-shake .3s ease; }
		@keyframes cce-shake {
			0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)}
		}

		/* ── Body ── */
		.cce-body { padding:18px 20px 8px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; max-height:60vh; }

		/* ── Section ── */
		.cce-section { display:flex; flex-direction:column; gap:8px; }
		.cce-section-label {
			font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8;
		}
		.cce-section-hint { font-weight:500; text-transform:none; letter-spacing:0; color:#c0c8d8; }

		/* ── Type chips ── */
		.cce-type-chips { display:flex; flex-wrap:wrap; gap:6px; }
		.cce-type-chip {
			display:inline-flex; align-items:center; gap:5px;
			padding:6px 12px; border-radius:99px; cursor:pointer;
			border:2px solid var(--chip-color); background:transparent;
			color:var(--chip-color); font-size:12px; font-weight:600;
			transition:all .16s; white-space:nowrap;
		}
		.cce-type-chip:hover {
			background:var(--chip-color); color:#fff; transform:translateY(-1px);
			box-shadow:0 4px 12px color-mix(in srgb, var(--chip-color) 40%, transparent);
		}
		.cce-type-chip--active {
			background:var(--chip-color); color:#fff;
			box-shadow:0 4px 14px color-mix(in srgb, var(--chip-color) 40%, transparent);
			transform:translateY(-1px);
		}
		.cce-chip-icon { width:13px; height:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
		.cce-chip-icon svg { width:13px; height:13px; }
		.cce-chip-label { font-size:12px; }

		/* ── Two-col row ── */
		.cce-row-2 {
			display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:end;
		}
		.cce-field-arrow { color:#cbd5e1; font-size:16px; padding-bottom:10px; text-align:center; }
		.cce-row-crew { display:flex; }

		/* ── Fields ── */
		.cce-field { display:flex; flex-direction:column; gap:5px; }
		.cce-label {
			display:flex; align-items:center; gap:5px;
			font-size:11px; font-weight:600; color:#64748b; letter-spacing:.02em;
		}
		.cce-input {
			padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:10px;
			font-size:13px; color:#1e293b; background:#f8fafc;
			outline:none; transition:border-color .15s, box-shadow .15s, background .15s;
			font-family:inherit; width:100%; box-sizing:border-box;
		}
		.cce-input:focus {
			border-color:#0176d3; background:#fff;
			box-shadow:0 0 0 3px rgba(1,118,211,.12);
		}

		/* ── Color palette ── */
		.cce-palette { display:flex; flex-wrap:wrap; gap:7px; align-items:center; }
		.cce-swatch {
			width:26px; height:26px; border-radius:50%; border:2.5px solid transparent;
			cursor:pointer; transition:transform .14s, box-shadow .14s, border-color .14s;
			flex-shrink:0;
		}
		.cce-swatch:hover { transform:scale(1.2); box-shadow:0 3px 10px rgba(0,0,0,.22); }
		.cce-swatch--active { border-color:#fff; box-shadow:0 0 0 2.5px currentColor, 0 3px 10px rgba(0,0,0,.2); transform:scale(1.15); }
		.cce-swatch-none {
			background:#f1f5f9 !important; color:#94a3b8; font-size:12px; font-weight:700;
			display:flex; align-items:center; justify-content:center; border-color:#e2e8f0;
		}
		.cce-swatch-none:hover { background:#e2e8f0 !important; }

		/* ── Footer ── */
		.cce-footer {
			display:flex; align-items:center; gap:8px; padding:14px 20px 18px;
			border-top:1px solid #f1f5f9; flex-shrink:0;
		}
		.cce-btn-ghost {
			padding:8px 14px; border:none; background:transparent;
			color:#94a3b8; font-size:12.5px; font-weight:600; cursor:pointer;
			border-radius:8px; transition:color .15s, background .15s; font-family:inherit;
		}
		.cce-btn-ghost:hover { color:#475569; background:#f1f5f9; }
		.cce-btn-outline {
			padding:8px 16px; border:1.5px solid #e2e8f0; background:#fff;
			color:#475569; font-size:12.5px; font-weight:600; cursor:pointer;
			border-radius:8px; transition:all .15s; font-family:inherit;
		}
		.cce-btn-outline:hover { border-color:#0176d3; color:#0176d3; }
		.cce-btn-primary {
			margin-left:auto; display:inline-flex; align-items:center; gap:6px;
			padding:9px 22px; border:none; border-radius:10px;
			background:#0176d3; color:#fff;
			font-size:13px; font-weight:700; cursor:pointer;
			box-shadow:0 4px 14px rgba(1,118,211,.35);
			transition:transform .15s, box-shadow .15s, background .15s; font-family:inherit;
		}
		.cce-btn-primary:hover { background:#0165b8; transform:translateY(-1px); box-shadow:0 6px 20px rgba(1,118,211,.4); }
		.cce-btn-primary:disabled { opacity:.65; transform:none; cursor:not-allowed; }
	`;
	document.head.appendChild(s);
}

})(); // end IIFE
