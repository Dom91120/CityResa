// Inscription : affiche, masque et rend obligatoires les champs selon « Vous êtes », et
// découpe le formulaire en deux étapes pour une association, une entreprise ou « Autre ».
// Les règles viennent du serveur (#regles-inscription, src/lib/dossier-usager.ts) :
//   { <type>: { titre, etape2, champs: { <name>: { visible, requis, libelle, aide } } } }
//   etape2 = titre de l'étape 2, null pour un particulier (une seule étape).
// Un champ masqué est aussi désactivé : il n'est pas envoyé. Le serveur reçoit toujours
// le formulaire complet et refait tous les contrôles.
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

    function appliquer(form, r) {
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

    /** Les champs actifs d'une étape sont-ils valides ? Sinon, le navigateur signale le premier. */
    function etapeValide(etape) {
        var champs = etape.querySelectorAll('input, select, textarea');
        for (var i = 0; i < champs.length; i++) {
            if (!champs[i].disabled && !champs[i].checkValidity()) {
                champs[i].reportValidity();
                return false;
            }
        }
        return true;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.querySelector('form[data-inscription-etapes]');
        var source = document.getElementById('regles-inscription');
        if (!form || !source) return;
        var regles;
        try { regles = JSON.parse(source.textContent); } catch (e) { return; }

        var choix = form.querySelector('[data-type-org]');
        var etape1 = form.querySelector('[data-etape="1"]');
        var etape2 = form.querySelector('[data-etape="2"]');
        var adresse = form.querySelector('[data-bloc-adresse]');
        var place1 = form.querySelector('[data-place-adresse="1"]');
        var place2 = form.querySelector('[data-place-adresse="2"]');
        var indicateur = form.querySelector('[data-indicateur]');
        var numero = form.querySelector('[data-numero]');
        var titreEtape = form.querySelector('[data-titre-etape]');
        var cgu = form.querySelector('[data-cgu]');
        var creer = form.querySelector('[data-creer]');
        var continuer = form.querySelector('[data-continuer]');
        var retour = form.querySelector('[data-retour]');
        var dejaInscrit = document.querySelector('[data-deja-inscrit]');
        var etape = 1;

        function regle() { return regles[choix.value] || regles.particulier; }

        /** Une étape d'organisation pour ce type ? */
        function deuxEtapes() { return Boolean(regle().etape2); }

        function afficher() {
            var deux = deuxEtapes();
            if (!deux) etape = 1;
            etape1.hidden = etape !== 1;
            etape2.hidden = etape !== 2;
            indicateur.hidden = !deux;
            numero.textContent = String(etape);
            if (titreEtape) titreEtape.textContent = etape === 1 ? 'Vous' : regle().etape2;
            // Masqué à l'étape 2 mais sa place est gardée : le bouton ne bouge pas d'une étape à l'autre.
            if (dejaInscrit) dejaInscrit.style.visibility = etape === 2 ? 'hidden' : '';
            // Le bouton final et la case d'acceptation n'apparaissent qu'à la dernière étape.
            var derniere = !deux || etape === 2;
            cgu.hidden = !derniere;
            form.elements.cgu.disabled = !derniere;
            creer.hidden = !derniere;
            continuer.hidden = derniere;
            retour.hidden = etape !== 2;
        }

        function majType() {
            var r = regle();
            appliquer(form, r);
            // L'adresse : celle du particulier (étape 1) ou celle du siège (étape 2).
            var cible = r.etape2 ? place2 : place1;
            if (adresse.parentElement !== cible) cible.appendChild(adresse);
            afficher();
        }

        choix.addEventListener('change', majType);
        continuer.addEventListener('click', function () {
            if (!etapeValide(etape1)) return;
            etape = 2;
            afficher();
            var premier = etape2.querySelector('input:not([disabled])');
            if (premier) premier.focus();
        });
        retour.addEventListener('click', function () {
            etape = 1;
            afficher();
            choix.focus();
        });
        // Entrée à l'étape 1 : passer à l'étape suivante plutôt qu'envoyer. Écouté en
        // capture et stoppé, pour que l'anti double-clic ne désactive pas le bouton final.
        form.addEventListener('submit', function (e) {
            if (deuxEtapes() && etape === 1) {
                e.preventDefault();
                e.stopImmediatePropagation();
                continuer.click();
            }
        }, true);
        majType();
    });
})();
