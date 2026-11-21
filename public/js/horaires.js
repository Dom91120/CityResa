// Horaires de travail du personnel de service, sans JavaScript inline (CSP à nonce) :
//   [data-semaine-horaires]   l'aperçu graphique de la semaine, redessiné à chaque saisie du
//                             formulaire qui le contient (grille des heures, cases « Repos »,
//                             choix « planning type / personnalisés / pas d'horaires fixes ») ;
//                             data-type porte le planning type du contrat, data-vide le message
//                             affiché quand il n'y a pas d'horaires.
//   [data-grille-perso]       la grille de saisie, masquée hors du mode « personnalisés ».
//   [data-aide-dessin]        le mode d'emploi du dessin, montré quand l'aperçu est modifiable.
// Quand la grille fait foi (horaires personnalisés, planning type), l'aperçu se dessine à la
// souris ou au doigt : glisser sur une ligne crée une plage, glisser une barre la déplace, ses
// bords l'étirent, deux clics rapprochés (double-clic) la retirent. Chaque geste est reporté dans les champs d'heures,
// qui restent la saisie de référence (clavier, lecteur d'écran, envoi du formulaire).
// Sans script, l'aperçu rendu par le serveur reste affiché et la grille visible.
(function () {
    'use strict';

    var PAS = 15;            // pas du dessin, en minutes
    var BORD = 7;            // largeur d'une poignée d'étirement, en pixels
    var MAX_PLAGES = 2;      // la grille a deux plages par jour (coupure méridienne)

    function minutes(v) {
        var m = /^(\d{2}):(\d{2})$/.exec(v || '');
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }

    function heure(m) {
        if (m === 1440) m = 0;
        return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
    }

    // « HH:MM » pour un champ d'heure ; minuit du soir s'écrit 00:00, comme le lit le serveur.
    function champ(m) {
        if (m === 1440) m = 0;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }

    function nombre(h) {
        return String(Math.round(h * 10) / 10).replace('.', ',');
    }

    function borner(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // Une plage « [début, fin] » en minutes ; une fin à 00:00 vaut minuit du soir.
    function plage(de, a) {
        var d = minutes(de);
        var f = minutes(a);
        if (d === null || f === null) return null;
        if (f === 0) f = 1440;
        return f > d ? [d, f] : null;
    }

    function depuisCycle(cycle) {
        var h = {};
        for (var j = 1; j <= 7; j++) {
            h[j] = ((cycle && cycle[String(j)]) || [])
                .map(function (p) { return plage(p[0], p[1]); })
                .filter(Boolean);
        }
        return h;
    }

    function plagesDuJour(form, j) {
        var plages = [];
        var repos = form.elements['repos_' + j];
        if (!repos || !repos.checked) {
            [1, 2].forEach(function (k) {
                var de = form.elements['h' + k + '_de_' + j];
                var a = form.elements['h' + k + '_a_' + j];
                var p = de && a ? plage(de.value, a.value) : null;
                if (p) plages.push(p);
            });
        }
        return plages.sort(function (x, y) { return x[0] - y[0]; });
    }

    function depuisGrille(form) {
        var h = {};
        for (var j = 1; j <= 7; j++) h[j] = plagesDuJour(form, j);
        return h;
    }

    // Reporte les plages d'un jour dans les champs de la grille (et sa case « Repos »).
    function ecrire(form, j, plages) {
        var tri = plages
            .filter(function (p) { return p && p[1] > p[0]; })
            .sort(function (x, y) { return x[0] - y[0]; })
            .slice(0, MAX_PLAGES);
        var repos = form.elements['repos_' + j];
        if (repos) repos.checked = tri.length === 0;
        [1, 2].forEach(function (k) {
            var de = form.elements['h' + k + '_de_' + j];
            var a = form.elements['h' + k + '_a_' + j];
            if (!de || !a) return;
            var p = tri[k - 1];
            de.value = p ? champ(p[0]) : '';
            a.value = p ? champ(p[1]) : '';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-semaine-horaires]').forEach(function (vue) {
            var form = vue.closest('form');
            if (!form) return;
            var type = null;
            try {
                type = vue.dataset.type ? JSON.parse(vue.dataset.type) : null;
            } catch (e) {
                type = null;
            }
            var grille = form.querySelector('[data-grille-perso]');
            var aide = form.querySelector('[data-aide-dessin]');
            var pied = vue.querySelector('.sh-pied');
            var geste = null;
            // Le dernier appui sur une barre : deux appuis rapprochés au même endroit la retirent. Le
            // double-clic du navigateur ne convient pas, les barres étant redessinées entre les deux.
            var dernier = null;

            function mode() {
                var r = form.querySelector('input[name="horaires_mode"]:checked');
                // Sans choix de mode (saisie d'un planning type), la grille fait foi.
                return form.querySelector('input[name="horaires_mode"]') ? (r ? r.value : 'contrat') : 'perso';
            }

            function dessiner() {
                var m = mode();
                var modifiable = m === 'perso';
                var h = m === 'libre' ? null : m === 'contrat' ? (type ? depuisCycle(type) : null) : depuisGrille(form);
                var semaine = 0;
                vue.querySelectorAll('.sh-ligne[data-jour]').forEach(function (ligne) {
                    var piste = ligne.querySelector('.sh-piste');
                    var total = ligne.querySelector('.sh-total');
                    piste.textContent = '';
                    var jour = 0;
                    ((h && h[ligne.dataset.jour]) || []).forEach(function (p, i) {
                        var barre = document.createElement('span');
                        barre.className = 'sh-plage';
                        barre.dataset.index = String(i);
                        barre.style.left = (p[0] / 1440) * 100 + '%';
                        barre.style.width = ((p[1] - p[0]) / 1440) * 100 + '%';
                        barre.textContent = heure(p[0]) + ' - ' + heure(p[1]);
                        barre.title = barre.textContent + (modifiable ? ' · glisser pour déplacer, tirer un bord pour étirer, double-clic pour retirer' : '');
                        piste.appendChild(barre);
                        jour += (p[1] - p[0]) / 60;
                    });
                    semaine += jour;
                    total.textContent = h ? (jour ? nombre(jour) + ' h' : 'Repos') : '';
                });
                if (pied) {
                    pied.querySelector('.sh-vide').textContent = h
                        ? ''
                        : m === 'libre'
                            ? "Pas d'horaires fixes : disponible à toute heure"
                            : vue.dataset.vide || '';
                    pied.querySelector('.sh-total').textContent = h ? nombre(semaine) + ' h' : '';
                }
                vue.classList.toggle('est-modifiable', modifiable);
                if (grille) grille.hidden = !modifiable;
                if (aide) aide.hidden = !modifiable;
            }

            // ── Dessin à la souris ou au doigt ──

            function minuteSous(piste, clientX) {
                var r = piste.getBoundingClientRect();
                var m = ((clientX - r.left) / r.width) * 1440;
                return borner(Math.round(m / PAS) * PAS, 0, 1440);
            }

            // L'intervalle libre autour d'une plage : de la fin de la précédente au début de la suivante.
            function limites(autres, repere) {
                var min = 0;
                var max = 1440;
                autres.forEach(function (p) {
                    if (p[1] <= repere) min = Math.max(min, p[1]);
                    else if (p[0] >= repere) max = Math.min(max, p[0]);
                });
                return [min, max];
            }

            vue.addEventListener('pointerdown', function (e) {
                if (mode() !== 'perso' || (e.pointerType === 'mouse' && e.button !== 0)) return;
                var piste = e.target.closest('.sh-ligne[data-jour] .sh-piste');
                if (!piste || !vue.contains(piste)) return;
                var j = Number(piste.closest('.sh-ligne').dataset.jour);
                var plages = plagesDuJour(form, j);
                var barre = e.target.closest('.sh-plage');
                var m = minuteSous(piste, e.clientX);
                if (barre) {
                    var i = Number(barre.dataset.index);
                    var p = plages[i];
                    if (!p) return;
                    var maintenant = Date.now();
                    if (dernier && !dernier.bouge && dernier.j === j && maintenant - dernier.t < 450 && Math.abs(e.clientX - dernier.x) < 6) {
                        dernier = null;
                        ecrire(form, j, plages.filter(function (_, k) { return k !== i; }));
                        dessiner();
                        e.preventDefault();
                        return;
                    }
                    dernier = { t: maintenant, x: e.clientX, j: j, bouge: false };
                    var r = barre.getBoundingClientRect();
                    var zone = e.clientX - r.left <= BORD ? 'debut' : r.right - e.clientX <= BORD ? 'fin' : 'deplacer';
                    var autres = plages.filter(function (_, k) { return k !== i; });
                    geste = { j: j, piste: piste, zone: zone, origine: p.slice(), autres: autres, depart: m, lim: limites(autres, p[0]) };
                } else {
                    if (plages.length >= MAX_PLAGES) return;
                    // Un point de départ déjà pris par une plage ne crée rien.
                    if (plages.some(function (p) { return m > p[0] && m < p[1]; })) return;
                    geste = { j: j, piste: piste, zone: 'creer', origine: [m, m], autres: plages, depart: m, lim: limites(plages, m) };
                }
                piste.setPointerCapture(e.pointerId);
                vue.classList.add('est-en-geste');
                e.preventDefault();
            });

            vue.addEventListener('pointermove', function (e) {
                if (!geste) return;
                var m = minuteSous(geste.piste, e.clientX);
                if (dernier && m !== geste.depart) dernier.bouge = true;
                var o = geste.origine;
                var min = geste.lim[0];
                var max = geste.lim[1];
                var p;
                if (geste.zone === 'creer') {
                    p = [borner(Math.min(geste.depart, m), min, max), borner(Math.max(geste.depart, m), min, max)];
                } else if (geste.zone === 'debut') {
                    p = [borner(m, min, o[1] - PAS), o[1]];
                } else if (geste.zone === 'fin') {
                    p = [o[0], borner(m, o[0] + PAS, max)];
                } else {
                    var d = borner(o[0] + (m - geste.depart), min, max - (o[1] - o[0]));
                    p = [d, d + (o[1] - o[0])];
                }
                ecrire(form, geste.j, geste.autres.concat([p]));
                dessiner();
            });

            function finir() {
                if (!geste) return;
                geste = null;
                vue.classList.remove('est-en-geste');
                dessiner();
            }
            vue.addEventListener('pointerup', finir);
            vue.addEventListener('pointercancel', finir);

            form.addEventListener('input', dessiner);
            form.addEventListener('change', dessiner);
            dessiner();
        });
    });
})();
