// The README screenshots (PNG) and animations (GIF) rendered by scripts/screenshots.mjs.
// Every capture has a twin in the other theme ("-dark" for a light capture, "-light" for a dark one)
// that shows exactly the same state: only the theme differs (checked by test/screenshots.test.mjs).
import { gasFlowing, waterFlowing } from "./mock-states.mjs";

const water = { entity: "sensor.water_meter", flow_entity: "sensor.water_flow", price_entity: "sensor.water_price" };
const gas = { entity: "sensor.gas_meter", flow_entity: "sensor.gas_flow", price: 0.105, price_unit: "energy", chart_period: "year" };
const leak = { entity: "sensor.cottage_water_meter", leak_entity: "binary_sensor.cottage_leak", price: 3.9, chart_period: "day" };

const twins = (file, type, width, config, extra = {}, first = "light") => {
  const other = first === "light" ? "dark" : "light";
  return [
    { file, type, theme: first, width, config, ...extra },
    { file: `${file}-${other}`, type, theme: other, width, config, ...extra },
  ];
};

export const shots = [
  ...twins("card", "utility-meter-card", 460, water),
  ...twins("card-gas", "utility-meter-card", 460, gas, {}, "dark"),
  ...twins("card-leak", "utility-meter-card", 460, leak),
  ...twins("card-popup", "utility-meter-card", 460, water, { clicks: ['[data-action="slot"][data-index="2"]'] }, "dark"),
  ...twins("card-month", "utility-meter-card", 460, { ...water, chart_period: "month", collapsed: ["consumption"] }),
  ...twins("mini-card", "utility-meter-mini-card", 380, water),
  ...twins("mini-card-gas", "utility-meter-mini-card", 380, gas, {}, "dark"),
  ...twins("mini-card-leak", "utility-meter-mini-card", 380, leak),
  ...twins("mini-card-zoom", "utility-meter-mini-card", 460, water, { clicks: [".zoom"] }, "dark"),
  // Narrow cards: the full card at 6 of 12 columns of a phone's Sections view and the mini card at 170 px.
  ...twins("card-narrow", "utility-meter-card", 238, { ...water, collapsed: [] }),
  ...twins("mini-card-narrow", "utility-meter-mini-card", 170, water, {}, "dark"),
];

// One looping GIF per distinct animated state of the drawn meters:
//   water-flowing — water running now: the star wheel spins and water ripples along the pipe
//   gas-flowing   — gas burning now: the last digit rolls and the flame flickers
//   water-leak    — continuous flow all night: drops fall from the pipe joint into a puddle, the meter pulses red,
//                   the alert icon pulses
// Each one is followed by its twin in the other theme.
export const gifs = [
  ...twins("water-flowing", "utility-meter-card", 460, water, { overrides: waterFlowing }),
  ...twins("gas-flowing", "utility-meter-card", 460, gas, { overrides: gasFlowing }, "dark"),
  ...twins("water-leak", "utility-meter-card", 460, leak),
];
