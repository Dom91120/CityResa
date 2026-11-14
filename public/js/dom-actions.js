// Gestes déclaratifs, à la place des attributs onclick/onchange inline des gabarits
// Flask (interdits par la CSP à nonce) :
//   [data-action="nom"]            clic → window[nom]()
//   [data-href-select]             changement → location.href = valeur choisie
//   [data-click-prev]              clic → déclenche l'élément précédent (champ fichier caché)
//   [data-fichier-nom]             changement d'un champ fichier → recopie le nom dans
//                                  le champ `filename` du formulaire et l'infobulle du bouton
//   [data-fichier-bouton]          changement d'un champ fichier → infobulle + couleur du bouton
//   [data-virtuel-kind]            case « Virtuel » → champ caché kind = vm | physical
//   [data-ouvrir-onglet="id"]      clic → ouvre l'onglet (bouton #ong-id)
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    if (a) {
      var fn = window[a.getAttribute('data-action')];
      if (typeof fn === 'function') { e.preventDefault(); fn.call(a, e); }
      return;
    }
    var p = e.target.closest('[data-click-prev]');
    if (p && p.previousElementSibling) { e.preventDefault(); p.previousElementSibling.click(); return; }
    var o = e.target.closest('[data-ouvrir-onglet]');
    if (o) {
      var b = document.getElementById('ong-' + o.getAttribute('data-ouvrir-onglet'));
      if (b) b.click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var a = e.target.closest && e.target.closest('[data-action][role="button"]');
    if (!a) return;
    var fn = window[a.getAttribute('data-action')];
    if (typeof fn === 'function') { e.preventDefault(); fn.call(a, e); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('[data-href-select]')) { location.href = t.value; return; }
    if (t.matches('[data-fichier-nom]')) {
      var champ = t.form && t.form.elements.filename;
      if (champ) champ.value = t.files.length ? t.files[0].name : '';
      var btn = t.nextElementSibling;
      if (btn) btn.title = t.files.length ? 'Choisi : ' + t.files[0].name : (btn.dataset.titre || btn.title);
      return;
    }
    if (t.matches('[data-fichier-bouton]')) {
      var b2 = t.nextElementSibling;
      if (!b2) return;
      b2.title = t.files.length ? 'Choisi : ' + t.files[0].name : (b2.dataset.titre || b2.title);
      b2.classList.toggle('btn-primary', !!t.files.length);
      b2.classList.toggle('btn-outline-secondary', !t.files.length);
      return;
    }
    if (t.matches('[data-virtuel-kind]')) {
      var h = t.nextElementSibling;
      if (h) h.value = t.checked ? 'vm' : 'physical';
    }
  });
})();

// [data-soumettre-au-changement] : la case cochée envoie aussitôt son formulaire
// (remplace l'ancien onchange="this.form.requestSubmit()", interdit par la CSP).
document.addEventListener('change', function (e) {
    var t = e.target.closest && e.target.closest('[data-soumettre-au-changement]');
    if (t && t.form) t.form.requestSubmit();
});

// [data-choix-memorise="cle"] : bouton scindé dont la partie gauche ([data-choix-principal])
// lance le dernier choix fait dans le menu. Une entrée du menu ([data-choix-valeur], lien visé
// dans data-choix-href) ne lance rien : elle change le choix, retenu dans le navigateur. Au
// chargement comme au choix, le bouton principal reprend le lien et le libellé
// ([data-choix-libelle]) de l'entrée retenue, qui est cochée dans le menu.
(function () {
    'use strict';
    function appliquer(groupe, valeur) {
        var principal = groupe.querySelector('[data-choix-principal]');
        var retenu = null;
        groupe.querySelectorAll('[data-choix-valeur]').forEach(function (i) {
            var oui = i.getAttribute('data-choix-valeur') === valeur;
            if (oui) retenu = i;
        });
        if (!principal || !retenu) return;
        groupe.querySelectorAll('[data-choix-valeur]').forEach(function (i) {
            i.classList.toggle('est-retenu', i === retenu);
            if (i === retenu) i.setAttribute('aria-current', 'true');
            else i.removeAttribute('aria-current');
        });
        principal.setAttribute('href', retenu.getAttribute('data-choix-href'));
        var libelle = principal.querySelector('[data-choix-libelle]');
        if (libelle) libelle.textContent = valeur;
    }
    document.querySelectorAll('[data-choix-memorise]').forEach(function (groupe) {
        var valeur = null;
        try { valeur = localStorage.getItem('choix-' + groupe.getAttribute('data-choix-memorise')); } catch (e) {}
        if (valeur) appliquer(groupe, valeur);
    });
    document.addEventListener('click', function (e) {
        var choix = e.target.closest && e.target.closest('[data-choix-valeur]');
        var groupe = choix && choix.closest('[data-choix-memorise]');
        if (!groupe) return;
        var valeur = choix.getAttribute('data-choix-valeur');
        try { localStorage.setItem('choix-' + groupe.getAttribute('data-choix-memorise'), valeur); } catch (err) {}
        appliquer(groupe, valeur);
    });
})();

// [data-date-aller] : un champ de date placé hors de son formulaire (attribut form) l'envoie dès
// qu'une date est choisie, comme le ferait un champ du formulaire à envoi automatique.
document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[data-date-aller]') && t.form && t.value) t.form.requestSubmit();
});
