// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { DEFAULT_LEAK, HOUR } from "./core.js";
import { STRINGS } from "./i18n/strings.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const lang = (hass, config) => {
  const l = config?.language || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: the card's language option, else Home Assistant's full locale (keeps its region, e.g. pt-BR,
// de-CH) when its base matches the card language. A bare "pt" (European Portuguese) becomes "pt-PT".
export const intlLocale = (hass, config) => {
  const l = lang(hass, config);
  const src = config?.language || (hass && (hass.locale?.language || hass.language)) || "";
  const out = src && src.split("-")[0] === l.split("-")[0] ? src : l;
  return out === "pt" ? "pt-PT" : out;
};

export const t = (hass, config, key, vars = {}) =>
  String(STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export const valid = (s) => !!s && !["unknown", "unavailable", ""].includes(s.state);
export const num = (s) => {
  if (!valid(s)) return null;
  const v = parseFloat(s.state);
  return Number.isFinite(v) ? v : null;
};

export const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

// Units: volumes in liters, energies in kWh, so that a value can be moved from one unit to another.
export const UNIT_ALIASES = { m3: "m³", l: "L", ft3: "ft³", ccf: "CCF", kwh: "kWh", wh: "Wh", mwh: "MWh", mj: "MJ", gj: "GJ", ml: "mL", gal: "gal" };
export const normUnit = (u) => {
  const s = String(u ?? "").trim();
  return UNIT_ALIASES[s.toLowerCase()] || s;
};
export const VOLUME_L = { mL: 0.001, L: 1, "m³": 1000, gal: 3.78541, "ft³": 28.3168, CCF: 2831.68 };
export const ENERGY_KWH = { Wh: 0.001, kWh: 1, MWh: 1000, MJ: 1 / 3.6, GJ: 1000 / 3.6 };
export const convert = (v, from, to) => {
  const f = normUnit(from);
  const tu = normUnit(to);
  if (v === null || v === undefined || f === tu) return v;
  if (f in VOLUME_L && tu in VOLUME_L) return (v * VOLUME_L[f]) / VOLUME_L[tu];
  if (f in ENERGY_KWH && tu in ENERGY_KWH) return (v * ENERGY_KWH[f]) / ENERGY_KWH[tu];
  return v;
};
export const isMetricVolume = (u) => ["mL", "L", "m³"].includes(normUnit(u));
export const isEnergy = (u) => normUnit(u) in ENERGY_KWH;

// The kind of meter: `meter_type` when set, else the sensor's device_class, else its unit — a Modbus or template
// sensor often has no device_class: Wh / kWh / MWh is electricity, MJ / GJ gas, a volume water.
export const meterType = (st, cfgType) => {
  if (cfgType === "water" || cfgType === "gas" || cfgType === "electricity") return cfgType;
  const a = st?.attributes || {};
  if (a.device_class === "gas") return "gas";
  if (a.device_class === "energy") return "electricity";
  if (a.device_class === "water") return "water";
  const u = normUnit(a.unit_of_measurement);
  if (u === "Wh" || u === "kWh" || u === "MWh") return "electricity";
  if (u === "MJ" || u === "GJ") return "gas";
  return "water";
};

export const NUM_FMT = {};
export const fmtNum = (v, locale, digits = 2, min = 0) =>
  (NUM_FMT[`${locale}|${digits}|${min}`] ??= new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: min })).format(v);

// Fraction digits of a consumption: fewer as the value grows, none for liters.
export const digitsFor = (v, unit) => {
  const a = Math.abs(v);
  const u = normUnit(unit);
  if (u === "L" || u === "mL" || u === "Wh") return 0;
  if (isEnergy(u)) return a < 10 ? 1 : 0;
  return a < 10 ? 2 : a < 100 ? 1 : 0;
};

// A consumption with its unit. Metric water volumes read in liters below 1 m³ and in m³ from 1000 L (`liters: false`
// keeps the sensor's unit).
export const fmtAmount = (v, unit, locale, { water = false, liters = true } = {}) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  let u = normUnit(unit);
  let x = v;
  if (water && liters && isMetricVolume(u)) {
    const l = convert(v, u, "L");
    if (Math.abs(l) < 1000) [x, u] = [l, "L"];
    else [x, u] = [convert(v, u, "m³"), "m³"];
  }
  return `${fmtNum(x, locale, digitsFor(x, u))}${u ? ` ${u}` : ""}`;
};

export const indexDigits = (unit, config) => {
  // 0 to 6 decimals: Intl throws past 100, and a negative count is no count.
  const d = config?.index_decimals;
  if (Number.isInteger(d) && d >= 0 && d <= 6) return d;
  const u = normUnit(unit);
  return u === "m³" ? 3 : u === "ft³" || u === "CCF" || u === "gal" ? 1 : 0;
};

export const PCT_FMT = {};
export const fmtPct = (v, locale) =>
  (PCT_FMT[locale] ??= new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" })).format(v);

export const MONEY_FMT = {};
export const fmtMoney = (v, currency, locale) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  try {
    return (MONEY_FMT[`${locale}|${currency}`] ??= new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 2 })).format(v);
  } catch (_err) {
    return `${fmtNum(v, locale, 2, 2)} ${currency}`;
  }
};

// "HH:MM" or "HH:MM:SS" (time selector) → minutes after midnight.
export const parseTime = (s, fallback) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s ?? ""));
  if (!m || +m[1] > 23 || +m[2] > 59) return parseTime(fallback, "00:00");
  return +m[1] * 60 + +m[2];
};

// Local calendar arithmetic (the browser's time zone, the one Home Assistant's frontend shows).
export const startOfDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
export const addDays = (ms, n) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()).getTime();
};
export const atMinutes = (dayMs, minutes) => {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
};
export const startOfMonth = (ms, n = 0) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
};
export const startOfYear = (ms, n = 0) => new Date(new Date(ms).getFullYear() + n, 0, 1).getTime();
export const startOfWeek = (ms, firstDay = 1) => {
  const day = startOfDay(ms);
  return addDays(day, -((new Date(day).getDay() - firstDay + 7) % 7));
};
export const FIRST_WEEKDAY = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
// Home Assistant's first day of the week; "language" (its default) follows the locale (Sunday for en-US…).
export const firstWeekday = (hass) => {
  const fw = FIRST_WEEKDAY[hass?.locale?.first_weekday];
  if (fw !== undefined) return fw;
  try {
    const loc = new Intl.Locale(hass?.locale?.language || hass?.language || "en");
    const day = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    return Number.isInteger(day) ? day % 7 : 1;
  } catch (_err) {
    return 1;
  }
};

export const periodStart = (kind, now, fw) =>
  kind === "day" ? startOfDay(now) : kind === "week" ? startOfWeek(now, fw) : kind === "month" ? startOfMonth(now) : startOfYear(now);
export const shiftPeriod = (kind, start, n) =>
  kind === "day" ? addDays(start, n) : kind === "week" ? addDays(start, 7 * n) : kind === "month" ? startOfMonth(start, n) : startOfYear(start, n);

// Statistics rows as { s, e, v }: start and end in ms, `change` as v. Home Assistant sends ms (2023.3+) or ISO strings.
export const toMs = (x) => (typeof x === "number" ? (x < 1e11 ? x * 1000 : x) : Date.parse(x));
// `daily`: Home Assistant cuts days at the server's midnight; each daily row is moved to the browser's day holding its
// middle, so that days, weeks and months stay right when the browser is in another time zone than the server.
export const statRows = (list, daily = false) =>
  (Array.isArray(list) ? list : [])
    .map((r) => ({ s: toMs(r.start), e: toMs(r.end), v: r.change === null || r.change === undefined ? Number.NaN : Number(r.change) }))
    .filter((r) => Number.isFinite(r.s) && Number.isFinite(r.v))
    .map((r) => {
      const e = Number.isFinite(r.e) && r.e > r.s ? r.e : r.s + (daily ? 24 * HOUR : HOUR);
      if (!daily) return { ...r, e };
      const s = startOfDay((r.s + e) / 2);
      return { ...r, s, e: addDays(s, 1) };
    })
    .sort((a, b) => a.s - b.s);

// End of the data the statistics hold: the last hourly row (a day for an import of daily values at midnight, as
// Suez's or Gazpar's), else the last daily row, never after now. Hourly statistics are compiled after each hour and
// imported ones can be days late, so "so far" means up to there.
export const coverageEnd = (stats, now) => {
  const h = stats.hourly;
  if (h.length) {
    const last = h[h.length - 1];
    const before = h[h.length - 2];
    const dayImport = last.s === startOfDay(last.s) && (!before || last.s - before.s >= 23 * HOUR);
    return Math.min(now, dayImport ? addDays(last.s, 1) : last.e);
  }
  return stats.daily.length ? Math.min(now, stats.daily[stats.daily.length - 1].e) : now;
};

// WebSocket answers shared for 30 seconds by the cards of one Home Assistant connection (a card and its mini card on
// the same meter ask once).
export const WS_CACHE = new WeakMap();
export const sharedWS = (hass, msg) => {
  const owner = hass.connection || hass;
  const cache = WS_CACHE.get(owner) || new Map();
  WS_CACHE.set(owner, cache);
  const key = JSON.stringify(msg);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.promise;
  const promise = hass.callWS(msg);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  for (const [k, v] of cache) if (Date.now() - v.at >= 30000) cache.delete(k);
  return promise;
};

// Rows that start in [from, to), counted whole.
export const sumFrom = (rows, from, to) => rows.reduce((a, r) => (r.s >= from && r.s < to ? a + r.v : a), 0);
export const anyFrom = (rows, from, to) => rows.some((r) => r.s >= from && r.s < to);
// Rows overlapping [from, to), each counted for the share of its span inside.
export const sumOverlap = (rows, from, to) =>
  rows.reduce((a, r) => {
    const o = Math.min(r.e, to) - Math.max(r.s, from);
    return o > 0 ? a + r.v * Math.min(1, o / (r.e - r.s)) : a;
  }, 0);

// Consumption of today (hourly rows, else the daily row of today).
export const todayOf = (stats, now) => {
  const day = startOfDay(now);
  return stats.hourly.length ? sumFrom(stats.hourly, day, Infinity) : sumFrom(stats.daily, day, Infinity);
};

// Current period so far and the previous one up to the same point: the same time elapsed since its start as the
// current period's data covers (up to now with `live`, when the current value comes from a live helper), never past
// the previous period's own end (31 March against February).
export const periodValues = (stats, kind, now, fw, live = false) => {
  const start = periodStart(kind, now, fw);
  const prev = shiftPeriod(kind, start, -1);
  const day = startOfDay(now);
  const today = todayOf(stats, now);
  const fine = kind === "day" && stats.hourly.length ? stats.hourly : stats.daily;
  const cur = kind === "day" ? today : sumFrom(stats.daily, start, day) + today;
  const elapsed = (live ? now : coverageEnd(stats, now)) - start;
  const has = elapsed > 0 && anyFrom(fine, prev, start);
  return { cur, prev: has ? sumOverlap(fine, prev, Math.min(start, prev + elapsed)) : null, start };
};

// Bars of the history chart: the slots of the current period (hours, days or months) with the same slot of the
// previous period. A slot still to come has no value (null).
export const chartSlots = (stats, kind, now, fw) => {
  const start = periodStart(kind, now, fw);
  const day = startOfDay(now);
  const today = todayOf(stats, now);
  const slots = [];
  const cur = (from, to) => (from > now ? null : sumFrom(stats.daily, from, Math.min(to, day)) + (day >= from && day < to ? today : 0));
  if (kind === "day") {
    for (let h = 0; h < 24; h++) {
      const from = start + h * HOUR;
      const value = from > now ? null : sumFrom(stats.hourly, from, from + HOUR);
      const p = addDays(from, -1);
      slots.push({ from, to: from + HOUR, value, prev: sumFrom(stats.hourly, p, p + HOUR) });
    }
  } else if (kind === "week") {
    for (let i = 0; i < 7; i++) {
      const from = addDays(start, i);
      const to = addDays(start, i + 1);
      slots.push({ from, to, value: cur(from, to), prev: sumFrom(stats.daily, addDays(from, -7), addDays(from, -6)) });
    }
  } else if (kind === "month") {
    const end = startOfMonth(start, 1);
    const prevStart = startOfMonth(start, -1);
    for (let from = start, i = 0; from < end; from = addDays(start, ++i)) {
      const to = addDays(start, i + 1);
      const p = addDays(prevStart, i);
      slots.push({ from, to, value: cur(from, to), prev: p < start ? sumFrom(stats.daily, p, addDays(prevStart, i + 1)) : null });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const from = startOfMonth(start, m);
      const to = startOfMonth(start, m + 1);
      slots.push({ from, to, value: cur(from, to), prev: sumFrom(stats.daily, startOfMonth(start, m - 12), startOfMonth(start, m - 11)) });
    }
  }
  return slots;
};

// Night window that ended last: [start, end) in ms, crossing midnight when it starts after it ends (23:00 → 05:00).
export const nightWindow = (now, startStr, endStr) => {
  const sm = parseTime(startStr, DEFAULT_LEAK.start);
  const em = parseTime(endStr, DEFAULT_LEAK.end);
  let end = atMinutes(startOfDay(now), em);
  if (end > now) end = atMinutes(addDays(startOfDay(now), -1), em);
  let start = atMinutes(startOfDay(end), sm);
  if (start >= end) start = atMinutes(addDays(startOfDay(end), -1), sm);
  return { start, end };
};

// Leak check on the last night: every hour of the window used at least `threshold` (sensor unit per hour).
// null when the hourly statistics do not cover the window: its first and last hours must have a row (not compiled yet,
// imported data a day late, or daily values only).
export const nightCheck = (stats, now, startStr, endStr, threshold) => {
  const { start, end } = nightWindow(now, startStr, endStr);
  if (!stats.hourly.length || stats.hourly[0].s > start) return null;
  if (!anyFrom(stats.hourly, start, start + HOUR) || !anyFrom(stats.hourly, end - HOUR, end)) return null;
  const hours = [];
  for (let h = start; h < end; h += HOUR) hours.push(sumFrom(stats.hourly, h, h + HOUR));
  if (!hours.length) return null;
  const lowest = Math.min(...hours);
  return { start, end, hours, lowest, leak: lowest >= threshold && lowest > 0 };
};

// Water threshold is given in L/h: moved to the sensor's unit. Gas: already in the sensor's unit per hour.
export const leakThreshold = (config, type, unit) => {
  const v = Number(config.leak_threshold ?? DEFAULT_LEAK[type]);
  const x = Number.isFinite(v) && v > 0 ? v : DEFAULT_LEAK[type];
  return type === "water" && normUnit(unit) in VOLUME_L ? convert(x, "L", unit) : x;
};

// An energy sensor is a meter only when it counts up (state_class total / total_increasing): plain `power` sensors in W
// are not, and `energy` sensors without a cumulative state_class (a rate, a daily reset helper's value) are skipped.
export const METER_DC = { water: 0, gas: 1, energy: 2 };
export const meterOf = (s) => {
  const dc = s?.attributes?.device_class;
  if (!s?.entity_id?.startsWith("sensor.") || !(dc in METER_DC)) return false;
  return dc !== "energy" || ["total", "total_increasing"].includes(s.attributes.state_class);
};
// Meters first: a cumulative sensor (state_class total / total_increasing), then water, gas, electricity.
export const listMeters = (hass) =>
  Object.values(hass?.states || {})
    .filter(meterOf)
    .sort((a, b) => {
      const rank = (s) => (["total", "total_increasing"].includes(s.attributes.state_class) ? 0 : 6) + METER_DC[s.attributes.device_class];
      return rank(a) - rank(b) || a.entity_id.localeCompare(b.entity_id);
    });

// utility_meter helpers fed by this meter, by period: { day: entity_id, … }.
export const UM_PERIODS = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
export const utilityMeters = (hass, entity) => {
  const out = {};
  for (const s of Object.values(hass?.states || {})) {
    const a = s.attributes || {};
    const p = UM_PERIODS[a.meter_period];
    if (p && a.source === entity && s.entity_id.startsWith("sensor.") && !out[p]) out[p] = s.entity_id;
  }
  return out;
};

export const isOutside = (card, ev) => {
  const path = ev.composedPath();
  return !path.includes(card) && !path.some((n) => ["HA-MORE-INFO-DIALOG", "HA-DIALOG", "DIALOG"].includes(n.tagName));
};

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside the card (a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
export const watchOutside = (card, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOutside(card, ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOutside(card, ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOutside(card, ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
  };
};

// ---------------------------------------------------------------------------
// Drawn meters (inline SVG, so that their animations run in the card): a brass water meter on its pipe and a gas meter
// cabinet. `active`: water or gas flowing right now (the flow sensor, else the statistics of the current hour) — the
// water meter's star wheel spins and water ripples along the pipe, the gas meter's last digit rolls and its flame
// flickers. `leak`: drops fall from the pipe joint into a growing puddle, the meter pulses red.
// ---------------------------------------------------------------------------

export const digitsOf = (v, n) => (v === null ? "-".repeat(n) : String(Math.floor(Math.abs(v)) % 10 ** n).padStart(n, "0"));

export const waterArt = (index, uid = "") =>
  '<svg viewBox="0 0 80 88" aria-hidden="true"><defs>' +
  `<radialGradient id="um-brass${uid}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#f3d58a"/><stop offset=".55" stop-color="#c9973c"/><stop offset="1" stop-color="#8a6420"/></radialGradient>` +
  `<linearGradient id="um-pipe${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe4ea"/><stop offset=".5" stop-color="#aab3bd"/><stop offset="1" stop-color="#7d8792"/></linearGradient>` +
  `<radialGradient id="um-glass${uid}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e9ef"/></radialGradient></defs>` +
  '<ellipse class="puddle" cx="62" cy="84" rx="12" ry="2.6"/>' +
  `<rect x="0" y="58" width="80" height="12" rx="2" fill="url(#um-pipe${uid})"/>` +
  '<g class="ripples"><path d="M6 64h7M30 64h6M54 64h7"/></g>' +
  '<rect x="8" y="55" width="7" height="18" rx="1.5" fill="#c9973c" stroke="#8a6420" stroke-width=".6"/>' +
  '<rect x="65" y="55" width="7" height="18" rx="1.5" fill="#c9973c" stroke="#8a6420" stroke-width=".6"/>' +
  '<path class="drop" d="M62 72c0 0-2.2 3-2.2 4.4a2.2 2.2 0 0 0 4.4 0c0-1.4-2.2-4.4-2.2-4.4z"/>' +
  '<circle class="halo" cx="40" cy="34" r="30"/>' +
  `<circle cx="40" cy="34" r="27" fill="url(#um-brass${uid})" stroke="#7a5518" stroke-width="1"/>` +
  `<circle cx="40" cy="34" r="21" fill="url(#um-glass${uid})" stroke="#9aa5b1" stroke-width=".8"/>` +
  '<rect x="27" y="22" width="26" height="8" rx="1.5" fill="#1d2632"/>' +
  `<text class="digits" x="40" y="28.3" text-anchor="middle">${esc(digitsOf(index, 5))}</text>` +
  '<g stroke="#9aa5b1" stroke-width=".7"><path d="M40 14.5v2.5M40 51v2.5M20.5 34H23M57 34h2.5"/></g>' +
  '<g class="star" transform="translate(40 41)"><path d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z" fill="#e53935"/><circle r="1.3" fill="#fff"/></g>' +
  "</svg>";

export const gasArt = (index, uid = "") =>
  '<svg viewBox="0 0 80 88" aria-hidden="true"><defs>' +
  `<linearGradient id="um-box${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6ea"/><stop offset="1" stop-color="#ddd3bd"/></linearGradient>` +
  `<linearGradient id="um-gpipe${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2c25a"/><stop offset=".5" stop-color="#fbe58a"/><stop offset="1" stop-color="#c9a332"/></linearGradient>` +
  `<clipPath id="um-roll${uid}"><rect x="51" y="19" width="6" height="9"/></clipPath></defs>` +
  `<rect x="24" y="66" width="7" height="22" fill="url(#um-gpipe${uid})"/><rect x="49" y="66" width="7" height="22" fill="url(#um-gpipe${uid})"/>` +
  '<rect class="halo" x="7" y="1" width="66" height="70" rx="10"/>' +
  `<rect x="11" y="5" width="58" height="62" rx="7" fill="url(#um-box${uid})" stroke="#bfb397" stroke-width="1"/>` +
  '<rect x="17" y="15" width="46" height="17" rx="2.5" fill="#1d2632"/>' +
  `<text class="digits" x="34" y="26.2" text-anchor="middle">${esc(digitsOf(index, 5).slice(0, 4))}</text>` +
  `<g clip-path="url(#um-roll${uid})"><g class="roll"><text class="digits red" x="54" y="26.2" text-anchor="middle">${esc(digitsOf(index, 1))}</text><text class="digits red" x="54" y="35.2" text-anchor="middle">${esc(String((Math.floor(Math.abs(index ?? 0)) + 1) % 10))}</text></g></g>` +
  '<rect x="17" y="38" width="46" height="5" rx="2.5" fill="#cfc4aa"/>' +
  '<circle cx="54" cy="55" r="7" fill="#fff" stroke="#bfb397" stroke-width=".8"/>' +
  '<path class="flame" d="M54 49.5c.5 2.2-1 3.2-2 4.5-1 1.3-1.7 2.4-1.7 3.9 0 2.1 1.6 3.6 3.7 3.6s3.7-1.5 3.7-3.6c0-1.6-.7-2.7-1.4-3.7-.2.9-.6 1.6-1.3 1.9.2-1.9-.2-4.2-1-6.6z"/>' +
  '<rect x="19" y="50" width="22" height="2.4" rx="1.2" fill="#d9cfb7"/><rect x="19" y="55" width="16" height="2.4" rx="1.2" fill="#d9cfb7"/>' +
  "</svg>";

// Electricity meter, three drawings (`picture_style`): `digital` a wall smart meter (its index digits, a mains LED and a
// power bar), `disc` the classic Ferraris meter (an aluminium disc that spins the faster the more is drawn), `submeter`
// a module clamped on a wire (a current that runs along the wire, a power screen in W). `active`: power is being drawn
// now. `high`: above the daily limit — the meter pulses red and the disc or the current speeds up.
export const elecDigital = (index) =>
  '<rect x="31" y="70" width="18" height="18" fill="#9aa5b1"/>' +
  '<rect class="halo" x="12" y="4" width="56" height="70" rx="12"/>' +
  '<rect x="15" y="6" width="50" height="66" rx="9" fill="#eef2ea" stroke="#bcc6b4" stroke-width="1"/>' +
  '<path d="M15 15a9 9 0 0 1 9-9h32a9 9 0 0 1 9 9v3H15z" fill="#2e7d32"/>' +
  '<rect x="21" y="25" width="38" height="15" rx="2.5" fill="#10261a"/>' +
  `<text class="digits" x="40" y="35" text-anchor="middle">${esc(digitsOf(index, 6))}</text>` +
  '<rect class="elec-scan" x="22" y="26" width="5" height="13"/>' +
  '<text class="unit elec-unit" x="40" y="47" text-anchor="middle">kWh</text>' +
  '<circle class="elec-led" cx="27" cy="53" r="2"/><circle cx="34" cy="53" r="2" fill="#cfd8c8"/><circle cx="41" cy="53" r="2" fill="#cfd8c8"/>' +
  '<rect x="21" y="60" width="38" height="5" rx="2.5" fill="#d3dccb"/>' +
  '<rect class="elec-bar" x="21" y="60" width="38" height="5" rx="2.5"/>';

export const elecDisc = (index, uid = "") =>
  `<defs><radialGradient id="um-edome${uid}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6ee"/></radialGradient></defs>` +
  '<rect x="34" y="66" width="12" height="22" fill="#9aa5b1"/>' +
  '<circle class="halo" cx="40" cy="36" r="31"/>' +
  '<circle cx="40" cy="36" r="30" fill="#e9eef3" stroke="#b7c0ca" stroke-width="1.5"/>' +
  `<circle cx="40" cy="36" r="24.5" fill="url(#um-edome${uid})" stroke="#c3ccd6" stroke-width="1"/>` +
  '<rect x="26" y="19" width="28" height="9" rx="1.5" fill="#1d2632"/>' +
  `<text class="digits" x="40" y="26" text-anchor="middle">${esc(digitsOf(index, 5))}</text>` +
  '<ellipse cx="40" cy="45" rx="17" ry="6.5" fill="#cdd5dd" stroke="#aeb7c1" stroke-width=".8"/>' +
  '<g class="elec-disc"><rect x="39" y="38.5" width="2" height="13" rx="1" fill="#2b333c"/></g>' +
  '<text class="unit elec-unit" x="40" y="58.5" text-anchor="middle">kWh</text>';

export const elecSubmeter = (power) =>
  '<path d="M2 62 H78" stroke="#5b6670" stroke-width="6" fill="none" stroke-linecap="round"/>' +
  '<path class="elec-cur" d="M2 62 H78"/>' +
  '<path d="M62 54a8 8 0 1 0 0 16" fill="none" stroke="#9aa5b1" stroke-width="3.4" stroke-linecap="round"/>' +
  '<path d="M62 54a8 8 0 1 1 0 16" fill="none" stroke="#c2cad2" stroke-width="3.4" stroke-linecap="round" opacity=".5"/>' +
  '<rect class="halo" x="13" y="6" width="42" height="42" rx="9"/>' +
  '<rect x="15" y="8" width="38" height="38" rx="7" fill="#f3f6f1" stroke="#b7c0ca" stroke-width="1"/>' +
  '<rect x="15" y="8" width="38" height="8" rx="7" fill="#2e7d32"/><rect x="15" y="13" width="38" height="3" fill="#2e7d32"/>' +
  '<rect x="20" y="20" width="28" height="14" rx="2" fill="#10261a"/>' +
  `<text class="digits" style="font-size:5.4px" x="34" y="29.5" text-anchor="middle">${esc(power)}</text>` +
  '<text class="unit elec-unit" x="44" y="42" text-anchor="middle">W</text>' +
  '<circle class="elec-led" cx="22" cy="40" r="2.3"/>';

export const ELEC_ARTS = { digital: elecDigital, disc: elecDisc, submeter: elecSubmeter };
export const electricArt = (index, style, power, uid = "") =>
  `<svg viewBox="0 0 80 88" aria-hidden="true">${(ELEC_ARTS[style] || elecDigital)(style === "submeter" ? power : index, uid)}</svg>`;

export const ART_STYLE = `
  .picture { flex: none; display: flex; align-items: center; justify-content: center; }
  .picture svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 3px 6px rgba(0,0,0,.18)); }
  .picture .digits { font: 600 6.4px/1 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #e8f1f8; letter-spacing: .4px; }
  .picture .digits.red { fill: #ff8a80; }
  .picture .ripples path { fill: none; stroke: #e3f2fd; stroke-width: 1.6; stroke-linecap: round; opacity: 0; }
  .picture .star { transform-box: view-box; }
  .picture .drop { fill: #4fc3f7; opacity: 0; }
  .picture .puddle { fill: #4fc3f7; opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .picture .halo { fill: none; stroke: var(--um-crit); stroke-width: 2.5; opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .picture .flame { fill: #b0bec5; transform-box: fill-box; transform-origin: 50% 100%; }
  .picture.active .ripples path { animation: um-ripple 1.5s linear infinite; }
  .picture.active .ripples path:nth-child(2) { animation-delay: -.5s; }
  .picture.active .ripples path:nth-child(3) { animation-delay: -1s; }
  .picture.active .star { animation: um-spin 1.5s linear infinite; }
  .picture.active .flame { fill: #ff9800; animation: um-flame 1s ease-in-out infinite; }
  .picture.active .roll { animation: um-roll 3s ease-in-out infinite; }
  .picture.leak .drop { animation: um-drip 1.5s ease-in infinite; }
  .picture.leak .puddle { animation: um-puddle 3s ease-in-out infinite; }
  .picture.leak .halo { animation: um-halo 1.5s ease-out infinite; }
  @keyframes um-ripple { 0% { opacity: 0; transform: translateX(-4px); } 25% { opacity: .9; } 75% { opacity: .9; } 100% { opacity: 0; transform: translateX(14px); } }
  @keyframes um-spin { from { transform: translate(40px, 41px) rotate(0deg); } to { transform: translate(40px, 41px) rotate(360deg); } }
  @keyframes um-flame { 0%, 100% { transform: scale(1, 1); } 30% { transform: scale(.9, 1.12); } 60% { transform: scale(1.06, .92); } }
  @keyframes um-roll { 0%, 40% { transform: translateY(0); } 60%, 100% { transform: translateY(-9px); } }
  @keyframes um-drip { 0% { opacity: 0; transform: translateY(-2px); } 15% { opacity: 1; } 85% { opacity: 1; transform: translateY(8px); } 100% { opacity: 0; transform: translateY(9px); } }
  @keyframes um-puddle { 0%, 100% { opacity: .45; transform: scale(.75, 1); } 50% { opacity: .7; transform: scale(1, 1); } }
  @keyframes um-halo { 0% { opacity: .8; transform: scale(.94); } 100% { opacity: 0; transform: scale(1.08); } }
  /* Electricity meters: digital (LED, power bar, screen sweep), disc (Ferraris), submeter (current along the wire). */
  .picture .elec-unit { fill: #8fb89a; }
  .picture .elec-led { fill: #9fb7a4; }
  .picture .elec-bar { fill: #43a047; transform-box: fill-box; transform-origin: 0 50%; transform: scaleX(.18); }
  .picture .elec-scan { fill: #8fffbf; opacity: 0; }
  .picture .elec-disc { transform-box: fill-box; transform-origin: 50% 50%; }
  .picture .elec-cur { fill: none; stroke: #66bb6a; stroke-width: 2.6; stroke-linecap: round; stroke-dasharray: 4 11; opacity: 0; }
  .picture.active .elec-led { fill: #43a047; animation: um-eblink 1.1s steps(1, end) infinite; }
  .picture.active .elec-bar { animation: um-ebar 2.6s ease-in-out infinite; }
  .picture.active .elec-scan { animation: um-escan 2.2s ease-in-out infinite; }
  .picture.active .elec-disc { animation: um-edisc 2s linear infinite; }
  .picture.active .elec-cur { opacity: 1; animation: um-eflow 1s linear infinite; }
  .picture.high .halo { animation: um-halo 1.5s ease-out infinite; }
  .picture.high .elec-disc { animation-duration: .7s; }
  .picture.high .elec-cur { stroke: #ffb199; animation-duration: .45s; }
  .picture.high .elec-led { fill: var(--um-crit); animation: um-eblink .5s steps(1, end) infinite; }
  .picture.high .elec-bar { fill: var(--um-crit); transform: scaleX(.92); }
  @keyframes um-eblink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: .25; } }
  @keyframes um-ebar { 0%, 100% { transform: scaleX(.18); } 50% { transform: scaleX(.74); } }
  @keyframes um-escan { 0% { opacity: 0; transform: translateX(-6px); } 20% { opacity: .5; } 60% { opacity: .5; } 100% { opacity: 0; transform: translateX(26px); } }
  @keyframes um-edisc { to { transform: rotate(360deg); } }
  @keyframes um-eflow { to { stroke-dashoffset: -15; } }
`;

// ---------------------------------------------------------------------------
// Illustrated header: a 200 × 80 scene at the right of a 90 px banner, over a 10 px ground strip edge to edge, with
// the card's own meter drawn big at its right (the same picture and animations as in the body before). Each kind of
// meter has its own place: water in a cellar (concrete floor, the blue pipe and its valve), electricity by the
// breaker panel (tiled floor, the cable down to the meter), gas on the house front (lawn, the yellow gas pipe).
// `night`: the night version (the dark theme; `illustration_theme` forces one).
// ---------------------------------------------------------------------------

export const umStars = (night) =>
  night ? `<g fill="#fff" opacity=".8">${[[12, 8], [44, 18], [96, 6], [132, 24], [168, 10], [188, 30], [70, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".6"/>`).join("")}</g>` : "";
export const umSunMoon = (x, y, night) =>
  night
    ? `<path d="M${x} ${y - 6}a6.4 6.4 0 1 0 5.6 9.6 5.2 5.2 0 1 1-5.6-9.6Z" fill="#f4f1dc"/>`
    : `<circle cx="${x}" cy="${y}" r="9" fill="#ffd65a" opacity=".28"/><circle cx="${x}" cy="${y}" r="6" fill="#ffd65a"/>`;
export const umLines = (x1, n, step, color, width) =>
  `<g stroke="${color}" stroke-width="${width}">${Array.from({ length: n }, (_, i) => `<line x1="${x1}" y1="${i * step}" x2="240" y2="${i * step}"/>`).join("")}</g>`;

// The room behind each meter, in a 200 × 80 view. Its wall, lines and pipes run on to x 240, past the view's right
// edge: when the mini card's scene steps left of the corner button, they continue under the button to the banner's edge.
export const UM_SCENES = {
  // With the corner button (`zoom`), the upper pipe rises through the ceiling before the button instead of running
  // on under it.
  water: (n, zoom) =>
    `<rect width="240" height="80" fill="${n ? "#26241f" : "#e9e3da"}"/>${umLines(0, 10, 9, n ? "#33302a" : "#d8cfc1", 1)}` +
    `<path d="M40 68 H240 M100 68 V14 ${zoom ? "H192 V0" : "H240"}" stroke="#2f80ed" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    '<path class="um-pulse" d="M40 68 H240" stroke="#bfe6ff" stroke-width="2" fill="none"/>' +
    '<rect x="118" y="62" width="8" height="12" rx="1" fill="#e5484d"/><circle cx="122" cy="60" r="4" fill="#e5484d"/>' +
    `<path d="M180 0 v20" stroke="#5f5e5a" stroke-width=".6"/><circle cx="180" cy="22" r="3" fill="${n ? "#ffcf6e" : "#f3e6d3"}"/>` +
    '<ellipse class="um-puddle" cx="170" cy="79.2" rx="20" ry="2.4"/>',
  electricity: (n) =>
    `<rect width="240" height="80" fill="${n ? "#24272e" : "#f1f2f4"}"/>` +
    `<g transform="translate(96 8)"><rect width="64" height="58" rx="3" fill="${n ? "#3a4050" : "#fff"}" stroke="${n ? "#4a5568" : "#c9ced6"}"/>${[0, 1, 2]
      .map(
        (r) =>
          `<rect x="4" y="${6 + r * 16}" width="56" height="12" rx="1.5" fill="${n ? "#2e3442" : "#eef1f5"}"/>${Array.from(
            { length: 7 },
            (_, i) => `<rect x="${(7 + i * 7.6).toFixed(1)}" y="${8 + r * 16}" width="5" height="8" rx="1" fill="${i === 3 && r === 1 ? "#e5484d" : n ? "#55617a" : "#fff"}" stroke="#9aa3ae" stroke-width=".5"/>`,
          ).join("")}`,
      )
      .join("")}</g>` +
    '<path d="M128 66 V80" stroke="#5f6b7a" stroke-width="3"/><path class="um-flow" d="M128 66 V80" stroke="#f5b400" stroke-width="1.4"/>',
  gas: (n) =>
    `${umStars(n)}${umSunMoon(30, 14, n)}<rect x="60" y="0" width="180" height="80" fill="${n ? "#3a3530" : "#efe3cf"}"/>${umLines(60, 9, 10, n ? "#4a443c" : "#e2d3b8", 0.8)}` +
    `<rect x="150" y="8" width="26" height="22" rx="1.5" fill="${n ? "#1b2f52" : "#bfe0f7"}" stroke="${n ? "#4a5568" : "#fff"}" stroke-width="1.4"/>` +
    `<rect x="104" y="30" width="56" height="46" rx="2" fill="${n ? "#4a443c" : "#d9c9ab"}" stroke="${n ? "#5a5246" : "#b9a684"}"/>` +
    '<path d="M86 80 V60 H104" stroke="#f5b400" stroke-width="4" fill="none" stroke-linejoin="round"/>' +
    '<path class="um-flow" d="M86 80 V60 H104" stroke="#fff3b0" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
};
export const UM_GROUND = { water: "concrete", electricity: "tiles", gas: "lawn" };

// The part of each meter picture (its 80 × 88 drawing) shown in the banner, 72 units high with its right edge at x 196
// of the scene and its foot on the ground strip.
export const UM_ART_VIEW = {
  water: "-2.4 4.06 84.73 71.68",
  gas: "7.91 2.04 64.11 88.46",
  digital: "11.9 2.95 56.14 87.53",
  disc: "7 3 66 87.5",
  submeter: "-2 4 84 63",
};

export const umScene = (type, night, zoom) =>
  `<svg class="um-bg" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">${UM_SCENES[type](night, zoom)}</svg>`;

// Night picture: forced by illustration_theme, else Home Assistant's dark theme alone (a light theme keeps the day
// picture after sunset).
// A dark theme picked as a plain theme (not through Home Assistant's dark mode) leaves themes.darkMode false: the
// theme's text colour then tells — light text is a dark theme. Reads #rgb, #rrggbb and rgb()/rgba().
export const isLightColor = (c) => {
  const s = String(c ?? "").trim();
  let rgb = null;
  const h = s.match(/^#([\da-f]{3}|[\da-f]{6})([\da-f]{2})?$/i);
  if (h) {
    const x = h[1].length === 3 ? [...h[1]].map((d) => d + d).join("") : h[1];
    rgb = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  } else {
    const m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) rgb = m.slice(1, 4).map(Number);
  }
  return !!rgb && 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 140;
};
export const umIsNight = (hass, config, el) => {
  const theme = config?.illustration_theme;
  if (theme === "night") return true;
  if (theme === "day") return false;
  if (hass?.themes?.darkMode) return true;
  try {
    return !!el && typeof getComputedStyle === "function" && isLightColor(getComputedStyle(el).getPropertyValue("--primary-text-color"));
  } catch {
    return false;
  }
};

export const BANNER_STYLE = `
  /* The banner's own text colours (its background stays light by day, dark by night, whatever the theme). */
  .banner { position: relative; overflow: hidden; height: 90px; --primary-text-color: #0d2a45; color: var(--primary-text-color); --um-sky-muted: #3b5b78;
            background: linear-gradient(90deg, #f1f8ff 0%, #e2f1fd 34%, #b9def8 70%, #9fd0f3 100%); }
  .banner.night { --primary-text-color: #fff; --um-sky-muted: rgba(255,255,255,.78);
                  background: linear-gradient(90deg, #1b2f52 0%, #15284a 36%, #0f1f3d 72%, #0a1830 100%); }
  .banner.t-water { background: #e9e3da; } .banner.t-water.night { background: #26241f; }
  .banner.t-electricity { background: #f1f2f4; } .banner.t-electricity.night { background: #24272e; }
  .um-scene { position: absolute; right: 0; bottom: 10px; width: min(200px, 56cqw); aspect-ratio: 5 / 2; }
  .um-bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  .um-scene .picture { position: absolute; right: 2%; bottom: 0; height: 90%; }
  .um-scene .picture .puddle { display: none; }
  /* The mini card's detail button sits at the top right (5 + 24 px): the whole scene, meter and background, steps
     left of it at full size. */
  .banner.has-zoom .um-scene { right: 34px; }
  .um-pulse { stroke-dasharray: 4 26; opacity: 0; }
  .um-flow { stroke-dasharray: 3 4; opacity: 0; }
  .banner.active .um-pulse { opacity: 1; animation: um-pl 1.4s linear infinite; }
  .banner.active .um-flow { opacity: 1; animation: um-fl 1s linear infinite; }
  .um-puddle { fill: #4fc3f7; opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .banner.leak .um-puddle { animation: um-puddle 3s ease-in-out infinite; }
  @keyframes um-pl { to { stroke-dashoffset: -30; } }
  @keyframes um-fl { to { stroke-dashoffset: -7; } }
  /* The 10 px ground strip, edge to edge, themed to the meter's place. */
  .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; }
  .g-concrete { background: #9aa1a9; box-shadow: inset 0 2px 0 #b5bbc2; } .night .g-concrete { background: #2c323b; box-shadow: inset 0 2px 0 #3a414c; }
  .g-tiles { background: repeating-linear-gradient(90deg, #d9dfe3 0 18px, #c6cdd2 18px 19px); box-shadow: inset 0 2px 0 #b8c0c6; }
  .night .g-tiles { background: repeating-linear-gradient(90deg, #3a4250 0 18px, #2e3542 18px 19px); box-shadow: none; }
  .g-lawn { background: repeating-linear-gradient(90deg, #5aa83d 0 22px, #6cbb4c 22px 44px); }
  .night .g-lawn { background: repeating-linear-gradient(90deg, #1f4a2a 0 22px, #245433 22px 44px); }
  /* The round icon and the titles on the left, over the background. */
  .htext { position: absolute; z-index: 1; left: 0; top: 0; bottom: 10px; right: min(200px, 56cqw); display: flex; align-items: center; gap: 10px;
           padding: 8px 8px 8px 14px; min-width: 0; }
  .htext .titles { display: flex; flex-direction: column; min-width: 0; }
  .htext .sub { font-size: 13px; color: var(--um-sky-muted); }
  .banner .type-icon { background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(47,128,237,.18); }
  .banner.night .type-icon { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .banner .type-icon.idle .icon { fill: #7d8792; }
  .banner.night .type-icon.on .icon { fill: var(--um-accent-hi); }
  .banner.night .type-icon.idle .icon { fill: #9aa3ae; }
  .banner .type-icon.warn .icon { fill: var(--um-warn); }
  .banner .type-icon.crit .icon { fill: var(--um-crit); animation: um-pulse 1.5s ease-in-out infinite; }
  /* The mini card's detail button: a frosted round button in the banner's top-right corner. */
  .banner .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; margin: 0; cursor: pointer; width: 24px; height: 24px;
                  border-radius: 50%; display: grid; place-items: center; box-sizing: border-box; color: #33506b; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .banner .zoom .icon { width: 16px; height: 16px; }
  .banner .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
  .banner.night .zoom { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .banner.night .zoom:hover { background: rgba(255,255,255,.22); color: #ffffff; }
  .banner .zoom:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .htext .titles { flex: 1 1 0; min-width: 0; align-self: stretch; display: flex; flex-direction: column; justify-content: center; }
  /* The status pill on the banner: the status colour on frosted glass. */
  .banner .chip { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; margin: 0; max-width: 51%; padding: 1px 8px; border-radius: 12px;
                  font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; overflow: hidden; box-sizing: border-box;
                  background: color-mix(in srgb, var(--c, var(--um-accent)) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c, var(--um-accent)) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c, var(--um-accent)) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c, var(--um-accent)) 35%, #ffffff); }
  .banner .chip .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--c, var(--um-accent)); }
  .banner .chip .chip-text { display: inline; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .banner .chip.on { --c: var(--um-accent); }
  .banner + .content { padding-top: 12px; }
  /* A long meter name (a card in a grid of three columns) takes two lines in the banner, cut after the second. */
  .htext .name { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  /* Narrow card: no room for the scene beside the text, the background alone stays. */
  @container um-card (max-width: 320px) { .um-scene { display: none; } .htext { right: 32px; } }
`;
