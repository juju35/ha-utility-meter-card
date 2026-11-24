// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
import { DEFAULT_COLLAPSED, DEFAULT_LEAK, HOUR, ICONS, MIN_REFETCH_MS, PERIODS, REFETCH_MS, TYPES } from "./core.js";
import { ART_STYLE, BANNER_STYLE, ENERGY_KWH, UM_ART_VIEW, UM_GROUND, VOLUME_L, addDays, atMinutes, chartSlots, convert, electricArt, esc, firstWeekday, fmtAmount, fmtMoney, fmtNum, fmtPct, gasArt, indexDigits, intlLocale, isEnergy, isMetricVolume, isOutside, leakThreshold, listMeters, meterType, nightCheck, normUnit, num, parseTime, periodValues, sharedWS, startOfDay, startOfYear, statRows, svgIcon, t, umIsNight, umScene, utilityMeters, valid, watchOutside, waterArt } from "./helpers.js";
import { BASE_STYLE, DIALOG_STYLE, FULL_STYLE, MINI_STYLE, umMorph } from "./styles.js";

export let _umUid = 0;

export class UtilityMeterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._statsVersion = 0;
    // Keeps the ids of each card's drawings apart on a page with several cards.
    this._uid = `-${++_umUid}`;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    // No rewrite of the card between the press and the release: Home Assistant updates the card several times a
    // second, and a rewrite under the pointer replaces the element pressed, so that the click lands on the card itself
    // and does nothing. The pending render is done once released (after the click). The focus is only kept across
    // rewrites for the keyboard: put back after a mouse click or a tap, it would draw the focus ring.
    this.shadowRoot.addEventListener("pointerdown", () => {
      this._byPointer = true;
      this._pressing = true;
      window.addEventListener("pointerup", this._onPressEnd, true);
      window.addEventListener("pointercancel", this._onPressEnd, true);
    });
    this._onPressEnd = () => {
      window.removeEventListener("pointerup", this._onPressEnd, true);
      window.removeEventListener("pointercancel", this._onPressEnd, true);
      setTimeout(() => {
        this._pressing = false;
        if (this._dirty) this._update();
      }, 0);
    };
    // Enter / Space on an element with the button role acts as a click, as on a <button>.
    this.shadowRoot.addEventListener("keydown", (ev) => {
      this._byPointer = false;
      if ((ev.key !== "Enter" && ev.key !== " ") || ev.target?.getAttribute?.("role") !== "button") return;
      ev.preventDefault();
      ev.target.click();
    });
    this._onKey = (ev) => {
      if (ev.key !== "Escape" || !this._popup) return;
      ev.stopPropagation();
      this._closePopup();
    };
  }

  static getConfigElement() {
    return document.createElement("utility-meter-card-editor");
  }

  static getStubConfig(hass) {
    const m = listMeters(hass)[0];
    return m ? { entity: m.entity_id } : {};
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this.toggleAttribute?.("hide-title", config.show_title === false);
    this.toggleAttribute?.("hide-subtitle", config.show_subtitle === false);
    this._chart = null;
    this._popup = null;
    this._html = "";
    this._lastDeps = null;
    this._maybeFetch();
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._maybeFetch();
    const deps = this._deps();
    const prev = this._lastDeps;
    if (deps && prev && deps.length === prev.length && deps.every((d, i) => d === prev[i])) return;
    this._lastDeps = deps;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    // A click elsewhere on the page folds the sections back to their defaults and closes the popup.
    this._onOutside ??= (ev) => {
      if ((!this._toggled?.size && !this._popup) || !isOutside(this, ev)) return;
      this._toggled = new Map();
      if (this._popup) this._closePopup();
      else this._update();
    };
    (this._outside ??= watchOutside(this, (ev) => this._onOutside(ev))).on();
    // A new width (or the web font loaded): the status pill is fitted again, in the next frame.
    if (typeof ResizeObserver === "function") {
      this._resize ??= new ResizeObserver((entries) => {
        const w = Math.round(entries.at(-1).contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
    // Back on the page after leaving it: rendered again in its default state.
    if (this._hass && this._config) this._update();
    if (this._popup) window.addEventListener("keydown", this._onKey);
    // Statistics are fetched again every 10 minutes, and the periods move at midnight.
    clearInterval(this._tick);
    this._tick = setInterval(() => {
      if (this._hass) this.hass = this._hass;
    }, 60000);
  }

  // The status pill goes right after the title only when the whole title and the pill's whole label fit on that row;
  // otherwise it takes a line of its own under the subtitle (.titles.below, the subtitle cut to one line). In the
  // banner (where that line may run over the picture), when the titles still run below the top of the ground strip or
  // out of the banner, and in the classic header when the label does not fit even alone, the pill keeps its dot alone,
  // beside the title (.titles.dotonly). Measured in fractional pixels.
  _fitPill() {
    // Home Assistant's <ha-card> (a Lit element) lays its content out at its first update, a microtask after it is
    // connected: measured before, everything is 0 px wide and the pill lands on the wrong line. Fitted then.
    const haCard = this.shadowRoot?.querySelector?.("ha-card");
    if (haCard && haCard.hasUpdated === false) {
      this._pillWait ??= (haCard.updateComplete?.then ? haCard.updateComplete : new Promise((r) => requestAnimationFrame(r))).then(() => {
        this._pillWait = null;
        this._fitPill();
      });
      return;
    }
    for (const t of this.shadowRoot?.querySelectorAll?.(".titles") || []) {
      const row = t.querySelector(".trow");
      const chips = row ? [...row.querySelectorAll(":scope > .chip")] : [];
      if (!chips.length || !row.getBoundingClientRect) continue;
      t.classList.remove("below", "dotonly");
      const name = row.querySelector(":scope > .name");
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const widths = chips.map((c) => c.getBoundingClientRect().width);
      let need = -gap;
      if (name && getComputedStyle(name).display !== "none") {
        name.style.flex = "none";
        need = name.getBoundingClientRect().width;
        name.style.flex = "";
      }
      for (const w of widths) need += gap + w;
      const room = row.getBoundingClientRect().width + 0.01;
      if (need <= room) continue;
      t.classList.add("below");
      const banner = t.closest(".banner");
      const cut = !banner && widths.some((w) => w > room);
      let out = false;
      if (banner) {
        const b = banner.getBoundingClientRect();
        const floor = b.bottom - (banner.querySelector(".ground")?.getBoundingClientRect().height ?? 10) + 0.5;
        out = [...t.querySelectorAll(".name, .sub, .chip")].some((e) => {
          const r = e.getBoundingClientRect();
          return r.height && (r.bottom > floor || r.top < b.top - 0.5 || r.right > b.right + 0.5);
        });
      }
      if (cut || out) t.classList.replace("below", "dotonly");
    }
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._tick = null;
    this._resize?.disconnect();
    this._fitWidth = null;
    this._outside?.off();
    this._pressing = false;
    window.removeEventListener("pointerup", this._onPressEnd, true);
    window.removeEventListener("pointercancel", this._onPressEnd, true);
    // Left (another dashboard view, a conditional card hidden): back to the defaults, so that the card does not come
    // back unfolded or with its popup open.
    this._toggled = new Map();
    this._popup = null;
    window.removeEventListener("keydown", this._onKey);
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _locale() {
    return intlLocale(this._hass, this._config);
  }

  _s(id) {
    return id ? this._hass?.states[id] : undefined;
  }

  // The meter shown: the configured entity, else the first water or gas meter.
  _entity() {
    return this._config?.entity || listMeters(this._hass)[0]?.entity_id;
  }

  _statId() {
    return this._config?.statistic_id || this._entity();
  }

  _type(st) {
    return meterType(st, this._config.meter_type);
  }

  _utility() {
    const auto = utilityMeters(this._hass, this._entity());
    // A weekly utility_meter starts on Monday: found on its own only when the week does too.
    if (firstWeekday(this._hass) !== 1) delete auto.week;
    const out = {};
    for (const p of PERIODS) {
      const id = this._config[`${p === "day" ? "today" : p}_entity`] || auto[p];
      if (id) out[p] = id;
    }
    return out;
  }

  _deps() {
    const h = this._hass;
    if (!h || !this._config) return null;
    const c = this._config;
    const ids = [this._entity(), c.flow_entity, c.leak_entity, c.valve_entity, c.price_entity, c.conversion_factor_entity, ...Object.values(this._utility())];
    return [h.language, h.locale, h.themes?.darkMode, h.config?.currency, this._statsVersion, startOfDay(Date.now()), ...ids.map((id) => h.states[id])];
  }

  // Long-term statistics: hourly from two days back (today, yesterday, last night) and daily from the 1st of January of
  // last year (week, month and year so far, the previous ones, the chart), in the sensor's unit. Home Assistant compiles
  // them once an hour, so they are fetched at once for a new meter, again a minute into each hour and every 10 minutes
  // (imported statistics come at any time); the daily ones at most once an hour. A failed fetch is retried a minute later.
  _maybeFetch() {
    const h = this._hass;
    const id = this._config && this._statId();
    if (!h || !id || typeof h.callWS !== "function") return;
    const unit = normUnit(h.states[this._entity()]?.attributes?.unit_of_measurement);
    const key = `${id}|${unit}`;
    if (this._fetching === key) return;
    const now = Date.now();
    if (this._statKey !== key || !this._stats) return this._fetchStats(key, id, unit, now, true);
    const at = this._fetchedAt;
    const due =
      now - at >= REFETCH_MS ||
      (Math.floor(now / HOUR) !== Math.floor(at / HOUR) && now % HOUR >= MIN_REFETCH_MS) ||
      (this._stats.error && now - at >= MIN_REFETCH_MS);
    if (!due) return;
    const daily = this._stats.error || startOfDay(now) !== startOfDay(this._dailyAt) || now - this._dailyAt >= HOUR;
    this._fetchStats(key, id, unit, now, daily);
  }

  async _fetchStats(key, id, unit, now, withDaily) {
    this._fetching = key;
    if (this._statKey !== key) this._stats = null;
    this._statKey = key;
    this._fetchedAt = now;
    const cls = unit in VOLUME_L ? "volume" : unit in ENERGY_KWH ? "energy" : null;
    // Whole hours, so that cards showing the same meter send the same message and share its answer.
    const end = new Date((Math.floor(now / HOUR) + 2) * HOUR).toISOString();
    const get = async (period, start) => {
      const msg = { type: "recorder/statistics_during_period", start_time: new Date(start).toISOString(), end_time: end, statistic_ids: [id], period, types: ["change"] };
      try {
        // In the sensor's unit (an imported statistic may be kept in another unit of the same kind).
        return await sharedWS(this._hass, cls ? { ...msg, units: { [cls]: unit } } : msg);
      } catch (err) {
        if (!cls) throw err;
        return sharedWS(this._hass, msg);
      }
    };
    let stats;
    try {
      const [hourly, daily] = await Promise.all([get("hour", addDays(startOfDay(now), -2)), withDaily ? get("day", startOfYear(now, -1)) : null]);
      stats = { hourly: statRows(hourly?.[id]), daily: withDaily ? statRows(daily?.[id], true) : this._stats?.daily || [] };
      if (withDaily) this._dailyAt = now;
    } catch (err) {
      stats = { hourly: [], daily: [], error: String(err?.message || err) };
    }
    if (this._fetching === key) this._fetching = null;
    if (this._statKey !== key) return;
    this._stats = stats;
    this._statsVersion++;
    this._lastDeps = null;
    this._update();
  }

  _hasStats() {
    return !!this._stats && (this._stats.hourly.length > 0 || this._stats.daily.length > 0);
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    let html = this._render();
    if (this._popup) {
      const pop = this._popupHtml();
      if (pop) html = html.replace(/<ha-card>([\s\S]*)<\/ha-card>\s*$/, (_, inner) => `<ha-card class="dialog-open">${inner}${pop}</ha-card>`);
    }
    if (html === this._html) return;
    const active = this.shadowRoot.activeElement;
    const kept = !this._byPointer && active?.dataset && Object.keys(active.dataset).length ? JSON.stringify({ ...active.dataset }) : null;
    this._html = html;
    umMorph(this.shadowRoot, html);
    this._fitPill();
    if (this._popup) this.shadowRoot.querySelector('[data-action="popup_close"]')?.focus?.({ preventScroll: true });
    else if (kept) {
      for (const el of this.shadowRoot.querySelectorAll("[data-action], [data-entity]")) {
        if (JSON.stringify({ ...el.dataset }) === kept) {
          el.focus?.({ preventScroll: true });
          break;
        }
      }
    }
  }

  _onClick(ev) {
    this._pressing = false;
    if (ev.detail === 0) this._byPointer = false;
    const path = ev.composedPath();
    const el = path.find((n) => n.dataset && (n.dataset.entity || n.dataset.action));
    if (this._popup) {
      ev.stopPropagation();
      const action = el?.dataset.action;
      if (action === "popup_close" || (action === "popup_backdrop" && path[0] === el)) this._closePopup();
      return;
    }
    if (!el) return;
    ev.stopPropagation();
    const { action, entity } = el.dataset;
    if (action === "zoom") return this._toggleZoom(ev);
    if (action === "valve") return this._toggleValve();
    if (action === "toggle_section") {
      const key = el.dataset.section;
      this._toggled = new Map(this._toggled).set(key, !this._isCollapsed(key));
      return this._update();
    }
    if (action === "tab") {
      this._chart = el.dataset.period;
      return this._update();
    }
    if (action === "slot") {
      this._popup = { period: this._chartPeriod(), index: Number(el.dataset.index) };
      window.addEventListener("keydown", this._onKey);
      return this._update();
    }
    if (entity) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }));
  }

  _closePopup() {
    this._popup = null;
    window.removeEventListener("keydown", this._onKey);
    this._update();
  }

  _toggleZoom() {}

  // Everything a render needs, computed once.
  _model() {
    const c = this._config;
    const id = this._entity();
    const st = this._s(id);
    if (!id) return { error: "no_meter" };
    if (!st) return { error: "unknown_entity", id };
    const type = this._type(st);
    const unit = normUnit(st.attributes.unit_of_measurement);
    const now = Date.now();
    const fw = firstWeekday(this._hass);
    const stats = this._hasStats() ? this._stats : null;
    const utility = this._utility();
    const periods = {};
    for (const p of PERIODS) {
      const v = stats ? periodValues(stats, p, now, fw) : { cur: null, prev: null };
      const um = this._s(utility[p]);
      if (valid(um)) {
        const uu = um.attributes.unit_of_measurement || unit;
        // A live helper counts up to now: the previous period is taken up to now too.
        if (stats) v.prev = periodValues(stats, p, now, fw, true).prev;
        v.cur = convert(num(um), uu, unit);
        const last = parseFloat(um.attributes.last_period);
        if (v.prev === null && Number.isFinite(last)) v.prev = convert(last, uu, unit);
      }
      periods[p] = { ...v, entity: utility[p] || id };
    }
    const leakOn = c.leak_detection ?? type === "water";
    const threshold = leakThreshold(c, type, unit);
    const night = leakOn && stats ? nightCheck(stats, now, c.leak_start, c.leak_end, threshold) : null;
    const sensor = leakOn && c.leak_entity ? this._s(c.leak_entity) : null;
    const sensorWet = sensor?.state === "on";
    const limit = Number(c.daily_limit);
    const high = Number.isFinite(limit) && limit > 0 && periods.day.cur !== null && periods.day.cur > limit;
    const leak = !!(night?.leak || sensorWet);
    const status = !valid(st)
      ? { cls: "idle", key: "status_unavailable" }
      : leak
        ? { cls: "crit", key: "status_leak" }
        : high
          ? { cls: "warn", key: "status_high" }
          : { cls: "ok", key: "status_ok" };
    const flowSt = this._s(c.flow_entity);
    const flow = flowSt ? { st: flowSt, v: num(flowSt), unit: flowSt.attributes.unit_of_measurement || "" } : null;
    // Flowing right now: the flow sensor when there is one, else the statistics of the current hour (or of the last one).
    let active = false;
    if (flow) active = flow.v !== null && flow.v > 0;
    else if (stats?.hourly.length) {
      const row = stats.hourly.findLast((r) => r.s <= now);
      active = !!row && row.v > 0 && now - row.e < HOUR;
    }
    const valve = this._valve();
    return { id, st, type, unit, now, fw, stats, periods, leakOn, threshold, night, sensor, sensorWet, high, limit, leak, status, flow, active, valve };
  }

  // The shut-off valve (`valve_entity`): a `valve` entity (open / opening / closed / closing), or a `switch` /
  // `input_boolean` driving a motorised valve (on = open).
  _valve() {
    const id = this._config.valve_entity;
    const st = this._s(id);
    if (!st) return null;
    const domain = id.split(".")[0];
    const state = st.state;
    const moving = domain === "valve" && (state === "opening" || state === "closing");
    const unavailable = state === "unavailable" || state === "unknown";
    const open = domain === "valve" ? state === "open" || state === "opening" : state === "on";
    return { id, st, domain, state, open, moving, unavailable };
  }

  // Open / close button of the valve. Outlined like the other buttons; the accent while open, red while open during a
  // leak (closing it is what is wanted then). Not pressable while it moves or is unavailable.
  _valveHtml(m) {
    const v = m.valve;
    if (!v) return "";
    const label = v.unavailable ? this._t("status_unavailable") : this._t(v.moving ? `valve_${v.state}` : v.open ? "valve_open" : "valve_closed");
    const action = this._t(v.open ? "valve_do_close" : "valve_do_open");
    const cls = v.unavailable || v.moving || !v.open ? "" : m.leak ? " crit" : " primary";
    const off = v.unavailable || v.moving;
    return `<button class="btn valve${cls}" data-action="valve" aria-pressed="${v.open}" title="${esc(action)}" aria-label="${esc(off ? label : `${label}. ${action}`)}"${
      off ? " disabled" : ""
    }>${svgIcon(v.open ? ICONS.valve_open : ICONS.valve_closed)}<span>${esc(label)}</span></button>`;
  }

  _toggleValve() {
    const v = this._m?.valve;
    if (!v || v.unavailable || v.moving || typeof this._hass?.callService !== "function") return;
    const service = v.domain === "valve" ? (v.open ? "close_valve" : "open_valve") : v.open ? "turn_off" : "turn_on";
    this._hass.callService(v.domain, service, { entity_id: v.id });
  }

  _amount(m, v) {
    return fmtAmount(v, m.unit, this._locale(), { water: m.type === "water", liters: this._config.liters !== false });
  }

  _price() {
    const c = this._config;
    const ps = this._s(c.price_entity);
    const p = ps ? num(ps) : Number(c.price);
    return Number.isFinite(p) && p >= 0 && (ps || (c.price !== undefined && c.price !== "")) ? p : null;
  }

  _currency() {
    return String(this._config.currency || this._hass.config?.currency || "EUR").toUpperCase();
  }

  // The m³→kWh conversion factor for gas cost: a live sensor (`conversion_factor_entity`, the daily factor GRDF
  // publishes), else the fixed `conversion_factor`, else 11.2. A sensor reading unknown falls back to the fixed value.
  _conversionFactor() {
    const c = this._config;
    const se = this._s(c.conversion_factor_entity);
    const sv = se ? num(se) : null;
    if (sv !== null && sv > 0) return sv;
    const fixed = Number(c.conversion_factor);
    return Number.isFinite(fixed) && fixed > 0 ? fixed : 11.2;
  }

  // Cost of a consumption in the sensor's unit: price per m³ (per the sensor's unit when it is not metric) or per kWh
  // (`price_unit: energy`, with the conversion factor kWh per m³ for a meter counting volumes, as Gazpar's).
  // Electricity meters count kWh and are priced per kWh, so their default price unit is energy.
  _cost(m, v) {
    const p = this._price();
    if (p === null || v === null || v === undefined || this._config.show_cost === false) return null;
    const priceUnit = this._config.price_unit || (m.type === "electricity" ? "energy" : "volume");
    const factor = this._conversionFactor();
    let q = v;
    if (priceUnit === "energy") {
      if (isEnergy(m.unit)) q = convert(v, m.unit, "kWh");
      // The factor is per m³: any volume (ft³, CCF, gal) is moved to m³ first.
      else q = (normUnit(m.unit) in VOLUME_L ? convert(v, m.unit, "m³") : v) * factor;
    } else if (isEnergy(m.unit)) q = convert(v, m.unit, "kWh") / factor;
    else if (isMetricVolume(m.unit)) q = convert(v, m.unit, "m³");
    return q * p;
  }

  _money(v) {
    return fmtMoney(v, this._currency(), this._locale());
  }

  _delta(cur, prev, label) {
    if (this._config.show_comparison === false || cur === null || prev === null || !(prev > 0)) return "";
    const r = (cur - prev) / prev;
    const dir = Math.round(r * 100) > 0 ? "up" : Math.round(r * 100) < 0 ? "down" : "";
    return `<div class="delta ${dir}">${dir ? svgIcon(ICONS[dir]) : ""}<span>${esc(`${fmtPct(r, this._locale())} ${label}`)}</span></div>`;
  }

  _isCollapsed(key) {
    if (this._toggled?.has(key)) return this._toggled.get(key);
    return this._defaultCollapsed(key);
  }

  _defaultCollapsed(key) {
    // A suspected leak always shows the night section unfolded (it can still be folded by hand).
    if (key === "night" && this._leakNow) return false;
    const c = this._config.collapsed ?? DEFAULT_COLLAPSED;
    return (Array.isArray(c) ? c : [c]).includes(key);
  }

  _sectionTitle(key, icon, label) {
    const closed = this._isCollapsed(key);
    return `<div class="section-title" role="button" tabindex="0" data-action="toggle_section" data-section="${key}" aria-expanded="${!closed}">${svgIcon(icon)}<span>${esc(
      label,
    )}</span>${svgIcon(ICONS.chevron_down, "chevron")}</div>`;
  }

  _accent(type) {
    return `:host { --um-accent: ${TYPES[type].accent[this._hass?.themes?.darkMode ? 1 : 0]}; --um-accent-hi: ${TYPES[type].accent[1]}; }`;
  }

  _illustrated() {
    return this._config.illustration !== false;
  }

  // State of the header icon, whose colour always shows the status: the meter's colour while it is flowing (or drawing
  // power), grey when still or unavailable, amber above the daily limit, red on a leak.
  _iconState(m) {
    const cls = m.status.cls;
    if (cls === "crit" || cls === "warn" || cls === "idle") return cls;
    return m.active ? "on" : "idle";
  }

  _header(m, sub) {
    const c = this._config;
    const text = this._t(m.status.key);
    const chipEntity = m.sensorWet ? c.leak_entity : m.id;
    const chip = `<span class="chip clickable ${m.status.cls}" role="button" tabindex="0" data-entity="${esc(chipEntity)}" title="${esc(text)}" aria-label="${esc(text)}"><span class="dot"></span><span class="chip-text">${esc(text)}</span></span>`;
    const icon = `<div class="type-icon ${this._iconState(m)}">${svgIcon(ICONS[m.type])}</div>`;
    const name = `<div class="name">${esc(c.title || m.st.attributes.friendly_name || m.id)}</div>`;
    if (!this._illustrated()) {
      return `
      <div class="header">
        ${icon}
        <div class="titles"><div class="tstack"><div class="trow">${name}${chip}</div>${sub ? `<div class="sub" title="${esc(sub)}">${esc(sub)}</div>` : ""}</div></div>
        ${this._zoomButton()}
      </div>`;
    }
    // The illustrated header: the scene and the meter on the right, the icon and the titles on the left, the status
    // pill on the title row in the round icon's colour.
    const zoom = this._zoomButton();
    const pill = chip.replace(`chip clickable ${m.status.cls}"`, `chip clickable ${this._iconState(m)}"`);
    const cls = `banner t-${m.type}${zoom ? " has-zoom" : ""}${umIsNight(this._hass, c, this) ? " night" : ""}${m.active ? " active" : ""}${m.leak ? " leak" : ""}`;
    return `
      <div class="${cls}">
        <div class="um-scene">${umScene(m.type, umIsNight(this._hass, c, this), !!zoom)}${this._picture(m, true)}</div>
        <div class="ground g-${UM_GROUND[m.type]}"></div>
        <div class="htext">${icon}<div class="titles"><div class="tstack"><div class="trow">${name}${pill}</div>${sub ? `<div class="sub" title="${esc(sub)}">${esc(sub)}</div>` : ""}</div></div></div>
        ${zoom}
      </div>`;
  }

  _zoomButton() {
    return "";
  }

  _errorCard(m) {
    const text = m.error === "unknown_entity" ? `${this._t(m.error)}: ${m.id}` : this._t(m.error);
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(text)}</div></ha-card>`;
  }

  _alerts(m) {
    const out = [];
    const loc = this._locale();
    const time = (ms) => new Date(ms).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
    if (m.night?.leak) {
      const text = this._t("leak_alert", { value: this._amount(m, m.night.lowest), start: time(m.night.start), end: time(m.night.end) });
      out.push(`<div class="alert crit clickable" role="button" tabindex="0" data-entity="${esc(m.id)}">${svgIcon(ICONS.alert)}<span>${esc(text)}</span></div>`);
    }
    if (m.sensorWet) {
      const name = m.sensor.attributes.friendly_name || this._config.leak_entity;
      out.push(`<div class="alert crit clickable" role="button" tabindex="0" data-entity="${esc(this._config.leak_entity)}">${svgIcon(ICONS.alert)}<span>${esc(this._t("leak_sensor", { name }))}</span></div>`);
    }
    if (m.high) {
      out.push(`<div class="alert warn clickable" role="button" tabindex="0" data-entity="${esc(m.periods.day.entity)}">${svgIcon(ICONS.alert)}<span>${esc(this._t("high_alert", { value: this._amount(m, m.limit) }))}</span></div>`);
    }
    return out.join("");
  }

  _flowText(m) {
    const f = m.flow;
    const v = f.v === null ? "—" : `${fmtNum(f.v, this._locale(), Math.abs(f.v) < 10 ? 2 : 1)} ${f.unit}`.trim();
    return `${this._t(m.type === "electricity" ? "power" : "flow")} ${v}`;
  }

  // Electricity picture: `digital`, `disc` or `submeter`; `auto` (the default) picks `submeter` when a power/flow sensor
  // is set (that is a sub-meter: a clamp or a Shelly EM), else `digital`.
  _pictureStyle(m) {
    const s = this._config.picture_style;
    if (s === "digital" || s === "disc" || s === "submeter") return s;
    return m.flow ? "submeter" : "digital";
  }

  _art(m) {
    const uid = this._uid;
    if (m.type === "water") return waterArt(num(m.st), uid);
    if (m.type === "gas") return gasArt(num(m.st), uid);
    const power = m.flow?.v != null ? fmtNum(Math.round(Math.abs(m.flow.v)), this._locale(), 0) : "———";
    return electricArt(num(m.st), this._pictureStyle(m), power, uid);
  }

  // The meter picture: in the body (classic header), or big at the right of the illustrated header (`banner`),
  // cropped to the drawing so that it stands on the ground strip.
  _picture(m, banner = false) {
    if (this._config.show_picture === false) return "";
    const high = m.type === "electricity" && m.high ? " high" : "";
    const cls = `${m.active ? " active" : ""}${m.leak ? " leak" : ""}${high}`;
    const label = `${this._t(`meter_${m.type}`)} · ${this._t(m.status.key)}`;
    let art = this._art(m);
    let style = "";
    if (banner) {
      const view = UM_ART_VIEW[m.type === "electricity" ? this._pictureStyle(m) : m.type];
      const [, , w, h] = view.split(" ").map(Number);
      art = art.replace('viewBox="0 0 80 88"', `viewBox="${view}"`);
      // Explicit width (90 % of the 5 : 2 scene's height, at the drawing's ratio): WebKit would size the absolute box
      // from its SVG's default 300 px width otherwise.
      style = ` style="aspect-ratio: ${w} / ${h}; width: ${+((36 * w) / h).toFixed(2)}%"`;
    }
    return `<div class="picture clickable${cls}" role="button" tabindex="0" aria-label="${esc(label)}" data-entity="${esc(m.id)}"${style}>${art}</div>`;
  }

  _hero(m) {
    const c = this._config;
    const info = [];
    if (c.show_index !== false) {
      const v = num(m.st);
      const value = v === null ? "—" : fmtNum(v, this._locale(), indexDigits(m.unit, c), indexDigits(m.unit, c));
      info.push(
        `<div class="index clickable" role="button" tabindex="0" data-entity="${esc(m.id)}"><div class="k">${esc(this._t("index"))}</div><div class="v">${esc(value)}${m.unit ? `<small>${esc(m.unit)}</small>` : ""}</div></div>`,
      );
    }
    const valve = this._valveHtml(m);
    if (m.flow || valve) {
      const on = m.flow && m.flow.v !== null && m.flow.v > 0;
      const flow = m.flow
        ? `<span class="flow clickable${on ? " flowing" : ""}" role="button" tabindex="0" data-entity="${esc(c.flow_entity)}">${svgIcon(m.type === "water" ? ICONS.flow : ICONS[m.type])}<span>${esc(this._flowText(m))}</span></span>`
        : "";
      info.push(`<div${valve ? ` class="acts"` : ""}>${flow}${valve}</div>`);
    }
    if (m.night) {
      info.push(
        `<div class="line${m.night.leak ? " crit" : ""}">${svgIcon(ICONS.night)}<span>${esc(`${this._t("night_lowest")}: ${this._t("per_hour", { value: this._amount(m, m.night.lowest) })}`)}</span></div>`,
      );
    }
    const pic = this._illustrated() ? "" : this._picture(m);
    if (!pic && !info.length) return "";
    return `<div class="hero">${pic}<div class="info">${info.join("")}</div></div>`;
  }

  _tiles(m) {
    const labels = { day: "today", week: "week", month: "month", year: "year" };
    return PERIODS.map((p) => {
      const v = m.periods[p];
      const cost = this._cost(m, v.cur);
      const cls = p === "day" && m.high ? " warn" : "";
      return `<div class="tile clickable${cls}" role="button" tabindex="0" data-entity="${esc(v.entity)}"><div class="k">${esc(this._t(labels[p]))}</div><div class="v">${esc(
        this._amount(m, v.cur),
      )}</div>${cost !== null ? `<div class="cost">${esc(this._money(cost))}</div>` : ""}${this._delta(v.cur, v.prev, this._t(`vs_${p}`))}</div>`;
    }).join("");
  }

  _chartPeriod() {
    const p = this._chart || this._config.chart_period;
    const list = this._chartPeriods();
    return list.includes(p) ? p : list.includes("week") ? "week" : list[0];
  }

  // The Day tab needs hourly statistics (an external statistic may only be daily).
  _chartPeriods() {
    return this._stats?.hourly?.length ? PERIODS : PERIODS.filter((p) => p !== "day");
  }

  _slotLabel(kind, from, long = false) {
    const loc = this._locale();
    const d = new Date(from);
    if (kind === "day") {
      if (long) return `${d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })} – ${new Date(from + HOUR).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
      return d.getHours() % 6 === 0 ? String(d.getHours()) : "";
    }
    if (kind === "week") return d.toLocaleDateString(loc, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "narrow" });
    if (kind === "month") {
      if (long) return d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
      const n = d.getDate();
      return n === 1 || n % 5 === 0 ? String(n) : "";
    }
    return d.toLocaleDateString(loc, long ? { month: "long", year: "numeric" } : { month: "narrow" });
  }

  _chartHtml(m) {
    if (!this._stats) return `<div class="empty">${esc(this._t("loading"))}</div>`;
    if (!m.stats) return `<div class="empty">${esc(this._t("no_stats"))}</div>`;
    const kind = this._chartPeriod();
    const slots = chartSlots(m.stats, kind, m.now, m.fw);
    const max = Math.max(...slots.flatMap((s) => [s.value ?? 0, s.prev ?? 0]), 0) || 1;
    const done = slots.filter((s) => s.value !== null && s.to <= m.now);
    const avg = done.length ? done.reduce((a, s) => a + s.value, 0) / done.length : null;
    const night = kind === "day" && m.night?.leak ? m.night : null;
    const tabs = this._chartPeriods()
      .map((p) => `<button class="btn tab" data-action="tab" data-period="${p}" aria-pressed="${p === kind}">${esc(this._t(`tab_${p}`))}</button>`)
      .join("");
    const pct = (v) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%`;
    const bars = slots
      .map((s, i) => {
        const now = s.from <= m.now && m.now < s.to;
        // Last night's hours that kept flowing (the window may have been today's early hours).
        const leaky = night && s.from >= night.start && s.from < night.end;
        const label = `${this._slotLabel(kind, s.from, true)}: ${s.value === null ? "—" : this._amount(m, s.value)}`;
        return `<div class="slot${now ? " now" : ""}${leaky ? " crit" : ""}" role="button" tabindex="0" data-action="slot" data-index="${i}" title="${esc(label)}" aria-label="${esc(label)}">${
          s.prev ? `<div class="prev" style="height:${pct(s.prev)}"></div>` : ""
        }${s.value !== null ? `<div class="cur" style="height:${pct(s.value)}"></div>` : ""}</div>`;
      })
      .join("");
    const axis = slots.map((s) => `<span>${esc(this._slotLabel(kind, s.from))}</span>`).join("");
    const prevKey = { day: "yesterday", week: "last_week", month: "last_month", year: "last_year" }[kind];
    const curKey = { day: "today", week: "week", month: "month", year: "year" }[kind];
    return `<div class="tabs" role="group">${tabs}</div>
      <div class="chart">${bars}${avg !== null ? `<div class="avg" style="bottom:${pct(avg)}"></div>` : ""}</div>
      <div class="axis" aria-hidden="true">${axis}</div>
      <div class="legend"><span><i class="l-cur"></i>${esc(this._t(curKey))}</span><span><i class="l-prev"></i>${esc(this._t(prevKey))}</span>${
        avg !== null ? `<span><i class="l-avg"></i>${esc(this._t("average", { value: this._amount(m, avg) }))}</span>` : ""
      }</div>`;
  }

  _nightHtml(m) {
    const loc = this._locale();
    const time = (min) => new Date(atMinutes(startOfDay(m.now), min)).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
    const c = this._config;
    const window_ = `${time(parseTime(c.leak_start, DEFAULT_LEAK.start))} – ${time(parseTime(c.leak_end, DEFAULT_LEAK.end))}`;
    const tile = (k, v, cls = "", entity = m.id) =>
      `<div class="tile clickable${cls}" role="button" tabindex="0" data-entity="${esc(entity)}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
    const tiles = [
      tile(this._t("night_window"), window_),
      tile(this._t("night_threshold"), this._t("per_hour", { value: this._amount(m, m.threshold) })),
      tile(this._t("night_lowest"), m.night ? this._t("per_hour", { value: this._amount(m, m.night.lowest) }) : "—", m.night?.leak ? " crit" : ""),
    ];
    if (m.sensor) tiles.push(tile(m.sensor.attributes.friendly_name || c.leak_entity, this._t(m.sensorWet ? "sensor_wet" : "sensor_ok"), m.sensorWet ? " crit" : "", c.leak_entity));
    return `<div class="tiles">${tiles.join("")}</div>`;
  }

  _section(key, icon, label, body) {
    const closed = this._isCollapsed(key);
    return `<div class="section">${this._sectionTitle(key, icon, label)}${closed ? "" : body}</div>`;
  }

  _style(m, extra) {
    this.setAttribute?.("meter", m.type);
    return `<style>${BASE_STYLE}${ART_STYLE}${extra}${this._illustrated() ? BANNER_STYLE : ""}${this._accent(m.type)}</style>`;
  }

  _render() {
    const m = this._model();
    if (m.error) return this._errorCard(m);
    this._m = m;
    this._leakNow = m.leak;
    const c = this._config;
    const parts = [this._alerts(m), this._hero(m)];
    if (c.show_consumption !== false) parts.push(this._section("consumption", ICONS.calendar, this._t("consumption"), `<div class="tiles">${this._tiles(m)}</div>`));
    if (c.show_chart !== false) parts.push(this._section("history", ICONS.stats, this._t("history"), this._chartHtml(m)));
    if (m.leakOn) parts.push(this._section("night", ICONS.night, this._t("night"), this._nightHtml(m)));
    return `${this._style(m, FULL_STYLE + DIALOG_STYLE)}
      <ha-card>
        ${this._header(m, this._t(`meter_${m.type}`))}
        <div class="content">${parts.filter(Boolean).join("")}</div>
      </ha-card>`;
  }

  // Details of a bar of the chart, in a popup at the top of the card.
  _popupHtml() {
    const m = this._m;
    if (!m?.stats) return "";
    const { period, index } = this._popup;
    const s = chartSlots(m.stats, period, m.now, m.fw)[index];
    if (!s) return "";
    const prevKey = { day: "yesterday", week: "last_week", month: "last_month", year: "last_year" }[period];
    const row = (k, v) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
    const cost = this._cost(m, s.value);
    const rows = [row(this._t("consumption"), this._amount(m, s.value))];
    if (cost !== null) rows.push(row(this._t("cost"), this._money(cost)));
    if (s.prev !== null) rows.push(row(this._t(prevKey), this._amount(m, s.prev)));
    return `<div class="backdrop" data-action="popup_backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(this._slotLabel(period, s.from, true))}">
        <div class="msg">${esc(this._slotLabel(period, s.from, true))}</div>
        ${rows.join("")}
        <div class="modal-actions"><button class="btn" data-action="popup_close">${esc(this._t("close"))}</button></div>
      </div>
    </div>`;
  }
}

// The mini card is a full card drawn compact: its detail button (top right, `zoom: false` removes it) switches it to
// the full card's content and back, and a click anywhere else on the page brings the compact view back.
export class UtilityMeterMiniCard extends UtilityMeterCard {
  constructor() {
    super();
    this._onUnzoom = (ev) => {
      if (this._zoomed && isOutside(this, ev)) this._setZoom(false);
    };
  }

  static getConfigElement() {
    return document.createElement("utility-meter-mini-card-editor");
  }

  connectedCallback() {
    super.connectedCallback();
    (this._unzoom ??= watchOutside(this, (ev) => this._onUnzoom(ev))).on();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unzoom?.off();
    // Back to the compact view once off the screen (see the full card).
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 3;
  }

  getGridOptions() {
    return { ...(this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 }), rows: "auto" };
  }

  _zoomButton() {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom" data-action="zoom" title="${label}" aria-label="${label}">${svgIcon(z ? ICONS.collapse : ICONS.expand)}</button>`;
  }

  _setZoom(on) {
    this._zoomed = on;
    this._update();
    this.dispatchEvent(new CustomEvent("iron-resize", { bubbles: true, composed: true }));
  }

  _toggleZoom(ev) {
    this._setZoom(!this._zoomed);
    if (ev?.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus?.({ preventScroll: true });
  }

  _render() {
    if (this._zoomed) return super._render();
    const m = this._model();
    if (m.error) return this._errorCard(m);
    this._m = m;
    this._leakNow = m.leak;
    const c = this._config;
    const v = num(m.st);
    const index = c.show_index === false || v === null ? "" : `${fmtNum(v, this._locale(), indexDigits(m.unit, c), indexDigits(m.unit, c))} ${m.unit}`.trim();
    const stat = (p, key) => {
      const x = m.periods[p];
      const cost = this._cost(m, x.cur);
      return `<div class="ms clickable" role="button" tabindex="0" data-entity="${esc(x.entity)}"><div class="k">${esc(this._t(key))}</div><div class="v">${esc(this._amount(m, x.cur))}</div>${
        cost !== null ? `<div class="cost">${esc(this._money(cost))}</div>` : this._delta(x.cur, x.prev, this._t(`vs_${p}`))
      }</div>`;
    };
    let spark = "";
    if (m.stats && c.show_chart !== false) {
      const slots = chartSlots(m.stats, "week", m.now, m.fw);
      const max = Math.max(...slots.map((s) => s.value ?? 0)) || 1;
      const act = c.zoom === false ? `role="img"` : `role="button" tabindex="0" data-action="zoom"`;
      spark = `<div class="spark${c.zoom === false ? "" : " clickable"}" ${act} aria-label="${esc(this._t("history"))}">${slots
        .map((s) => `<span class="${s.from <= m.now && m.now < s.to ? "now" : ""}" style="height:${s.value === null ? 0 : Math.max(3, (s.value / max) * 100).toFixed(1)}%"></span>`)
        .join("")}</div>`;
    }
    const flow = m.flow
      ? `<div class="flowline clickable${m.flow.v > 0 ? " flowing" : ""}" role="button" tabindex="0" data-entity="${esc(c.flow_entity)}">${svgIcon(m.type === "water" ? ICONS.flow : ICONS[m.type])}<span>${esc(this._flowText(m))}</span></div>`
      : "";
    const valve = this._valveHtml(m);
    return `${this._style(m, MINI_STYLE)}
      <ha-card>
        ${this._header(m, index)}
        <div class="content">
          ${this._alerts(m)}
          <div class="mini">${this._illustrated() ? "" : this._picture(m)}${stat("day", "today")}${stat("month", "month")}${spark}</div>
          ${valve ? `<div class="acts">${flow}${valve}</div>` : flow}
        </div>
      </ha-card>`;
  }
}
