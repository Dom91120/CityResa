// Planning : clic sur une case (jour de la semaine, heure de la frise) → création d'une réservation
// pré-remplie ; impression ; glisser-déposer d'un créneau sur une autre case du même espace (le serveur vérifie
// règles et disponibilité, puis la page se recharge avec son message).
// Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';

    var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

    // Où le créneau arrive s'il est lâché sur cette case.
    // Vue Semaine : la case est un jour, les heures sont conservées.
    // Vue Jour (frise) : le créneau se décale d'autant d'heures que le pointeur a parcouru de cases
    // depuis la prise, quel que soit l'endroit où on l'a saisi ; ses minutes et sa durée sont conservées.
    // Rend null si le dépôt n'a pas de sens ici.
    function arrivee(evt, td, x, departX) {
        if (td.dataset.espaceId !== evt.dataset.espaceId) return null;
        if (!td.classList.contains('frise-case')) return { cible: td, debutMin: Number(evt.dataset.debutMin) };
        // Un créneau commencé la veille ne se déplace pas depuis la frise d'un autre jour.
        if (td.dataset.jour !== evt.dataset.jour) return null;
        var largeur = td.getBoundingClientRect().width || 1;
        var debutMin = Number(evt.dataset.debutMin) + Math.round((x - departX) / largeur) * 60;
        debutMin = Math.max(0, Math.min(1439, debutMin));
        var heure = hm(Math.floor(debutMin / 60) * 60);
        var cible = td;
        Array.prototype.forEach.call(td.parentElement.children, function (c) { if (c.dataset.heure === heure) cible = c; });
        return { cible: cible, debutMin: debutMin };
    }

    function deposer(evt, cellule, debutMin) {
        var csrf = document.querySelector('[data-planning-csrf]');
        if (!csrf) return;
        var duree = Number(evt.dataset.dureeMin);
        if (!duree || Number.isNaN(debutMin)) return;
        if (cellule.dataset.jour === evt.dataset.jour && debutMin === Number(evt.dataset.debutMin)) return;
        var finMin = (debutMin + duree) % 1440;
        var texte = 'Déplacer « ' + (evt.dataset.titre || 'ce créneau') + ' » au ' + cellule.dataset.jour.split('-').reverse().join('/') + ' de ' + hm(debutMin) + ' à ' + hm(finMin) + ' ? Le serveur vérifie les horaires et la disponibilité ; l\'usager est prévenu par courriel.';
        var jour = cellule.dataset.jour;
        var envoyer = function () {
            var fd = new FormData();
            fd.set('csrf_token', csrf.dataset.planningCsrf);
            fd.set('date', jour);
            fd.set('heure_debut', hm(debutMin));
            fd.set('heure_fin', hm(finMin));
            fd.set('portee', 'cette');
            fd.set('prevenir', 'on');
            evt.classList.add('evt--en-cours');
            fetch('/reservations/' + evt.dataset.reservationId + '/creneaux/' + evt.dataset.creneauId + '/modifier', {
                method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual'
            }).then(function () { location.reload(); }, function () { location.reload(); });
        };
        // La fenêtre de confirmation de l'application, comme partout ailleurs : la boîte native du
        // navigateur n'est pas affichée dans tous les contextes (navigateur intégré), et le
        // déplacement était alors abandonné sans rien dire. Elle ne sert que de repli.
        if (window.confirmerModal && window.confirmerModal(texte, envoyer)) return;
        if (window.confirm(texte)) envoyer();
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
        var departX = 0;
        // La case mise en évidence : celle où le créneau commencera.
        var surlignee = null;
        var surligner = function (cible) {
            if (surlignee === cible) return;
            if (surlignee) surlignee.classList.remove('depot-possible');
            surlignee = cible;
            if (surlignee) surlignee.classList.add('depot-possible');
        };
        document.querySelectorAll('a.evt[data-creneau-id]').forEach(function (a) {
            a.setAttribute('draggable', 'true');
            a.addEventListener('dragstart', function (e) {
                enCours = a;
                departX = e.clientX;
                a.classList.add('evt--glisse');
                if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', a.dataset.creneauId); }
            });
            a.addEventListener('dragend', function () {
                a.classList.remove('evt--glisse');
                surligner(null);
                enCours = null;
            });
        });
        // Une zone de dépôt et la case qu'elle désigne sous le pointeur.
        // Vue Semaine : la cellule du jour. Vue Jour : la ligne entière de la frise, vignettes comprises
        // — le dépôt aboutit aussi quand le pointeur est sur une vignette, la sienne ou une autre.
        var zone = function (el, caseSous) {
            el.addEventListener('dragover', function (e) {
                var td = enCours ? caseSous(e.clientX) : null;
                var ou = td ? arrivee(enCours, td, e.clientX, departX) : null;
                if (!ou) { surligner(null); return; }
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                surligner(ou.cible);
            });
            el.addEventListener('dragleave', function (e) {
                // En restant dans la zone (d'une case à sa voisine), le survol suivant remet la bonne en évidence.
                if (!e.relatedTarget || !el.contains(e.relatedTarget)) surligner(null);
            });
            el.addEventListener('drop', function (e) {
                var td = enCours ? caseSous(e.clientX) : null;
                var ou = td ? arrivee(enCours, td, e.clientX, departX) : null;
                surligner(null);
                if (!ou) return;
                e.preventDefault();
                deposer(enCours, ou.cible, ou.debutMin);
            });
        };
        document.querySelectorAll('.jour-cellule[data-jour][data-espace-id]:not(.frise-case)').forEach(function (td) {
            zone(td, function () { return td; });
        });
        document.querySelectorAll('.frise-cases').forEach(function (cases) {
            zone(cases.parentElement, function (x) {
                var trouvee = null;
                Array.prototype.forEach.call(cases.children, function (c) {
                    var r = c.getBoundingClientRect();
                    if (x >= r.left && x < r.right) trouvee = c;
                });
                return trouvee;
            });
        });
    });
})();
