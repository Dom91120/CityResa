// Planning : clic sur une case (jour de la semaine, heure de la frise) → création d'une réservation
// pré-remplie ; impression ; glisser-déposer d'un créneau sur une autre case du même espace (le serveur vérifie
// règles et disponibilité, puis la page se recharge avec son message).
// Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';

    function deposer(evt, cellule) {
        var csrf = document.querySelector('[data-planning-csrf]');
        if (!csrf) return;
        if (cellule.dataset.espaceId !== evt.dataset.espaceId) return;
        var heure = cellule.dataset.heure || '';
        var debutMin = heure ? Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5)) : Number(evt.dataset.debutMin);
        var duree = Number(evt.dataset.dureeMin);
        if (!duree || Number.isNaN(debutMin)) return;
        if (cellule.dataset.jour === evt.dataset.jour && debutMin === Number(evt.dataset.debutMin)) return;
        var finMin = (debutMin + duree) % 1440;
        var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
        var texte = 'Déplacer « ' + (evt.dataset.titre || 'ce créneau') + ' » au ' + cellule.dataset.jour.split('-').reverse().join('/') + ' de ' + hm(debutMin) + ' à ' + hm(finMin) + ' ?\n\nLe serveur vérifie les horaires et la disponibilité ; l\'usager est prévenu par courriel.';
        if (!window.confirm(texte)) return;
        var fd = new FormData();
        fd.set('csrf_token', csrf.dataset.planningCsrf);
        fd.set('date', cellule.dataset.jour);
        fd.set('heure_debut', hm(debutMin));
        fd.set('heure_fin', hm(finMin));
        fd.set('portee', 'cette');
        fd.set('prevenir', 'on');
        evt.classList.add('evt--en-cours');
        fetch('/reservations/' + evt.dataset.reservationId + '/creneaux/' + evt.dataset.creneauId + '/modifier', {
            method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual'
        }).then(function () { location.reload(); }, function () { location.reload(); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.jour-cellule[data-creer]').forEach(function (td) {
            td.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;
                location.href = td.dataset.creer;
            });
        });
        var imprimer = document.querySelector('[data-imprimer]');
        if (imprimer) imprimer.addEventListener('click', function () { window.print(); });

        var enCours = null;
        document.querySelectorAll('a.evt[data-creneau-id]').forEach(function (a) {
            a.setAttribute('draggable', 'true');
            a.addEventListener('dragstart', function (e) {
                enCours = a;
                a.classList.add('evt--glisse');
                // Les vignettes de la frise laissent passer le pointeur : la case d'une heure reste atteignable sous elles.
                setTimeout(function () { document.body.classList.add('glisse-en-cours'); }, 0);
                if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', a.dataset.creneauId); }
            });
            a.addEventListener('dragend', function () { a.classList.remove('evt--glisse'); document.body.classList.remove('glisse-en-cours'); enCours = null; });
        });
        document.querySelectorAll('.jour-cellule[data-jour][data-espace-id]').forEach(function (td) {
            td.addEventListener('dragover', function (e) {
                if (!enCours || td.dataset.espaceId !== enCours.dataset.espaceId) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                td.classList.add('depot-possible');
            });
            td.addEventListener('dragleave', function () { td.classList.remove('depot-possible'); });
            td.addEventListener('drop', function (e) {
                td.classList.remove('depot-possible');
                if (!enCours) return;
                e.preventDefault();
                deposer(enCours, td);
            });
        });
    });
})();
