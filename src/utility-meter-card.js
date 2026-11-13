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

const VERSION = "__VERSION__";

const HOUR = 3600000;
const REFETCH_MS = 10 * 60000;
const MIN_REFETCH_MS = 60000;
const PERIODS = ["day", "week", "month", "year"];
const DEFAULT_COLLAPSED = ["night"];
const SECTIONS = ["consumption", "history", "night"];
const DEFAULT_LEAK = { start: "01:00", end: "05:00", water: 2, gas: 0.05 };

// Accent of each kind of meter, [light theme, dark theme].
const TYPES = {
  water: { accent: ["#0288d1", "#29b6f6"] },
  gas: { accent: ["#ef6c00", "#ffa726"] },
};

const ICONS = {
  water: "M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",
  gas: "M12 2c.6 3.1-1.4 4.6-2.9 6.5C7.6 10.4 6.5 12.2 6.5 14.6 6.5 18.3 9 21 12 21s5.5-2.7 5.5-6.2c0-2.4-1-4.1-2.1-5.6-.2 1.4-.9 2.5-2 3 .4-2.8-.3-6.6-1.4-10.2zM12 19c-1.5 0-2.6-1.2-2.6-2.7 0-1.4 1-2.3 1.9-3.4.2 1 .7 1.6 1.4 1.9.1-.8.4-1.5.9-2.1.7.9 1.1 1.8 1.1 3 0 1.9-1.2 3.3-2.7 3.3z",
  counter: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7H4zm2 2h2v6H6V9zm4 0h2v6h-2V9zm4 0h4v6h-4V9z",
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z",
  stats: "M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z",
  night: "M12.3 3a9 9 0 1 0 8.7 11.3A7.5 7.5 0 0 1 12.3 3z",
  alert: "M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z",
  flow: "M3 8c2 0 2-1.5 4.5-1.5S9.5 8 12 8s2-1.5 4.5-1.5S18.5 8 21 8v2c-2 0-2-1.5-4.5-1.5S14.5 10 12 10s-2-1.5-4.5-1.5S5 10 3 10V8zm0 6c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2-1.5 4.5-1.5S18.5 14 21 14v2c-2 0-2-1.5-4.5-1.5S14.5 16 12 16s-2-1.5-4.5-1.5S5 16 3 16v-2z",
  coin: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm1 3h-2v1.1c-1.7.4-2.8 1.6-2.8 3 0 1.8 1.5 2.5 3.4 3 1.3.3 1.8.7 1.8 1.2 0 .6-.6 1-1.6 1-1.1 0-1.7-.5-1.8-1.3H8c.1 1.6 1.3 2.6 3 2.9V18h2v-1.1c1.7-.3 2.8-1.4 2.8-2.9 0-1.9-1.6-2.6-3.4-3.1-1.3-.3-1.8-.6-1.8-1.1s.5-.9 1.4-.9c1 0 1.4.5 1.5 1.1h1.8c-.1-1.4-1-2.5-2.3-2.8V7z",
  sensor: "M12 2c-.3 0-.6.1-.8.4C9.6 4.6 6 9.6 6 13.5 6 17.1 8.7 20 12 20s6-2.9 6-6.5c0-3.9-3.6-8.9-5.2-11.1-.2-.3-.5-.4-.8-.4zM5 21h14v2H5z",
  up: "M7 15l5-5 5 5z",
  down: "M7 10l5 5 5-5z",
  chevron_down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  // mdi:arrow-expand and mdi:arrow-collapse (mini card detail button)
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
};

const STRINGS = {
  en: {
    meter_water: "Water meter",
    meter_gas: "Gas meter",
    index: "Index",
    today: "Today",
    week: "This week",
    month: "This month",
    year: "This year",
    yesterday: "Yesterday",
    last_week: "Last week",
    last_month: "Last month",
    last_year: "Last year",
    vs_day: "vs yesterday",
    vs_week: "vs last week",
    vs_month: "vs last month",
    vs_year: "vs last year",
    consumption: "Consumption",
    history: "History",
    night: "Night monitoring",
    tab_day: "Day",
    tab_week: "Week",
    tab_month: "Month",
    tab_year: "Year",
    average: "Average {value}",
    cost: "Cost",
    flow: "Flow",
    status_ok: "Normal",
    status_leak: "Leak suspected",
    status_high: "High usage",
    status_unavailable: "Unavailable",
    leak_alert: "Continuous flow all night: at least {value} every hour from {start} to {end}",
    leak_sensor: "{name} reports a leak",
    high_alert: "Today's consumption is above the daily limit ({value})",
    night_window: "Night window",
    night_lowest: "Lowest hour last night",
    night_threshold: "Alert threshold",
    sensor_ok: "Dry",
    sensor_wet: "Leak detected",
    no_stats: "No long-term statistics for this meter yet",
    loading: "Loading…",
    close: "Close",
    per_hour: "{value}/h",
    zoom_in: "Show details",
    zoom_out: "Show less",
    no_meter: "No water or gas meter found",
    unknown_entity: "Entity not found",
    entity: "Meter (index sensor)",
    title: "Title",
    meter_type: "Meter type",
    type_auto: "Automatic",
    type_water: "Water",
    type_gas: "Gas",
    chart_period: "Default chart",
    show_title: "Show title",
    show_subtitle: "Show subtitle",
    show_picture: "Show the meter picture",
    show_index: "Show index",
    show_consumption: "Show consumption",
    show_comparison: "Compare with the previous period",
    show_chart: "Show history chart",
    show_cost: "Show cost",
    leak_detection: "Leak detection",
    liters: "Small water amounts in liters",
    collapsed: "Sections folded by default",
    cost_section: "Cost",
    price: "Price per unit",
    price_entity: "Price entity",
    currency: "Currency",
    price_unit: "Price per",
    unit_volume: "Volume (m³)",
    unit_energy: "Energy (kWh)",
    conversion_factor: "Conversion factor (kWh per m³)",
    leak_section: "Leak detection",
    flow_entity: "Flow sensor",
    leak_entity: "Leak sensor",
    leak_start: "Night window start",
    leak_end: "Night window end",
    leak_threshold: "Threshold (L/h for water)",
    daily_limit: "Daily limit",
    sources_section: "Data sources",
    statistic_id: "Statistic (instead of the sensor's)",
    today_entity: "Utility meter (daily)",
    week_entity: "Utility meter (weekly)",
    month_entity: "Utility meter (monthly)",
    year_entity: "Utility meter (yearly)",
    zoom: "Detail button",
    zoom_helper: "Switches the mini card to the full card and back",
    language: "Language",
    lang_auto: "Automatic (Home Assistant)",
  },
  fr: {
    meter_water: "Compteur d'eau", meter_gas: "Compteur de gaz", index: "Index", today: "Aujourd'hui", week: "Cette semaine", month: "Ce mois-ci", year: "Cette année",
    yesterday: "Hier", last_week: "Semaine dernière", last_month: "Mois dernier", last_year: "Année dernière",
    vs_day: "par rapport à hier", vs_week: "par rapport à la semaine dernière", vs_month: "par rapport au mois dernier", vs_year: "par rapport à l'an dernier",
    consumption: "Consommation", history: "Historique", night: "Surveillance nocturne", tab_day: "Jour", tab_week: "Semaine", tab_month: "Mois", tab_year: "Année",
    average: "Moyenne {value}", cost: "Coût", flow: "Débit", status_ok: "Normal", status_leak: "Fuite suspectée", status_high: "Consommation élevée", status_unavailable: "Indisponible",
    leak_alert: "Débit continu toute la nuit : au moins {value} chaque heure de {start} à {end}", leak_sensor: "{name} signale une fuite",
    high_alert: "La consommation du jour dépasse la limite journalière ({value})", night_window: "Plage nocturne", night_lowest: "Heure la plus basse la nuit dernière",
    night_threshold: "Seuil d'alerte", sensor_ok: "Sec", sensor_wet: "Fuite détectée", no_stats: "Pas encore de statistiques long terme pour ce compteur", loading: "Chargement…",
    close: "Fermer", per_hour: "{value}/h", zoom_in: "Afficher les détails", zoom_out: "Réduire", no_meter: "Aucun compteur d'eau ou de gaz trouvé", unknown_entity: "Entité introuvable",
    entity: "Compteur (capteur d'index)", title: "Titre", meter_type: "Type de compteur", type_auto: "Automatique", type_water: "Eau", type_gas: "Gaz", chart_period: "Graphique par défaut",
    show_title: "Afficher le titre", show_subtitle: "Afficher le sous-titre", show_picture: "Afficher l'illustration du compteur", show_index: "Afficher l'index",
    show_consumption: "Afficher la consommation", show_comparison: "Comparer avec la période précédente", show_chart: "Afficher le graphique d'historique", show_cost: "Afficher le coût",
    leak_detection: "Détection de fuite", liters: "Petites quantités d'eau en litres", collapsed: "Sections repliées par défaut", cost_section: "Coût", price: "Prix unitaire",
    price_entity: "Entité de prix", currency: "Devise", price_unit: "Prix par", unit_volume: "Volume (m³)", unit_energy: "Énergie (kWh)", conversion_factor: "Coefficient de conversion (kWh par m³)",
    leak_section: "Détection de fuite", flow_entity: "Capteur de débit", leak_entity: "Détecteur de fuite", leak_start: "Début de la plage nocturne", leak_end: "Fin de la plage nocturne",
    leak_threshold: "Seuil (L/h pour l'eau)", daily_limit: "Limite journalière", sources_section: "Sources de données", statistic_id: "Statistique (au lieu de celle du capteur)",
    today_entity: "Compteur de services (journalier)", week_entity: "Compteur de services (hebdomadaire)", month_entity: "Compteur de services (mensuel)", year_entity: "Compteur de services (annuel)",
    zoom: "Bouton détail", zoom_helper: "Bascule la mini-carte vers la carte complète et inversement", language: "Langue", lang_auto: "Automatique (Home Assistant)",
  },
  de: {
    meter_water: "Wasserzähler", meter_gas: "Gaszähler", index: "Zählerstand", today: "Heute", week: "Diese Woche", month: "Dieser Monat", year: "Dieses Jahr",
    yesterday: "Gestern", last_week: "Letzte Woche", last_month: "Letzter Monat", last_year: "Letztes Jahr",
    vs_day: "ggü. gestern", vs_week: "ggü. letzter Woche", vs_month: "ggü. letztem Monat", vs_year: "ggü. letztem Jahr",
    consumption: "Verbrauch", history: "Verlauf", night: "Nachtüberwachung", tab_day: "Tag", tab_week: "Woche", tab_month: "Monat", tab_year: "Jahr",
    average: "Durchschnitt {value}", cost: "Kosten", flow: "Durchfluss", status_ok: "Normal", status_leak: "Leck vermutet", status_high: "Hoher Verbrauch", status_unavailable: "Nicht verfügbar",
    leak_alert: "Durchgehender Durchfluss die ganze Nacht: mindestens {value} pro Stunde von {start} bis {end}", leak_sensor: "{name} meldet ein Leck",
    high_alert: "Der heutige Verbrauch liegt über dem Tageslimit ({value})", night_window: "Nachtzeitraum", night_lowest: "Niedrigste Stunde letzte Nacht",
    night_threshold: "Alarmschwelle", sensor_ok: "Trocken", sensor_wet: "Leck erkannt", no_stats: "Noch keine Langzeitstatistiken für diesen Zähler", loading: "Wird geladen…",
    close: "Schließen", per_hour: "{value}/h", zoom_in: "Details anzeigen", zoom_out: "Weniger anzeigen", no_meter: "Kein Wasser- oder Gaszähler gefunden", unknown_entity: "Entität nicht gefunden",
    entity: "Zähler (Zählerstand-Sensor)", title: "Titel", meter_type: "Zählerart", type_auto: "Automatisch", type_water: "Wasser", type_gas: "Gas", chart_period: "Standarddiagramm",
    show_title: "Titel anzeigen", show_subtitle: "Untertitel anzeigen", show_picture: "Zählerbild anzeigen", show_index: "Zählerstand anzeigen",
    show_consumption: "Verbrauch anzeigen", show_comparison: "Mit dem vorherigen Zeitraum vergleichen", show_chart: "Verlaufsdiagramm anzeigen", show_cost: "Kosten anzeigen",
    leak_detection: "Leckerkennung", liters: "Kleine Wassermengen in Litern", collapsed: "Standardmäßig eingeklappte Abschnitte", cost_section: "Kosten", price: "Preis pro Einheit",
    price_entity: "Preis-Entität", currency: "Währung", price_unit: "Preis pro", unit_volume: "Volumen (m³)", unit_energy: "Energie (kWh)", conversion_factor: "Umrechnungsfaktor (kWh pro m³)",
    leak_section: "Leckerkennung", flow_entity: "Durchflusssensor", leak_entity: "Lecksensor", leak_start: "Beginn des Nachtzeitraums", leak_end: "Ende des Nachtzeitraums",
    leak_threshold: "Schwelle (L/h für Wasser)", daily_limit: "Tageslimit", sources_section: "Datenquellen", statistic_id: "Statistik (statt der des Sensors)",
    today_entity: "Verbrauchszähler (täglich)", week_entity: "Verbrauchszähler (wöchentlich)", month_entity: "Verbrauchszähler (monatlich)", year_entity: "Verbrauchszähler (jährlich)",
    zoom: "Detail-Schaltfläche", zoom_helper: "Schaltet die Mini-Karte auf die vollständige Karte um und zurück", language: "Sprache", lang_auto: "Automatisch (Home Assistant)",
  },
  es: {
    meter_water: "Contador de agua", meter_gas: "Contador de gas", index: "Lectura", today: "Hoy", week: "Esta semana", month: "Este mes", year: "Este año",
    yesterday: "Ayer", last_week: "Semana pasada", last_month: "Mes pasado", last_year: "Año pasado",
    vs_day: "frente a ayer", vs_week: "frente a la semana pasada", vs_month: "frente al mes pasado", vs_year: "frente al año pasado",
    consumption: "Consumo", history: "Historial", night: "Vigilancia nocturna", tab_day: "Día", tab_week: "Semana", tab_month: "Mes", tab_year: "Año",
    average: "Media {value}", cost: "Coste", flow: "Caudal", status_ok: "Normal", status_leak: "Posible fuga", status_high: "Consumo elevado", status_unavailable: "No disponible",
    leak_alert: "Caudal continuo toda la noche: al menos {value} cada hora de {start} a {end}", leak_sensor: "{name} indica una fuga",
    high_alert: "El consumo de hoy supera el límite diario ({value})", night_window: "Franja nocturna", night_lowest: "Hora más baja de anoche",
    night_threshold: "Umbral de alerta", sensor_ok: "Seco", sensor_wet: "Fuga detectada", no_stats: "Aún no hay estadísticas a largo plazo para este contador", loading: "Cargando…",
    close: "Cerrar", per_hour: "{value}/h", zoom_in: "Mostrar detalles", zoom_out: "Mostrar menos", no_meter: "No se encontró ningún contador de agua o gas", unknown_entity: "Entidad no encontrada",
    entity: "Contador (sensor de lectura)", title: "Título", meter_type: "Tipo de contador", type_auto: "Automático", type_water: "Agua", type_gas: "Gas", chart_period: "Gráfico predeterminado",
    show_title: "Mostrar el título", show_subtitle: "Mostrar el subtítulo", show_picture: "Mostrar la ilustración del contador", show_index: "Mostrar la lectura",
    show_consumption: "Mostrar el consumo", show_comparison: "Comparar con el periodo anterior", show_chart: "Mostrar el gráfico de historial", show_cost: "Mostrar el coste",
    leak_detection: "Detección de fugas", liters: "Pequeñas cantidades de agua en litros", collapsed: "Secciones plegadas por defecto", cost_section: "Coste", price: "Precio por unidad",
    price_entity: "Entidad de precio", currency: "Moneda", price_unit: "Precio por", unit_volume: "Volumen (m³)", unit_energy: "Energía (kWh)", conversion_factor: "Factor de conversión (kWh por m³)",
    leak_section: "Detección de fugas", flow_entity: "Sensor de caudal", leak_entity: "Sensor de fugas", leak_start: "Inicio de la franja nocturna", leak_end: "Fin de la franja nocturna",
    leak_threshold: "Umbral (L/h para el agua)", daily_limit: "Límite diario", sources_section: "Fuentes de datos", statistic_id: "Estadística (en lugar de la del sensor)",
    today_entity: "Contador de consumo (diario)", week_entity: "Contador de consumo (semanal)", month_entity: "Contador de consumo (mensual)", year_entity: "Contador de consumo (anual)",
    zoom: "Botón de detalle", zoom_helper: "Cambia la minitarjeta a la tarjeta completa y viceversa", language: "Idioma", lang_auto: "Automático (Home Assistant)",
  },
  sr: {
    meter_water: "Водомер", meter_gas: "Гасомер", index: "Стање бројила", today: "Данас", week: "Ове недеље", month: "Овог месеца", year: "Ове године",
    yesterday: "Јуче", last_week: "Прошле недеље", last_month: "Прошлог месеца", last_year: "Прошле године",
    vs_day: "у односу на јуче", vs_week: "у односу на прошлу недељу", vs_month: "у односу на прошли месец", vs_year: "у односу на прошлу годину",
    consumption: "Потрошња", history: "Историја", night: "Ноћни надзор", tab_day: "Дан", tab_week: "Недеља", tab_month: "Месец", tab_year: "Година",
    average: "Просек {value}", cost: "Трошак", flow: "Проток", status_ok: "Нормално", status_leak: "Сумња на цурење", status_high: "Висока потрошња", status_unavailable: "Недоступно",
    leak_alert: "Непрекидан проток целе ноћи: најмање {value} сваког сата од {start} до {end}", leak_sensor: "{name} пријављује цурење",
    high_alert: "Данашња потрошња је изнад дневног ограничења ({value})", night_window: "Ноћни период", night_lowest: "Најнижи сат прошле ноћи",
    night_threshold: "Праг упозорења", sensor_ok: "Суво", sensor_wet: "Откривено цурење", no_stats: "Још нема дугорочне статистике за ово бројило", loading: "Учитавање…",
    close: "Затвори", per_hour: "{value}/h", zoom_in: "Прикажи детаље", zoom_out: "Прикажи мање", no_meter: "Није пронађен водомер ни гасомер", unknown_entity: "Ентитет није пронађен",
    entity: "Бројило (сензор стања)", title: "Наслов", meter_type: "Врста бројила", type_auto: "Аутоматски", type_water: "Вода", type_gas: "Гас", chart_period: "Подразумевани графикон",
    show_title: "Прикажи наслов", show_subtitle: "Прикажи поднаслов", show_picture: "Прикажи слику бројила", show_index: "Прикажи стање бројила",
    show_consumption: "Прикажи потрошњу", show_comparison: "Упореди са претходним периодом", show_chart: "Прикажи графикон историје", show_cost: "Прикажи трошак",
    leak_detection: "Откривање цурења", liters: "Мале количине воде у литрима", collapsed: "Подразумевано скупљени одељци", cost_section: "Трошак", price: "Цена по јединици",
    price_entity: "Ентитет цене", currency: "Валута", price_unit: "Цена по", unit_volume: "Запремина (m³)", unit_energy: "Енергија (kWh)", conversion_factor: "Фактор претварања (kWh по m³)",
    leak_section: "Откривање цурења", flow_entity: "Сензор протока", leak_entity: "Сензор цурења", leak_start: "Почетак ноћног периода", leak_end: "Крај ноћног периода",
    leak_threshold: "Праг (L/h за воду)", daily_limit: "Дневно ограничење", sources_section: "Извори података", statistic_id: "Статистика (уместо статистике сензора)",
    today_entity: "Бројач потрошње (дневни)", week_entity: "Бројач потрошње (недељни)", month_entity: "Бројач потрошње (месечни)", year_entity: "Бројач потрошње (годишњи)",
    zoom: "Дугме за детаље", zoom_helper: "Пребацује мини картицу на пуну картицу и назад", language: "Језик", lang_auto: "Аутоматски (Home Assistant)",
  },
  "sr-Latn": {
    meter_water: "Vodomer", meter_gas: "Gasomer", index: "Stanje brojila", today: "Danas", week: "Ove nedelje", month: "Ovog meseca", year: "Ove godine",
    yesterday: "Juče", last_week: "Prošle nedelje", last_month: "Prošlog meseca", last_year: "Prošle godine",
    vs_day: "u odnosu na juče", vs_week: "u odnosu na prošlu nedelju", vs_month: "u odnosu na prošli mesec", vs_year: "u odnosu na prošlu godinu",
    consumption: "Potrošnja", history: "Istorija", night: "Noćni nadzor", tab_day: "Dan", tab_week: "Nedelja", tab_month: "Mesec", tab_year: "Godina",
    average: "Prosek {value}", cost: "Trošak", flow: "Protok", status_ok: "Normalno", status_leak: "Sumnja na curenje", status_high: "Visoka potrošnja", status_unavailable: "Nedostupno",
    leak_alert: "Neprekidan protok cele noći: najmanje {value} svakog sata od {start} do {end}", leak_sensor: "{name} prijavljuje curenje",
    high_alert: "Današnja potrošnja je iznad dnevnog ograničenja ({value})", night_window: "Noćni period", night_lowest: "Najniži sat prošle noći",
    night_threshold: "Prag upozorenja", sensor_ok: "Suvo", sensor_wet: "Otkriveno curenje", no_stats: "Još nema dugoročne statistike za ovo brojilo", loading: "Učitavanje…",
    close: "Zatvori", per_hour: "{value}/h", zoom_in: "Prikaži detalje", zoom_out: "Prikaži manje", no_meter: "Nije pronađen vodomer ni gasomer", unknown_entity: "Entitet nije pronađen",
    entity: "Brojilo (senzor stanja)", title: "Naslov", meter_type: "Vrsta brojila", type_auto: "Automatski", type_water: "Voda", type_gas: "Gas", chart_period: "Podrazumevani grafikon",
    show_title: "Prikaži naslov", show_subtitle: "Prikaži podnaslov", show_picture: "Prikaži sliku brojila", show_index: "Prikaži stanje brojila",
    show_consumption: "Prikaži potrošnju", show_comparison: "Uporedi sa prethodnim periodom", show_chart: "Prikaži grafikon istorije", show_cost: "Prikaži trošak",
    leak_detection: "Otkrivanje curenja", liters: "Male količine vode u litrima", collapsed: "Podrazumevano skupljeni odeljci", cost_section: "Trošak", price: "Cena po jedinici",
    price_entity: "Entitet cene", currency: "Valuta", price_unit: "Cena po", unit_volume: "Zapremina (m³)", unit_energy: "Energija (kWh)", conversion_factor: "Faktor pretvaranja (kWh po m³)",
    leak_section: "Otkrivanje curenja", flow_entity: "Senzor protoka", leak_entity: "Senzor curenja", leak_start: "Početak noćnog perioda", leak_end: "Kraj noćnog perioda",
    leak_threshold: "Prag (L/h za vodu)", daily_limit: "Dnevno ograničenje", sources_section: "Izvori podataka", statistic_id: "Statistika (umesto statistike senzora)",
    today_entity: "Brojač potrošnje (dnevni)", week_entity: "Brojač potrošnje (nedeljni)", month_entity: "Brojač potrošnje (mesečni)", year_entity: "Brojač potrošnje (godišnji)",
    zoom: "Dugme za detalje", zoom_helper: "Prebacuje mini karticu na punu karticu i nazad", language: "Jezik", lang_auto: "Automatski (Home Assistant)",
  },
  it: {
    meter_water: "Contatore dell'acqua", meter_gas: "Contatore del gas", index: "Lettura", today: "Oggi", week: "Questa settimana", month: "Questo mese", year: "Quest'anno",
    yesterday: "Ieri", last_week: "Settimana scorsa", last_month: "Mese scorso", last_year: "Anno scorso",
    vs_day: "rispetto a ieri", vs_week: "rispetto alla settimana scorsa", vs_month: "rispetto al mese scorso", vs_year: "rispetto all'anno scorso",
    consumption: "Consumo", history: "Cronologia", night: "Monitoraggio notturno", tab_day: "Giorno", tab_week: "Settimana", tab_month: "Mese", tab_year: "Anno",
    average: "Media {value}", cost: "Costo", flow: "Portata", status_ok: "Normale", status_leak: "Sospetta perdita", status_high: "Consumo elevato", status_unavailable: "Non disponibile",
    leak_alert: "Flusso continuo per tutta la notte: almeno {value} ogni ora dalle {start} alle {end}", leak_sensor: "{name} segnala una perdita",
    high_alert: "Il consumo di oggi supera il limite giornaliero ({value})", night_window: "Fascia notturna", night_lowest: "Ora più bassa della notte scorsa",
    night_threshold: "Soglia di allarme", sensor_ok: "Asciutto", sensor_wet: "Perdita rilevata", no_stats: "Ancora nessuna statistica a lungo termine per questo contatore", loading: "Caricamento…",
    close: "Chiudi", per_hour: "{value}/h", zoom_in: "Mostra dettagli", zoom_out: "Mostra meno", no_meter: "Nessun contatore dell'acqua o del gas trovato", unknown_entity: "Entità non trovata",
    entity: "Contatore (sensore della lettura)", title: "Titolo", meter_type: "Tipo di contatore", type_auto: "Automatico", type_water: "Acqua", type_gas: "Gas", chart_period: "Grafico predefinito",
    show_title: "Mostra il titolo", show_subtitle: "Mostra il sottotitolo", show_picture: "Mostra l'illustrazione del contatore", show_index: "Mostra la lettura",
    show_consumption: "Mostra il consumo", show_comparison: "Confronta con il periodo precedente", show_chart: "Mostra il grafico della cronologia", show_cost: "Mostra il costo",
    leak_detection: "Rilevamento perdite", liters: "Piccole quantità d'acqua in litri", collapsed: "Sezioni chiuse per impostazione predefinita", cost_section: "Costo", price: "Prezzo unitario",
    price_entity: "Entità del prezzo", currency: "Valuta", price_unit: "Prezzo per", unit_volume: "Volume (m³)", unit_energy: "Energia (kWh)", conversion_factor: "Fattore di conversione (kWh per m³)",
    leak_section: "Rilevamento perdite", flow_entity: "Sensore di portata", leak_entity: "Sensore di perdite", leak_start: "Inizio della fascia notturna", leak_end: "Fine della fascia notturna",
    leak_threshold: "Soglia (L/h per l'acqua)", daily_limit: "Limite giornaliero", sources_section: "Fonti dei dati", statistic_id: "Statistica (al posto di quella del sensore)",
    today_entity: "Contatore dei consumi (giornaliero)", week_entity: "Contatore dei consumi (settimanale)", month_entity: "Contatore dei consumi (mensile)", year_entity: "Contatore dei consumi (annuale)",
    zoom: "Pulsante dettagli", zoom_helper: "Passa dalla mini scheda alla scheda completa e viceversa", language: "Lingua", lang_auto: "Automatica (Home Assistant)",
  },
  nl: {
    meter_water: "Watermeter", meter_gas: "Gasmeter", index: "Meterstand", today: "Vandaag", week: "Deze week", month: "Deze maand", year: "Dit jaar",
    yesterday: "Gisteren", last_week: "Vorige week", last_month: "Vorige maand", last_year: "Vorig jaar",
    vs_day: "t.o.v. gisteren", vs_week: "t.o.v. vorige week", vs_month: "t.o.v. vorige maand", vs_year: "t.o.v. vorig jaar",
    consumption: "Verbruik", history: "Geschiedenis", night: "Nachtbewaking", tab_day: "Dag", tab_week: "Week", tab_month: "Maand", tab_year: "Jaar",
    average: "Gemiddelde {value}", cost: "Kosten", flow: "Debiet", status_ok: "Normaal", status_leak: "Mogelijk lek", status_high: "Hoog verbruik", status_unavailable: "Niet beschikbaar",
    leak_alert: "De hele nacht doorlopend verbruik: minstens {value} per uur van {start} tot {end}", leak_sensor: "{name} meldt een lek",
    high_alert: "Het verbruik van vandaag ligt boven de daglimiet ({value})", night_window: "Nachtperiode", night_lowest: "Laagste uur afgelopen nacht",
    night_threshold: "Alarmdrempel", sensor_ok: "Droog", sensor_wet: "Lek gedetecteerd", no_stats: "Nog geen langetermijnstatistieken voor deze meter", loading: "Laden…",
    close: "Sluiten", per_hour: "{value}/u", zoom_in: "Details tonen", zoom_out: "Minder tonen", no_meter: "Geen water- of gasmeter gevonden", unknown_entity: "Entiteit niet gevonden",
    entity: "Meter (meterstandsensor)", title: "Titel", meter_type: "Type meter", type_auto: "Automatisch", type_water: "Water", type_gas: "Gas", chart_period: "Standaardgrafiek",
    show_title: "Titel tonen", show_subtitle: "Ondertitel tonen", show_picture: "Afbeelding van de meter tonen", show_index: "Meterstand tonen",
    show_consumption: "Verbruik tonen", show_comparison: "Vergelijken met de vorige periode", show_chart: "Geschiedenisgrafiek tonen", show_cost: "Kosten tonen",
    leak_detection: "Lekdetectie", liters: "Kleine hoeveelheden water in liters", collapsed: "Standaard ingeklapte secties", cost_section: "Kosten", price: "Prijs per eenheid",
    price_entity: "Prijsentiteit", currency: "Valuta", price_unit: "Prijs per", unit_volume: "Volume (m³)", unit_energy: "Energie (kWh)", conversion_factor: "Omrekenfactor (kWh per m³)",
    leak_section: "Lekdetectie", flow_entity: "Debietsensor", leak_entity: "Leksensor", leak_start: "Begin van de nachtperiode", leak_end: "Einde van de nachtperiode",
    leak_threshold: "Drempel (L/u voor water)", daily_limit: "Daglimiet", sources_section: "Gegevensbronnen", statistic_id: "Statistiek (in plaats van die van de sensor)",
    today_entity: "Verbruiksmeter (dagelijks)", week_entity: "Verbruiksmeter (wekelijks)", month_entity: "Verbruiksmeter (maandelijks)", year_entity: "Verbruiksmeter (jaarlijks)",
    zoom: "Detailknop", zoom_helper: "Schakelt de minikaart naar de volledige kaart en terug", language: "Taal", lang_auto: "Automatisch (Home Assistant)",
  },
  pt: {
    meter_water: "Contador de água", meter_gas: "Contador de gás", index: "Leitura", today: "Hoje", week: "Esta semana", month: "Este mês", year: "Este ano",
    yesterday: "Ontem", last_week: "Semana passada", last_month: "Mês passado", last_year: "Ano passado",
    vs_day: "face a ontem", vs_week: "face à semana passada", vs_month: "face ao mês passado", vs_year: "face ao ano passado",
    consumption: "Consumo", history: "Histórico", night: "Vigilância noturna", tab_day: "Dia", tab_week: "Semana", tab_month: "Mês", tab_year: "Ano",
    average: "Média {value}", cost: "Custo", flow: "Caudal", status_ok: "Normal", status_leak: "Possível fuga", status_high: "Consumo elevado", status_unavailable: "Indisponível",
    leak_alert: "Caudal contínuo toda a noite: pelo menos {value} por hora das {start} às {end}", leak_sensor: "{name} indica uma fuga",
    high_alert: "O consumo de hoje ultrapassa o limite diário ({value})", night_window: "Período noturno", night_lowest: "Hora mais baixa da noite passada",
    night_threshold: "Limiar de alerta", sensor_ok: "Seco", sensor_wet: "Fuga detetada", no_stats: "Ainda não há estatísticas de longo prazo para este contador", loading: "A carregar…",
    close: "Fechar", per_hour: "{value}/h", zoom_in: "Mostrar detalhes", zoom_out: "Mostrar menos", no_meter: "Nenhum contador de água ou gás encontrado", unknown_entity: "Entidade não encontrada",
    entity: "Contador (sensor de leitura)", title: "Título", meter_type: "Tipo de contador", type_auto: "Automático", type_water: "Água", type_gas: "Gás", chart_period: "Gráfico predefinido",
    show_title: "Mostrar o título", show_subtitle: "Mostrar o subtítulo", show_picture: "Mostrar a ilustração do contador", show_index: "Mostrar a leitura",
    show_consumption: "Mostrar o consumo", show_comparison: "Comparar com o período anterior", show_chart: "Mostrar o gráfico do histórico", show_cost: "Mostrar o custo",
    leak_detection: "Deteção de fugas", liters: "Pequenas quantidades de água em litros", collapsed: "Secções recolhidas por predefinição", cost_section: "Custo", price: "Preço por unidade",
    price_entity: "Entidade do preço", currency: "Moeda", price_unit: "Preço por", unit_volume: "Volume (m³)", unit_energy: "Energia (kWh)", conversion_factor: "Fator de conversão (kWh por m³)",
    leak_section: "Deteção de fugas", flow_entity: "Sensor de caudal", leak_entity: "Sensor de fugas", leak_start: "Início do período noturno", leak_end: "Fim do período noturno",
    leak_threshold: "Limiar (L/h para a água)", daily_limit: "Limite diário", sources_section: "Fontes de dados", statistic_id: "Estatística (em vez da do sensor)",
    today_entity: "Contador de consumo (diário)", week_entity: "Contador de consumo (semanal)", month_entity: "Contador de consumo (mensal)", year_entity: "Contador de consumo (anual)",
    zoom: "Botão de detalhe", zoom_helper: "Muda o mini cartão para o cartão completo e vice-versa", language: "Idioma", lang_auto: "Automático (Home Assistant)",
  },
  pl: {
    meter_water: "Wodomierz", meter_gas: "Gazomierz", index: "Stan licznika", today: "Dziś", week: "Ten tydzień", month: "Ten miesiąc", year: "Ten rok",
    yesterday: "Wczoraj", last_week: "Poprzedni tydzień", last_month: "Poprzedni miesiąc", last_year: "Poprzedni rok",
    vs_day: "względem wczoraj", vs_week: "względem poprzedniego tygodnia", vs_month: "względem poprzedniego miesiąca", vs_year: "względem poprzedniego roku",
    consumption: "Zużycie", history: "Historia", night: "Nadzór nocny", tab_day: "Dzień", tab_week: "Tydzień", tab_month: "Miesiąc", tab_year: "Rok",
    average: "Średnia {value}", cost: "Koszt", flow: "Przepływ", status_ok: "Normalnie", status_leak: "Podejrzenie wycieku", status_high: "Wysokie zużycie", status_unavailable: "Niedostępny",
    leak_alert: "Ciągły przepływ przez całą noc: co najmniej {value} co godzinę od {start} do {end}", leak_sensor: "{name} zgłasza wyciek",
    high_alert: "Dzisiejsze zużycie przekracza dzienny limit ({value})", night_window: "Okno nocne", night_lowest: "Najniższa godzina ostatniej nocy",
    night_threshold: "Próg alarmu", sensor_ok: "Sucho", sensor_wet: "Wykryto wyciek", no_stats: "Brak jeszcze statystyk długoterminowych dla tego licznika", loading: "Ładowanie…",
    close: "Zamknij", per_hour: "{value}/h", zoom_in: "Pokaż szczegóły", zoom_out: "Pokaż mniej", no_meter: "Nie znaleziono wodomierza ani gazomierza", unknown_entity: "Nie znaleziono encji",
    entity: "Licznik (czujnik stanu)", title: "Tytuł", meter_type: "Rodzaj licznika", type_auto: "Automatycznie", type_water: "Woda", type_gas: "Gaz", chart_period: "Domyślny wykres",
    show_title: "Pokaż tytuł", show_subtitle: "Pokaż podtytuł", show_picture: "Pokaż ilustrację licznika", show_index: "Pokaż stan licznika",
    show_consumption: "Pokaż zużycie", show_comparison: "Porównaj z poprzednim okresem", show_chart: "Pokaż wykres historii", show_cost: "Pokaż koszt",
    leak_detection: "Wykrywanie wycieków", liters: "Małe ilości wody w litrach", collapsed: "Sekcje domyślnie zwinięte", cost_section: "Koszt", price: "Cena za jednostkę",
    price_entity: "Encja ceny", currency: "Waluta", price_unit: "Cena za", unit_volume: "Objętość (m³)", unit_energy: "Energia (kWh)", conversion_factor: "Współczynnik przeliczeniowy (kWh na m³)",
    leak_section: "Wykrywanie wycieków", flow_entity: "Czujnik przepływu", leak_entity: "Czujnik wycieku", leak_start: "Początek okna nocnego", leak_end: "Koniec okna nocnego",
    leak_threshold: "Próg (L/h dla wody)", daily_limit: "Dzienny limit", sources_section: "Źródła danych", statistic_id: "Statystyka (zamiast statystyki czujnika)",
    today_entity: "Licznik mediów (dzienny)", week_entity: "Licznik mediów (tygodniowy)", month_entity: "Licznik mediów (miesięczny)", year_entity: "Licznik mediów (roczny)",
    zoom: "Przycisk szczegółów", zoom_helper: "Przełącza minikartę na pełną kartę i z powrotem", language: "Język", lang_auto: "Automatycznie (Home Assistant)",
  },
  ro: {
    meter_water: "Contor de apă", meter_gas: "Contor de gaz", index: "Index", today: "Azi", week: "Săptămâna aceasta", month: "Luna aceasta", year: "Anul acesta",
    yesterday: "Ieri", last_week: "Săptămâna trecută", last_month: "Luna trecută", last_year: "Anul trecut",
    vs_day: "față de ieri", vs_week: "față de săptămâna trecută", vs_month: "față de luna trecută", vs_year: "față de anul trecut",
    consumption: "Consum", history: "Istoric", night: "Supraveghere nocturnă", tab_day: "Zi", tab_week: "Săptămână", tab_month: "Lună", tab_year: "An",
    average: "Medie {value}", cost: "Cost", flow: "Debit", status_ok: "Normal", status_leak: "Posibilă scurgere", status_high: "Consum ridicat", status_unavailable: "Indisponibil",
    leak_alert: "Debit continuu toată noaptea: cel puțin {value} în fiecare oră de la {start} la {end}", leak_sensor: "{name} semnalează o scurgere",
    high_alert: "Consumul de azi depășește limita zilnică ({value})", night_window: "Interval nocturn", night_lowest: "Cea mai mică oră de azi-noapte",
    night_threshold: "Prag de alertă", sensor_ok: "Uscat", sensor_wet: "Scurgere detectată", no_stats: "Încă nu există statistici pe termen lung pentru acest contor", loading: "Se încarcă…",
    close: "Închide", per_hour: "{value}/h", zoom_in: "Afișează detaliile", zoom_out: "Afișează mai puțin", no_meter: "Nu s-a găsit niciun contor de apă sau gaz", unknown_entity: "Entitate negăsită",
    entity: "Contor (senzor de index)", title: "Titlu", meter_type: "Tip de contor", type_auto: "Automat", type_water: "Apă", type_gas: "Gaz", chart_period: "Grafic implicit",
    show_title: "Afișează titlul", show_subtitle: "Afișează subtitlul", show_picture: "Afișează ilustrația contorului", show_index: "Afișează indexul",
    show_consumption: "Afișează consumul", show_comparison: "Compară cu perioada anterioară", show_chart: "Afișează graficul istoricului", show_cost: "Afișează costul",
    leak_detection: "Detectarea scurgerilor", liters: "Cantități mici de apă în litri", collapsed: "Secțiuni restrânse implicit", cost_section: "Cost", price: "Preț pe unitate",
    price_entity: "Entitate de preț", currency: "Monedă", price_unit: "Preț pe", unit_volume: "Volum (m³)", unit_energy: "Energie (kWh)", conversion_factor: "Factor de conversie (kWh pe m³)",
    leak_section: "Detectarea scurgerilor", flow_entity: "Senzor de debit", leak_entity: "Senzor de scurgere", leak_start: "Începutul intervalului nocturn", leak_end: "Sfârșitul intervalului nocturn",
    leak_threshold: "Prag (L/h pentru apă)", daily_limit: "Limită zilnică", sources_section: "Surse de date", statistic_id: "Statistică (în locul celei a senzorului)",
    today_entity: "Contor de consum (zilnic)", week_entity: "Contor de consum (săptămânal)", month_entity: "Contor de consum (lunar)", year_entity: "Contor de consum (anual)",
    zoom: "Buton de detalii", zoom_helper: "Comută mini cardul la cardul complet și înapoi", language: "Limbă", lang_auto: "Automat (Home Assistant)",
  },
  da: {
    meter_water: "Vandmåler", meter_gas: "Gasmåler", index: "Målerstand", today: "I dag", week: "Denne uge", month: "Denne måned", year: "I år",
    yesterday: "I går", last_week: "Sidste uge", last_month: "Sidste måned", last_year: "Sidste år",
    vs_day: "ift. i går", vs_week: "ift. sidste uge", vs_month: "ift. sidste måned", vs_year: "ift. sidste år",
    consumption: "Forbrug", history: "Historik", night: "Natovervågning", tab_day: "Dag", tab_week: "Uge", tab_month: "Måned", tab_year: "År",
    average: "Gennemsnit {value}", cost: "Pris", flow: "Flow", status_ok: "Normal", status_leak: "Mistanke om lækage", status_high: "Højt forbrug", status_unavailable: "Utilgængelig",
    leak_alert: "Konstant flow hele natten: mindst {value} hver time fra {start} til {end}", leak_sensor: "{name} melder en lækage",
    high_alert: "Dagens forbrug er over dagsgrænsen ({value})", night_window: "Natperiode", night_lowest: "Laveste time i nat",
    night_threshold: "Alarmtærskel", sensor_ok: "Tør", sensor_wet: "Lækage registreret", no_stats: "Ingen langtidsstatistik for denne måler endnu", loading: "Indlæser…",
    close: "Luk", per_hour: "{value}/t", zoom_in: "Vis detaljer", zoom_out: "Vis mindre", no_meter: "Ingen vand- eller gasmåler fundet", unknown_entity: "Enhed ikke fundet",
    entity: "Måler (målerstandssensor)", title: "Titel", meter_type: "Målertype", type_auto: "Automatisk", type_water: "Vand", type_gas: "Gas", chart_period: "Standarddiagram",
    show_title: "Vis titel", show_subtitle: "Vis undertitel", show_picture: "Vis billede af måleren", show_index: "Vis målerstand",
    show_consumption: "Vis forbrug", show_comparison: "Sammenlign med forrige periode", show_chart: "Vis historikdiagram", show_cost: "Vis pris",
    leak_detection: "Lækagedetektion", liters: "Små vandmængder i liter", collapsed: "Sektioner foldet sammen som standard", cost_section: "Pris", price: "Pris pr. enhed",
    price_entity: "Prisenhed", currency: "Valuta", price_unit: "Pris pr.", unit_volume: "Volumen (m³)", unit_energy: "Energi (kWh)", conversion_factor: "Omregningsfaktor (kWh pr. m³)",
    leak_section: "Lækagedetektion", flow_entity: "Flowsensor", leak_entity: "Lækagesensor", leak_start: "Start på natperiode", leak_end: "Slut på natperiode",
    leak_threshold: "Tærskel (L/t for vand)", daily_limit: "Dagsgrænse", sources_section: "Datakilder", statistic_id: "Statistik (i stedet for sensorens)",
    today_entity: "Forbrugsmåler (daglig)", week_entity: "Forbrugsmåler (ugentlig)", month_entity: "Forbrugsmåler (månedlig)", year_entity: "Forbrugsmåler (årlig)",
    zoom: "Detaljeknap", zoom_helper: "Skifter minikortet til det fulde kort og tilbage", language: "Sprog", lang_auto: "Automatisk (Home Assistant)",
  },
  sv: {
    meter_water: "Vattenmätare", meter_gas: "Gasmätare", index: "Mätarställning", today: "I dag", week: "Den här veckan", month: "Den här månaden", year: "I år",
    yesterday: "I går", last_week: "Förra veckan", last_month: "Förra månaden", last_year: "Förra året",
    vs_day: "jämfört med i går", vs_week: "jämfört med förra veckan", vs_month: "jämfört med förra månaden", vs_year: "jämfört med förra året",
    consumption: "Förbrukning", history: "Historik", night: "Nattövervakning", tab_day: "Dag", tab_week: "Vecka", tab_month: "Månad", tab_year: "År",
    average: "Medel {value}", cost: "Kostnad", flow: "Flöde", status_ok: "Normal", status_leak: "Misstänkt läcka", status_high: "Hög förbrukning", status_unavailable: "Otillgänglig",
    leak_alert: "Konstant flöde hela natten: minst {value} varje timme från {start} till {end}", leak_sensor: "{name} rapporterar en läcka",
    high_alert: "Dagens förbrukning är över dagsgränsen ({value})", night_window: "Nattperiod", night_lowest: "Lägsta timmen i natt",
    night_threshold: "Larmtröskel", sensor_ok: "Torrt", sensor_wet: "Läcka upptäckt", no_stats: "Ingen långtidsstatistik för den här mätaren ännu", loading: "Laddar…",
    close: "Stäng", per_hour: "{value}/h", zoom_in: "Visa detaljer", zoom_out: "Visa mindre", no_meter: "Ingen vatten- eller gasmätare hittades", unknown_entity: "Entiteten hittades inte",
    entity: "Mätare (sensor för mätarställning)", title: "Titel", meter_type: "Mätartyp", type_auto: "Automatisk", type_water: "Vatten", type_gas: "Gas", chart_period: "Standarddiagram",
    show_title: "Visa titel", show_subtitle: "Visa underrubrik", show_picture: "Visa bild av mätaren", show_index: "Visa mätarställning",
    show_consumption: "Visa förbrukning", show_comparison: "Jämför med föregående period", show_chart: "Visa historikdiagram", show_cost: "Visa kostnad",
    leak_detection: "Läckagedetektering", liters: "Små vattenmängder i liter", collapsed: "Avsnitt hopfällda som standard", cost_section: "Kostnad", price: "Pris per enhet",
    price_entity: "Prisentitet", currency: "Valuta", price_unit: "Pris per", unit_volume: "Volym (m³)", unit_energy: "Energi (kWh)", conversion_factor: "Omräkningsfaktor (kWh per m³)",
    leak_section: "Läckagedetektering", flow_entity: "Flödessensor", leak_entity: "Läckagesensor", leak_start: "Nattperiodens början", leak_end: "Nattperiodens slut",
    leak_threshold: "Tröskel (L/h för vatten)", daily_limit: "Dagsgräns", sources_section: "Datakällor", statistic_id: "Statistik (i stället för sensorns)",
    today_entity: "Förbrukningsmätare (daglig)", week_entity: "Förbrukningsmätare (veckovis)", month_entity: "Förbrukningsmätare (månadsvis)", year_entity: "Förbrukningsmätare (årlig)",
    zoom: "Detaljknapp", zoom_helper: "Växlar minikortet till hela kortet och tillbaka", language: "Språk", lang_auto: "Automatiskt (Home Assistant)",
  },
  bg: {
    meter_water: "Водомер", meter_gas: "Газомер", index: "Показание", today: "Днес", week: "Тази седмица", month: "Този месец", year: "Тази година",
    yesterday: "Вчера", last_week: "Миналата седмица", last_month: "Миналия месец", last_year: "Миналата година",
    vs_day: "спрямо вчера", vs_week: "спрямо миналата седмица", vs_month: "спрямо миналия месец", vs_year: "спрямо миналата година",
    consumption: "Потребление", history: "История", night: "Нощно наблюдение", tab_day: "Ден", tab_week: "Седмица", tab_month: "Месец", tab_year: "Година",
    average: "Средно {value}", cost: "Разход", flow: "Дебит", status_ok: "Нормално", status_leak: "Подозиран теч", status_high: "Високо потребление", status_unavailable: "Недостъпно",
    leak_alert: "Непрекъснат дебит цяла нощ: поне {value} на всеки час от {start} до {end}", leak_sensor: "{name} съобщава за теч",
    high_alert: "Днешното потребление надвишава дневния лимит ({value})", night_window: "Нощен период", night_lowest: "Най-нисък час миналата нощ",
    night_threshold: "Праг на тревога", sensor_ok: "Сухо", sensor_wet: "Открит теч", no_stats: "Все още няма дългосрочна статистика за този уред", loading: "Зареждане…",
    close: "Затвори", per_hour: "{value}/ч", zoom_in: "Покажи подробности", zoom_out: "Покажи по-малко", no_meter: "Не е намерен водомер или газомер", unknown_entity: "Обектът не е намерен",
    entity: "Уред (сензор за показание)", title: "Заглавие", meter_type: "Вид уред", type_auto: "Автоматично", type_water: "Вода", type_gas: "Газ", chart_period: "Графика по подразбиране",
    show_title: "Покажи заглавието", show_subtitle: "Покажи подзаглавието", show_picture: "Покажи изображение на уреда", show_index: "Покажи показанието",
    show_consumption: "Покажи потреблението", show_comparison: "Сравни с предходния период", show_chart: "Покажи графиката на историята", show_cost: "Покажи разхода",
    leak_detection: "Откриване на течове", liters: "Малки количества вода в литри", collapsed: "Свити по подразбиране раздели", cost_section: "Разход", price: "Цена за единица",
    price_entity: "Обект за цена", currency: "Валута", price_unit: "Цена за", unit_volume: "Обем (m³)", unit_energy: "Енергия (kWh)", conversion_factor: "Коефициент на преобразуване (kWh за m³)",
    leak_section: "Откриване на течове", flow_entity: "Сензор за дебит", leak_entity: "Сензор за теч", leak_start: "Начало на нощния период", leak_end: "Край на нощния период",
    leak_threshold: "Праг (L/ч за вода)", daily_limit: "Дневен лимит", sources_section: "Източници на данни", statistic_id: "Статистика (вместо тази на сензора)",
    today_entity: "Брояч на потребление (дневен)", week_entity: "Брояч на потребление (седмичен)", month_entity: "Брояч на потребление (месечен)", year_entity: "Брояч на потребление (годишен)",
    zoom: "Бутон за подробности", zoom_helper: "Превключва мини картата към пълната карта и обратно", language: "Език", lang_auto: "Автоматично (Home Assistant)",
  },
  ru: {
    meter_water: "Счётчик воды", meter_gas: "Счётчик газа", index: "Показания", today: "Сегодня", week: "Эта неделя", month: "Этот месяц", year: "Этот год",
    yesterday: "Вчера", last_week: "Прошлая неделя", last_month: "Прошлый месяц", last_year: "Прошлый год",
    vs_day: "к вчерашнему дню", vs_week: "к прошлой неделе", vs_month: "к прошлому месяцу", vs_year: "к прошлому году",
    consumption: "Потребление", history: "История", night: "Ночной контроль", tab_day: "День", tab_week: "Неделя", tab_month: "Месяц", tab_year: "Год",
    average: "В среднем {value}", cost: "Стоимость", flow: "Расход", status_ok: "Норма", status_leak: "Подозрение на утечку", status_high: "Высокое потребление", status_unavailable: "Недоступно",
    leak_alert: "Непрерывный расход всю ночь: не менее {value} каждый час с {start} до {end}", leak_sensor: "{name} сообщает об утечке",
    high_alert: "Сегодняшнее потребление превышает дневной лимит ({value})", night_window: "Ночной интервал", night_lowest: "Минимальный час прошлой ночью",
    night_threshold: "Порог тревоги", sensor_ok: "Сухо", sensor_wet: "Обнаружена утечка", no_stats: "Для этого счётчика пока нет долгосрочной статистики", loading: "Загрузка…",
    close: "Закрыть", per_hour: "{value}/ч", zoom_in: "Подробнее", zoom_out: "Свернуть", no_meter: "Счётчик воды или газа не найден", unknown_entity: "Объект не найден",
    entity: "Счётчик (датчик показаний)", title: "Заголовок", meter_type: "Тип счётчика", type_auto: "Автоматически", type_water: "Вода", type_gas: "Газ", chart_period: "График по умолчанию",
    show_title: "Показывать заголовок", show_subtitle: "Показывать подзаголовок", show_picture: "Показывать изображение счётчика", show_index: "Показывать показания",
    show_consumption: "Показывать потребление", show_comparison: "Сравнивать с предыдущим периодом", show_chart: "Показывать график истории", show_cost: "Показывать стоимость",
    leak_detection: "Обнаружение утечек", liters: "Малые объёмы воды в литрах", collapsed: "Разделы, свёрнутые по умолчанию", cost_section: "Стоимость", price: "Цена за единицу",
    price_entity: "Объект цены", currency: "Валюта", price_unit: "Цена за", unit_volume: "Объём (m³)", unit_energy: "Энергия (kWh)", conversion_factor: "Коэффициент пересчёта (kWh на m³)",
    leak_section: "Обнаружение утечек", flow_entity: "Датчик расхода", leak_entity: "Датчик протечки", leak_start: "Начало ночного интервала", leak_end: "Конец ночного интервала",
    leak_threshold: "Порог (л/ч для воды)", daily_limit: "Дневной лимит", sources_section: "Источники данных", statistic_id: "Статистика (вместо статистики датчика)",
    today_entity: "Счётчик потребления (за день)", week_entity: "Счётчик потребления (за неделю)", month_entity: "Счётчик потребления (за месяц)", year_entity: "Счётчик потребления (за год)",
    zoom: "Кнопка подробностей", zoom_helper: "Переключает мини-карточку на полную и обратно", language: "Язык", lang_auto: "Автоматически (Home Assistant)",
  },
  uk: {
    meter_water: "Лічильник води", meter_gas: "Лічильник газу", index: "Показники", today: "Сьогодні", week: "Цей тиждень", month: "Цей місяць", year: "Цей рік",
    yesterday: "Учора", last_week: "Минулий тиждень", last_month: "Минулий місяць", last_year: "Минулий рік",
    vs_day: "до вчора", vs_week: "до минулого тижня", vs_month: "до минулого місяця", vs_year: "до минулого року",
    consumption: "Споживання", history: "Історія", night: "Нічний контроль", tab_day: "День", tab_week: "Тиждень", tab_month: "Місяць", tab_year: "Рік",
    average: "У середньому {value}", cost: "Вартість", flow: "Витрата", status_ok: "Норма", status_leak: "Підозра на витік", status_high: "Високе споживання", status_unavailable: "Недоступно",
    leak_alert: "Безперервна витрата всю ніч: щонайменше {value} щогодини з {start} до {end}", leak_sensor: "{name} повідомляє про витік",
    high_alert: "Сьогоднішнє споживання перевищує денний ліміт ({value})", night_window: "Нічний інтервал", night_lowest: "Найнижча година минулої ночі",
    night_threshold: "Поріг тривоги", sensor_ok: "Сухо", sensor_wet: "Виявлено витік", no_stats: "Для цього лічильника ще немає довгострокової статистики", loading: "Завантаження…",
    close: "Закрити", per_hour: "{value}/год", zoom_in: "Докладніше", zoom_out: "Згорнути", no_meter: "Лічильник води чи газу не знайдено", unknown_entity: "Об'єкт не знайдено",
    entity: "Лічильник (датчик показників)", title: "Заголовок", meter_type: "Тип лічильника", type_auto: "Автоматично", type_water: "Вода", type_gas: "Газ", chart_period: "Графік за замовчуванням",
    show_title: "Показувати заголовок", show_subtitle: "Показувати підзаголовок", show_picture: "Показувати зображення лічильника", show_index: "Показувати показники",
    show_consumption: "Показувати споживання", show_comparison: "Порівнювати з попереднім періодом", show_chart: "Показувати графік історії", show_cost: "Показувати вартість",
    leak_detection: "Виявлення витоків", liters: "Малі об'єми води в літрах", collapsed: "Розділи, згорнуті за замовчуванням", cost_section: "Вартість", price: "Ціна за одиницю",
    price_entity: "Об'єкт ціни", currency: "Валюта", price_unit: "Ціна за", unit_volume: "Об'єм (m³)", unit_energy: "Енергія (kWh)", conversion_factor: "Коефіцієнт перерахунку (kWh на m³)",
    leak_section: "Виявлення витоків", flow_entity: "Датчик витрати", leak_entity: "Датчик протікання", leak_start: "Початок нічного інтервалу", leak_end: "Кінець нічного інтервалу",
    leak_threshold: "Поріг (л/год для води)", daily_limit: "Денний ліміт", sources_section: "Джерела даних", statistic_id: "Статистика (замість статистики датчика)",
    today_entity: "Лічильник споживання (денний)", week_entity: "Лічильник споживання (тижневий)", month_entity: "Лічильник споживання (місячний)", year_entity: "Лічильник споживання (річний)",
    zoom: "Кнопка подробиць", zoom_helper: "Перемикає міні-картку на повну й назад", language: "Мова", lang_auto: "Автоматично (Home Assistant)",
  },
  hu: {
    meter_water: "Vízóra", meter_gas: "Gázóra", index: "Mérőállás", today: "Ma", week: "Ezen a héten", month: "Ebben a hónapban", year: "Ebben az évben",
    yesterday: "Tegnap", last_week: "Múlt hét", last_month: "Múlt hónap", last_year: "Tavaly",
    vs_day: "a tegnapihoz képest", vs_week: "a múlt héthez képest", vs_month: "a múlt hónaphoz képest", vs_year: "a tavalyihoz képest",
    consumption: "Fogyasztás", history: "Előzmények", night: "Éjszakai felügyelet", tab_day: "Nap", tab_week: "Hét", tab_month: "Hónap", tab_year: "Év",
    average: "Átlag {value}", cost: "Költség", flow: "Átfolyás", status_ok: "Normál", status_leak: "Szivárgás gyanúja", status_high: "Magas fogyasztás", status_unavailable: "Nem elérhető",
    leak_alert: "Folyamatos átfolyás egész éjjel: óránként legalább {value} {start} és {end} között", leak_sensor: "{name} szivárgást jelez",
    high_alert: "A mai fogyasztás meghaladja a napi korlátot ({value})", night_window: "Éjszakai időszak", night_lowest: "Legalacsonyabb óra az éjjel",
    night_threshold: "Riasztási küszöb", sensor_ok: "Száraz", sensor_wet: "Szivárgás észlelve", no_stats: "Ehhez a mérőhöz még nincs hosszú távú statisztika", loading: "Betöltés…",
    close: "Bezárás", per_hour: "{value}/óra", zoom_in: "Részletek", zoom_out: "Kevesebb", no_meter: "Nem található víz- vagy gázóra", unknown_entity: "Az entitás nem található",
    entity: "Mérő (mérőállás-érzékelő)", title: "Cím", meter_type: "Mérő típusa", type_auto: "Automatikus", type_water: "Víz", type_gas: "Gáz", chart_period: "Alapértelmezett diagram",
    show_title: "Cím megjelenítése", show_subtitle: "Alcím megjelenítése", show_picture: "A mérő képének megjelenítése", show_index: "Mérőállás megjelenítése",
    show_consumption: "Fogyasztás megjelenítése", show_comparison: "Összevetés az előző időszakkal", show_chart: "Előzménydiagram megjelenítése", show_cost: "Költség megjelenítése",
    leak_detection: "Szivárgásérzékelés", liters: "Kis vízmennyiségek literben", collapsed: "Alapértelmezetten összecsukott szakaszok", cost_section: "Költség", price: "Egységár",
    price_entity: "Ár entitás", currency: "Pénznem", price_unit: "Ár / egység", unit_volume: "Térfogat (m³)", unit_energy: "Energia (kWh)", conversion_factor: "Átváltási tényező (kWh / m³)",
    leak_section: "Szivárgásérzékelés", flow_entity: "Átfolyásérzékelő", leak_entity: "Szivárgásérzékelő", leak_start: "Az éjszakai időszak kezdete", leak_end: "Az éjszakai időszak vége",
    leak_threshold: "Küszöb (L/óra víz esetén)", daily_limit: "Napi korlát", sources_section: "Adatforrások", statistic_id: "Statisztika (az érzékelőé helyett)",
    today_entity: "Fogyasztásmérő (napi)", week_entity: "Fogyasztásmérő (heti)", month_entity: "Fogyasztásmérő (havi)", year_entity: "Fogyasztásmérő (éves)",
    zoom: "Részletek gomb", zoom_helper: "A mini kártyát a teljes kártyára váltja és vissza", language: "Nyelv", lang_auto: "Automatikus (Home Assistant)",
  },
  sk: {
    meter_water: "Vodomer", meter_gas: "Plynomer", index: "Stav meradla", today: "Dnes", week: "Tento týždeň", month: "Tento mesiac", year: "Tento rok",
    yesterday: "Včera", last_week: "Minulý týždeň", last_month: "Minulý mesiac", last_year: "Minulý rok",
    vs_day: "oproti včerajšku", vs_week: "oproti minulému týždňu", vs_month: "oproti minulému mesiacu", vs_year: "oproti minulému roku",
    consumption: "Spotreba", history: "História", night: "Nočný dohľad", tab_day: "Deň", tab_week: "Týždeň", tab_month: "Mesiac", tab_year: "Rok",
    average: "Priemer {value}", cost: "Náklady", flow: "Prietok", status_ok: "Normálne", status_leak: "Podozrenie na únik", status_high: "Vysoká spotreba", status_unavailable: "Nedostupné",
    leak_alert: "Nepretržitý prietok celú noc: aspoň {value} každú hodinu od {start} do {end}", leak_sensor: "{name} hlási únik",
    high_alert: "Dnešná spotreba prekračuje denný limit ({value})", night_window: "Nočné okno", night_lowest: "Najnižšia hodina minulej noci",
    night_threshold: "Prah upozornenia", sensor_ok: "Sucho", sensor_wet: "Zistený únik", no_stats: "Pre toto meradlo zatiaľ nie sú dlhodobé štatistiky", loading: "Načítava sa…",
    close: "Zavrieť", per_hour: "{value}/h", zoom_in: "Zobraziť podrobnosti", zoom_out: "Zobraziť menej", no_meter: "Nenašiel sa žiadny vodomer ani plynomer", unknown_entity: "Entita sa nenašla",
    entity: "Meradlo (senzor stavu)", title: "Názov", meter_type: "Typ meradla", type_auto: "Automaticky", type_water: "Voda", type_gas: "Plyn", chart_period: "Predvolený graf",
    show_title: "Zobraziť názov", show_subtitle: "Zobraziť podnadpis", show_picture: "Zobraziť obrázok meradla", show_index: "Zobraziť stav meradla",
    show_consumption: "Zobraziť spotrebu", show_comparison: "Porovnať s predchádzajúcim obdobím", show_chart: "Zobraziť graf histórie", show_cost: "Zobraziť náklady",
    leak_detection: "Detekcia únikov", liters: "Malé množstvá vody v litroch", collapsed: "Predvolene zbalené sekcie", cost_section: "Náklady", price: "Cena za jednotku",
    price_entity: "Entita ceny", currency: "Mena", price_unit: "Cena za", unit_volume: "Objem (m³)", unit_energy: "Energia (kWh)", conversion_factor: "Prepočítavací koeficient (kWh na m³)",
    leak_section: "Detekcia únikov", flow_entity: "Senzor prietoku", leak_entity: "Senzor úniku", leak_start: "Začiatok nočného okna", leak_end: "Koniec nočného okna",
    leak_threshold: "Prah (L/h pre vodu)", daily_limit: "Denný limit", sources_section: "Zdroje údajov", statistic_id: "Štatistika (namiesto štatistiky senzora)",
    today_entity: "Merač spotreby (denný)", week_entity: "Merač spotreby (týždenný)", month_entity: "Merač spotreby (mesačný)", year_entity: "Merač spotreby (ročný)",
    zoom: "Tlačidlo podrobností", zoom_helper: "Prepne mini kartu na úplnú kartu a späť", language: "Jazyk", lang_auto: "Automaticky (Home Assistant)",
  },
  cs: {
    meter_water: "Vodoměr", meter_gas: "Plynoměr", index: "Stav měřidla", today: "Dnes", week: "Tento týden", month: "Tento měsíc", year: "Letos",
    yesterday: "Včera", last_week: "Minulý týden", last_month: "Minulý měsíc", last_year: "Loni",
    vs_day: "oproti včerejšku", vs_week: "oproti minulému týdnu", vs_month: "oproti minulému měsíci", vs_year: "oproti loňsku",
    consumption: "Spotřeba", history: "Historie", night: "Noční dohled", tab_day: "Den", tab_week: "Týden", tab_month: "Měsíc", tab_year: "Rok",
    average: "Průměr {value}", cost: "Náklady", flow: "Průtok", status_ok: "Normální", status_leak: "Podezření na únik", status_high: "Vysoká spotřeba", status_unavailable: "Nedostupné",
    leak_alert: "Nepřetržitý průtok celou noc: alespoň {value} každou hodinu od {start} do {end}", leak_sensor: "{name} hlásí únik",
    high_alert: "Dnešní spotřeba překračuje denní limit ({value})", night_window: "Noční okno", night_lowest: "Nejnižší hodina minulé noci",
    night_threshold: "Práh upozornění", sensor_ok: "Sucho", sensor_wet: "Zjištěn únik", no_stats: "Pro toto měřidlo zatím nejsou dlouhodobé statistiky", loading: "Načítání…",
    close: "Zavřít", per_hour: "{value}/h", zoom_in: "Zobrazit podrobnosti", zoom_out: "Zobrazit méně", no_meter: "Nebyl nalezen žádný vodoměr ani plynoměr", unknown_entity: "Entita nenalezena",
    entity: "Měřidlo (senzor stavu)", title: "Název", meter_type: "Typ měřidla", type_auto: "Automaticky", type_water: "Voda", type_gas: "Plyn", chart_period: "Výchozí graf",
    show_title: "Zobrazit název", show_subtitle: "Zobrazit podnadpis", show_picture: "Zobrazit obrázek měřidla", show_index: "Zobrazit stav měřidla",
    show_consumption: "Zobrazit spotřebu", show_comparison: "Porovnat s předchozím obdobím", show_chart: "Zobrazit graf historie", show_cost: "Zobrazit náklady",
    leak_detection: "Detekce úniků", liters: "Malá množství vody v litrech", collapsed: "Ve výchozím stavu sbalené sekce", cost_section: "Náklady", price: "Cena za jednotku",
    price_entity: "Entita ceny", currency: "Měna", price_unit: "Cena za", unit_volume: "Objem (m³)", unit_energy: "Energie (kWh)", conversion_factor: "Přepočítací koeficient (kWh na m³)",
    leak_section: "Detekce úniků", flow_entity: "Senzor průtoku", leak_entity: "Senzor úniku", leak_start: "Začátek nočního okna", leak_end: "Konec nočního okna",
    leak_threshold: "Práh (L/h pro vodu)", daily_limit: "Denní limit", sources_section: "Zdroje dat", statistic_id: "Statistika (místo statistiky senzoru)",
    today_entity: "Měřič spotřeby (denní)", week_entity: "Měřič spotřeby (týdenní)", month_entity: "Měřič spotřeby (měsíční)", year_entity: "Měřič spotřeby (roční)",
    zoom: "Tlačítko podrobností", zoom_helper: "Přepne mini kartu na úplnou kartu a zpět", language: "Jazyk", lang_auto: "Automaticky (Home Assistant)",
  },
  sl: {
    meter_water: "Vodomer", meter_gas: "Plinomer", index: "Stanje števca", today: "Danes", week: "Ta teden", month: "Ta mesec", year: "Letos",
    yesterday: "Včeraj", last_week: "Prejšnji teden", last_month: "Prejšnji mesec", last_year: "Lani",
    vs_day: "glede na včeraj", vs_week: "glede na prejšnji teden", vs_month: "glede na prejšnji mesec", vs_year: "glede na lani",
    consumption: "Poraba", history: "Zgodovina", night: "Nočni nadzor", tab_day: "Dan", tab_week: "Teden", tab_month: "Mesec", tab_year: "Leto",
    average: "Povprečje {value}", cost: "Strošek", flow: "Pretok", status_ok: "Normalno", status_leak: "Sum puščanja", status_high: "Visoka poraba", status_unavailable: "Ni na voljo",
    leak_alert: "Neprekinjen pretok vso noč: vsaj {value} vsako uro od {start} do {end}", leak_sensor: "{name} javlja puščanje",
    high_alert: "Današnja poraba presega dnevno omejitev ({value})", night_window: "Nočno okno", night_lowest: "Najnižja ura pretekle noči",
    night_threshold: "Prag opozorila", sensor_ok: "Suho", sensor_wet: "Zaznano puščanje", no_stats: "Za ta števec še ni dolgoročne statistike", loading: "Nalaganje…",
    close: "Zapri", per_hour: "{value}/h", zoom_in: "Prikaži podrobnosti", zoom_out: "Prikaži manj", no_meter: "Ni najdenega vodomera ali plinomera", unknown_entity: "Entitete ni mogoče najti",
    entity: "Števec (senzor stanja)", title: "Naslov", meter_type: "Vrsta števca", type_auto: "Samodejno", type_water: "Voda", type_gas: "Plin", chart_period: "Privzeti graf",
    show_title: "Prikaži naslov", show_subtitle: "Prikaži podnaslov", show_picture: "Prikaži sliko števca", show_index: "Prikaži stanje števca",
    show_consumption: "Prikaži porabo", show_comparison: "Primerjaj s prejšnjim obdobjem", show_chart: "Prikaži graf zgodovine", show_cost: "Prikaži strošek",
    leak_detection: "Zaznavanje puščanja", liters: "Majhne količine vode v litrih", collapsed: "Privzeto strnjeni razdelki", cost_section: "Strošek", price: "Cena na enoto",
    price_entity: "Entiteta cene", currency: "Valuta", price_unit: "Cena na", unit_volume: "Prostornina (m³)", unit_energy: "Energija (kWh)", conversion_factor: "Pretvorbeni faktor (kWh na m³)",
    leak_section: "Zaznavanje puščanja", flow_entity: "Senzor pretoka", leak_entity: "Senzor puščanja", leak_start: "Začetek nočnega okna", leak_end: "Konec nočnega okna",
    leak_threshold: "Prag (L/h za vodo)", daily_limit: "Dnevna omejitev", sources_section: "Viri podatkov", statistic_id: "Statistika (namesto statistike senzorja)",
    today_entity: "Števec porabe (dnevni)", week_entity: "Števec porabe (tedenski)", month_entity: "Števec porabe (mesečni)", year_entity: "Števec porabe (letni)",
    zoom: "Gumb za podrobnosti", zoom_helper: "Preklopi mini kartico na polno kartico in nazaj", language: "Jezik", lang_auto: "Samodejno (Home Assistant)",
  },
  lv: {
    meter_water: "Ūdens skaitītājs", meter_gas: "Gāzes skaitītājs", index: "Rādījums", today: "Šodien", week: "Šonedēļ", month: "Šomēnes", year: "Šogad",
    yesterday: "Vakar", last_week: "Pagājušajā nedēļā", last_month: "Pagājušajā mēnesī", last_year: "Pagājušajā gadā",
    vs_day: "salīdzinot ar vakardienu", vs_week: "salīdzinot ar pagājušo nedēļu", vs_month: "salīdzinot ar pagājušo mēnesi", vs_year: "salīdzinot ar pagājušo gadu",
    consumption: "Patēriņš", history: "Vēsture", night: "Nakts uzraudzība", tab_day: "Diena", tab_week: "Nedēļa", tab_month: "Mēnesis", tab_year: "Gads",
    average: "Vidēji {value}", cost: "Izmaksas", flow: "Plūsma", status_ok: "Normāli", status_leak: "Aizdomas par noplūdi", status_high: "Liels patēriņš", status_unavailable: "Nav pieejams",
    leak_alert: "Nepārtraukta plūsma visu nakti: vismaz {value} katru stundu no {start} līdz {end}", leak_sensor: "{name} ziņo par noplūdi",
    high_alert: "Šodienas patēriņš pārsniedz dienas limitu ({value})", night_window: "Nakts periods", night_lowest: "Zemākā stunda pagājušajā naktī",
    night_threshold: "Brīdinājuma slieksnis", sensor_ok: "Sauss", sensor_wet: "Konstatēta noplūde", no_stats: "Šim skaitītājam vēl nav ilgtermiņa statistikas", loading: "Ielādē…",
    close: "Aizvērt", per_hour: "{value}/h", zoom_in: "Rādīt detaļas", zoom_out: "Rādīt mazāk", no_meter: "Nav atrasts neviens ūdens vai gāzes skaitītājs", unknown_entity: "Entītija nav atrasta",
    entity: "Skaitītājs (rādījuma sensors)", title: "Virsraksts", meter_type: "Skaitītāja veids", type_auto: "Automātiski", type_water: "Ūdens", type_gas: "Gāze", chart_period: "Noklusējuma diagramma",
    show_title: "Rādīt virsrakstu", show_subtitle: "Rādīt apakšvirsrakstu", show_picture: "Rādīt skaitītāja attēlu", show_index: "Rādīt rādījumu",
    show_consumption: "Rādīt patēriņu", show_comparison: "Salīdzināt ar iepriekšējo periodu", show_chart: "Rādīt vēstures diagrammu", show_cost: "Rādīt izmaksas",
    leak_detection: "Noplūžu noteikšana", liters: "Nelielus ūdens daudzumus litros", collapsed: "Pēc noklusējuma sakļautās sadaļas", cost_section: "Izmaksas", price: "Vienības cena",
    price_entity: "Cenas entītija", currency: "Valūta", price_unit: "Cena par", unit_volume: "Tilpums (m³)", unit_energy: "Enerģija (kWh)", conversion_factor: "Pārrēķina koeficients (kWh uz m³)",
    leak_section: "Noplūžu noteikšana", flow_entity: "Plūsmas sensors", leak_entity: "Noplūdes sensors", leak_start: "Nakts perioda sākums", leak_end: "Nakts perioda beigas",
    leak_threshold: "Slieksnis (L/h ūdenim)", daily_limit: "Dienas limits", sources_section: "Datu avoti", statistic_id: "Statistika (sensora statistikas vietā)",
    today_entity: "Patēriņa skaitītājs (dienas)", week_entity: "Patēriņa skaitītājs (nedēļas)", month_entity: "Patēriņa skaitītājs (mēneša)", year_entity: "Patēriņa skaitītājs (gada)",
    zoom: "Detaļu poga", zoom_helper: "Pārslēdz mini karti uz pilno karti un atpakaļ", language: "Valoda", lang_auto: "Automātiski (Home Assistant)",
  },
  el: {
    meter_water: "Μετρητής νερού", meter_gas: "Μετρητής αερίου", index: "Ένδειξη", today: "Σήμερα", week: "Αυτή την εβδομάδα", month: "Αυτόν τον μήνα", year: "Φέτος",
    yesterday: "Χθες", last_week: "Προηγούμενη εβδομάδα", last_month: "Προηγούμενος μήνας", last_year: "Πέρσι",
    vs_day: "σε σχέση με χθες", vs_week: "σε σχέση με την προηγούμενη εβδομάδα", vs_month: "σε σχέση με τον προηγούμενο μήνα", vs_year: "σε σχέση με πέρσι",
    consumption: "Κατανάλωση", history: "Ιστορικό", night: "Νυχτερινή επιτήρηση", tab_day: "Ημέρα", tab_week: "Εβδομάδα", tab_month: "Μήνας", tab_year: "Έτος",
    average: "Μέσος όρος {value}", cost: "Κόστος", flow: "Ροή", status_ok: "Κανονικά", status_leak: "Πιθανή διαρροή", status_high: "Υψηλή κατανάλωση", status_unavailable: "Μη διαθέσιμο",
    leak_alert: "Συνεχής ροή όλη τη νύχτα: τουλάχιστον {value} κάθε ώρα από {start} έως {end}", leak_sensor: "Ο αισθητήρας {name} αναφέρει διαρροή",
    high_alert: "Η σημερινή κατανάλωση υπερβαίνει το ημερήσιο όριο ({value})", night_window: "Νυχτερινό διάστημα", night_lowest: "Χαμηλότερη ώρα χθες βράδυ",
    night_threshold: "Όριο ειδοποίησης", sensor_ok: "Στεγνό", sensor_wet: "Εντοπίστηκε διαρροή", no_stats: "Δεν υπάρχουν ακόμη μακροπρόθεσμα στατιστικά για αυτόν τον μετρητή", loading: "Φόρτωση…",
    close: "Κλείσιμο", per_hour: "{value}/ώρα", zoom_in: "Εμφάνιση λεπτομερειών", zoom_out: "Λιγότερα", no_meter: "Δεν βρέθηκε μετρητής νερού ή αερίου", unknown_entity: "Η οντότητα δεν βρέθηκε",
    entity: "Μετρητής (αισθητήρας ένδειξης)", title: "Τίτλος", meter_type: "Τύπος μετρητή", type_auto: "Αυτόματα", type_water: "Νερό", type_gas: "Αέριο", chart_period: "Προεπιλεγμένο γράφημα",
    show_title: "Εμφάνιση τίτλου", show_subtitle: "Εμφάνιση υπότιτλου", show_picture: "Εμφάνιση εικόνας μετρητή", show_index: "Εμφάνιση ένδειξης",
    show_consumption: "Εμφάνιση κατανάλωσης", show_comparison: "Σύγκριση με την προηγούμενη περίοδο", show_chart: "Εμφάνιση γραφήματος ιστορικού", show_cost: "Εμφάνιση κόστους",
    leak_detection: "Ανίχνευση διαρροών", liters: "Μικρές ποσότητες νερού σε λίτρα", collapsed: "Ενότητες συμπτυγμένες από προεπιλογή", cost_section: "Κόστος", price: "Τιμή ανά μονάδα",
    price_entity: "Οντότητα τιμής", currency: "Νόμισμα", price_unit: "Τιμή ανά", unit_volume: "Όγκος (m³)", unit_energy: "Ενέργεια (kWh)", conversion_factor: "Συντελεστής μετατροπής (kWh ανά m³)",
    leak_section: "Ανίχνευση διαρροών", flow_entity: "Αισθητήρας ροής", leak_entity: "Αισθητήρας διαρροής", leak_start: "Αρχή νυχτερινού διαστήματος", leak_end: "Τέλος νυχτερινού διαστήματος",
    leak_threshold: "Όριο (L/ώρα για νερό)", daily_limit: "Ημερήσιο όριο", sources_section: "Πηγές δεδομένων", statistic_id: "Στατιστικό (αντί του αισθητήρα)",
    today_entity: "Μετρητής κατανάλωσης (ημερήσιος)", week_entity: "Μετρητής κατανάλωσης (εβδομαδιαίος)", month_entity: "Μετρητής κατανάλωσης (μηνιαίος)", year_entity: "Μετρητής κατανάλωσης (ετήσιος)",
    zoom: "Κουμπί λεπτομερειών", zoom_helper: "Εναλλάσσει τη μίνι κάρτα με την πλήρη κάρτα", language: "Γλώσσα", lang_auto: "Αυτόματα (Home Assistant)",
  },
};

const LANGUAGES = [
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const lang = (hass, config) => {
  const l = config?.language || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: the card's language option, else Home Assistant's full locale (keeps its region, e.g. pt-BR,
// de-CH) when its base matches the card language. A bare "pt" (European Portuguese) becomes "pt-PT".
const intlLocale = (hass, config) => {
  const l = lang(hass, config);
  const src = config?.language || (hass && (hass.locale?.language || hass.language)) || "";
  const out = src && src.split("-")[0] === l.split("-")[0] ? src : l;
  return out === "pt" ? "pt-PT" : out;
};

const t = (hass, config, key, vars = {}) =>
  String(STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const valid = (s) => !!s && !["unknown", "unavailable", ""].includes(s.state);
const num = (s) => {
  if (!valid(s)) return null;
  const v = parseFloat(s.state);
  return Number.isFinite(v) ? v : null;
};

const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

// Units: volumes in liters, energies in kWh, so that a value can be moved from one unit to another.
const UNIT_ALIASES = { m3: "m³", l: "L", ft3: "ft³", ccf: "CCF", kwh: "kWh", wh: "Wh", mwh: "MWh", mj: "MJ", gj: "GJ", ml: "mL", gal: "gal" };
const normUnit = (u) => {
  const s = String(u ?? "").trim();
  return UNIT_ALIASES[s.toLowerCase()] || s;
};
const VOLUME_L = { mL: 0.001, L: 1, "m³": 1000, gal: 3.78541, "ft³": 28.3168, CCF: 2831.68 };
const ENERGY_KWH = { Wh: 0.001, kWh: 1, MWh: 1000, MJ: 1 / 3.6, GJ: 1000 / 3.6 };
const convert = (v, from, to) => {
  const f = normUnit(from);
  const tu = normUnit(to);
  if (v === null || v === undefined || f === tu) return v;
  if (f in VOLUME_L && tu in VOLUME_L) return (v * VOLUME_L[f]) / VOLUME_L[tu];
  if (f in ENERGY_KWH && tu in ENERGY_KWH) return (v * ENERGY_KWH[f]) / ENERGY_KWH[tu];
  return v;
};
const isMetricVolume = (u) => ["mL", "L", "m³"].includes(normUnit(u));
const isEnergy = (u) => normUnit(u) in ENERGY_KWH;

const NUM_FMT = {};
const fmtNum = (v, locale, digits = 2, min = 0) =>
  (NUM_FMT[`${locale}|${digits}|${min}`] ??= new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: min })).format(v);

// Fraction digits of a consumption: fewer as the value grows, none for liters.
const digitsFor = (v, unit) => {
  const a = Math.abs(v);
  const u = normUnit(unit);
  if (u === "L" || u === "mL" || u === "Wh") return 0;
  if (isEnergy(u)) return a < 10 ? 1 : 0;
  return a < 10 ? 2 : a < 100 ? 1 : 0;
};

// A consumption with its unit. Metric water volumes read in liters below 1 m³ and in m³ from 1000 L (`liters: false`
// keeps the sensor's unit).
const fmtAmount = (v, unit, locale, { water = false, liters = true } = {}) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  let u = normUnit(unit);
  let x = v;
  if (water && liters && isMetricVolume(u)) {
    const l = convert(v, u, "L");
    if (Math.abs(l) < 1000) [x, u] = [l, "L"];
    else [x, u] = [convert(v, u, "m³"), "m³"];
  }
  return `${fmtNum(x, locale, digitsFor(x, u))}${u ? ` ${u}` : ""}`;
};

const indexDigits = (unit, config) => {
  if (Number.isInteger(config?.index_decimals)) return config.index_decimals;
  const u = normUnit(unit);
  return u === "m³" ? 3 : u === "ft³" || u === "CCF" || u === "gal" ? 1 : 0;
};

const PCT_FMT = {};
const fmtPct = (v, locale) =>
  (PCT_FMT[locale] ??= new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" })).format(v);

const MONEY_FMT = {};
const fmtMoney = (v, currency, locale) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  try {
    return (MONEY_FMT[`${locale}|${currency}`] ??= new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 2 })).format(v);
  } catch (_err) {
    return `${fmtNum(v, locale, 2, 2)} ${currency}`;
  }
};

// "HH:MM" or "HH:MM:SS" (time selector) → minutes after midnight.
const parseTime = (s, fallback) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s ?? ""));
  if (!m || +m[1] > 23 || +m[2] > 59) return parseTime(fallback, "00:00");
  return +m[1] * 60 + +m[2];
};

// Local calendar arithmetic (the browser's time zone, the one Home Assistant's frontend shows).
const startOfDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const addDays = (ms, n) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()).getTime();
};
const atMinutes = (dayMs, minutes) => {
  const d = new Date(dayMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
};
const startOfMonth = (ms, n = 0) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
};
const startOfYear = (ms, n = 0) => new Date(new Date(ms).getFullYear() + n, 0, 1).getTime();
const startOfWeek = (ms, firstDay = 1) => {
  const day = startOfDay(ms);
  return addDays(day, -((new Date(day).getDay() - firstDay + 7) % 7));
};
const FIRST_WEEKDAY = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
// Home Assistant's first day of the week; "language" (its default) follows the locale (Sunday for en-US…).
const firstWeekday = (hass) => {
  const fw = FIRST_WEEKDAY[hass?.locale?.first_weekday];
  if (fw !== undefined) return fw;
  try {
    const loc = new Intl.Locale(hass?.locale?.language || hass?.language || "en");
    const day = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    return Number.isInteger(day) ? day % 7 : 1;
  } catch (_err) {
    return 1;
  }
};

const periodStart = (kind, now, fw) =>
  kind === "day" ? startOfDay(now) : kind === "week" ? startOfWeek(now, fw) : kind === "month" ? startOfMonth(now) : startOfYear(now);
const shiftPeriod = (kind, start, n) =>
  kind === "day" ? addDays(start, n) : kind === "week" ? addDays(start, 7 * n) : kind === "month" ? startOfMonth(start, n) : startOfYear(start, n);

// Statistics rows as { s, e, v }: start and end in ms, `change` as v. Home Assistant sends ms (2023.3+) or ISO strings.
const toMs = (x) => (typeof x === "number" ? (x < 1e11 ? x * 1000 : x) : Date.parse(x));
// `daily`: Home Assistant cuts days at the server's midnight; each daily row is moved to the browser's day holding its
// middle, so that days, weeks and months stay right when the browser is in another time zone than the server.
const statRows = (list, daily = false) =>
  (Array.isArray(list) ? list : [])
    .map((r) => ({ s: toMs(r.start), e: toMs(r.end), v: r.change === null || r.change === undefined ? Number.NaN : Number(r.change) }))
    .filter((r) => Number.isFinite(r.s) && Number.isFinite(r.v))
    .map((r) => {
      const e = Number.isFinite(r.e) && r.e > r.s ? r.e : r.s + (daily ? 24 * HOUR : HOUR);
      if (!daily) return { ...r, e };
      const s = startOfDay((r.s + e) / 2);
      return { ...r, s, e: addDays(s, 1) };
    })
    .sort((a, b) => a.s - b.s);

// End of the data the statistics hold: the last hourly row (a day for an import of daily values at midnight, as
// Suez's or Gazpar's), else the last daily row, never after now. Hourly statistics are compiled after each hour and
// imported ones can be days late, so "so far" means up to there.
const coverageEnd = (stats, now) => {
  const h = stats.hourly;
  if (h.length) {
    const last = h[h.length - 1];
    const before = h[h.length - 2];
    const dayImport = last.s === startOfDay(last.s) && (!before || last.s - before.s >= 23 * HOUR);
    return Math.min(now, dayImport ? addDays(last.s, 1) : last.e);
  }
  return stats.daily.length ? Math.min(now, stats.daily[stats.daily.length - 1].e) : now;
};

// WebSocket answers shared for 30 seconds by the cards of one Home Assistant connection (a card and its mini card on
// the same meter ask once).
const WS_CACHE = new WeakMap();
const sharedWS = (hass, msg) => {
  const owner = hass.connection || hass;
  const cache = WS_CACHE.get(owner) || new Map();
  WS_CACHE.set(owner, cache);
  const key = JSON.stringify(msg);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.promise;
  const promise = hass.callWS(msg);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  for (const [k, v] of cache) if (Date.now() - v.at >= 30000) cache.delete(k);
  return promise;
};

// Rows that start in [from, to), counted whole.
const sumFrom = (rows, from, to) => rows.reduce((a, r) => (r.s >= from && r.s < to ? a + r.v : a), 0);
const anyFrom = (rows, from, to) => rows.some((r) => r.s >= from && r.s < to);
// Rows overlapping [from, to), each counted for the share of its span inside.
const sumOverlap = (rows, from, to) =>
  rows.reduce((a, r) => {
    const o = Math.min(r.e, to) - Math.max(r.s, from);
    return o > 0 ? a + r.v * Math.min(1, o / (r.e - r.s)) : a;
  }, 0);

// Consumption of today (hourly rows, else the daily row of today).
const todayOf = (stats, now) => {
  const day = startOfDay(now);
  return stats.hourly.length ? sumFrom(stats.hourly, day, Infinity) : sumFrom(stats.daily, day, Infinity);
};

// Current period so far and the previous one up to the same point: the same time elapsed since its start as the
// current period's data covers (up to now with `live`, when the current value comes from a live helper), never past
// the previous period's own end (31 March against February).
const periodValues = (stats, kind, now, fw, live = false) => {
  const start = periodStart(kind, now, fw);
  const prev = shiftPeriod(kind, start, -1);
  const day = startOfDay(now);
  const today = todayOf(stats, now);
  const fine = kind === "day" && stats.hourly.length ? stats.hourly : stats.daily;
  const cur = kind === "day" ? today : sumFrom(stats.daily, start, day) + today;
  const elapsed = (live ? now : coverageEnd(stats, now)) - start;
  const has = elapsed > 0 && anyFrom(fine, prev, start);
  return { cur, prev: has ? sumOverlap(fine, prev, Math.min(start, prev + elapsed)) : null, start };
};

// Bars of the history chart: the slots of the current period (hours, days or months) with the same slot of the
// previous period. A slot still to come has no value (null).
const chartSlots = (stats, kind, now, fw) => {
  const start = periodStart(kind, now, fw);
  const day = startOfDay(now);
  const today = todayOf(stats, now);
  const slots = [];
  const cur = (from, to) => (from > now ? null : sumFrom(stats.daily, from, Math.min(to, day)) + (day >= from && day < to ? today : 0));
  if (kind === "day") {
    for (let h = 0; h < 24; h++) {
      const from = start + h * HOUR;
      const value = from > now ? null : sumFrom(stats.hourly, from, from + HOUR);
      const p = addDays(from, -1);
      slots.push({ from, to: from + HOUR, value, prev: sumFrom(stats.hourly, p, p + HOUR) });
    }
  } else if (kind === "week") {
    for (let i = 0; i < 7; i++) {
      const from = addDays(start, i);
      const to = addDays(start, i + 1);
      slots.push({ from, to, value: cur(from, to), prev: sumFrom(stats.daily, addDays(from, -7), addDays(from, -6)) });
    }
  } else if (kind === "month") {
    const end = startOfMonth(start, 1);
    const prevStart = startOfMonth(start, -1);
    for (let from = start, i = 0; from < end; from = addDays(start, ++i)) {
      const to = addDays(start, i + 1);
      const p = addDays(prevStart, i);
      slots.push({ from, to, value: cur(from, to), prev: p < start ? sumFrom(stats.daily, p, addDays(prevStart, i + 1)) : null });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const from = startOfMonth(start, m);
      const to = startOfMonth(start, m + 1);
      slots.push({ from, to, value: cur(from, to), prev: sumFrom(stats.daily, startOfMonth(start, m - 12), startOfMonth(start, m - 11)) });
    }
  }
  return slots;
};

// Night window that ended last: [start, end) in ms, crossing midnight when it starts after it ends (23:00 → 05:00).
const nightWindow = (now, startStr, endStr) => {
  const sm = parseTime(startStr, DEFAULT_LEAK.start);
  const em = parseTime(endStr, DEFAULT_LEAK.end);
  let end = atMinutes(startOfDay(now), em);
  if (end > now) end = atMinutes(addDays(startOfDay(now), -1), em);
  let start = atMinutes(startOfDay(end), sm);
  if (start >= end) start = atMinutes(addDays(startOfDay(end), -1), sm);
  return { start, end };
};

// Leak check on the last night: every hour of the window used at least `threshold` (sensor unit per hour).
// null when the hourly statistics do not cover the window: its first and last hours must have a row (not compiled yet,
// imported data a day late, or daily values only).
const nightCheck = (stats, now, startStr, endStr, threshold) => {
  const { start, end } = nightWindow(now, startStr, endStr);
  if (!stats.hourly.length || stats.hourly[0].s > start) return null;
  if (!anyFrom(stats.hourly, start, start + HOUR) || !anyFrom(stats.hourly, end - HOUR, end)) return null;
  const hours = [];
  for (let h = start; h < end; h += HOUR) hours.push(sumFrom(stats.hourly, h, h + HOUR));
  if (!hours.length) return null;
  const lowest = Math.min(...hours);
  return { start, end, hours, lowest, leak: lowest >= threshold && lowest > 0 };
};

// Water threshold is given in L/h: moved to the sensor's unit. Gas: already in the sensor's unit per hour.
const leakThreshold = (config, type, unit) => {
  const v = Number(config.leak_threshold ?? DEFAULT_LEAK[type]);
  const x = Number.isFinite(v) && v > 0 ? v : DEFAULT_LEAK[type];
  return type === "water" && normUnit(unit) in VOLUME_L ? convert(x, "L", unit) : x;
};

const meterOf = (s) => {
  const dc = s?.attributes?.device_class;
  return s?.entity_id?.startsWith("sensor.") && (dc === "water" || dc === "gas");
};
// Meters first: a cumulative sensor (state_class total / total_increasing), water before gas.
const listMeters = (hass) =>
  Object.values(hass?.states || {})
    .filter(meterOf)
    .sort((a, b) => {
      const rank = (s) => (["total", "total_increasing"].includes(s.attributes.state_class) ? 0 : 2) + (s.attributes.device_class === "water" ? 0 : 1);
      return rank(a) - rank(b) || a.entity_id.localeCompare(b.entity_id);
    });

// utility_meter helpers fed by this meter, by period: { day: entity_id, … }.
const UM_PERIODS = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
const utilityMeters = (hass, entity) => {
  const out = {};
  for (const s of Object.values(hass?.states || {})) {
    const a = s.attributes || {};
    const p = UM_PERIODS[a.meter_period];
    if (p && a.source === entity && s.entity_id.startsWith("sensor.") && !out[p]) out[p] = s.entity_id;
  }
  return out;
};

const isOutside = (card, ev) => {
  const path = ev.composedPath();
  return !path.includes(card) && !path.some((n) => ["HA-MORE-INFO-DIALOG", "HA-DIALOG", "DIALOG"].includes(n.tagName));
};

// ---------------------------------------------------------------------------
// Drawn meters (inline SVG, so that their animations run in the card): a brass water meter on its pipe and a gas meter
// cabinet. `active`: water or gas flowing right now (the flow sensor, else the statistics of the current hour) — the
// water meter's star wheel spins and water ripples along the pipe, the gas meter's last digit rolls and its flame
// flickers. `leak`: drops fall from the pipe joint into a growing puddle, the meter pulses red.
// ---------------------------------------------------------------------------

const digitsOf = (v, n) => (v === null ? "-".repeat(n) : String(Math.floor(Math.abs(v)) % 10 ** n).padStart(n, "0"));

const waterArt = (index) =>
  '<svg viewBox="0 0 80 88" aria-hidden="true"><defs>' +
  '<radialGradient id="um-brass" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#f3d58a"/><stop offset=".55" stop-color="#c9973c"/><stop offset="1" stop-color="#8a6420"/></radialGradient>' +
  '<linearGradient id="um-pipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe4ea"/><stop offset=".5" stop-color="#aab3bd"/><stop offset="1" stop-color="#7d8792"/></linearGradient>' +
  '<radialGradient id="um-glass" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e9ef"/></radialGradient></defs>' +
  '<ellipse class="puddle" cx="62" cy="84" rx="12" ry="2.6"/>' +
  '<rect x="0" y="58" width="80" height="12" rx="2" fill="url(#um-pipe)"/>' +
  '<g class="ripples"><path d="M6 64h7M30 64h6M54 64h7"/></g>' +
  '<rect x="8" y="55" width="7" height="18" rx="1.5" fill="#c9973c" stroke="#8a6420" stroke-width=".6"/>' +
  '<rect x="65" y="55" width="7" height="18" rx="1.5" fill="#c9973c" stroke="#8a6420" stroke-width=".6"/>' +
  '<path class="drop" d="M62 72c0 0-2.2 3-2.2 4.4a2.2 2.2 0 0 0 4.4 0c0-1.4-2.2-4.4-2.2-4.4z"/>' +
  '<circle class="halo" cx="40" cy="34" r="30"/>' +
  '<circle cx="40" cy="34" r="27" fill="url(#um-brass)" stroke="#7a5518" stroke-width="1"/>' +
  '<circle cx="40" cy="34" r="21" fill="url(#um-glass)" stroke="#9aa5b1" stroke-width=".8"/>' +
  '<rect x="27" y="22" width="26" height="8" rx="1.5" fill="#1d2632"/>' +
  `<text class="digits" x="40" y="28.3" text-anchor="middle">${esc(digitsOf(index, 5))}</text>` +
  '<g stroke="#9aa5b1" stroke-width=".7"><path d="M40 14.5v2.5M40 51v2.5M20.5 34H23M57 34h2.5"/></g>' +
  '<g class="star" transform="translate(40 41)"><path d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z" fill="#e53935"/><circle r="1.3" fill="#fff"/></g>' +
  "</svg>";

const gasArt = (index) =>
  '<svg viewBox="0 0 80 88" aria-hidden="true"><defs>' +
  '<linearGradient id="um-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6ea"/><stop offset="1" stop-color="#ddd3bd"/></linearGradient>' +
  '<linearGradient id="um-gpipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2c25a"/><stop offset=".5" stop-color="#fbe58a"/><stop offset="1" stop-color="#c9a332"/></linearGradient>' +
  '<clipPath id="um-roll"><rect x="51" y="19" width="6" height="9"/></clipPath></defs>' +
  '<rect x="24" y="66" width="7" height="22" fill="url(#um-gpipe)"/><rect x="49" y="66" width="7" height="22" fill="url(#um-gpipe)"/>' +
  '<rect class="halo" x="7" y="1" width="66" height="70" rx="10"/>' +
  '<rect x="11" y="5" width="58" height="62" rx="7" fill="url(#um-box)" stroke="#bfb397" stroke-width="1"/>' +
  '<rect x="17" y="15" width="46" height="17" rx="2.5" fill="#1d2632"/>' +
  `<text class="digits" x="34" y="26.2" text-anchor="middle">${esc(digitsOf(index, 5).slice(0, 4))}</text>` +
  `<g clip-path="url(#um-roll)"><g class="roll"><text class="digits red" x="54" y="26.2" text-anchor="middle">${esc(digitsOf(index, 1))}</text><text class="digits red" x="54" y="35.2" text-anchor="middle">${esc(String((Math.floor(Math.abs(index ?? 0)) + 1) % 10))}</text></g></g>` +
  '<rect x="17" y="38" width="46" height="5" rx="2.5" fill="#cfc4aa"/>' +
  '<circle cx="54" cy="55" r="7" fill="#fff" stroke="#bfb397" stroke-width=".8"/>' +
  '<path class="flame" d="M54 49.5c.5 2.2-1 3.2-2 4.5-1 1.3-1.7 2.4-1.7 3.9 0 2.1 1.6 3.6 3.7 3.6s3.7-1.5 3.7-3.6c0-1.6-.7-2.7-1.4-3.7-.2.9-.6 1.6-1.3 1.9.2-1.9-.2-4.2-1-6.6z"/>' +
  '<rect x="19" y="50" width="22" height="2.4" rx="1.2" fill="#d9cfb7"/><rect x="19" y="55" width="16" height="2.4" rx="1.2" fill="#d9cfb7"/>' +
  "</svg>";

const ART_STYLE = `
  .picture { flex: none; display: flex; align-items: center; justify-content: center; }
  .picture svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 3px 6px rgba(0,0,0,.18)); }
  .picture .digits { font: 600 6.4px/1 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; fill: #e8f1f8; letter-spacing: .4px; }
  .picture .digits.red { fill: #ff8a80; }
  .picture .ripples path { fill: none; stroke: #e3f2fd; stroke-width: 1.6; stroke-linecap: round; opacity: 0; }
  .picture .star { transform-box: view-box; }
  .picture .drop { fill: #4fc3f7; opacity: 0; }
  .picture .puddle { fill: #4fc3f7; opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .picture .halo { fill: none; stroke: var(--um-crit); stroke-width: 2.5; opacity: 0; transform-box: fill-box; transform-origin: 50% 50%; }
  .picture .flame { fill: #b0bec5; transform-box: fill-box; transform-origin: 50% 100%; }
  .picture.active .ripples path { animation: um-ripple 1.5s linear infinite; }
  .picture.active .ripples path:nth-child(2) { animation-delay: -.5s; }
  .picture.active .ripples path:nth-child(3) { animation-delay: -1s; }
  .picture.active .star { animation: um-spin 1.5s linear infinite; }
  .picture.active .flame { fill: #ff9800; animation: um-flame 1s ease-in-out infinite; }
  .picture.active .roll { animation: um-roll 3s ease-in-out infinite; }
  .picture.leak .drop { animation: um-drip 1.5s ease-in infinite; }
  .picture.leak .puddle { animation: um-puddle 3s ease-in-out infinite; }
  .picture.leak .halo { animation: um-halo 1.5s ease-out infinite; }
  @keyframes um-ripple { 0% { opacity: 0; transform: translateX(-4px); } 25% { opacity: .9; } 75% { opacity: .9; } 100% { opacity: 0; transform: translateX(14px); } }
  @keyframes um-spin { from { transform: translate(40px, 41px) rotate(0deg); } to { transform: translate(40px, 41px) rotate(360deg); } }
  @keyframes um-flame { 0%, 100% { transform: scale(1, 1); } 30% { transform: scale(.9, 1.12); } 60% { transform: scale(1.06, .92); } }
  @keyframes um-roll { 0%, 40% { transform: translateY(0); } 60%, 100% { transform: translateY(-9px); } }
  @keyframes um-drip { 0% { opacity: 0; transform: translateY(-2px); } 15% { opacity: 1; } 85% { opacity: 1; transform: translateY(8px); } 100% { opacity: 0; transform: translateY(9px); } }
  @keyframes um-puddle { 0%, 100% { opacity: .45; transform: scale(.75, 1); } 50% { opacity: .7; transform: scale(1, 1); } }
  @keyframes um-halo { 0% { opacity: .8; transform: scale(.94); } 100% { opacity: 0; transform: scale(1.08); } }
`;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BASE_STYLE = `
  :host { --um-accent: #0288d1; --um-ok: var(--success-color, #43a047); --um-warn: var(--warning-color, #ffa600);
          --um-crit: var(--error-color, #db4437); --um-idle: var(--disabled-text-color, #9e9e9e);
          /* Text in a state or accent color is mixed with the text color so that it reads at 4.5:1 at least. */
          --um-accent-text: color-mix(in srgb, var(--um-accent) 55%, var(--primary-text-color)); }
  ha-card { overflow: hidden; container-type: inline-size; }
  /* A size container has no width of its own content: this empty, zero-height grid gives the card a natural width
     without any minimum, so it neither falls to its borders in a shrink-to-fit parent nor overflows a narrow track. */
  :host { display: block; min-width: 0; --um-natural-width: 360px; }
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--um-natural-width)); height: 0; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  [role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color, var(--um-accent)); outline-offset: 2px; border-radius: 6px; }
  .ok { --c: var(--um-ok); } .warn { --c: var(--um-warn); } .crit { --c: var(--um-crit); } .idle { --c: var(--um-idle); }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 0; }
  .type-icon { position: relative; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
               --um-tint: var(--c, var(--um-accent)); background: color-mix(in srgb, var(--um-tint) 16%, transparent); transition: background-color .3s ease; }
  .type-icon .icon { width: 24px; height: 24px; fill: var(--um-accent); transition: fill .3s ease; }
  .type-icon:is(.warn, .crit) .icon { fill: color-mix(in srgb, var(--um-tint) 65%, var(--primary-text-color)); }
  .titles { flex: 1 1 0; min-width: 5ch; align-self: center; }
  :host([hide-title]) .titles > .name, :host([hide-subtitle]) .titles > .sub { display: none; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Status pill, at the right of the header, on the line of the title. */
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap;
          background: color-mix(in srgb, var(--c, var(--um-ok)) 15%, transparent); color: color-mix(in srgb, var(--c, var(--um-ok)) 50%, var(--primary-text-color));
          flex: 0 1 auto; min-width: 0; max-width: 50%; overflow: hidden; box-sizing: border-box; align-self: flex-start; margin-top: 2px; }
  .chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--um-ok)); flex: none; display: inline-block; }
  .warning { padding: 16px; color: color-mix(in srgb, var(--um-warn) 50%, var(--primary-text-color)); }
  .alert { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 10px; font-size: 13px; line-height: 1.35;
           border: 1px solid color-mix(in srgb, var(--c, var(--um-crit)) 45%, transparent);
           background: color-mix(in srgb, var(--c, var(--um-crit)) 10%, transparent);
           color: color-mix(in srgb, var(--c, var(--um-crit)) 50%, var(--primary-text-color)); }
  .alert .icon { width: 18px; height: 18px; color: var(--c, var(--um-crit)); }
  .alert.crit .icon { animation: um-pulse 1.5s ease-in-out infinite; transform-origin: 50% 60%; }
  @keyframes um-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: .55; } }
  .delta { display: inline-flex; align-items: center; gap: 1px; font-size: 11px; white-space: nowrap; color: var(--secondary-text-color); min-width: 0; overflow: hidden; }
  .delta .icon { width: 14px; height: 14px; margin: 0 -2px; }
  .delta.up { color: color-mix(in srgb, var(--um-warn) 55%, var(--primary-text-color)); }
  .delta.down { color: color-mix(in srgb, var(--um-ok) 55%, var(--primary-text-color)); }
  .delta span { overflow: hidden; text-overflow: ellipsis; }
  /* Smoked-glass buttons: outline, never filled; the accent marks the active one. */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500;
         padding: 5px 12px; border-radius: 16px; color: var(--primary-text-color); min-width: 0;
         background: color-mix(in srgb, var(--primary-text-color) 4%, transparent); border: 1px solid var(--divider-color, rgba(127,127,127,.3)); }
  .btn:hover { background: color-mix(in srgb, var(--um-accent) 8%, transparent); }
  .btn.primary { color: var(--um-accent-text); border-color: color-mix(in srgb, var(--um-accent) 55%, transparent); }
  .btn.primary .icon { color: var(--um-accent); }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: 0 -4px 0 0; border-radius: 50%; align-self: flex-start; margin-top: 0;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--um-idle) 16%, transparent); color: var(--primary-text-color); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
  /* Narrow card: the status pill keeps only its dot (its text stays in title and aria-label). */
  @container (max-width: 230px) {
    .chip { padding: 4px; flex: none; }
    .chip-text { display: none; }
    .header { gap: 6px; }
  }
`;

// In-card popup: a backdrop over the card with a small dialog at the top of the card, so that it stays in view.
const DIALOG_STYLE = `
  ha-card.dialog-open { position: relative; min-height: 180px; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 12px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); width: min(92%, 320px); max-height: calc(100% - 24px);
           box-sizing: border-box; border-radius: 14px; padding: 14px 16px; box-shadow: 0 8px 30px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 8px; }
  .modal .msg { font-size: 15px; font-weight: 500; }
  .modal .row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
  .modal .row .k { color: var(--secondary-text-color); }
  .modal .row .v { font-weight: 500; text-align: right; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
`;

const FULL_STYLE = `
  .content { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 12px; }
  .hero { display: flex; align-items: center; gap: 12px; }
  .hero .picture { width: 96px; height: 104px; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; max-width: 100%; }
  .line .icon { width: 16px; height: 16px; }
  .line span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line.crit { color: color-mix(in srgb, var(--um-crit) 55%, var(--primary-text-color)); }
  .line.crit .icon { color: var(--um-crit); }
  .index { min-width: 0; max-width: 100%; }
  .index .k { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
  .index .v { font-size: 28px; line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .index .v small { font-size: 14px; color: var(--secondary-text-color); margin-left: 4px; }
  .flow { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border-radius: 14px; white-space: nowrap;
          border: 1px solid var(--divider-color, rgba(127,127,127,.3)); color: var(--secondary-text-color); }
  .flow .icon { width: 16px; height: 16px; }
  .flow.flowing { color: var(--um-accent-text); border-color: color-mix(in srgb, var(--um-accent) 55%, transparent); }
  .flow.flowing .icon { color: var(--um-accent); }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; cursor: pointer; user-select: none; }
  .section-title .icon { width: 16px; height: 16px; }
  .section-title span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section-title[aria-expanded="false"] { margin-bottom: 0; }
  /* Chevron to the right when folded, down when unfolded. */
  .section-title .chevron { margin-left: auto; transition: transform .2s ease; }
  .section-title[aria-expanded="false"] .chevron { transform: rotate(-90deg); }
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .tile { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px; border-radius: 10px; min-width: 0;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); }
  .tile .k { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile .v { font-size: 17px; font-weight: 500; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  .tile .cost { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile.crit .v, .tile.warn .v { color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color)); }
  .tabs { display: flex; gap: 4px; margin-bottom: 8px; }
  .tab { flex: 1 1 0; padding: 3px 6px; font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tab[aria-pressed="true"] { color: var(--um-accent-text); border-color: color-mix(in srgb, var(--um-accent) 55%, transparent);
                               background: color-mix(in srgb, var(--um-accent) 10%, transparent); }
  .chart { position: relative; height: 96px; display: flex; align-items: flex-end; gap: 2px; padding-top: 4px; }
  .slot { position: relative; flex: 1 1 0; height: 100%; display: flex; align-items: flex-end; justify-content: center; min-width: 0; cursor: pointer; border-radius: 3px; }
  .slot:hover { background: color-mix(in srgb, var(--um-accent) 7%, transparent); }
  .slot .prev { position: absolute; bottom: 0; left: 0; right: 0; border-radius: 3px 3px 0 0;
                background: color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
  .slot .cur { position: relative; width: 62%; border-radius: 3px 3px 0 0; background: color-mix(in srgb, var(--um-accent) 70%, transparent); min-height: 1px; }
  .slot.now .cur { background: var(--um-accent); }
  .slot.crit .cur { background: var(--um-crit); }
  .avg { position: absolute; left: 0; right: 0; border-top: 1px dashed color-mix(in srgb, var(--primary-text-color) 45%, transparent); pointer-events: none; }
  .axis { display: flex; gap: 2px; margin-top: 3px; }
  .axis span { flex: 1 1 0; min-width: 0; text-align: center; font-size: 10px; color: var(--secondary-text-color); white-space: nowrap; overflow: visible; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 11px; color: var(--secondary-text-color); }
  .legend i { display: inline-block; width: 10px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: 0; }
  .legend .l-cur { background: var(--um-accent); }
  .legend .l-prev { background: color-mix(in srgb, var(--secondary-text-color) 30%, transparent); }
  .legend .l-avg { height: 0; border-top: 1px dashed var(--secondary-text-color); vertical-align: 3px; }
  .empty { font-size: 13px; color: var(--secondary-text-color); padding: 8px 0; }
  @container (max-width: 300px) {
    .hero .picture { width: 72px; height: 80px; }
    .hero { gap: 10px; }
    .index .v { font-size: 22px; }
    .tile .v { font-size: 15px; }
  }
  @container (max-width: 240px) {
    .hero .picture { width: 52px; height: 58px; }
    .tiles { grid-template-columns: minmax(0, 1fr); }
  }
  /* Below 6 columns of a phone (a "1fr 1fr" grid): the index takes the whole width. */
  @container (max-width: 200px) {
    .hero .picture { display: none; }
    .index .v { font-size: 19px; }
  }
`;

const MINI_STYLE = `
  :host { --um-natural-width: 300px; }
  .content { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .mini { display: flex; align-items: center; gap: 12px; }
  .mini .picture { width: 56px; height: 62px; }
  .ms { flex: 1 1 0; min-width: 0; }
  .ms .k { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ms .v { font-size: 18px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  .ms .cost { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spark { flex: 0 0 76px; height: 36px; display: flex; align-items: flex-end; gap: 2px; }
  .spark span { flex: 1 1 0; border-radius: 2px 2px 0 0; background: color-mix(in srgb, var(--um-accent) 55%, transparent); min-height: 1px; }
  .spark span.now { background: var(--um-accent); }
  .alert { padding: 6px 8px; font-size: 12px; }
  .flowline { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); }
  .flowline .icon { width: 16px; height: 16px; }
  .flowline.flowing { color: var(--um-accent-text); }
  .flowline.flowing .icon { color: var(--um-accent); }
  @container (max-width: 270px) {
    .spark { display: none; }
  }
  @container (max-width: 210px) {
    .mini { flex-wrap: wrap; gap: 4px 10px; }
    .mini .picture { width: 40px; height: 44px; }
    .mini .ms { flex-basis: calc(100% - 50px); }
  }
`;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

class UtilityMeterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._statsVersion = 0;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    // Enter / Space on an element with the button role acts as a click, as on a <button>.
    this.shadowRoot.addEventListener("keydown", (ev) => {
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
    document.addEventListener("click", this._onOutside, true);
    if (this._popup) window.addEventListener("keydown", this._onKey);
    // Statistics are fetched again every 10 minutes, and the periods move at midnight.
    clearInterval(this._tick);
    this._tick = setInterval(() => {
      if (this._hass) this.hass = this._hass;
    }, 60000);
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._tick = null;
    document.removeEventListener("click", this._onOutside, true);
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
    const c = this._config.meter_type;
    if (c === "water" || c === "gas") return c;
    return st?.attributes?.device_class === "gas" ? "gas" : "water";
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
    const ids = [this._entity(), c.flow_entity, c.leak_entity, c.price_entity, ...Object.values(this._utility())];
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
    let html = this._render();
    if (this._popup) {
      const pop = this._popupHtml();
      if (pop) html = html.replace(/<ha-card>([\s\S]*)<\/ha-card>\s*$/, (_, inner) => `<ha-card class="dialog-open">${inner}${pop}</ha-card>`);
    }
    if (html === this._html) return;
    const active = this.shadowRoot.activeElement;
    const kept = active?.dataset && Object.keys(active.dataset).length ? JSON.stringify({ ...active.dataset }) : null;
    this._html = html;
    this.shadowRoot.innerHTML = html;
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
    return { id, st, type, unit, now, fw, stats, periods, leakOn, threshold, night, sensor, sensorWet, high, limit, leak, status, flow, active };
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

  // Cost of a consumption in the sensor's unit: price per m³ (per the sensor's unit when it is not metric) or per kWh
  // (`price_unit: energy`, with `conversion_factor` kWh per m³ for a meter counting volumes, as Gazpar's).
  _cost(m, v) {
    const p = this._price();
    if (p === null || v === null || v === undefined || this._config.show_cost === false) return null;
    const factor = Number(this._config.conversion_factor) || 11.2;
    let q = v;
    if (this._config.price_unit === "energy") {
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
    return `:host { --um-accent: ${TYPES[type].accent[this._hass?.themes?.darkMode ? 1 : 0]}; }`;
  }

  _header(m, sub) {
    const c = this._config;
    const text = this._t(m.status.key);
    const tint = m.status.cls === "crit" || m.status.cls === "warn" ? ` ${m.status.cls}` : "";
    const chipEntity = m.sensorWet ? c.leak_entity : m.id;
    return `
      <div class="header">
        <div class="type-icon${tint}">${svgIcon(ICONS[m.type])}</div>
        <div class="titles">
          <div class="name">${esc(c.title || m.st.attributes.friendly_name || m.id)}</div>
          ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
        </div>
        <span class="chip clickable ${m.status.cls}" role="button" tabindex="0" data-entity="${esc(chipEntity)}" title="${esc(text)}" aria-label="${esc(text)}"><span class="dot"></span><span class="chip-text">${esc(text)}</span></span>
        ${this._zoomButton()}
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
    return `${this._t("flow")} ${v}`;
  }

  _picture(m) {
    if (this._config.show_picture === false) return "";
    const cls = `${m.active ? " active" : ""}${m.leak ? " leak" : ""}`;
    const label = `${this._t(`meter_${m.type}`)} · ${this._t(m.status.key)}`;
    return `<div class="picture clickable${cls}" role="button" tabindex="0" aria-label="${esc(label)}" data-entity="${esc(m.id)}">${(m.type === "gas" ? gasArt : waterArt)(num(m.st))}</div>`;
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
    if (m.flow) {
      const on = m.flow.v !== null && m.flow.v > 0;
      info.push(`<div><span class="flow clickable${on ? " flowing" : ""}" role="button" tabindex="0" data-entity="${esc(c.flow_entity)}">${svgIcon(m.type === "gas" ? ICONS.gas : ICONS.flow)}<span>${esc(this._flowText(m))}</span></span></div>`);
    }
    if (m.night) {
      info.push(
        `<div class="line${m.night.leak ? " crit" : ""}">${svgIcon(ICONS.night)}<span>${esc(`${this._t("night_lowest")}: ${this._t("per_hour", { value: this._amount(m, m.night.lowest) })}`)}</span></div>`,
      );
    }
    const pic = this._picture(m);
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
    return `<style>${BASE_STYLE}${ART_STYLE}${extra}${this._accent(m.type)}</style>`;
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
class UtilityMeterMiniCard extends UtilityMeterCard {
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
    document.addEventListener("click", this._onUnzoom, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._onUnzoom, true);
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
      ? `<div class="flowline clickable${m.flow.v > 0 ? " flowing" : ""}" role="button" tabindex="0" data-entity="${esc(c.flow_entity)}">${svgIcon(m.type === "gas" ? ICONS.gas : ICONS.flow)}<span>${esc(this._flowText(m))}</span></div>`
      : "";
    return `${this._style(m, MINI_STYLE)}
      <ha-card>
        ${this._header(m, index)}
        <div class="content">
          ${this._alerts(m)}
          <div class="mini">${this._picture(m)}${stat("day", "today")}${stat("month", "month")}${spark}</div>
          ${flow}
        </div>
      </ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

class UtilityMeterEditorBase extends HTMLElement {
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
    const type = this._config.meter_type === "gas" || this._config.meter_type === "water" ? this._config.meter_type : st?.attributes?.device_class === "gas" ? "gas" : "water";
    const d = {
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
      chart_period: "week",
      price_unit: "volume",
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
    const toggles = ["show_title", "show_subtitle", "show_picture", "show_index", "show_consumption", "show_comparison", "show_chart", "show_cost", "leak_detection", "liters"];
    if (this.constructor.mini) toggles.push("zoom");
    return [
      { name: "entity", selector: { entity: { filter: [{ domain: "sensor", device_class: "water" }, { domain: "sensor", device_class: "gas" }] } } },
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "meter_type", selector: { select: { mode: "dropdown", options: ["auto", "water", "gas"].map((v) => ({ value: v, label: tr(`type_${v}`) })) } } },
          { name: "chart_period", selector: { select: { mode: "dropdown", options: PERIODS.map((v) => ({ value: v, label: tr(`tab_${v}`) })) } } },
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

class UtilityMeterCardEditor extends UtilityMeterEditorBase {}

class UtilityMeterMiniCardEditor extends UtilityMeterEditorBase {
  static get mini() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
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
    description: "Water or gas meter: index, consumption of the day, week, month and year compared with the previous period, history chart, cost and night leak detection.",
  },
  {
    type: "utility-meter-mini-card",
    name: "Utility Meter Mini Card",
    description: "Compact water or gas meter overview: index, today's and this month's consumption, last days and leak alert.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-utility-meter-card" });
}

console.info(`%c UTILITY-METER-CARD %c v${VERSION} `, "color: white; background: #0288d1; font-weight: 700;", "color: #0288d1; background: white; font-weight: 700;");
