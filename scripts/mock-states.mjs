// Mock Home Assistant states and long-term statistics used to render the screenshots and by the tests: a water meter
// with a flow sensor and a price sensor, a holiday home water meter that keeps flowing at night (leak) and a gas meter
// counting m³ (as Gazpar does). Names are neutral; the clock is fixed by the screenshot script (see NOW).
export const NOW = "2026-11-12T14:30:00Z";

export const states = {};
const entity = (entity_id, state, attributes = {}) => {
  states[entity_id] = { entity_id, state: String(state), attributes, last_changed: NOW, last_updated: NOW };
};

entity("sensor.water_meter", "1234.567", {
  friendly_name: "House water",
  device_class: "water",
  state_class: "total_increasing",
  unit_of_measurement: "m³",
});
entity("sensor.water_flow", "0", { friendly_name: "Water flow", device_class: "volume_flow_rate", unit_of_measurement: "L/min" });
entity("sensor.water_price", "4.34", { friendly_name: "Water price", unit_of_measurement: "EUR/m³" });
entity("sensor.cottage_water_meter", "287.341", {
  friendly_name: "Holiday home water",
  device_class: "water",
  state_class: "total_increasing",
  unit_of_measurement: "m³",
});
entity("binary_sensor.cottage_leak", "off", { friendly_name: "Utility room leak sensor", device_class: "moisture" });
entity("sensor.gas_meter", "8456.12", {
  friendly_name: "House gas",
  device_class: "gas",
  state_class: "total_increasing",
  unit_of_measurement: "m³",
});
entity("sensor.gas_flow", "0", { friendly_name: "Gas flow", device_class: "volume_flow_rate", unit_of_measurement: "m³/h" });

// Overrides of the GIFs: water and gas flowing right now.
export const waterFlowing = { "sensor.water_flow": { state: "6.5" } };
export const gasFlowing = { "sensor.gas_flow": { state: "0.42" } };

/**
 * Answers a `recorder/statistics_during_period` message like Home Assistant: { [statistic_id]: [{ start, end, change }] },
 * start and end in ms, one row per hour or day up to now (the current one partial). Self-contained (no outer
 * reference): the screenshot script injects it into the page as source text.
 */
export function mockStatistics(msg) {
  const HOUR = 3600000;
  // Liters per hour of the day for a household, m³ of gas per hour (heating mornings and evenings).
  const WATER = [0, 0, 0, 0, 0, 0, 8, 35, 22, 6, 4, 5, 10, 6, 4, 3, 5, 12, 18, 28, 20, 10, 6, 2];
  const GAS = [0.05, 0.05, 0.04, 0.04, 0.05, 0.12, 0.42, 0.38, 0.22, 0.12, 0.08, 0.08, 0.1, 0.08, 0.07, 0.08, 0.12, 0.26, 0.36, 0.34, 0.28, 0.2, 0.12, 0.08];
  // Heating season: gas use by month (January first).
  const SEASON = [1.35, 1.25, 0.95, 0.6, 0.3, 0.12, 0.08, 0.08, 0.2, 0.55, 1, 1.3];
  const noise = (n) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const hourValue = (id, t) => {
    const d = new Date(t);
    const day = Math.floor(t / 86400000);
    const f = 0.8 + 0.4 * noise(day + (id.length % 7));
    const h = d.getHours();
    if (id === "sensor.gas_meter") return GAS[h] * SEASON[d.getMonth()] * f;
    if (id === "sensor.cottage_water_meter") return ((WATER[h] * 0.45 * f + 4) / 1000);
    if (id === "sensor.water_meter") return (WATER[h] * f * (1 + 0.15 * Math.sin(d.getMonth() / 1.9))) / 1000;
    return 0;
  };
  const now = Date.now();
  const start = Date.parse(msg.start_time);
  const end = Math.min(Date.parse(msg.end_time), now);
  const out = {};
  for (const id of msg.statistic_ids) {
    if (!["sensor.water_meter", "sensor.cottage_water_meter", "sensor.gas_meter"].includes(id)) continue;
    const rows = [];
    if (msg.period === "hour") {
      for (let t = Math.floor(start / HOUR) * HOUR; t < end; t += HOUR) {
        const share = Math.min(1, (end - t) / HOUR);
        rows.push({ start: t, end: t + HOUR, change: hourValue(id, t) * share });
      }
    } else {
      const d0 = new Date(start);
      for (let d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()); d.getTime() < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const from = d.getTime();
        const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        let change = 0;
        for (let t = from; t < Math.min(to, end); t += HOUR) change += hourValue(id, t) * Math.min(1, (end - t) / HOUR);
        rows.push({ start: from, end: to, change });
      }
    }
    out[id] = rows;
  }
  return out;
}
