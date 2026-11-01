// Gestes du portail public, sans JavaScript inline (CSP à nonce) :
//   [data-choix-date]            une date cliquée dans le calendrier préremplit le champ date
//   [data-participants-max]      avertit quand le nombre de participants dépasse la capacité
//   [data-etapes]                l'indicateur d'étapes suit la section visible du formulaire
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // form[data-auto-submit] : géré par le socle (public/js/formulaire.js).

    document.querySelectorAll('[data-participants-max]').forEach(function (inp) {
      var max = parseInt(inp.dataset.participantsMax, 10);
      var aide = inp.parentElement.querySelector('.form-text');
      if (!max || !aide) return;
      var base = aide.textContent;
      inp.addEventListener('input', function () {
        var v = parseInt(inp.value, 10);
        if (v > max) {
          aide.textContent = 'Attention : la capacité maximale de cet espace est de ' + max + ' personnes.';
          aide.classList.add('text-danger');
        } else {
          aide.textContent = base;
          aide.classList.remove('text-danger');
        }
      });
    });

    var etapes = document.querySelector('[data-etapes]');
    if (etapes && 'IntersectionObserver' in window) {
      var sections = Array.prototype.slice.call(document.querySelectorAll('[data-etape]'));
      var items = etapes.querySelectorAll('.etape');
      var courante = 0;
      var maj = function () {
        items.forEach(function (it, i) {
          it.classList.toggle('faite', i < courante);
          it.classList.toggle('courante', i === courante);
        });
      };
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            courante = sections.indexOf(en.target);
            maj();
          }
        });
      }, { rootMargin: '-40% 0px -50% 0px' });
      sections.forEach(function (s) { obs.observe(s); });
    }
  });
})();
