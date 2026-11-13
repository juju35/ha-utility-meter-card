import assert from "node:assert/strict";
import { test } from "node:test";
import { mockStatistics, NOW, states } from "../scripts/mock-states.mjs";
import { flush, load, makeHass } from "./load.mjs";

const um = load();
const HOUR = 3600000;
const now = Date.parse(NOW); // Thursday 12 November 2026, 14:30 UTC (the tests run with TZ=UTC)

// Statistics of a meter using `perHour` (sensor unit) every hour, the current hour partly, like the recorder.
const flat =
  (perHour, id = "sensor.water_meter") =>
  (msg) => {
    const start = Date.parse(msg.start_time);
    const end = Math.min(Date.parse(msg.end_time), now);
    const rows = [];
    const step = msg.period === "hour" ? HOUR : 24 * HOUR;
    for (let t = start; t < end; t += step) rows.push({ start: t, end: t + step, change: (perHour * Math.min(step, end - t)) / HOUR });
    return { [id]: rows };
  };

const clone = (o) => JSON.parse(JSON.stringify(o));
// Values from the card's sandbox (another realm) as plain values.
const plain = clone;

const newCard = async (config = {}, { st = clone(states), stats = mockStatistics, Card = um.Card, extra } = {}) => {
  const hass = makeHass(st, stats, extra);
  const card = new Card();
  card.setConfig({ entity: "sensor.water_meter", ...config });
  card.hass = hass;
  await flush();
  return { card, hass, html: () => card.shadowRoot.innerHTML };
};

// A click on an element of the card, as composedPath() would report it.
const click = (card, dataset, extra = []) => {
  const el = { dataset };
  card._onClick({ composedPath: () => [el, ...extra], stopPropagation() {} });
  return el;
};

test("statistics rows: ms, seconds and ISO starts, sorted, rows without a change dropped", () => {
  const rows = um.statRows([
    { start: "2026-11-12T02:00:00Z", end: "2026-11-12T03:00:00Z", change: 2 },
    { start: Date.parse("2026-11-12T00:00:00Z") / 1000, change: 1 },
    { start: Date.parse("2026-11-12T01:00:00Z"), end: Date.parse("2026-11-12T02:00:00Z"), change: null },
  ]);
  assert.deepEqual(
    rows.map((r) => [new Date(r.s).toISOString(), r.v, r.e - r.s]),
    [
      ["2026-11-12T00:00:00.000Z", 1, HOUR],
      ["2026-11-12T02:00:00.000Z", 2, HOUR],
    ],
  );
});

test("each period so far is compared with the previous one at the same point", () => {
  const get = flat(0.001);
  const stats = {
    hourly: um.statRows(get({ start_time: "2026-11-10T00:00:00Z", end_time: NOW, period: "hour" })["sensor.water_meter"]),
    daily: um.statRows(get({ start_time: "2025-01-01T00:00:00Z", end_time: NOW, period: "day" })["sensor.water_meter"]),
  };
  const liters = (kind) => {
    const v = um.periodValues(stats, kind, now, 1);
    return [Math.round(v.cur * 10000) / 10, Math.round(v.prev * 10000) / 10];
  };
  assert.deepEqual(liters("day"), [14.5, 14.5]);
  // Monday 9 to Thursday 14:30: 3 days and 14.5 hours, last week's Thursday counted for the same 14.5 hours.
  assert.deepEqual(liters("week"), [86.5, 86.5]);
  assert.deepEqual(liters("month"), [278.5, 278.5]);
  const y = um.periodValues(stats, "year", now, 1);
  assert.ok(Math.abs(y.cur - y.prev) < 1e-9, "same elapsed time in the previous year");
  // Sunday as the first day of the week.
  assert.equal(Math.round(um.periodValues(stats, "week", now, 0).cur * 10000) / 10, 110.5);
});

test("the previous period stops at its own end and at the data the current one has", () => {
  // 31 March 12:00 against February (28 days): all of February, nothing of March counted twice.
  const end = Date.parse("2026-03-31T12:00:00Z");
  const rows = [];
  for (let t = Date.parse("2026-02-01T00:00:00Z"); t < end; t += 24 * HOUR) rows.push({ start: t, end: t + 24 * HOUR, change: 1 });
  const v = um.periodValues({ hourly: [], daily: um.statRows(rows, true) }, "month", end, 1);
  assert.equal(v.prev, 28);
  // Statistics imported two days late (Suez, Gazpar): this week up to the last data against last week up to the same point.
  const late = [];
  for (let t = Date.parse("2026-11-02T00:00:00Z"); t < Date.parse("2026-11-11T00:00:00Z"); t += 24 * HOUR) late.push({ start: t, change: 1 });
  const w = um.periodValues({ hourly: [], daily: um.statRows(late, true) }, "week", now, 1);
  assert.equal(w.cur, 2);
  assert.equal(w.prev, 2);
  // Hourly statistics compiled up to 14:00: yesterday up to 14:00 too.
  const hourly = [];
  for (let t = Date.parse("2026-11-11T00:00:00Z"); t < Date.parse("2026-11-12T14:00:00Z"); t += HOUR) hourly.push({ start: t, change: 1 });
  const d = um.periodValues({ hourly: um.statRows(hourly), daily: [] }, "day", now, 1);
  assert.deepEqual([d.cur, d.prev], [14, 14]);
  // A live utility_meter value: up to now.
  assert.equal(um.periodValues({ hourly: um.statRows(hourly), daily: [] }, "day", now, 1, true).prev, 14.5);
});

test("daily rows land on the browser's day even when the server cuts days elsewhere", () => {
  // Server in UTC+1 (Paris): its days start at 23:00 UTC; the browser here runs in UTC.
  const rows = um.statRows([{ start: "2026-11-11T23:00:00Z", end: "2026-11-12T23:00:00Z", change: 3 }], true);
  assert.equal(new Date(rows[0].s).toISOString(), "2026-11-12T00:00:00.000Z");
});

test("first day of the week: Home Assistant's choice, else the language's", async () => {
  const sunday = await newCard({}, { extra: { locale: { language: "en-US", first_weekday: "language" } } });
  const monday = await newCard({}, { extra: { locale: { language: "fr", first_weekday: "language" } } });
  const start = (c) => new Date(c.card._m.periods.week.start).getUTCDay();
  assert.equal(start(monday), 1);
  // Engines without week data fall back to Monday.
  const info = new Intl.Locale("en-US");
  assert.equal(start(sunday), (info.getWeekInfo?.() ?? info.weekInfo) ? 0 : 1);
});

test("no previous period without statistics for it", () => {
  const stats = { hourly: [], daily: um.statRows([{ start: Date.parse("2026-11-12T00:00:00Z"), change: 0.1 }]) };
  const v = um.periodValues(stats, "week", now, 1);
  assert.equal(v.cur, 0.1);
  assert.equal(v.prev, null);
});

test("chart slots: hours, weekdays, days of the month and months, slots to come left empty", () => {
  const get = flat(0.001);
  const stats = {
    hourly: um.statRows(get({ start_time: "2026-11-10T00:00:00Z", end_time: NOW, period: "hour" })["sensor.water_meter"]),
    daily: um.statRows(get({ start_time: "2025-01-01T00:00:00Z", end_time: NOW, period: "day" })["sensor.water_meter"]),
  };
  const day = um.chartSlots(stats, "day", now, 1);
  assert.equal(day.length, 24);
  assert.equal(day[15].value, null);
  assert.ok(Math.abs(day[14].value - 0.0005) < 1e-12, "current hour so far");
  const week = um.chartSlots(stats, "week", now, 1);
  assert.equal(week.length, 7);
  assert.deepEqual(
    plain(week.map((s) => (s.value === null ? null : Math.round(s.value * 1000)))),
    [24, 24, 24, 15, null, null, null],
  );
  assert.ok(week.every((s) => Math.round(s.prev * 1000) === 24), "one day of last week per bar");
  const month = um.chartSlots(stats, "month", now, 1);
  assert.equal(month.length, 30);
  assert.equal(month[29].prev !== null, true, "30 October exists");
  const year = um.chartSlots(stats, "year", now, 1);
  assert.equal(year.length, 12);
  assert.equal(year[11].value, null);
  assert.equal(Math.round(year[0].prev * 1000), 744, "January of last year");
});

test("night window: the last one that ended, across midnight or not", () => {
  const iso = (w) => [new Date(w.start).toISOString(), new Date(w.end).toISOString()];
  assert.deepEqual(iso(um.nightWindow(now, "01:00", "05:00")), ["2026-11-12T01:00:00.000Z", "2026-11-12T05:00:00.000Z"]);
  assert.deepEqual(iso(um.nightWindow(now, "23:00:00", "06:00:00")), ["2026-11-11T23:00:00.000Z", "2026-11-12T06:00:00.000Z"]);
  const early = Date.parse("2026-11-12T03:00:00Z");
  assert.deepEqual(iso(um.nightWindow(early, "01:00", "05:00")), ["2026-11-11T01:00:00.000Z", "2026-11-11T05:00:00.000Z"]);
  // Invalid times fall back to the defaults.
  assert.deepEqual(iso(um.nightWindow(now, "nope", "25:00")), ["2026-11-12T01:00:00.000Z", "2026-11-12T05:00:00.000Z"]);
});

test("leak: every hour of the night window at the threshold or above", () => {
  const hourly = (fn) => ({ hourly: um.statRows(Array.from({ length: 40 }, (_, i) => ({ start: Date.parse("2026-11-11T00:00:00Z") + i * HOUR, change: fn(i % 24) }))), daily: [] });
  const t = um.leakThreshold({}, "water", "m³");
  assert.equal(t, 0.002, "2 L/h in m³");
  assert.equal(um.nightCheck(hourly(() => 0.004), now, "01:00", "05:00", t).leak, true);
  const one = um.nightCheck(hourly((h) => (h === 3 ? 0 : 0.004)), now, "01:00", "05:00", t);
  assert.equal(one.leak, false);
  assert.equal(one.lowest, 0);
  assert.equal(one.hours.length, 4);
  assert.equal(um.nightCheck({ hourly: [], daily: [] }, now, "01:00", "05:00", t), null);
  assert.equal(um.leakThreshold({ leak_threshold: 5 }, "water", "L"), 5);
  assert.equal(um.leakThreshold({}, "gas", "m³"), 0.05);
});

test("leak: no verdict while the night is not in the statistics yet (late or daily-only data)", () => {
  const t = um.leakThreshold({}, "water", "m³");
  const rows = (to) => {
    const out = [];
    for (let s = Date.parse("2026-11-11T00:00:00Z"); s < Date.parse(to); s += HOUR) out.push({ start: s, change: 0.004 });
    return { hourly: um.statRows(out), daily: [] };
  };
  assert.equal(um.nightCheck(rows("2026-11-12T03:00:00Z"), now, "01:00", "05:00", t), null);
  assert.equal(um.nightCheck(rows("2026-11-12T05:00:00Z"), now, "01:00", "05:00", t).leak, true);
  // Daily values imported at midnight as hourly rows.
  const daily = { hourly: um.statRows([{ start: "2026-11-11T00:00:00Z", change: 0.3 }, { start: "2026-11-12T00:00:00Z", change: 0.3 }]), daily: [] };
  assert.equal(um.nightCheck(daily, now, "01:00", "05:00", t), null);
});

test("amounts: liters below 1 m³ for water, fewer digits as values grow, the sensor's unit otherwise", () => {
  assert.equal(um.fmtAmount(0.245, "m³", "en", { water: true }), "245 L");
  assert.equal(um.fmtAmount(2.0412, "m³", "en", { water: true }), "2.04 m³");
  assert.equal(um.fmtAmount(1500, "L", "en", { water: true }), "1.5 m³");
  assert.equal(um.fmtAmount(0.245, "m³", "en", { water: true, liters: false }), "0.25 m³");
  assert.equal(um.fmtAmount(123.4, "kWh", "en"), "123 kWh");
  assert.equal(um.fmtAmount(1.82, "m3", "en"), "1.82 m³");
  assert.equal(um.fmtAmount(null, "m³", "en"), "—");
  assert.match(um.fmtAmount(1234.5, "m³", "fr", {}), /^1\s235 m³$/);
  assert.equal(um.convert(1, "m³", "L"), 1000);
  assert.equal(Math.round(um.convert(1, "gal", "L") * 1000) / 1000, 3.785);
  assert.equal(um.convert(3.6, "MJ", "kWh"), 1);
  assert.equal(um.convert(5, "m³", "kWh"), 5, "no conversion between volume and energy");
  assert.equal(um.fmtPct(0.123, "en"), "+12%");
  assert.equal(um.fmtPct(-0.5, "en"), "-50%");
});

test("the full card shows the index, the periods with cost and comparison, the chart and the night section", async () => {
  const { html, hass } = await newCard({ price_entity: "sensor.water_price", flow_entity: "sensor.water_flow" });
  const h = html();
  assert.match(h, /1,234\.567<small>m³<\/small>/);
  for (const label of ["Today", "This week", "This month", "This year"]) assert.ok(h.includes(`<div class="k">${label}</div>`), label);
  assert.match(h, /€\d+\.\d\d/);
  assert.match(h, /vs yesterday/);
  assert.match(h, /data-action="tab" data-period="week" aria-pressed="true"/);
  assert.equal(h.match(/data-action="slot"/g).length, 7);
  assert.match(h, /data-section="night" aria-expanded="false"/);
  assert.match(h, /Flow 0 L\/min/);
  // Two statistics requests: hourly from two days back and daily from the 1st of January of last year.
  const ws = hass.calls.filter((c) => c[0] === "ws").map((c) => c[1]);
  assert.deepEqual(
    plain(ws.map((m) => [m.type, m.period, m.start_time, m.statistic_ids, m.types])),
    [
      ["recorder/statistics_during_period", "hour", "2026-11-10T00:00:00.000Z", ["sensor.water_meter"], ["change"]],
      ["recorder/statistics_during_period", "day", "2025-01-01T00:00:00.000Z", ["sensor.water_meter"], ["change"]],
    ],
  );
});

test("statistics are not fetched again on every state update", async () => {
  const { card, hass } = await newCard();
  card.hass = { ...hass, states: { ...hass.states, "light.x": { entity_id: "light.x", state: "on", attributes: {} } } };
  card.hass = { ...hass };
  await flush();
  assert.equal(hass.calls.filter((c) => c[0] === "ws").length, 2);
});

test("cost: per m³, per kWh with the conversion factor, none without a price or with show_cost: false", async () => {
  const stats = flat(0.01, "sensor.gas_meter");
  const st = clone(states);
  const gas = { entity: "sensor.gas_meter", price: 0.1, price_unit: "energy", conversion_factor: 10 };
  // Today: 14.5 hours at 0.01 m³ = 0.145 m³ = 1.45 kWh = €0.15 (rounded).
  const a = await newCard(gas, { st, stats });
  assert.match(a.html(), /<div class="cost">€0\.15<\/div>/);
  const b = await newCard({ ...gas, price_unit: "volume", price: 2 }, { st, stats });
  assert.match(b.html(), /<div class="cost">€0\.29<\/div>/);
  const c = await newCard({ entity: "sensor.gas_meter" }, { st, stats });
  assert.doesNotMatch(c.html(), /class="cost"/);
  const d = await newCard({ ...gas, show_cost: false }, { st, stats });
  assert.doesNotMatch(d.html(), /class="cost"/);
  const e = await newCard({ ...gas, currency: "chf" }, { st, stats });
  assert.match(e.html(), /CHF/);
});

test("a utility_meter helper fed by the meter gives the period's live value", async () => {
  const st = clone(states);
  st["sensor.water_daily"] = {
    entity_id: "sensor.water_daily",
    state: "0.321",
    attributes: { source: "sensor.water_meter", meter_period: "daily", unit_of_measurement: "m³", last_period: "0.4" },
  };
  assert.deepEqual({ ...um.utilityMeters({ states: st }, "sensor.water_meter") }, { day: "sensor.water_daily" });
  const { html } = await newCard({}, { st });
  assert.match(html(), /data-entity="sensor\.water_daily"><div class="k">Today<\/div><div class="v">321 L<\/div>/);
  // Without statistics, the previous full period of the helper is the comparison.
  const none = await newCard({}, { st, stats: () => ({}) });
  assert.match(none.html(), /-20% vs yesterday/);
  assert.match(none.html(), /No long-term statistics/);
});

test("a night of continuous flow raises the leak alert, unfolds the night section and turns the header red", async () => {
  const { html } = await newCard({ entity: "sensor.cottage_water_meter", chart_period: "day" });
  const h = html();
  assert.match(h, /class="chip clickable crit"[^>]*title="Leak suspected"/);
  assert.match(h, /class="type-icon crit"/);
  assert.match(h, /Continuous flow all night: at least 4 L every hour from 01:00 AM to 05:00 AM/);
  assert.match(h, /data-section="night" aria-expanded="true"/);
  assert.match(h, /class="picture clickable active leak"/);
  // Last night's hours are drawn red in the day chart.
  assert.equal(h.match(/class="slot crit"/g).length, 4);
});

test("a leak sensor reports a leak, leak_detection: false hides it all, gas meters have no detection by default", async () => {
  const st = clone(states);
  st["binary_sensor.cottage_leak"].state = "on";
  const a = await newCard({ leak_entity: "binary_sensor.cottage_leak" }, { st });
  assert.match(a.html(), /Utility room leak sensor reports a leak/);
  assert.match(a.html(), /title="Leak suspected"/);
  const b = await newCard({ entity: "sensor.cottage_water_meter", leak_detection: false });
  assert.doesNotMatch(b.html(), /Leak suspected|data-section="night"/);
  const c = await newCard({ entity: "sensor.gas_meter" });
  assert.doesNotMatch(c.html(), /data-section="night"/);
});

test("daily limit: high usage in orange; an unavailable meter is grey", async () => {
  const a = await newCard({ daily_limit: 0.01 });
  assert.match(a.html(), /title="High usage"/);
  assert.match(a.html(), /above the daily limit \(10 L\)/);
  const st = clone(states);
  st["sensor.water_meter"].state = "unavailable";
  const b = await newCard({}, { st });
  assert.match(b.html(), /class="chip clickable idle"[^>]*title="Unavailable"/);
  assert.match(b.html(), /<div class="v">—<small>m³<\/small>/);
});

test("sections fold and unfold, and fold back when the page is clicked elsewhere", async () => {
  const { card, html } = await newCard();
  click(card, { action: "toggle_section", section: "night" });
  assert.match(html(), /data-section="night" aria-expanded="true"/);
  click(card, { action: "toggle_section", section: "consumption" });
  assert.match(html(), /data-section="consumption" aria-expanded="false"/);
  card.connectedCallback();
  card._onOutside({ composedPath: () => [] });
  assert.match(html(), /data-section="night" aria-expanded="false"/);
  assert.match(html(), /data-section="consumption" aria-expanded="true"/);
});

test("chart tabs switch the period; a bar opens its details at the top of the card", async () => {
  const { card, html } = await newCard({ price: 4 });
  click(card, { action: "tab", period: "year" });
  assert.equal(html().match(/data-action="slot"/g).length, 12);
  click(card, { action: "tab", period: "week" });
  click(card, { action: "slot", index: "2" });
  assert.match(html(), /<ha-card class="dialog-open">/);
  assert.match(html(), /aria-label="Wednesday, November 11"/);
  assert.match(html(), /<span class="k">Last week<\/span>/);
  assert.match(html(), /<span class="k">Cost<\/span>/);
  // A click inside the dialog does nothing, the backdrop or Close closes it.
  card._onClick({ composedPath: () => [{}, { dataset: { action: "popup_backdrop" } }], stopPropagation() {} });
  assert.match(html(), /<ha-card class="dialog-open">/);
  click(card, { action: "popup_close" });
  assert.doesNotMatch(html(), /<ha-card class="dialog-open">/);
});

test("daily-only statistics (an external statistic): no Day tab", async () => {
  const daily = (msg) => (msg.period === "hour" ? {} : flat(0.1, "sensor.water_meter")(msg));
  const { html } = await newCard({ chart_period: "day" }, { stats: daily });
  assert.doesNotMatch(html(), /data-period="day"/);
  assert.match(html(), /data-period="week" aria-pressed="true"/);
});

test("statistic_id reads another statistic than the sensor's", async () => {
  const { hass } = await newCard({ statistic_id: "suez_water:123_water_consumption_statistics" }, { stats: () => ({}) });
  assert.deepEqual(plain(hass.calls.filter((c) => c[0] === "ws").map((c) => c[1].statistic_ids[0])), [
    "suez_water:123_water_consumption_statistics",
    "suez_water:123_water_consumption_statistics",
  ]);
});

test("statistics come in the sensor's unit, once an hour and every 10 minutes, shared by cards on the same meter", async () => {
  const { card, hass } = await newCard();
  const ws = () => hass.calls.filter((c) => c[0] === "ws").map((c) => c[1]);
  assert.deepEqual(plain(ws().map((m) => [m.period, m.units])), [
    ["hour", { volume: "m³" }],
    ["day", { volume: "m³" }],
  ]);
  const twin = new um.MiniCard();
  twin.setConfig({ entity: "sensor.water_meter" });
  twin.hass = hass;
  await flush();
  assert.equal(ws().length, 2, "the mini card on the same meter reuses the answer");
  // 11 minutes later: the hourly statistics again, the daily ones kept.
  card._fetchedAt -= 11 * 60000;
  card.hass = { ...hass };
  await flush();
  assert.deepEqual(plain(ws().slice(2).map((m) => m.period)), ["hour"]);
  // A Home Assistant refusing the unit: asked again without it.
  const strict = await newCard({}, { stats: (msg) => {
    if (msg.units) throw new Error("invalid unit");
    return mockStatistics(msg);
  } });
  assert.match(strict.html(), /class="tile clickable"/);
  assert.doesNotMatch(strict.html(), /No long-term statistics/);
});

test("the picture: still when nothing flows, animated while flowing (flow sensor or current hour)", async () => {
  const st = clone(states);
  const still = await newCard({ flow_entity: "sensor.water_flow" }, { st });
  assert.match(still.html(), /class="picture clickable" role="button"/);
  st["sensor.water_flow"].state = "6.5";
  const flowing = await newCard({ flow_entity: "sensor.water_flow" }, { st });
  assert.match(flowing.html(), /class="picture clickable active"/);
  assert.match(flowing.html(), /class="flow clickable flowing"/);
  // No flow sensor: the current hour of the statistics used water.
  const stats = await newCard();
  assert.match(stats.html(), /class="picture clickable active"/);
  const gas = await newCard({ entity: "sensor.gas_meter" });
  assert.match(gas.html(), /class="flame"/);
  const none = await newCard({ show_picture: false });
  assert.doesNotMatch(none.html(), /class="picture/);
});

test("mini card: index in the subtitle, today and this month, detail button switching to the full card", async () => {
  const { card, html } = await newCard({}, { Card: um.MiniCard });
  assert.match(html(), /<div class="sub">1,234\.567 m³<\/div>/);
  assert.match(html(), /<div class="k">Today<\/div>/);
  assert.match(html(), /<div class="k">This month<\/div>/);
  assert.match(html(), /class="zoom" data-action="zoom"/);
  assert.equal(card.getGridOptions().columns, 6);
  click(card, { action: "zoom" });
  assert.match(html(), /data-section="history"/);
  assert.equal(card.getGridOptions().columns, 12);
  card.connectedCallback();
  card._onUnzoom({ composedPath: () => [] });
  assert.doesNotMatch(html(), /data-section="history"/);
  const off = await newCard({ zoom: false }, { Card: um.MiniCard });
  assert.doesNotMatch(off.html(), /data-action="zoom" title/);
});

test("errors: no meter at all, an unknown entity", async () => {
  const card = new um.Card();
  card.setConfig({});
  card.hass = makeHass({}, () => ({}));
  assert.match(card.shadowRoot.innerHTML, /No water or gas meter found/);
  const b = await newCard({ entity: "sensor.nope" });
  assert.match(b.html(), /Entity not found: sensor\.nope/);
});

test("stub config and default meter: cumulative water meter first", () => {
  assert.deepEqual({ ...um.Card.getStubConfig({ states }) }, { entity: "sensor.cottage_water_meter" });
  assert.deepEqual(
    plain(um.listMeters({ states }).map((s) => s.entity_id)),
    ["sensor.cottage_water_meter", "sensor.water_meter", "sensor.gas_meter"],
  );
});

test("the editor keeps the YAML minimal: defaults and empty values are dropped", () => {
  const ed = new um.Editor();
  ed.setConfig({ entity: "sensor.gas_meter" });
  ed.hass = { states, language: "en" };
  const form = ed.children[0];
  assert.ok(form.schema.length > 5);
  const names = JSON.stringify(form.schema);
  for (const n of ["price", "leak_start", "statistic_id", "show_picture", "collapsed"]) assert.ok(names.includes(`"${n}"`), n);
  let out;
  ed.dispatchEvent = (ev) => (out = ev.detail.config);
  const events = form.listeners;
  events["value-changed"]({
    stopPropagation() {},
    detail: { value: { entity: "sensor.gas_meter", show_title: true, leak_detection: false, title: "", price: 0.1, chart_period: "week", collapsed: ["night"] } },
  });
  assert.deepEqual({ ...out }, { entity: "sensor.gas_meter", price: 0.1 });
  // Leak detection defaults to on for a water meter: turning it off is kept.
  ed.setConfig({ entity: "sensor.water_meter" });
  events["value-changed"]({ stopPropagation() {}, detail: { value: { entity: "sensor.water_meter", leak_detection: false } } });
  assert.deepEqual({ ...out }, { entity: "sensor.water_meter", leak_detection: false });
  const mini = new um.MiniEditor();
  mini.setConfig({});
  mini.hass = { states, language: "en" };
  assert.ok(JSON.stringify(mini.children[0].schema).includes('"zoom"'));
});

test("every language has every text, with the same placeholders, and is listed in the editor", () => {
  const en = Object.keys(um.STRINGS.en);
  const langs = Object.keys(um.STRINGS);
  assert.equal(langs.length, 22);
  assert.deepEqual([...um.LANGUAGES.map(([l]) => l)].sort(), [...langs].sort());
  for (const l of langs) {
    assert.deepEqual(Object.keys(um.STRINGS[l]).sort(), [...en].sort(), l);
    for (const k of en) {
      const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(ph(um.STRINGS[l][k]), ph(um.STRINGS.en[k]), `${l}.${k}`);
    }
  }
});

test("the card follows the language option", async () => {
  const { html } = await newCard({ language: "fr", price: 4 });
  assert.match(html(), /Aujourd&#39;hui/);
  assert.match(html(), /Compteur d&#39;eau/);
  assert.match(html(), /1\s234,567/);
});
