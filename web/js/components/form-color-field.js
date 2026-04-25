/**
 * Color field — keeps the swatch (input[type=color]) and the hex text input
 * in sync inside any [data-color-field] block rendered by form-group.html
 * with Type="color".
 *
 * Runs on initial DOMContentLoaded and again on htmx:afterSwap so drawer-
 * loaded forms (the option-value drawer, etc.) wire up automatically.
 *
 * Idempotent: re-running on the same node is a no-op (we mark wired nodes
 * with data-color-field-wired="true").
 */
(function () {
  'use strict';

  function normalize(v) {
    v = (v || '').trim();
    if (!v) return '';
    if (v.charAt(0) !== '#') v = '#' + v;
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : '';
  }

  function wire(field) {
    if (!field || field.dataset.colorFieldWired === 'true') return;
    var swatch = field.querySelector('[data-color-swatch]');
    var hex = field.querySelector('[data-color-hex]');
    if (!swatch || !hex) return;

    swatch.addEventListener('input', function () {
      hex.value = swatch.value;
    });
    hex.addEventListener('input', function () {
      var v = normalize(hex.value);
      if (v) swatch.value = v;
    });

    var initial = normalize(hex.value);
    if (initial) {
      hex.value = initial;
      swatch.value = initial;
    }

    field.dataset.colorFieldWired = 'true';
  }

  function init(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var fields = scope.querySelectorAll('[data-color-field]');
    for (var i = 0; i < fields.length; i++) wire(fields[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
  document.body.addEventListener('htmx:afterSwap', function (e) {
    init(e.target || document);
  });
})();
