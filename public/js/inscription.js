// Inscription : affiche, masque et rend obligatoires les champs selon « Vous êtes ».
// Les règles viennent du serveur (#regles-inscription, src/lib/dossier-usager.ts) :
//   { <type>: { titre, champs: { <name>: { visible, requis, libelle, aide } } } }
// Un champ masqué est aussi désactivé : il n'est pas envoyé.
(function () {
    'use strict';

    function majLibelle(label, texte, requis) {
        label.textContent = texte;
        if (requis) {
            var etoile = document.createElement('span');
            etoile.className = 'req';
            etoile.textContent = ' *';
            label.appendChild(etoile);
        }
    }

    function majAide(bloc, texte) {
        var aide = bloc.querySelector('.form-text');
        if (!aide && texte) {
            aide = document.createElement('div');
            aide.className = 'form-text';
            bloc.appendChild(aide);
        }
        if (aide) {
            aide.textContent = texte || '';
            aide.hidden = !texte;
        }
    }

    function appliquer(form, regles, type) {
        var r = regles[type];
        if (!r) return;
        Object.keys(r.champs).forEach(function (name) {
            var champ = form.elements.namedItem(name);
            if (!champ || !champ.parentElement) return;
            var regle = r.champs[name];
            var bloc = champ.parentElement;
            bloc.hidden = !regle.visible;
            champ.disabled = !regle.visible;
            champ.required = regle.visible && regle.requis;
            var label = bloc.querySelector('label');
            if (label) majLibelle(label, regle.libelle, champ.required);
            majAide(bloc, regle.aide);
        });
        var titre = form.querySelector('[data-titre-representant]');
        if (titre) {
            titre.hidden = !r.champs.legal_first_name.visible;
            var span = titre.querySelector('span');
            if (span) span.textContent = r.titre;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var source = document.getElementById('regles-inscription');
        var select = document.querySelector('select[data-type-org]');
        if (!source || !select || !select.form) return;
        var regles;
        try { regles = JSON.parse(source.textContent); } catch (e) { return; }
        var maj = function () { appliquer(select.form, regles, select.value); };
        select.addEventListener('change', maj);
        maj();
    });
})();
