// Planning : clic sur une cellule → création d'une réservation pré-remplie ; sélecteur
// d'espaces ; impression. Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('td.jour-cellule[data-creer]').forEach(function (td) {
            td.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;
                location.href = td.dataset.creer;
            });
        });
        var imprimer = document.querySelector('[data-imprimer]');
        if (imprimer) imprimer.addEventListener('click', function () { window.print(); });
    });
})();
