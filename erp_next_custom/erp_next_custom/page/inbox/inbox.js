"use strict";

frappe.pages["inbox"].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({ parent: wrapper, title: "Inbox", single_column: true });
    _inbox_render(wrapper);
};

frappe.pages["inbox"].on_page_show = function (wrapper) {
    _inbox_render(wrapper);
};

const _AVATAR_COLORS = ["#2563eb","#7c3aed","#0891b2","#059669","#d97706","#dc2626","#db2777"];
function _ibColor(name) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) & 0x7fffffff;
    return _AVATAR_COLORS[h % _AVATAR_COLORS.length];
}
function _ibIni(name) {
    const p = name.trim().split(/\s+/);
    return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length-1][0]).toUpperCase();
}

const SOURCE_ICONS = {
    gmail: `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`,
    linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    slack: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#4A154B"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>`,
};

const DEMO_MSGS = [
    { name: "Natasha Corwin", time: "3m",  preview: "Wants to share a sales contract from Brightstone Realty with all key details included", source: "gmail"    },
    { name: "Luke Rankin",    time: "8m",  preview: "Shares a project update for ITWA, including the latest progress and key milestones",   source: "linkedin" },
    { name: "Jack Callaghan", time: "8m",  preview: "Shares the next month's team meet talan, including dates and agenda highlights",        source: "slack"    },
    { name: "Dan Monroe",     time: "15m", preview: "Following up on the proposal sent last week, asking for feedback and next steps",        source: "gmail"    },
    { name: "Sara Ellis",     time: "1h",  preview: "Sent over the revised budget breakdown for Q3 — needs your sign-off before EOD",        source: "slack"    },
    { name: "Michael Torres", time: "2h",  preview: "Checking in on the partnership agreement draft and timeline for final approval",         source: "linkedin" },
];

function _inbox_render(wrapper) {
    const main = wrapper.querySelector(".layout-main-section");
    if (!main || main.dataset.ibLoaded) return;
    main.dataset.ibLoaded = "1";

    if (!document.getElementById("inbox-page-styles")) {
        const s = document.createElement("style");
        s.id = "inbox-page-styles";
        s.textContent = `
.ib-page { max-width: 600px; margin: 0 auto; padding: 28px 16px 60px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.ib-search-wrap { position: relative; margin-bottom: 22px; }
.ib-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
.ib-search {
    width: 100%; box-sizing: border-box;
    background: #fff; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 12px 16px 12px 40px;
    font-size: 14px; color: #1c1c1e; outline: none;
    box-shadow: 0 2px 8px rgba(0,0,0,.07);
    transition: border-color .14s, box-shadow .14s;
}
.ib-search:focus { border-color: #2563eb; box-shadow: 0 2px 8px rgba(37,99,235,.18); }
.ib-search::placeholder { color: #9ca3af; }
.ib-section-label { font-size: 18px; font-weight: 700; color: #1c1c1e; margin-bottom: 12px; }
.ib-list { display: flex; flex-direction: column; gap: 6px; }
.ib-item {
    display: flex; align-items: flex-start; gap: 13px;
    padding: 14px 14px; border-radius: 14px; cursor: pointer;
    background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.07);
    border: 1px solid #f0f0f5;
    transition: background .12s, box-shadow .12s;
}
.ib-item:hover { background: #f5f7ff; box-shadow: 0 2px 10px rgba(37,99,235,.10); }
.ib-avatar {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.18);
}
.ib-body { flex: 1; min-width: 0; }
.ib-row1 { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.ib-name { font-size: 14px; font-weight: 700; color: #1c1c1e; }
.ib-time { font-size: 11.5px; color: #9ca3af; margin-left: auto; white-space: nowrap; flex-shrink: 0; }
.ib-preview { font-size: 13px; color: #6b7280; line-height: 1.45; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-source { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 24px; padding-top: 2px; }
        `;
        document.head.appendChild(s);
    }

    main.innerHTML = `
<div class="ib-page">
    <div class="ib-search-wrap">
        <svg class="ib-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="ib-search" placeholder="Start typing to ask or search…" />
    </div>
    <div class="ib-section-label">Inbox</div>
    <div class="ib-list">
        ${DEMO_MSGS.map(m => `
        <div class="ib-item">
            <div class="ib-avatar" style="background:${_ibColor(m.name)}">${_ibIni(m.name)}</div>
            <div class="ib-body">
                <div class="ib-row1">
                    <span class="ib-name">${m.name}</span>
                    <span class="ib-time">${m.time}</span>
                </div>
                <div class="ib-preview">${m.preview}</div>
            </div>
            <div class="ib-source">${SOURCE_ICONS[m.source] || ""}</div>
        </div>
        `).join("")}
    </div>
</div>`;

    // live search filter
    main.querySelector(".ib-search").addEventListener("input", function () {
        const q = this.value.trim().toLowerCase();
        main.querySelectorAll(".ib-item").forEach((el, i) => {
            const m = DEMO_MSGS[i];
            el.style.display = (!q || m.name.toLowerCase().includes(q) || m.preview.toLowerCase().includes(q)) ? "" : "none";
        });
    });
}
