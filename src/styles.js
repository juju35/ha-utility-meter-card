// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const BASE_STYLE = `
  :host { --um-accent: #0288d1; --um-ok: var(--success-color, #43a047); --um-warn: var(--warning-color, #ffa600);
          --um-crit: var(--error-color, #db4437); --um-idle: var(--secondary-text-color, #9e9e9e);
          /* Text in a state or accent color is mixed with the text color so that it reads at 4.5:1 at least. */
          --um-accent-text: color-mix(in srgb, var(--um-accent) 55%, var(--primary-text-color)); }
  ha-card { overflow: hidden; container: um-card / inline-size; }
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
  .type-icon.idle .icon { fill: var(--um-idle); }
  .titles { flex: 1 1 0; min-width: 0; align-self: center; }
  :host([hide-title]) .titles .name, :host([hide-subtitle]) .titles .sub { display: none; }
  /* The status pill, in every header: on the title row right after the title only when the whole title and the pill's
     whole label fit there; otherwise on its own line under the subtitle, cut to one line; its dot alone, beside the
     title, when the banner has no room left above its ground strip, or on a card of 200 px or less. Decided by
     measurement (see _fitPill), so that every language and every width gets it right. */
  .tstack { display: flex; flex-direction: column; gap: 1px; align-items: flex-start; min-width: 0; width: 100%; }
  .tstack > * { max-width: 100%; }
  .trow { display: flex; align-items: center; gap: 8px; min-width: 0; width: 100%; }
  .trow .name { flex: 0 1 auto; min-width: 0; }
  .titles .trow .chip { flex: none; max-width: none; margin: 0; align-self: center; }
  .titles.below .tstack { display: grid; justify-items: start; row-gap: 1px; }
  .titles.below .trow { display: contents; }
  .titles.below .name { max-width: 100%; }
  .titles.below .chip { order: 3; max-width: 100%; }
  /* In the banner, a pill on its own line may run over the picture, up to the banner's edge. */
  .banner .titles.below .chip { max-width: none; }
  .titles.below .sub { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .titles.dotonly .trow .chip { padding: 4px; } .titles.dotonly .trow .chip .chip-text { display: none; }
  @container um-card (max-width: 200px) { .titles .tstack .chip { padding: 4px; } .titles .tstack .chip .chip-text { display: none; } }
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
  .btn.crit { color: color-mix(in srgb, var(--um-crit) 55%, var(--primary-text-color)); border-color: color-mix(in srgb, var(--um-crit) 55%, transparent); }
  .btn.crit .icon { color: var(--um-crit); }
  .btn[disabled] { cursor: default; opacity: .6; }
  .btn[disabled]:hover { background: color-mix(in srgb, var(--primary-text-color) 4%, transparent); }
  /* Valve button: the size of the flow pill next to it. */
  .btn.valve { font-size: 12px; font-weight: 400; padding: 4px 10px; border-radius: 14px; white-space: nowrap; max-width: 100%; }
  .btn.valve .icon { width: 16px; height: 16px; flex: none; }
  .btn.valve span { overflow: hidden; text-overflow: ellipsis; }
  .acts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; max-width: 100%; }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: 0 -4px 0 0; border-radius: 50%; align-self: flex-start; margin-top: 0;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--um-idle) 16%, transparent); color: var(--primary-text-color); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
  @container um-card (max-width: 230px) { .header { gap: 6px; } }
`;

// In-card popup: a backdrop over the card with a small dialog at the top of the card, so that it stays in view.
export const DIALOG_STYLE = `
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

export const FULL_STYLE = `
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
  @container um-card (max-width: 300px) {
    .hero .picture { width: 72px; height: 80px; }
    .hero { gap: 10px; }
    .index .v { font-size: 22px; }
    .tile .v { font-size: 15px; }
  }
  @container um-card (max-width: 240px) {
    .hero .picture { width: 52px; height: 58px; }
    .tiles { grid-template-columns: minmax(0, 1fr); }
  }
  /* Below 6 columns of a phone (a "1fr 1fr" grid): the index takes the whole width. */
  @container um-card (max-width: 200px) {
    .hero .picture { display: none; }
    .index .v { font-size: 19px; }
  }
`;

export const MINI_STYLE = `
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
  .acts .flowline { flex: 1 1 auto; min-width: 0; }
  .acts .btn.valve { margin-left: auto; }
  @container um-card (max-width: 270px) {
    .spark { display: none; }
  }
  @container um-card (max-width: 210px) {
    .mini { flex-wrap: wrap; gap: 4px 10px; }
    .mini .picture { width: 40px; height: 44px; }
    .mini .ms { flex-basis: calc(100% - 50px); }
  }
`;

// ---------------------------------------------------------------------------
// Shadow DOM patching: an update changes the nodes that differ and keeps the others (their focus, hover, running
// animations and size), instead of rebuilding the whole card. `<ha-icon>` and the other Home Assistant elements keep
// their own shadow content (only their attributes are patched).
// ---------------------------------------------------------------------------

export const umPatchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
export const umSame = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
export const umPatchChildren = (cur, next) => {
  const fresh = [...next.childNodes];
  fresh.forEach((n, i) => {
    const o = cur.childNodes[i];
    if (!umSame(o, n)) {
      if (o) cur.replaceChild(n, o);
      else cur.appendChild(n);
      return;
    }
    if (n.nodeType === 1) {
      umPatchAttrs(o, n);
      umPatchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
// The first render (an empty root) and environments without a DOM (the unit tests' stand-ins) set innerHTML.
export const umMorph = (root, html) => {
  if (!root.childNodes?.length) {
    root.innerHTML = html;
    return;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  umPatchChildren(root, tpl.content);
};
