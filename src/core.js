/*
 * Utility Meter Card for Home Assistant
 * https://github.com/juju35/ha-utility-meter-card
 *
 * Lovelace cards for water and gas meters, whatever the integration: a cumulative `sensor` with the `water` or `gas`
 * device class (pulse counters, Gazpar / GRDF, Suez, Veolia, Eau de Paris…, utility_meter helpers) and its long-term
 * statistics, read through the `recorder/statistics_during_period` WebSocket command.
 * Index, consumption of the day / week / month / year compared with the same point of the previous period, history
 * chart, optional cost and night leak detection (continuous flow through the night).
 */

export const VERSION = "__VERSION__";

export const HOUR = 3600000;
export const REFETCH_MS = 10 * 60000;
export const MIN_REFETCH_MS = 60000;
export const PERIODS = ["day", "week", "month", "year"];
export const DEFAULT_COLLAPSED = ["night"];
export const SECTIONS = ["consumption", "history", "night"];
export const DEFAULT_LEAK = { start: "01:00", end: "05:00", water: 2, gas: 0.05, electricity: 0.3 };

// Accent of each kind of meter, [light theme, dark theme].
export const TYPES = {
  water: { accent: ["#0288d1", "#29b6f6"] },
  gas: { accent: ["#ef6c00", "#ffa726"] },
  electricity: { accent: ["#2e7d32", "#66bb6a"] },
};

export const ICONS = {
  water: "M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",
  gas: "M12 2c.6 3.1-1.4 4.6-2.9 6.5C7.6 10.4 6.5 12.2 6.5 14.6 6.5 18.3 9 21 12 21s5.5-2.7 5.5-6.2c0-2.4-1-4.1-2.1-5.6-.2 1.4-.9 2.5-2 3 .4-2.8-.3-6.6-1.4-10.2zM12 19c-1.5 0-2.6-1.2-2.6-2.7 0-1.4 1-2.3 1.9-3.4.2 1 .7 1.6 1.4 1.9.1-.8.4-1.5.9-2.1.7.9 1.1 1.8 1.1 3 0 1.9-1.2 3.3-2.7 3.3z",
  electricity: "M11 15H6l7-14v8h5l-7 14v-8z",
  counter: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7H4zm2 2h2v6H6V9zm4 0h2v6h-2V9zm4 0h4v6h-4V9z",
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z",
  stats: "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z",
  night: "M12.3 3a9 9 0 1 0 8.7 11.3A7.5 7.5 0 0 1 12.3 3z",
  alert: "M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z",
  flow: "M3 8c2 0 2-1.5 4.5-1.5S9.5 8 12 8s2-1.5 4.5-1.5S18.5 8 21 8v2c-2 0-2-1.5-4.5-1.5S14.5 10 12 10s-2-1.5-4.5-1.5S5 10 3 10V8zm0 6c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2-1.5 4.5-1.5S18.5 14 21 14v2c-2 0-2-1.5-4.5-1.5S14.5 16 12 16s-2-1.5-4.5-1.5S5 16 3 16v-2z",
  coin: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm1 3h-2v1.1c-1.7.4-2.8 1.6-2.8 3 0 1.8 1.5 2.5 3.4 3 1.3.3 1.8.7 1.8 1.2 0 .6-.6 1-1.6 1-1.1 0-1.7-.5-1.8-1.3H8c.1 1.6 1.3 2.6 3 2.9V18h2v-1.1c1.7-.3 2.8-1.4 2.8-2.9 0-1.9-1.6-2.6-3.4-3.1-1.3-.3-1.8-.6-1.8-1.1s.5-.9 1.4-.9c1 0 1.4.5 1.5 1.1h1.8c-.1-1.4-1-2.5-2.3-2.8V7z",
  sensor: "M12 2c-.3 0-.6.1-.8.4C9.6 4.6 6 9.6 6 13.5 6 17.1 8.7 20 12 20s6-2.9 6-6.5c0-3.9-3.6-8.9-5.2-11.1-.2-.3-.5-.4-.8-.4zM5 21h14v2H5z",
  // Shut-off valve between two flanges: the passage across the pipe when open, the gate across it when closed.
  valve_open: "M2 2h2v20H2zM20 2h2v20h-2zM4 11h4.27a4 4 0 0 1 7.46 0H20v2h-4.27a4 4 0 0 1-7.46 0H4z",
  valve_closed: "M2 2h2v20H2zM20 2h2v20h-2zM11 4h2v4.27a4 4 0 0 1 0 7.46V20h-2v-4.27a4 4 0 0 1 0-7.46z",
  up: "M7 15l5-5 5 5z",
  down: "M7 10l5 5 5-5z",
  chevron_down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  // mdi:arrow-expand and mdi:arrow-collapse (mini card detail button)
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
};


export const LANGUAGES = [
  ["en", "English"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["sr", "Српски"],
  ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"],
  ["nl", "Nederlands"],
  ["pt", "Português (Portugal)"],
  ["pl", "Polski"],
  ["ro", "Română"],
  ["da", "Dansk"],
  ["sv", "Svenska"],
  ["bg", "Български"],
  ["ru", "Русский"],
  ["uk", "Українська"],
  ["hu", "Magyar"],
  ["sk", "Slovenčina"],
  ["cs", "Čeština"],
  ["sl", "Slovenščina"],
  ["lv", "Latviešu"],
  ["el", "Ελληνικά"],
];
