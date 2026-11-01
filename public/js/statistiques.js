// Page Statistiques : le sélecteur de période.
//   [data-stats-periode]  le formulaire GET (periode, de, a)
//   [data-stats-auto]     le <select> des périodes : un choix nommé soumet aussitôt (sans bornes) ;
//                         « Bornes libres… » laisse saisir les dates.
//   [data-stats-borne]    les champs de dates : une saisie vide le choix de période.
// Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.querySelector('form[data-stats-periode]');
        if (!form) return;
        var select = form.querySelector('[data-stats-auto]');
        var bornes = form.querySelectorAll('[data-stats-borne]');
        if (select) {
            select.addEventListener('change', function () {
                if (!select.value) return;
                bornes.forEach(function (b) { b.disabled = true; });
                form.requestSubmit ? form.requestSubmit() : form.submit();
            });
        }
        bornes.forEach(function (b) {
            b.addEventListener('change', function () { if (select) select.value = ''; });
        });
        form.addEventListener('submit', function () {
            // Une période nommée l'emporte : on n'envoie pas les bornes.
            if (select && select.value) bornes.forEach(function (b) { b.disabled = true; });
        });
    });
})();
