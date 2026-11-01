// Gestes de formulaire sans JavaScript inline (CSP à nonce) :
//   [data-recurrence]           affiche le bloc de récurrence quand la case est cochée
//   [data-devis]                recalcule le devis d'une demande (POST /api/devis) à chaque changement
//   [data-slug-de="#champ"]     propose un slug depuis un autre champ
//   [data-compte-caracteres]    compteur de caractères
//   [data-filtre-cases]         filtre une liste de cases à cocher par un champ texte
//   [data-copier]               copie le texte du data-copier dans le presse-papiers
//   [data-double-envoi]         désactive le bouton à l'envoi (anti double-clic)
(function () {
    'use strict';

    function slugify(s) {
        return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
    }

    function euros(n) {
        var v = Math.round(n * 100) / 100;
        var entier = Math.abs(v - Math.round(v)) < 0.005;
        var s = (entier ? Math.round(v).toFixed(0) : v.toFixed(2)).replace('.', ',');
        return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
    }

    function majDevis(form) {
        var cible = document.querySelector(form.dataset.devis);
        if (!cible) return;
        var fd = new FormData(form);
        var body = new URLSearchParams();
        fd.forEach(function (v, k) { if (typeof v === 'string') body.append(k, v); });
        fetch('/api/devis', { method: 'POST', body: body, credentials: 'same-origin', headers: { 'X-CSRFToken': fd.get('csrf_token') || '' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d) return;
                var html = '';
                if (d.erreurs && d.erreurs.length) {
                    html += '<div class="alert alert-warning py-2 mb-2">' + d.erreurs.map(function (e) { return '<div>' + e + '</div>'; }).join('') + '</div>';
                }
                if (d.conflits && d.conflits.length) {
                    html += '<div class="alert alert-danger py-2 mb-2">Créneau indisponible : ' + d.conflits.join(' · ') + '</div>';
                }
                if (d.devis) {
                    html += '<table class="montants w-100"><tbody>';
                    d.devis.lignes.forEach(function (l) {
                        html += '<tr><td>' + l.libelle + '</td><td class="text-end">' + euros(l.montant) + '</td></tr>';
                    });
                    if (!d.devis.lignes.length) html += '<tr><td class="text-muted">Aucune redevance</td><td></td></tr>';
                    if (d.devis.tva) html += '<tr><td>TVA</td><td class="text-end">' + euros(d.devis.tva) + '</td></tr>';
                    html += '<tr class="total"><td>Total' + (d.devis.tva ? ' TTC' : '') + '</td><td class="text-end">' + (d.devis.gratuit ? 'Gratuit' : euros(d.devis.ttc)) + '</td></tr>';
                    if (d.devis.caution) html += '<tr><td class="text-muted">Caution</td><td class="text-end text-muted">' + euros(d.devis.caution) + '</td></tr>';
                    if (d.nbCreneaux > 1) html += '<tr><td class="text-muted" colspan="2">' + d.nbCreneaux + ' créneaux' + (d.recurrence ? ' · ' + d.recurrence : '') + '</td></tr>';
                    html += '</tbody></table>';
                }
                cible.innerHTML = html;
            })
            .catch(function () {});
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-recurrence]').forEach(function (cb) {
            var bloc = document.querySelector(cb.dataset.recurrence);
            if (!bloc) return;
            var maj = function () { bloc.classList.toggle('d-none', !cb.checked); };
            cb.addEventListener('change', maj);
            maj();
        });

        document.querySelectorAll('form[data-devis]').forEach(function (form) {
            var minuteur;
            var planifier = function () { clearTimeout(minuteur); minuteur = setTimeout(function () { majDevis(form); }, 250); };
            form.addEventListener('change', planifier);
            form.addEventListener('input', function (e) { if (e.target.matches('input[type="number"], input[type="date"], input[type="time"]')) planifier(); });
            majDevis(form);
        });

        document.querySelectorAll('[data-slug-de]').forEach(function (champ) {
            var src = document.querySelector(champ.dataset.slugDe);
            if (!src) return;
            var touche = champ.value !== '';
            champ.addEventListener('input', function () { touche = champ.value !== ''; });
            src.addEventListener('input', function () { if (!touche) champ.value = slugify(src.value); });
        });

        document.querySelectorAll('[data-compte-caracteres]').forEach(function (ta) {
            var out = document.querySelector(ta.dataset.compteCaracteres);
            if (!out) return;
            var maj = function () { out.textContent = ta.value.length + (ta.maxLength > 0 ? ' / ' + ta.maxLength : ''); };
            ta.addEventListener('input', maj);
            maj();
        });

        document.querySelectorAll('[data-filtre-cases]').forEach(function (inp) {
            var liste = document.querySelector(inp.dataset.filtreCases);
            if (!liste) return;
            inp.addEventListener('input', function () {
                var q = inp.value.toLowerCase();
                liste.querySelectorAll('label').forEach(function (l) {
                    l.style.display = l.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
                });
            });
        });

        document.addEventListener('click', function (e) {
            var c = e.target.closest('[data-copier]');
            if (!c) return;
            e.preventDefault();
            var texte = c.dataset.copier;
            if (navigator.clipboard) navigator.clipboard.writeText(texte).then(function () {
                var ancien = c.textContent;
                c.textContent = 'Copié !';
                setTimeout(function () { c.textContent = ancien; }, 1500);
            });
        });

        // [data-auto-submit] : un formulaire GET de filtres s'envoie dès qu'un champ change.
        document.querySelectorAll('form[data-auto-submit]').forEach(function (form) {
            form.addEventListener('change', function (e) {
                if (e.target.matches('select, input[type="date"], input[type="checkbox"], input[type="radio"], input[type="month"]')) form.requestSubmit();
            });
        });

        document.querySelectorAll('form[data-double-envoi]').forEach(function (form) {
            form.addEventListener('submit', function () {
                form.querySelectorAll('button[type="submit"]').forEach(function (b) { b.disabled = true; });
            });
        });
    });
})();
