// Actions « sur place » : la page ne se recharge pas et ne défile pas.
//
//   <form data-sur-place="creneau-12">   formulaire envoyé en arrière-plan ; la zone
//                                         [data-zone-maj] qui contient la ligne #creneau-12
//                                         est remplacée par sa version à jour, et le message
//                                         s'affiche sous #creneau-12.
//
// Sans JavaScript, ou si la réponse est inattendue, le formulaire part normalement.
// Repli : une page qui arrive avec une ancre (#creneau-12) et des messages les déplace
// aussi sous la ligne visée, sans faire défiler.
(function () {
  'use strict';

  function ligneMessage(cible) {
    if (cible.tagName === 'TR') {
      var tr = document.createElement('tr');
      tr.className = 'flash-ligne';
      var td = document.createElement('td');
      td.colSpan = cible.cells.length || 1;
      tr.appendChild(td);
      cible.parentNode.insertBefore(tr, cible.nextSibling);
      return { conteneur: td, bloc: tr };
    }
    var div = document.createElement('div');
    div.className = 'flash-sur-place';
    cible.parentNode.insertBefore(div, cible.nextSibling);
    return { conteneur: div, bloc: div };
  }

  /** Place les alertes sous la cible ; les succès se ferment seuls. */
  function poser(cible, alertes) {
    if (!cible || !alertes.length) return;
    var place = ligneMessage(cible);
    alertes.forEach(function (a) {
      a.classList.add('alert-sur-place');
      place.conteneur.appendChild(a);
      a.addEventListener('closed.bs.alert', function () {
        if (!place.conteneur.querySelector('.alert')) place.bloc.remove();
      });
      if (/alert-(success|info)/.test(a.className)) {
        setTimeout(function () {
          if (window.bootstrap && bootstrap.Alert) bootstrap.Alert.getOrCreateInstance(a).close();
          else place.bloc.remove();
        }, 6000);
      }
    });
    cible.classList.add('cible-flash');
    setTimeout(function () { cible.classList.remove('cible-flash'); }, 2500);
  }

  function nettoyerModales() {
    document.querySelectorAll('.modal.show').forEach(function (m) {
      if (window.bootstrap && bootstrap.Modal) {
        var inst = bootstrap.Modal.getInstance(m);
        if (inst) inst.hide();
      }
    });
    document.querySelectorAll('.modal-backdrop').forEach(function (b) { b.remove(); });
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-sur-place')) return;
    if (e.defaultPrevented || !window.fetch || !window.DOMParser) return;
    var ancre = form.getAttribute('data-sur-place');
    var cibleAvant = document.getElementById(ancre);
    var zone = (cibleAvant && cibleAvant.closest('[data-zone-maj]')) || form.closest('[data-zone-maj]');
    if (!zone) return;
    e.preventDefault();
    var donnees;
    try { donnees = new FormData(form, e.submitter || undefined); } catch (err) { donnees = new FormData(form); }
    var boutons = form.querySelectorAll('button[type="submit"]');
    boutons.forEach(function (b) { b.disabled = true; });
    fetch(form.action, { method: 'POST', body: donnees, credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var nom = zone.getAttribute('data-zone-maj');
        var nouvelle = doc.querySelector('[data-zone-maj="' + nom + '"]');
        if (!nouvelle) throw new Error('zone absente');
        var alertes = Array.prototype.slice.call(doc.querySelectorAll('.flash-zone .alert'));
        nettoyerModales();
        zone.replaceWith(document.importNode(nouvelle, true));
        poser(
          document.getElementById(ancre),
          alertes.map(function (a) { return document.importNode(a, true); }),
        );
        // Les messages sont affichés : on vide le cookie comme le ferait flash-clear.js.
        fetch('/api/flash', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
      })
      .catch(function () {
        // Repli : envoi classique (la page se recharge).
        boutons.forEach(function (b) { b.disabled = false; });
        form.removeAttribute('data-sur-place');
        HTMLFormElement.prototype.submit.call(form);
      });
  });

  // Repli après un rechargement complet avec ancre : messages sous la ligne, sans défilement.
  document.addEventListener('DOMContentLoaded', function () {
    var zone = document.querySelector('.flash-zone');
    if (!zone || !location.hash || location.hash.length < 2) return;
    var cible;
    try { cible = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { cible = null; }
    if (!cible) return;
    poser(cible, Array.prototype.slice.call(zone.querySelectorAll('.alert')));
    if (!zone.querySelector('.alert')) zone.remove();
  });
})();
