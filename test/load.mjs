// Evaluates src/utility-meter-card.js (a classic script, bundled as is by scripts/build.mjs) in a sandbox with
// minimal DOM stand-ins and a fixed clock, and returns the names the tests need. No dependency, no browser.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { NOW } from "../scripts/mock-states.mjs";

const source = readFileSync(new URL("../src/utility-meter-card.js", import.meta.url), "utf8");

// Shadow root stand-in: keeps the HTML it is given and the listeners it gets.
const fakeRoot = () => ({
  innerHTML: "",
  listeners: {},
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
});

// Date with a fixed "now" (NOW, or the time given to load()).
const fixedDate = (now) => {
  const t = Date.parse(now);
  class FixedDate extends Date {
    constructor(...a) {
      super(...(a.length ? a : [t]));
    }
    static now() {
      return t;
    }
  }
  return FixedDate;
};

export const load = (now = NOW) => {
  const registry = new Map();
  class HTMLElement {
    attachShadow() {
      this.shadowRoot = fakeRoot();
      return this.shadowRoot;
    }
    dispatchEvent(ev) {
      (this.events ||= []).push(ev);
    }
    setAttribute(k, v) {
      (this.attrs ||= {})[k] = String(v);
    }
    toggleAttribute(k, on) {
      (this.attrs ||= {})[k] = on ? "" : undefined;
    }
    appendChild(c) {
      (this.children ||= []).push(c);
    }
  }
  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const sandbox = {
    HTMLElement,
    CustomEvent,
    Intl,
    Date: fixedDate(now),
    console: { info() {}, warn() {} },
    customElements: { get: (t) => registry.get(t), define: (t, c) => registry.set(t, c) },
    document: {
      // Unknown elements (ha-form): keep their listeners, for the tests to fire.
      createElement: (t) =>
        registry.has(t)
          ? new (registry.get(t))()
          : {
              tagName: t.toUpperCase(),
              listeners: {},
              addEventListener(type, fn) {
                this.listeners[type] = fn;
              },
              appendChild() {},
            },
      addEventListener() {},
      removeEventListener() {},
    },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return vm.runInContext(
    `${source}
    ({ STRINGS, LANGUAGES, esc, convert, normUnit, fmtAmount, fmtPct, fmtMoney, parseTime, statRows, periodValues, chartSlots, nightWindow, nightCheck,
       leakThreshold, listMeters, utilityMeters, startOfWeek, startOfDay, Card: customElements.get("utility-meter-card"),
       MiniCard: customElements.get("utility-meter-mini-card"), Editor: customElements.get("utility-meter-card-editor"),
       MiniEditor: customElements.get("utility-meter-mini-card-editor"), window })`,
    sandbox,
  );
};

// A mock hass whose callWS answers like the recorder, with the calls it got.
export const makeHass = (states, statistics, extra = {}) => {
  const calls = [];
  return {
    calls,
    states,
    entities: {},
    devices: {},
    language: "en",
    locale: { language: "en", first_weekday: "monday" },
    config: { currency: "EUR" },
    themes: { darkMode: false },
    callService: (...a) => calls.push(["service", ...a]),
    callWS: async (msg) => {
      calls.push(["ws", msg]);
      return statistics(msg);
    },
    ...extra,
  };
};

export const flush = () => new Promise((r) => setTimeout(r, 0));
