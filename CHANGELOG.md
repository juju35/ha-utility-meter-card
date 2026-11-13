# Changelog

## 1.0.0 - 2026-11-13

### Features
- **Utility Meter Card** (`custom:utility-meter-card`) for water and gas meters: index, consumption of the day, the week, the month and the year, each compared with the previous period at the same point, history chart (day, week, month, year) with the previous period behind each bar and the average, details of a bar in a popup at the top of the card.
- **Utility Meter Mini Card** (`custom:utility-meter-mini-card`): index, today and this month, the last days as a small chart and the leak alert; its detail button switches it to the full card and back.
- Any `sensor` with the `water` or `gas` device class (pulse counters, Gazpar / GRDF, Suez, Veolia, Eau de Paris…, utility_meter helpers), long-term statistics read with `recorder/statistics_during_period`, `statistic_id` for an external statistic; utility_meter helpers fed by the meter found on their own for live values.
- Optional cost: price or price entity, per m³ or per kWh (with a conversion factor for meters counting m³), currency of Home Assistant or your own.
- Leak detection: continuous flow every hour of a configurable night window (water by default), a leak sensor, a daily limit; alert banner, red status pill and night section unfolded.
- Drawn meters animated by their state: the water meter's star wheel spins and water ripples along the pipe while water flows, the gas meter's last digit rolls and its flame flickers, drops fall from the pipe joint on a leak.
- Visual editor for both cards, light and dark themes, 22 languages (English in the bundle, the others loaded on demand).
