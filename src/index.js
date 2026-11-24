// Entry point: the card's modules in their original order. scripts/bundle.mjs concatenates them in this order into the
// single classic script the card ships as.
import "./card-picker.js";
import "./i18n/strings.js";
import "./core.js";
import "./helpers.js";
import "./styles.js";
import "./cards.js";
import "./visual-editors.js";
import "./register.js";
