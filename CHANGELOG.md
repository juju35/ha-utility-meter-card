# Changelog

## 1.2.1 - 2026-11-17

### Fixes
- Illustrated header in Safari (WebKit): the meter gets an explicit width, so that WebKit no longer sizes the picture from an SVG's default 300 px width and lays it over the title.

## 1.2.0 - 2026-11-17

### Features
- **Illustrated header** on the full and the mini card (90 px): the card's own meter drawn big at the right, in a place matching the kind of meter — water in a cellar on its blue pipe (concrete floor), electricity by the breaker panel (tiled floor), gas on the house front (lawn) — over a 10 px ground strip, edge to edge. It follows the meter's state: water running along the pipe, current down the cable and gas along its pipe while flowing; a puddle spreading under the meter, the meter pulsing red and the status pill on a leak.
- Night version of the header when `sun.sun` is below the horizon or with the dark theme (even while the sun is up), forced with `illustration_theme: day | night`; `illustration: false` keeps the classic header. Both options are in the visual editor of both cards.
- The header icon's colour always shows the status: the meter's colour while flowing, grey when still or unavailable, amber above the daily limit, red (pulsing) on a leak.
- The meter drawings' ids are unique per card, so several cards on a page never share a gradient.
- The status pill is back in the illustrated header in every state (Normal included), in the round icon's colour. In every header (illustrated or classic, full and mini card) it is placed by measurement, in every language: on the title row right after the title only when the whole title and its whole label fit there, otherwise on its own line under the subtitle (cut to one line); only its dot when the banner has no room left above its ground strip, and on a card of 200 px or less. The picture gives way below 320 px so the title stays readable. The mini card's detail button sits in the banner's top-right corner, in the frosted style of the other cards.
- On the mini card, the whole scene (meter, wall and pipes) steps left of the corner expand / collapse button at full size, the wall running on under the button: the water pipe, the gas window and the meters no longer sit under it.

## 1.1.1 - 2026-11-15

### Docs
- README: the top table now shows the electricity meter (full and mini card) in place of the leak alert, which keeps its own section and animation below.

## 1.1.0 - 2026-11-15

### Features
- **Electricity meters** (`energy` device class, kWh): index, consumption of the day, week, month and year, cost per kWh, history chart and live power — the same as water and gas. Detected on their own, or forced with `meter_type: electricity`. Works with Linky / Enedis (MyElectricalData, LixeeLinky / ZLinky, Teleinfo), Shelly EM, Tasmota, ESPHome, Z-Wave, Zigbee, Emporia, Tuya, utility_meter helpers and any cumulative energy sensor (#9).
- Electricity meter drawn three ways with `picture_style`: `digital` (a smart meter with its mains LED and a live power bar), `disc` (the classic Ferraris meter, an aluminium disc that spins the faster the more is drawn) and `submeter` (a module clamped on a wire, the current running along it). `auto` picks the sub-meter when a power sensor is set, else the digital meter. Live power (W) shows next to the index, and the meter pulses red above the `daily_limit`.
- **Dynamic gas conversion factor**: `conversion_factor_entity` reads the kWh-per-m³ factor from a live sensor (the daily factor GRDF publishes), instead of the fixed `conversion_factor`; it falls back to the fixed value when the sensor is unavailable (#9).

## 1.0.1 - 2026-11-13

### Fixes
- Folding back on a tap elsewhere now works on iOS (Safari and the companion app): a tap on something that is not clickable sent no click to the page, so the unfolded sections, the popup of a bar and the detailed view of the mini card stayed open. The press and the release are caught instead; a slider dragged out of the card and a scroll do not fold anything.
- Leaving the card (another dashboard view, a conditional card hidden) brings it back in its default state: sections folded as configured, popup closed, mini card compact.
- A click could do nothing: Home Assistant updates the card several times a second, and a rewrite of the card between the press and the release replaced the element pressed, so that the click was lost. The card is no longer rewritten while a press is in progress; the pending update is drawn right after the click.
- No focus ring after a mouse click or a tap: the focus is kept across updates only for the keyboard.

## 1.0.0 - 2026-11-13

### Features
- **Utility Meter Card** (`custom:utility-meter-card`) for water and gas meters: index, consumption of the day, the week, the month and the year, each compared with the previous period at the same point, history chart (day, week, month, year) with the previous period behind each bar and the average, details of a bar in a popup at the top of the card.
- **Utility Meter Mini Card** (`custom:utility-meter-mini-card`): index, today and this month, the last days as a small chart and the leak alert; its detail button switches it to the full card and back.
- Any `sensor` with the `water` or `gas` device class (pulse counters, Gazpar / GRDF, Suez, Veolia, Eau de Paris…, utility_meter helpers), long-term statistics read with `recorder/statistics_during_period`, `statistic_id` for an external statistic; utility_meter helpers fed by the meter found on their own for live values.
- Optional cost: price or price entity, per m³ or per kWh (with a conversion factor for meters counting m³), currency of Home Assistant or your own.
- Leak detection: continuous flow every hour of a configurable night window (water by default), a leak sensor, a daily limit; alert banner, red status pill and night section unfolded.
- Drawn meters animated by their state: the water meter's star wheel spins and water ripples along the pipe while water flows, the gas meter's last digit rolls and its flame flickers, drops fall from the pipe joint on a leak.
- Visual editor for both cards, light and dark themes, 22 languages (English in the bundle, the others loaded on demand).
