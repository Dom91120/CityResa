// Réservations, planning et messages : gestes sans JavaScript inline (CSP à nonce).
//   select[data-recharger="#form"]      changer d'espace recharge la page de saisie en
//                                       conservant les champs listés dans data-recharger-champs
//   .planning [data-confirm-stop]       bouton dans une cellule cliquable du planning :
//                                       confirme sans déclencher la création d'un dossier
//   [data-defiler]                      fait défiler le fil de discussion jusqu'en bas
//   [data-cible-ancre]                  un clic place le curseur dans la zone de saisie visée
(function () {
    'use strict';

    // form[data-auto-submit] : géré par le socle (public/js/formulaire.js).

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('select[data-recharger]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var form = document.querySelector(sel.dataset.recharger);
                var url = new URL(location.pathname, location.origin);
                url.searchParams.set(sel.name, sel.value);
                if (form) {
                    (sel.dataset.rechargerChamps || '').split(',').forEach(function (nom) {
                        nom = nom.trim();
                        if (!nom || !form.elements[nom]) return;
                        var v = form.elements[nom].value;
                        if (v) url.searchParams.set(nom, v);
                    });
                }
                location.href = url.toString();
            });
        });

        document.querySelectorAll('.planning [data-confirm-stop]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var form = btn.closest('form');
                if (!form) return;
                var msg = btn.dataset.confirmStop || 'Confirmer ?';
                if (window.confirmerModal && window.confirmerModal(msg, form)) return;
                if (window.confirm(msg)) form.requestSubmit();
            });
        });

        document.querySelectorAll('[data-defiler]').forEach(function (el) {
            el.scrollTop = el.scrollHeight;
        });

        document.querySelectorAll('[data-cible-ancre]').forEach(function (a) {
            a.addEventListener('click', function () {
                var cible = document.querySelector(a.dataset.cibleAncre);
                if (cible) setTimeout(function () { cible.focus(); }, 50);
            });
        });
    });
})();
