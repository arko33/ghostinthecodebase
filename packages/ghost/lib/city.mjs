
// Ghost City — the recorder's own /playground. Same shell, same 3D city, same
// autopsy panel and tape dock as the published dashboard; the data is whatever
// this recorder has actually captured (or an explicitly-labelled demo fixture).
import fs from "node:fs";

const CSS = fs.readFileSync(new URL("./city.css", import.meta.url), "utf8");
const CLIENT = fs.readFileSync(new URL("./city-client.mjs", import.meta.url), "utf8");

const GHOST = (size) =>
  '<svg class="ghost-mark ghost-mark--glow" width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
  '<path d="M16 3.35c-5.5 0-9 4.4-9 10.4v13.15l3.2-2.6 2.3 2.6 3.5-2.95 3.5 2.95 2.3-2.6 3.2 2.6V13.75c0-6-3.5-10.4-9-10.4Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>' +
  '<circle cx="12.7" cy="14" r="1.05" fill="currentColor"/><circle cx="19.3" cy="14" r="1.05" fill="currentColor"/>' +
  '<path d="M13.6 18.7c.7.7 1.5 1 2.4 1s1.7-.3 2.4-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45"/></svg>';

const I = (d, s) =>
  '<svg width="' + (s || 14) + '" height="' + (s || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";

export function cityHtml3d() {
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/>" +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    "<title>Ghost City — live playground</title>" +
    "<style>" + CSS + "</style>" +
    '<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.169.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.169.0/examples/jsm/"}}</script>' +
    "</head><body><div class=\"dashboard-page\"><div class=\"app\"><div class=\"pg-shell\" id=\"shell\">" +

    // ── top bar ────────────────────────────────────────────────────────────
    '<header class="pg-top"><div class="pg-top__brand">' + GHOST(28) +
    '<div class="pg-top__title"><strong>Ghost</strong><span>Code Autopsy</span></div></div>' +
    '<div class="pg-pills" aria-label="Session metadata">' +
    '<span class="pg-pill" id="pillSession">…</span>' +
    '<span class="pg-pill" id="pillAgent">ghost watch · local</span>' +
    '<span class="pg-pill" id="pillRepo">…</span></div>' +
    '<div class="pg-top__actions">' +
    '<span class="pg-live" id="liveChip" data-on="true"><i aria-hidden="true"></i><span id="liveText">Live</span></span>' +
    '<button type="button" class="pg-pill-btn" id="btnDemo" title="Toggle the demo fixture (clearly labelled, never mixed with your data)">Demo</button>' +
    '<button type="button" class="pg-pill-btn" id="btnReload">' + I('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>') + '<span class="pg-btn-label">Load session</span></button>' +
    '<a class="pg-icon-link" href="/studio" title="Ghost Studio" aria-label="Ghost Studio">' + I('<path d="M19 12H5m6-6-6 6 6 6"/>', 16) + "</a>" +
    "</div></header>" +

    // ── body ───────────────────────────────────────────────────────────────
    '<div class="pg-body"><div class="pg-rail-wrap">' +
    '<aside class="pg-rail" aria-label="Session tape">' +
    '<div class="pg-rail__head"><div><span class="pg-label">Tape</span><h2 id="railCount">0 turns</h2></div>' +
    '<span class="pg-rec" id="railRec" data-on="true"><i aria-hidden="true"></i>REC</span></div>' +
    '<div class="pg-rail__meta"><span id="railAgent">ghost watch · local</span><span id="railSid">—</span></div>' +
    '<ol class="pg-rail__list" id="tape"></ol></aside></div>' +

    '<div class="pg-work"><section class="pg-stage" aria-label="Code city">' +
    '<div class="pg-stage__sky" aria-hidden="true"></div>' +
    '<div class="pg-stage__canvas"><div class="pg-city" id="city"><canvas id="gl"></canvas>' +
    '<div class="pg-city__hint">Drag to orbit · click a tower to inspect</div>' +
    '<div id="tip" class="pg-city-tip"></div>' +
    '<div class="pg-stage__empty" id="cityEmpty" style="display:none"></div></div></div>' +
    '<div class="pg-stage__top"><span class="pg-stage__tag" id="stageTag">' + I('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>') + "code city · 0 turns</span>" +
    '<div class="pg-presets">' +
    '<button type="button" data-preset="overview" data-active="true">' + I('<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14M15 6v14"/>') + "Overview</button>" +
    '<button type="button" data-preset="blame" data-active="false">' + I('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>') + "Focus on blame</button>" +
    "</div></div>" +
    '<div class="pg-stage__legend">' +
    "<span>" + I('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/>', 13) + "healthy</span>" +
    "<span>" + I('<path d="M12 4.8 21 20H3L12 4.8Z"/><path d="M12 10v4.2M12 17.2h.01"/>', 13) + "anomaly</span>" +
    "<span>" + I('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>', 13) + "agent-written</span>" +
    "<span>" + I('<circle cx="12" cy="8.5" r="3.2"/><path d="M5.5 20c.8-3.4 3.3-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/>', 13) + "human</span>" +
    "</div></section>" +

    '<div class="pg-mobile-tabs" role="tablist" aria-label="Panels">' +
    '<button type="button" role="tab" data-tab="tape" data-active="false">Tape</button>' +
    '<button type="button" role="tab" data-tab="autopsy" data-active="true">Autopsy</button></div>' +
    '<aside class="pg-autopsy" id="autopsy" aria-label="Autopsy"></aside>' +
    "</div></div>" +

    // ── dock ───────────────────────────────────────────────────────────────
    '<footer class="pg-dock" aria-label="Timeline">' +
    '<div class="pg-dock__controls">' +
    '<button type="button" class="pg-icon-btn" id="prev" aria-label="Previous turn">' + I('<path d="m14.5 6-6 6 6 6"/>', 16) + "</button>" +
    '<button type="button" class="pg-play" id="play" aria-label="Play replay">' + I('<path d="M8 5.5 18 12 8 18.5V5.5Z"/>', 16) + "</button>" +
    '<button type="button" class="pg-icon-btn" id="next" aria-label="Next turn">' + I('<path d="m9.5 6 6 6-6 6"/>', 16) + "</button></div>" +
    '<div class="pg-dock__time"><span class="pg-rec" id="dockRec" data-on="true"><i aria-hidden="true"></i>REC</span>' +
    '<span class="pg-dock__tc" id="tc">00:00:00</span><span class="pg-dock__turn" id="dockTurn">t0 / 0</span></div>' +
    '<div class="pg-dock__track" id="track"></div>' +
    '<div class="pg-dock__meta"><button type="button" class="pg-speed" id="speed" aria-label="Playback speed">1x</button>' +
    '<span class="pg-dock__keys"><span class="kbd">Space</span><span class="kbd">←</span><span class="kbd">→</span></span></div>' +
    "</footer></div></div></div>" +
    "<script type=\"module\">" + CLIENT + "</script></body></html>";
}
