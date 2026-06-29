// Copyright (c) 2026, ASteamcode and contributors
// For license information, please see license.txt

(() => {
    "use strict";

    // ─── Person-to-URLs ────────────────────────────────────────────────────────
    function _personUrls(p) {
        const c = s => (s || "").replace(/^@/, "").trim();
        const urls = [];
        if (c(p.instagram)) urls.push(`https://www.instagram.com/${c(p.instagram)}/`);
        if (c(p.linkedin))  urls.push(`https://www.linkedin.com/in/${c(p.linkedin)}/`);
        if (c(p.facebook))  urls.push(`https://www.facebook.com/${c(p.facebook)}`);
        if (c(p.twitter))   urls.push(`https://x.com/${c(p.twitter)}`);
        if (p.website) {
            const w = p.website.trim();
            urls.push(w.startsWith("http") ? w : `https://${w}`);
        }
        return urls;
    }

    // ─── Prompt builder ────────────────────────────────────────────────────────
    function _buildPrompt(p) {
        const known = [];
        if (p.name)      known.push(`Name: ${p.name}`);
        if (p.email)     known.push(`Email: ${p.email}`);
        if (p.phone)     known.push(`Phone: ${p.phone}`);
        if (p.username)  known.push(`Username: ${p.username}`);
        if (p.company)   known.push(`Company: ${p.company}`);
        if (p.notes)     known.push(`Context: ${p.notes}`);

        const query = known.length ? known.join(" · ") : "unknown person";
        return `Find the public profile of this person: ${query}

Work in this PRIORITY ORDER and stop spending effort once you have enough:

1. LINKEDIN — most reliable. Find their LinkedIn profile URL first. Use it to \
anchor the rest (job_title, company, full_name).
2. CONTACT — if email or phone was not already given, look for a publicly listed \
email / phone.
3. INSTAGRAM & WEBSITE — find their Instagram profile URL and personal website.
4. DESCRIPTION — write one short factual sentence about who they are.

Return a single JSON object with ONLY confirmed fields (omit anything uncertain):
  full_name, linkedin_url, job_title, company,
  emails (array), phones (array),
  instagram_url, websites (array),
  twitter_url, facebook_url, usernames (array),
  description

Raw JSON only. No markdown. No explanation.`;
    }

    // ─── Loading messages ──────────────────────────────────────────────────────
    const HUNT_MSGS = [
        "Started the hunt",
        "Climbing the trees…",
        "Knocking on some doors",
        "Checking the usual spots",
        "Almost got something",
        "Piecing it together…",
        "One more second",
    ];

    // ─── Icons ────────────────────────────────────────────────────────────────
    const IC = {
        bolt:     `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        person:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        email:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>`,
        at:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`,
        building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        brief:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
        globe:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        phone:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.42 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        note:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        close:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        insta:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
        linkedin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
        facebook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
        xtwitter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
        external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    };

    // ─── CSS ──────────────────────────────────────────────────────────────────
    const CSS = `
        /* ── Fullscreen overlay ─────────────────────────────────────── */
        #sh-shazam {
            position: fixed;
            inset: 0;
            z-index: 9990;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
        }

        .sh-bg {
            width: 100%; height: 100%;
            background: linear-gradient(140deg, #0d2756 0%, #1e3f85 40%, #0e7490 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        /* soft radial bloom behind the bolt */
        .sh-bg::before {
            content: "";
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 55vmin; height: 55vmin;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%);
            pointer-events: none;
        }

        /* ── Center stage ─────────────────────────────────────────── */
        .sh-stage {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            position: relative;
            z-index: 1;
            user-select: none;
        }
        .sh-eyebrow {
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.36em;
            text-transform: uppercase;
            color: rgba(255,255,255,.28);
        }

        /* ── Lightning button ──────────────────────────────────────── */
        .sh-bolt-btn {
            width: 140px; height: 140px;
            border-radius: 50%;
            border: none;
            background: rgba(255,255,255,.06);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            -webkit-tap-highlight-color: transparent;
            transition: transform .25s cubic-bezier(.34,1.56,.64,1);
            outline: none;
        }
        .sh-bolt-btn:hover  { transform: scale(1.07); }
        .sh-bolt-btn:active { transform: scale(.93); }

        /* pulsing rings */
        .sh-ring {
            position: absolute;
            border-radius: 50%;
            border: 1.5px solid rgba(255,255,255,.1);
            animation: sh-ring-pulse 3s ease-out infinite;
            pointer-events: none;
        }
        .sh-ring-1 { inset: -20px; animation-delay: 0s; }
        .sh-ring-2 { inset: -44px; animation-delay: 1s;   border-color: rgba(255,255,255,.06); }
        .sh-ring-3 { inset: -72px; animation-delay: 2s;   border-color: rgba(255,255,255,.03); }
        @keyframes sh-ring-pulse {
            0%   { opacity: .85; transform: scale(.9); }
            100% { opacity: 0;   transform: scale(1.0); }
        }

        /* the bolt SVG itself */
        .sh-bolt-icon {
            width: 64px; height: 64px;
            color: #fff;
            position: relative;
            z-index: 1;
            animation: sh-bolt-glow 3.5s ease-in-out infinite;
        }
        @keyframes sh-bolt-glow {
            0%,100% { filter: drop-shadow(0 0 14px rgba(255,255,255,.42)); }
            50%      { filter: drop-shadow(0 0 32px rgba(255,255,255,.8))
                               drop-shadow(0 0 64px rgba(96,165,250,.5)); }
        }

        /* ── Loading arc around the bolt ──────────────────────────── */
        .sh-arc {
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            background: conic-gradient(#60a5fa 0%, #38bdf8 30%, transparent 30%);
            opacity: 0;
            transition: opacity .3s ease;
            animation: sh-arc-spin 1.1s linear infinite;
            pointer-events: none;
        }
        /* mask the fill, keep only the stroke */
        .sh-arc::after {
            content: "";
            position: absolute;
            inset: 5px;
            border-radius: 50%;
            background: rgba(13,39,86,.96);
        }
        @keyframes sh-arc-spin { to { transform: rotate(360deg); } }

        .sh-bolt-btn.hunting .sh-arc { opacity: 1; }
        .sh-bolt-btn.hunting .sh-ring { animation-play-state: paused; opacity: 0; }
        .sh-bolt-btn.hunting { cursor: default; transform: none !important; }

        /* ── Status caption + timer ────────────────────────────────── */
        .sh-caption {
            font-size: 14px;
            color: rgba(255,255,255,.36);
            font-weight: 500;
            letter-spacing: .03em;
            transition: opacity .35s ease;
            min-height: 1.4em;
            text-align: center;
        }
        .sh-caption.fade { opacity: 0; }

        .sh-timer {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .08em;
            color: rgba(255,255,255,.18);
            font-variant-numeric: tabular-nums;
            margin-top: 6px;
            min-height: 1em;
            text-align: center;
            transition: opacity .3s;
        }
        .sh-timer.hidden { opacity: 0; }

        /* ── Backdrop dim ─────────────────────────────────────────── */
        .sh-backdrop {
            position: absolute; inset: 0;
            background: transparent;
            transition: background .38s ease;
            z-index: 2;
            pointer-events: none;
        }
        .sh-backdrop.on {
            background: rgba(0,0,0,.52);
            pointer-events: auto;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
        }

        /* ── Sheet wrapper ────────────────────────────────────────── */
        .sh-sheet-wrap {
            position: absolute; bottom: 0; left: 0; right: 0;
            display: flex;
            justify-content: center;
            z-index: 3;
            pointer-events: none;
        }
        .sh-sheet-wrap.live { pointer-events: auto; }

        /* ── iOS bottom sheet ──────────────────────────────────────── */
        .sh-sheet {
            width: 100%;
            max-width: 540px;
            background: #f0f2f5;
            border-radius: 26px 26px 0 0;
            box-shadow: 0 -14px 60px rgba(0,0,0,.38);
            max-height: 90vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            transform: translateY(100%);
            transition: transform .52s cubic-bezier(.32,.72,0,1);
            padding-bottom: 32px;
        }
        .sh-sheet.open { transform: translateY(0); }

        .sh-handle {
            width: 40px; height: 4px;
            background: rgba(0,0,0,.13);
            border-radius: 99px;
            margin: 14px auto 0;
        }

        .sh-sheet-inner { padding: 0 18px; }

        .sh-title {
            font-size: 26px;
            font-weight: 800;
            color: #0f1117;
            letter-spacing: -.03em;
            padding: 16px 4px 2px;
        }
        .sh-subtitle {
            font-size: 13px;
            color: #9ca3af;
            padding: 0 4px 8px;
        }

        /* ── Blob field groups ─────────────────────────────────────── */
        .sh-grp { margin-top: 14px; }
        .sh-grp-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .11em;
            text-transform: uppercase;
            color: #b0b7c3;
            padding-left: 4px;
            margin-bottom: 6px;
        }

        .sh-row { display: grid; gap: 8px; }
        .sh-col2 { grid-template-columns: 1fr 1fr; }
        .sh-col4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

        /* the blob itself */
        .sh-blob {
            background: rgba(0,0,0,.058);
            border-radius: 14px;
            padding: 11px 13px;
            display: flex;
            align-items: center;
            gap: 9px;
            border: 2px solid transparent;
            transition: background .15s, border-color .15s, box-shadow .15s;
            cursor: text;
        }
        .sh-blob:focus-within {
            background: #fff;
            border-color: rgba(37,99,235,.22);
            box-shadow: 0 2px 16px rgba(37,99,235,.09);
        }
        .sh-blob--hero { padding: 14px 16px; border-radius: 18px; }
        .sh-blob--hero input { font-size: 20px; font-weight: 700; color: #111; }

        .sh-blob-ic {
            flex-shrink: 0;
            display: flex; align-items: center;
            color: #c4c9d4;
        }
        .sh-blob-ic svg { width: 16px; height: 16px; }

        /* social icon colours */
        .sh-blob-ic--ig   { color: #c13584; }
        .sh-blob-ic--li   { color: #0a66c2; }
        .sh-blob-ic--fb   { color: #1877f2; }
        .sh-blob-ic--x    { color: #1a1a1a; }

        .sh-blob input,
        .sh-blob textarea {
            border: none; background: none; outline: none;
            font-size: 14.5px; color: #111;
            width: 100%; font-family: inherit; line-height: 1.4;
        }
        .sh-blob input::placeholder,
        .sh-blob textarea::placeholder { color: #c4c9d4; }
        .sh-blob textarea { resize: none; min-height: 54px; }

        /* ── Hunt CTA ──────────────────────────────────────────────── */
        .sh-go-wrap { padding: 18px 0 0; }
        .sh-go {
            width: 100%;
            height: 54px;
            border: none;
            border-radius: 16px;
            background: linear-gradient(135deg, #1e3f85 0%, #2563eb 50%, #0891b2 100%);
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: .01em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            box-shadow: 0 4px 28px rgba(37,99,235,.4);
            transition: opacity .15s, transform .12s, box-shadow .15s;
            -webkit-tap-highlight-color: transparent;
        }
        .sh-go svg { width: 18px; height: 18px; }
        .sh-go:hover  { opacity: .92; transform: translateY(-1px); box-shadow: 0 6px 32px rgba(37,99,235,.52); }
        .sh-go:active { transform: scale(.98); }
        .sh-go[disabled] { opacity: .38; cursor: not-allowed; transform: none !important; }

        /* ── Results panel ─────────────────────────────────────────── */
        .sh-results {
            position: absolute; inset: 0;
            background: linear-gradient(160deg, #07101f 0%, #0d2756 100%);
            z-index: 5;
            overflow-y: auto;
            padding: 56px 22px 56px;
            transform: translateY(100%);
            transition: transform .48s cubic-bezier(.32,.72,0,1);
        }
        .sh-results.open { transform: translateY(0); }

        .sh-res-hd {
            display: flex; align-items: flex-start; justify-content: space-between;
            margin-bottom: 28px; gap: 12px;
        }
        .sh-res-name {
            font-size: 30px; font-weight: 800; color: #fff;
            letter-spacing: -.035em; line-height: 1.1;
        }
        .sh-res-sub { font-size: 13px; color: rgba(255,255,255,.38); margin-top: 5px; }
        .sh-res-x {
            width: 38px; height: 38px; border-radius: 50%;
            background: rgba(255,255,255,.1); border: none;
            color: rgba(255,255,255,.65); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; margin-top: 3px;
            transition: background .12s;
        }
        .sh-res-x:hover { background: rgba(255,255,255,.2); color: #fff; }
        .sh-res-x svg { width: 14px; height: 14px; }

        .sh-res-card {
            background: rgba(255,255,255,.07);
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 18px;
            padding: 16px 18px;
            margin-bottom: 10px;
        }
        .sh-res-clabel {
            font-size: 9px; font-weight: 800; letter-spacing: .13em;
            text-transform: uppercase; color: rgba(255,255,255,.28);
            margin-bottom: 10px;
        }
        .sh-res-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 7px 0;
            border-bottom: 1px solid rgba(255,255,255,.05);
            font-size: 13px;
        }
        .sh-res-row:last-child { border-bottom: none; padding-bottom: 0; }
        .sh-res-k {
            font-weight: 600; color: rgba(255,255,255,.32);
            min-width: 96px; flex-shrink: 0; font-size: 11.5px;
            padding-top: 1px;
        }
        .sh-res-v { color: #e2e8f0; flex: 1; word-break: break-word; line-height: 1.55; }
        .sh-res-v a {
            color: #60a5fa; text-decoration: none;
            display: inline-flex; align-items: center; gap: 3px;
        }
        .sh-res-v a:hover { text-decoration: underline; color: #93c5fd; }
        .sh-res-v a svg { width: 10px; height: 10px; opacity: .6; }
        .sh-chip {
            display: inline-block;
            background: rgba(255,255,255,.09);
            border-radius: 99px; padding: 2px 10px;
            font-size: 11.5px; color: #cbd5e1;
            margin: 2px 3px 2px 0;
        }

        .sh-no-data {
            text-align: center; padding: 64px 20px;
            color: rgba(255,255,255,.28); font-size: 14px;
        }

        /* ── Dig deeper button ─────────────────────────────────────── */
        .sh-deeper {
            width: 100%; margin-top: 14px;
            height: 48px; border: 1.5px solid rgba(255,255,255,.14);
            border-radius: 14px; background: rgba(255,255,255,.05);
            color: rgba(255,255,255,.7); font-size: 14px; font-weight: 600;
            cursor: pointer; display: flex; align-items: center;
            justify-content: center; gap: 8px;
            transition: background .15s, border-color .15s, color .15s;
            font-family: inherit;
        }
        .sh-deeper:hover { background: rgba(255,255,255,.11); color: #fff; border-color: rgba(255,255,255,.28); }
        .sh-deeper[disabled] { opacity: .38; cursor: not-allowed; }
        .sh-deeper svg { width: 15px; height: 15px; }

        /* ── New field highlight ───────────────────────────────────── */
        .sh-res-row.sh-new .sh-res-v {
            color: #7dd3fc;
            animation: sh-highlight-fade 3s ease forwards;
        }
        @keyframes sh-highlight-fade {
            0%   { color: #38bdf8; }
            100% { color: #e2e8f0; }
        }

        /* ── Possible / unverified accounts ───────────────────────── */
        .sh-res-card--possible {
            background: rgba(255,255,255,.035);
            border: 1px dashed rgba(255,255,255,.12);
        }
        .sh-res-card--possible .sh-res-clabel {
            color: rgba(255,193,7,.5);
        }
        .sh-possible-row {
            display: flex; align-items: center; gap: 9px;
            padding: 7px 0;
            border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .sh-possible-row:last-child { border-bottom: none; padding-bottom: 0; }
        .sh-possible-badge {
            font-size: 9px; font-weight: 800; letter-spacing: .08em;
            background: rgba(255,193,7,.15); color: rgba(255,193,7,.7);
            border-radius: 99px; padding: 2px 7px; flex-shrink: 0;
            text-transform: uppercase;
        }
        .sh-possible-row a {
            color: rgba(255,255,255,.5); font-size: 12.5px;
            text-decoration: none; word-break: break-all; flex: 1;
        }
        .sh-possible-row a:hover { color: #fff; text-decoration: underline; }

        /* ── Per-platform search button ────────────────────────────── */
        .sh-platform-btn {
            background: rgba(255,255,255,.07);
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 99px;
            color: rgba(255,255,255,.55);
            font-size: 11.5px; font-weight: 600;
            padding: 4px 12px;
            cursor: pointer; display: inline-flex;
            align-items: center; gap: 5px;
            font-family: inherit;
            transition: background .12s, color .12s;
        }
        .sh-platform-btn svg { width: 11px; height: 11px; }
        .sh-platform-btn:hover { background: rgba(255,255,255,.14); color: #fff; }
        .sh-platform-btn[disabled] { opacity: .35; cursor: not-allowed; }

        /* ── Spinning bolt for loading state ───────────────────────── */
        @keyframes sh-spin { to { transform: rotate(360deg); } }
        .sh-spinning { animation: sh-spin .9s linear infinite; display: inline-block; }
    `;

    let _cssInjected = false;
    function _injectCSS() {
        if (_cssInjected || document.getElementById("sh-css")) return;
        const s = document.createElement("style");
        s.id = "sh-css";
        s.textContent = CSS;
        document.head.appendChild(s);
        _cssInjected = true;
    }

    // ─── Build the overlay HTML ────────────────────────────────────────────────
    function _html() {
        return `
        <div class="sh-bg">

            <!-- Shazam stage -->
            <div class="sh-stage">
                <div class="sh-eyebrow">Person Intelligence</div>

                <button class="sh-bolt-btn" id="sh-trigger" aria-label="Open hunt">
                    <span class="sh-arc"></span>
                    <span class="sh-ring sh-ring-1"></span>
                    <span class="sh-ring sh-ring-2"></span>
                    <span class="sh-ring sh-ring-3"></span>
                    <span class="sh-bolt-icon">${IC.bolt}</span>
                </button>

                <div class="sh-caption">Tap to hunt someone</div>
                <div class="sh-timer hidden" id="sh-timer"></div>
            </div>

            <!-- dim -->
            <div class="sh-backdrop" id="sh-bd"></div>

            <!-- sheet -->
            <div class="sh-sheet-wrap" id="sh-swrap">
                <div class="sh-sheet" id="sh-sheet">
                    <div class="sh-handle"></div>
                    <div class="sh-sheet-inner">

                        <div class="sh-title">Who are you hunting?</div>
                        <div class="sh-subtitle">Fill in what you already know</div>

                        <!-- Identity -->
                        <div class="sh-grp">
                            <div class="sh-blob sh-blob--hero">
                                <span class="sh-blob-ic">${IC.person}</span>
                                <input id="sh-name" type="text" placeholder="Full name" autocomplete="off" spellcheck="false"/>
                            </div>
                        </div>

                        <!-- Contact -->
                        <div class="sh-grp">
                            <div class="sh-grp-label">Contact</div>
                            <div class="sh-row sh-col2">
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.email}</span>
                                    <input id="sh-email" type="email" placeholder="Email" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.phone}</span>
                                    <input id="sh-phone" type="tel" placeholder="Phone" autocomplete="off"/>
                                </div>
                            </div>
                        </div>

                        <!-- Online -->
                        <div class="sh-grp">
                            <div class="sh-grp-label">Online</div>
                            <div class="sh-row sh-col2">
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.at}</span>
                                    <input id="sh-username" type="text" placeholder="Username" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.globe}</span>
                                    <input id="sh-website" type="text" placeholder="Website" autocomplete="off"/>
                                </div>
                            </div>
                        </div>

                        <!-- Professional -->
                        <div class="sh-grp">
                            <div class="sh-grp-label">Professional</div>
                            <div class="sh-row sh-col2">
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.building}</span>
                                    <input id="sh-company" type="text" placeholder="Company" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic">${IC.brief}</span>
                                    <input id="sh-job" type="text" placeholder="Job title" autocomplete="off"/>
                                </div>
                            </div>
                        </div>

                        <!-- Social -->
                        <div class="sh-grp">
                            <div class="sh-grp-label">Social</div>
                            <div class="sh-row sh-col4">
                                <div class="sh-blob">
                                    <span class="sh-blob-ic sh-blob-ic--ig">${IC.insta}</span>
                                    <input id="sh-instagram" type="text" placeholder="Instagram" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic sh-blob-ic--li">${IC.linkedin}</span>
                                    <input id="sh-linkedin" type="text" placeholder="LinkedIn" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic sh-blob-ic--fb">${IC.facebook}</span>
                                    <input id="sh-facebook" type="text" placeholder="Facebook" autocomplete="off"/>
                                </div>
                                <div class="sh-blob">
                                    <span class="sh-blob-ic sh-blob-ic--x">${IC.xtwitter}</span>
                                    <input id="sh-twitter" type="text" placeholder="X / Twitter" autocomplete="off"/>
                                </div>
                            </div>
                        </div>

                        <!-- Notes -->
                        <div class="sh-grp">
                            <div class="sh-grp-label">Anything else</div>
                            <div class="sh-blob">
                                <span class="sh-blob-ic">${IC.note}</span>
                                <textarea id="sh-notes" placeholder="Any extra context that might help Gemini find them…" rows="2"></textarea>
                            </div>
                        </div>

                        <!-- Run -->
                        <div class="sh-go-wrap">
                            <button class="sh-go" id="sh-go">
                                ${IC.bolt} Hunt Everything
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Results -->
            <div class="sh-results" id="sh-results">
                <div class="sh-res-hd">
                    <div>
                        <div class="sh-res-name" id="sh-res-name">Profile</div>
                        <div class="sh-res-sub"  id="sh-res-sub"></div>
                    </div>
                    <button class="sh-res-x" id="sh-res-close">${IC.close}</button>
                </div>
                <div id="sh-res-body"></div>
            </div>

        </div>`;
    }

    // ─── Mount / unmount ───────────────────────────────────────────────────────
    function _mount(frm) {
        _unmount();
        _injectCSS();

        const el = document.createElement("div");
        el.id = "sh-shazam";
        el._frm = frm;                          // stored for phase-2 deep hunt
        el.innerHTML = _html();
        document.body.appendChild(el);

        _wire(el, frm);
        _prefill(el, frm);
    }

    function _unmount() {
        document.getElementById("sh-shazam")?.remove();
    }

    // ─── Pre-fill inputs from saved doc fields ──────────────────────────────────
    function _prefill(el, frm) {
        const d = frm.doc;
        const put = (id, v) => { if (v) { const e = el.querySelector(`#${id}`); if (e) e.value = v; } };
        put("sh-name",      d.target_name);
        put("sh-email",     d.target_email);
        put("sh-phone",     d.target_phone);
        put("sh-username",  d.target_username);
        put("sh-website",   d.target_website);
        put("sh-company",   d.target_company);
        put("sh-job",       d.target_job);
        put("sh-instagram", d.target_instagram);
        put("sh-linkedin",  d.target_linkedin);
        put("sh-facebook",  d.target_facebook);
        put("sh-twitter",   d.target_twitter);
        put("sh-notes",     d.target_notes);

        // Auto-open results if this doc already has a result
        if (d.hunt_result && !frm.is_new()) {
            _showResults(el, d.hunt_result, d.target_name || "Hunt Result");
        }
    }

    // ─── Event wiring ──────────────────────────────────────────────────────────
    function _wire(el, frm) {
        const $     = id => el.querySelector(`#${id}`);
        const sheet = $("sh-sheet");
        const swrap = $("sh-swrap");
        const bd    = $("sh-bd");

        function openSheet() {
            bd.classList.add("on");
            swrap.classList.add("live");
            requestAnimationFrame(() => sheet.classList.add("open"));
            // Focus name field after animation
            setTimeout(() => $("sh-name")?.focus(), 520);
        }
        function closeSheet() {
            sheet.classList.remove("open");
            bd.classList.remove("on");
            setTimeout(() => swrap.classList.remove("live"), 520);
        }

        $("sh-trigger").addEventListener("click", openSheet);
        bd.addEventListener("click", closeSheet);

        document.addEventListener("keydown.sh", e => {
            if (e.key === "Escape") closeSheet();
        });

        $("sh-go").addEventListener("click", () => _doHunt(el, frm, closeSheet));
        $("sh-res-close").addEventListener("click", () => $("sh-results").classList.remove("open"));

        // Enter on name field → moves to email
        $("sh-name").addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); $("sh-email")?.focus(); }
        });
    }

    // ─── Collect field values ──────────────────────────────────────────────────
    function _collect(el) {
        const v = id => (el.querySelector(`#${id}`)?.value || "").trim();
        return {
            name: v("sh-name"), email: v("sh-email"), phone: v("sh-phone"),
            username: v("sh-username"), website: v("sh-website"),
            company: v("sh-company"), job: v("sh-job"),
            instagram: v("sh-instagram"), linkedin: v("sh-linkedin"),
            facebook: v("sh-facebook"), twitter: v("sh-twitter"),
            notes: v("sh-notes"),
        };
    }

    // ─── Execute hunt ──────────────────────────────────────────────────────────
    function _doHunt(el, frm, closeSheet) {
        const p = _collect(el);
        const hasAny = Object.values(p).some(v => v.length > 0);

        if (!hasAny) {
            frappe.msgprint({ message: "Add at least one detail to hunt on.", indicator: "orange" });
            return;
        }

        const goBtn   = el.querySelector("#sh-go");
        const boltBtn = el.querySelector("#sh-trigger");
        const caption = el.querySelector(".sh-caption");
        const timerEl = el.querySelector("#sh-timer");
        goBtn.disabled = true;
        goBtn.innerHTML = `<span class="sh-spinning">${IC.bolt}</span>&ensp;Hunting…`;

        closeSheet();

        // Arc + cycling messages + live timer
        boltBtn.classList.add("hunting");
        boltBtn.disabled = true;

        let msgIdx = 0, elapsed = 0;
        const _setCaption = txt => {
            caption.classList.add("fade");
            setTimeout(() => { caption.textContent = txt; caption.classList.remove("fade"); }, 320);
        };
        _setCaption(HUNT_MSGS[0]);
        timerEl.textContent = "0s";
        timerEl.classList.remove("hidden");

        const clock = setInterval(() => {
            elapsed++;
            timerEl.textContent = `${elapsed}s`;
            if (elapsed % 4 === 0) {
                msgIdx++;
                _setCaption(HUNT_MSGS[msgIdx % HUNT_MSGS.length]);
            }
        }, 1000);

        const _stopHunting = () => {
            clearInterval(clock);
            boltBtn.classList.remove("hunting");
            boltBtn.disabled = false;
            timerEl.classList.add("hidden");
            _setCaption("Tap to hunt someone");
            goBtn.disabled = false;
            goBtn.innerHTML = `${IC.bolt} Hunt Everything`;
        };

        // Push person fields back to the Frappe doc
        const set = (field, val) => { if (val) frm.set_value(field, val); };
        set("target_name",      p.name);
        set("target_email",     p.email);
        set("target_phone",     p.phone);
        set("target_username",  p.username);
        set("target_website",   p.website);
        set("target_company",   p.company);
        set("target_job",       p.job);
        set("target_instagram", p.instagram);
        set("target_linkedin",  p.linkedin);
        set("target_facebook",  p.facebook);
        set("target_twitter",   p.twitter);
        set("target_notes",     p.notes);
        frm.set_value("hunt_mode", "Person Intelligence");
        frm.set_value("hunt_prompt", _buildPrompt(p));

        // Auto-name the hunt doc
        if (!frm.doc.hunt_name || frm.doc.hunt_name.startsWith("Hunt:")) {
            frm.set_value("hunt_name", p.name ? `Hunt: ${p.name}` : `Hunt · ${frappe.datetime.nowdate()}`);
        }

        frm.save().then(() => {
            frm.call({
                method: "run_filtered_hunt",
                doc: frm.doc,
                freeze: false,
                callback(r) {
                    _stopHunting();
                    if (!r.exc) {
                        frm.reload_doc().then(() => {
                            const raw = frm.doc.hunt_result;
                            _showResults(el, raw, p.name || "Hunt Result");
                        });
                    }
                },
                error() { _stopHunting(); },
            });
        });
    }

    // ─── Show results overlay ──────────────────────────────────────────────────
    function _showResults(el, rawJson, personName, newFields = [], phase = 1) {
        let data = null;
        try { data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson; }
        catch { /* keep null */ }

        const panel  = el.querySelector("#sh-results");
        const nameEl = el.querySelector("#sh-res-name");
        const subEl  = el.querySelector("#sh-res-sub");
        const bodyEl = el.querySelector("#sh-res-body");

        nameEl.textContent = data?.full_name || personName || "Results";
        subEl.textContent  = [data?.job_title, data?.company].filter(Boolean).join(" · ");

        bodyEl.innerHTML = data
            ? _renderCards(data, new Set(newFields), phase)
            : `<div class="sh-no-data">No data returned from Gemini.</div>`;
        bodyEl.innerHTML += _deeperBtn();

        _wireDeeper(el, bodyEl, data || {}, personName, phase);
        if (phase >= 2) _wirePlatformBtns(el, bodyEl, data || {}, personName);

        panel.classList.add("open");
    }

    function _deeperBtn() {
        return `<button class="sh-deeper" id="sh-deeper">
            ${IC.bolt} Dig deeper &nbsp;<span style="font-weight:400;opacity:.5;font-size:12px">search the web</span>
        </button>`;
    }

    function _wireDeeper(el, bodyEl, currentData, personName, phase = 1) {
        const btn = bodyEl.querySelector("#sh-deeper");
        if (!btn) return;
        const frm = el._frm;
        if (!frm) { btn.remove(); return; }

        btn.addEventListener("click", () => {
            btn.disabled = true;
            btn.innerHTML = `<span class="sh-spinning">${IC.bolt}</span>&ensp;Searching the web…`;
            frm.call({
                method: "run_deep_hunt",
                doc: frm.doc,
                freeze: false,
                callback(r) {
                    if (r.message) {
                        const { result, new_fields } = r.message;
                        el.querySelector("#sh-res-name").textContent = result.full_name || personName || "Results";
                        el.querySelector("#sh-res-sub").textContent  = [result.job_title, result.company].filter(Boolean).join(" · ");
                        bodyEl.innerHTML = _renderCards(result, new Set(new_fields), 2) + _deeperBtn();
                        _wireDeeper(el, bodyEl, result, personName, 2);
                        _wirePlatformBtns(el, bodyEl, result, personName);
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = `${IC.bolt} Dig deeper &nbsp;<span style="font-weight:400;opacity:.5;font-size:12px">search the web</span>`;
                    }
                },
                error() {
                    btn.disabled = false;
                    btn.innerHTML = `${IC.bolt} Dig deeper &nbsp;<span style="font-weight:400;opacity:.5;font-size:12px">search the web</span>`;
                },
            });
        });
    }

    function _wirePlatformBtns(el, bodyEl, currentData, personName) {
        bodyEl.querySelectorAll("[data-platform]").forEach(btn => {
            btn.addEventListener("click", () => {
                const platform = btn.dataset.platform;
                const frm = el._frm;
                if (!frm) return;
                btn.disabled = true;
                const origHTML = btn.innerHTML;
                btn.innerHTML = `<span class="sh-spinning">${IC.bolt}</span>`;

                frm.call({
                    method: "run_platform_hunt",
                    doc: frm.doc,
                    args: { platform },
                    freeze: false,
                    callback(r) {
                        if (r.message) {
                            const { result, new_fields } = r.message;
                            el.querySelector("#sh-res-name").textContent = result.full_name || personName || "Results";
                            el.querySelector("#sh-res-sub").textContent  = [result.job_title, result.company].filter(Boolean).join(" · ");
                            bodyEl.innerHTML = _renderCards(result, new Set(new_fields), 2) + _deeperBtn();
                            _wireDeeper(el, bodyEl, result, personName, 2);
                            _wirePlatformBtns(el, bodyEl, result, personName);
                        } else {
                            btn.disabled = false;
                            btn.innerHTML = origHTML;
                        }
                    },
                    error() { btn.disabled = false; btn.innerHTML = origHTML; },
                });
            });
        });
    }

    // ─── Build result cards ────────────────────────────────────────────────────
    const _KNOWN_KEYS = new Set([
        "full_name","emails","phones","usernames","instagram_url","linkedin_url",
        "facebook_url","twitter_url","websites","company","job_title","location",
        "bio","description","skills","education","connections","profile_image","other","source_urls",
        "possible_instagram","possible_twitter","possible_linkedin","possible_facebook",
    ]);

    const _POSSIBLE_META = {
        possible_instagram: { label: "Instagram",  icon: IC.insta,    color: "#c13584" },
        possible_twitter:   { label: "X / Twitter",icon: IC.xtwitter, color: "#e2e8f0" },
        possible_linkedin:  { label: "LinkedIn",   icon: IC.linkedin, color: "#0a66c2" },
        possible_facebook:  { label: "Facebook",   icon: IC.facebook, color: "#1877f2" },
    };

    function _renderCards(d, newFields = new Set(), phase = 1) {
        const isNew = key => newFields.has(key);
        const link  = url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}&nbsp;${IC.external}</a>`;
        const chips = arr => (arr || []).map(v => `<span class="sh-chip">${v}</span>`).join("");
        const row   = (label, content, key = "") => {
            if (!content) return "";
            const cls = key && isNew(key) ? " sh-new" : "";
            return `<div class="sh-res-row${cls}"><span class="sh-res-k">${label}</span><span class="sh-res-v">${content}</span></div>`;
        };
        const card = (label, rows, extraClass = "") => {
            const inner = rows.filter(Boolean).join("");
            return inner ? `<div class="sh-res-card ${extraClass}"><div class="sh-res-clabel">${label}</div>${inner}</div>` : "";
        };

        // Social row: confirmed link OR (phase 2+) a platform search button
        const socialRow = (label, urlKey, platform, icon) => {
            if (d[urlKey]) return row(label, link(d[urlKey]), urlKey);
            if (phase < 2)  return "";
            // Not found — show individual search button
            const newCls = isNew(`possible_${platform}`) ? " sh-new" : "";
            return `<div class="sh-res-row${newCls}">
                <span class="sh-res-k">${label}</span>
                <span class="sh-res-v">
                    <button class="sh-platform-btn" data-platform="${platform}">
                        ${icon} Search ${label}
                    </button>
                </span>
            </div>`;
        };

        const emailLinks = (d.emails || []).map(e => `<a href="mailto:${e}">${e}</a>`).join("<br>");

        // Possible accounts — only shown in phase 2+
        const possibleCards = phase >= 2
            ? Object.entries(_POSSIBLE_META).map(([key, meta]) => {
                const urls = d[key];
                if (!urls || !urls.length) return "";
                const rows = urls.map(u =>
                    `<div class="sh-possible-row">
                        <span class="sh-possible-badge">maybe</span>
                        <a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>
                    </div>`
                ).join("");
                const cls = isNew(key) ? " sh-new" : "";
                return `<div class="sh-res-card sh-res-card--possible${cls}">
                    <div class="sh-res-clabel">Possible ${meta.label}</div>${rows}
                </div>`;
            }).join("")
            : "";

        // Surprise fields Gemini named itself
        const surpriseRows = Object.entries(d)
            .filter(([k]) => !_KNOWN_KEYS.has(k) && d[k])
            .map(([k, v]) => {
                const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                return row(label, Array.isArray(v) ? chips(v) : String(v), k);
            });

        return [
            card("Identity", [
                row("Name",     d.full_name, "full_name"),
                row("Location", d.location,  "location"),
                row("About",    d.description || d.bio, d.description ? "description" : "bio"),
            ]),
            card("Contact", [
                row("Email", emailLinks,                  "emails"),
                row("Phone", (d.phones||[]).join("<br>"), "phones"),
            ]),
            card("Professional", [
                row("Company",   d.company,          "company"),
                row("Title",     d.job_title,        "job_title"),
                row("Skills",    chips(d.skills),    "skills"),
                row("Education", chips(d.education), "education"),
            ]),
            card("Social", [
                socialRow("Instagram", "instagram_url", "instagram", IC.insta),
                socialRow("LinkedIn",  "linkedin_url",  "linkedin",  IC.linkedin),
                socialRow("Facebook",  "facebook_url",  "facebook",  IC.facebook),
                socialRow("X / Twitter","twitter_url",  "twitter",   IC.xtwitter),
            ]),
            card("Online", [
                row("Usernames", chips(d.usernames), "usernames"),
                (d.websites||[]).length ? row("Websites", d.websites.map(link).join("<br>"), "websites") : "",
            ]),
            possibleCards,
            surpriseRows.length ? card("Also found", surpriseRows) : "",
        ].filter(Boolean).join("");
    }

    // ─── Form hooks ────────────────────────────────────────────────────────────
    frappe.ui.form.on("Scraper Hunt", {
        refresh(frm) {
            _mount(frm);
        },
        before_load() {
            _unmount();
        },
    });

    // Clean up on SPA navigation
    $(document).on("page-change.sh-hunt", () => _unmount());

})();
