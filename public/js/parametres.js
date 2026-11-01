// Paramètres › Apparence : aperçu en direct de la couleur principale.
//   <input type="color" data-apercu-couleur="#cible">  → met à jour --apercu* sur la cible
//   [data-apercu-code]                                 → affiche la valeur hex choisie
(function () {
  'use strict';

  function hexVersRgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); });
  }
  function melange(hex, ratio) {
    var cible = ratio >= 0 ? 255 : 0;
    var q = Math.abs(ratio);
    return '#' + hexVersRgb(hex).map(function (v) {
      return Math.round(v + (cible - v) * q).toString(16).padStart(2, '0');
    }).join('');
  }
  function contraste(hex) {
    var c = hexVersRgb(hex);
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.6 ? '#1f2937' : '#ffffff';
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-apercu-couleur]').forEach(function (inp) {
      var cible = document.querySelector(inp.dataset.apercuCouleur);
      var code = document.querySelector('[data-apercu-code]');
      if (!cible) return;
      var maj = function () {
        var hex = (inp.value || '').toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(hex)) return;
        cible.style.setProperty('--apercu', hex);
        cible.style.setProperty('--apercu-dark', melange(hex, -0.18));
        cible.style.setProperty('--apercu-soft', melange(hex, 0.85));
        cible.style.setProperty('--apercu-texte', contraste(hex));
        if (code) code.textContent = hex;
      };
      inp.addEventListener('input', maj);
      inp.addEventListener('change', maj);
    });
  });
})();
