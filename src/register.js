// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./core.js";
import { UtilityMeterCard, UtilityMeterMiniCard } from "./cards.js";
import { UtilityMeterCardEditor, UtilityMeterMiniCardEditor } from "./visual-editors.js";

export const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("utility-meter-card", UtilityMeterCard);
define("utility-meter-mini-card", UtilityMeterMiniCard);
define("utility-meter-card-editor", UtilityMeterCardEditor);
define("utility-meter-mini-card-editor", UtilityMeterMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  {
    type: "utility-meter-card",
    name: "Utility Meter Card",
    description: "Water, gas or electricity meter: index, consumption of the day, week, month and year compared with the previous period, history chart, cost and night leak detection.",
  },
  {
    type: "utility-meter-mini-card",
    name: "Utility Meter Mini Card",
    description: "Compact water, gas or electricity meter overview: index, today's and this month's consumption, last days and leak alert.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-utility-meter-card" });
}

console.info(`%c UTILITY-METER-CARD %c v${VERSION} `, "color: white; background: #0288d1; font-weight: 700;", "color: #0288d1; background: white; font-weight: 700;");
