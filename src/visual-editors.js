// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { DEFAULT_COLLAPSED, DEFAULT_LEAK, LANGUAGES, PERIODS, SECTIONS } from "./core.js";
import { lang, listMeters, meterType, t } from "./helpers.js";

export class UtilityMeterEditorBase extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  // Defaults of the toggles: leak detection is on for water meters, off for gas meters.
  _defaults() {
    const st = this._hass?.states[this._config.entity || listMeters(this._hass)[0]?.entity_id];
    const type = meterType(st, this._config.meter_type);
    const d = {
      illustration: true,
      illustration_theme: "auto",
      show_title: true,
      show_subtitle: true,
      show_picture: true,
      show_index: true,
      show_consumption: true,
      show_comparison: true,
      show_chart: true,
      show_cost: true,
      leak_detection: type === "water",
      liters: true,
      meter_type: "auto",
      picture_style: "auto",
      chart_period: "week",
      price_unit: type === "electricity" ? "energy" : "volume",
      collapsed: DEFAULT_COLLAPSED,
      leak_start: `${DEFAULT_LEAK.start}:00`,
      leak_end: `${DEFAULT_LEAK.end}:00`,
    };
    if (this.constructor.mini) d.zoom = true;
    return d;
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const sensor = (device_class) => ({ entity: { domain: "sensor", ...(device_class ? { device_class } : {}) } });
    const toggles = ["illustration", "show_title", "show_subtitle", "show_picture", "show_index", "show_consumption", "show_comparison", "show_chart", "show_cost", "leak_detection", "liters"];
    if (this.constructor.mini) toggles.push("zoom");
    return [
      { name: "entity", selector: { entity: { filter: [{ domain: "sensor", device_class: "water" }, { domain: "sensor", device_class: "gas" }, { domain: "sensor", device_class: "energy" }] } } },
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "meter_type", selector: { select: { mode: "dropdown", options: ["auto", "water", "gas", "electricity"].map((v) => ({ value: v, label: tr(`type_${v}`) })) } } },
          { name: "chart_period", selector: { select: { mode: "dropdown", options: PERIODS.map((v) => ({ value: v, label: tr(`tab_${v}`) })) } } },
          { name: "picture_style", selector: { select: { mode: "dropdown", options: ["auto", "digital", "disc", "submeter"].map((v) => ({ value: v, label: tr(`style_${v}`) })) } } },
          { name: "illustration_theme", selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((v) => ({ value: v, label: tr(`theme_${v}`) })) } } },
          // Empty: 3 for m³, 1 for ft³, CCF and gal, 0 for L and kWh.
          { name: "index_decimals", selector: { number: { min: 0, max: 6, step: 1, mode: "box" } } },
        ],
      },
      { type: "grid", name: "", schema: toggles.map((name) => ({ name, selector: { boolean: {} } })) },
      {
        name: "collapsed",
        selector: { select: { multiple: true, mode: "list", options: SECTIONS.map((value) => ({ value, label: tr(value) })) } },
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: tr("cost_section"),
        icon: "mdi:cash",
        schema: [
          { name: "price", selector: { number: { min: 0, step: "any", mode: "box" } } },
          { name: "price_entity", selector: sensor() },
          { name: "currency", selector: { text: {} } },
          { name: "price_unit", selector: { select: { mode: "dropdown", options: ["volume", "energy"].map((v) => ({ value: v, label: tr(`unit_${v}`) })) } } },
          { name: "conversion_factor", selector: { number: { min: 0, step: "any", mode: "box" } } },
          { name: "conversion_factor_entity", selector: sensor() },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: tr("leak_section"),
        icon: "mdi:water-alert",
        schema: [
          { name: "leak_start", selector: { time: {} } },
          { name: "leak_end", selector: { time: {} } },
          { name: "leak_threshold", selector: { number: { min: 0, step: "any", mode: "box" } } },
          { name: "daily_limit", selector: { number: { min: 0, step: "any", mode: "box" } } },
          { name: "flow_entity", selector: sensor() },
          { name: "leak_entity", selector: { entity: { domain: "binary_sensor" } } },
          { name: "valve_entity", selector: { entity: { domain: ["valve", "switch", "input_boolean"] } } },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: tr("sources_section"),
        icon: "mdi:database",
        schema: [
          { name: "statistic_id", selector: { statistic: {} } },
          ...["today_entity", "week_entity", "month_entity", "year_entity"].map((name) => ({ name, selector: sensor() })),
        ],
      },
      {
        name: "language",
        selector: { select: { mode: "dropdown", options: [{ value: "", label: tr("lang_auto") }, ...LANGUAGES.map(([value, label]) => ({ value, label }))] } },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => t(this._hass, this._config, s.name);
      this._form.computeHelper = (s) => (s.name === "zoom" ? t(this._hass, this._config, "zoom_helper") : undefined);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        const defaults = this._defaults();
        // Keep the YAML minimal: drop empty values and options left at their default.
        for (const [k, v] of Object.entries(config)) {
          if (v === "" || v === undefined || v === null || (k in defaults && JSON.stringify(v) === JSON.stringify(defaults[k]))) delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { ...this._defaults(), ...this._config };
    if (!data.entity) data.entity = listMeters(this._hass)[0]?.entity_id;
    this._form.hass = this._hass;
    if (this._dataFor !== this._config) {
      this._dataFor = this._config;
      this._form.data = data;
    }
    const l = lang(this._hass, this._config);
    if (this._schemaLang !== l) {
      this._schemaLang = l;
      this._form.schema = this._schema();
    }
  }
}

export class UtilityMeterCardEditor extends UtilityMeterEditorBase {}

export class UtilityMeterMiniCardEditor extends UtilityMeterEditorBase {
  static get mini() {
    return true;
  }
}
