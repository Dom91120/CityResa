// Modèles de courriel : rédaction directe dans l'aperçu habillé (une seule zone).
//   [data-editeur-courriel]       le conteneur ; data-exemples = JSON des valeurs d'exemple
//   [data-zone]                   la zone contenteditable (le corps du courriel)
//   textarea#f-body               la source HTML, cachée, maintenue à jour ; visible en mode HTML
//   [data-outil="…"]              gras, italique, lien, liste, citation, paragraphe
//   [data-variable="x"]           insère {{x}} au curseur (sujet ou corps, selon le dernier champ actif)
//   [data-basculer-html]          alterne éditeur / HTML
//   [data-exemples-toggle]        affiche les jetons avec leurs valeurs d'exemple
// Les variables apparaissent comme des jetons insécables ; à l'enregistrement le HTML est
// normalisé (balises admises seulement), puis à nouveau côté serveur.
(function () {
  'use strict';

  var ADMISES = { P: 1, STRONG: 1, EM: 1, A: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, BR: 1 };
  var RENOMMEES = { B: 'STRONG', I: 'EM', DIV: 'P', H1: 'P', H2: 'P', H3: 'P', H4: 'P' };

  function jeton(nom, brut, exemples, montrerExemple) {
    var s = document.createElement('span');
    s.className = 'jeton-variable';
    s.contentEditable = 'false';
    s.dataset.var = nom;
    s.dataset.brut = brut ? '1' : '';
    s.title = exemples[nom] ? 'Exemple : ' + exemples[nom] : 'Variable ' + nom;
    s.textContent = montrerExemple && exemples[nom] ? exemples[nom] : (brut ? '{{{' : '{{') + nom + (brut ? '}}}' : '}}');
    return s;
  }

  // Remplace, dans les nœuds texte, {{x}} et {{{x}}} par des jetons.
  function poserJetons(racine, exemples, montrerExemple) {
    var marche = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    var textes = [];
    while (marche.nextNode()) textes.push(marche.currentNode);
    textes.forEach(function (t) {
      var re = /\{\{(\{?)\s*(\w+)\s*\}?\}\}/g;
      if (!re.test(t.nodeValue)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var dernier = 0;
      var m;
      while ((m = re.exec(t.nodeValue))) {
        if (m.index > dernier) frag.appendChild(document.createTextNode(t.nodeValue.slice(dernier, m.index)));
        frag.appendChild(jeton(m[2], m[1] === '{', exemples, montrerExemple));
        dernier = m.index + m[0].length;
      }
      if (dernier < t.nodeValue.length) frag.appendChild(document.createTextNode(t.nodeValue.slice(dernier)));
      t.parentNode.replaceChild(frag, t);
    });
  }

  // Le HTML normalisé d'un nœud : balises admises, sans attribut (href gardé), jetons → texte.
  function serialiser(noeud) {
    var out = '';
    noeud.childNodes.forEach(function (n) {
      if (n.nodeType === 3) {
        out += n.nodeValue.replace(/​/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, ' ');
        return;
      }
      if (n.nodeType !== 1) return;
      if (n.classList.contains('jeton-variable')) {
        out += (n.dataset.brut ? '{{{' : '{{') + n.dataset.var + (n.dataset.brut ? '}}}' : '}}');
        return;
      }
      var nom = RENOMMEES[n.tagName] || n.tagName;
      if (nom === 'BR') { out += '<br>'; return; }
      if (!ADMISES[nom]) { out += serialiser(n); return; }
      var b = nom.toLowerCase();
      var attr = '';
      if (b === 'a') {
        var href = n.getAttribute('href') || '';
        if (/^(https?:\/\/|mailto:|\{\{)/i.test(href)) attr = ' href="' + href.replace(/"/g, '&quot;') + '"';
      }
      out += '<' + b + attr + '>' + serialiser(n) + '</' + b + '>';
    });
    return out;
  }

  function nettoyerHtml(html) {
    return html
      .replace(/<p>(\s|<br>|&nbsp;)*<\/p>/g, '')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function selectionDans(zone) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    return zone.contains(r.commonAncestorContainer) ? r : null;
  }

  function insererAuCurseur(input, texte) {
    var debut = input.selectionStart == null ? input.value.length : input.selectionStart;
    var fin = input.selectionEnd == null ? debut : input.selectionEnd;
    input.value = input.value.slice(0, debut) + texte + input.value.slice(fin);
    input.focus();
    input.selectionStart = input.selectionEnd = debut + texte.length;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ed = document.querySelector('[data-editeur-courriel]');
    if (!ed) return;
    var zone = ed.querySelector('[data-zone]');
    var source = document.getElementById('f-body');
    var sujet = document.getElementById('f-subject');
    var form = source && source.form;
    if (!zone || !source || !form) return;
    var exemples = {};
    try { exemples = JSON.parse(ed.dataset.exemples || '{}'); } catch (e) { exemples = {}; }
    var modeHtml = false;
    var montrerExemple = false;
    var dernierChamp = 'corps';
    var plage = null;

    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ancien navigateur */ }

    function charger() {
      zone.innerHTML = source.value;
      poserJetons(zone, exemples, montrerExemple);
      if (!zone.textContent.trim() && !zone.querySelector('p')) zone.innerHTML = '<p><br></p>';
    }
    function synchroniser() {
      if (modeHtml) return;
      source.value = nettoyerHtml(serialiser(zone));
    }
    function memoriserPlage() {
      var r = selectionDans(zone);
      if (r) plage = r.cloneRange();
    }
    function restaurerPlage() {
      zone.focus();
      if (!plage) return;
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(plage);
    }

    charger();
    ed.classList.add('est-actif');

    zone.addEventListener('input', synchroniser);
    zone.addEventListener('keyup', memoriserPlage);
    zone.addEventListener('mouseup', memoriserPlage);
    zone.addEventListener('focus', function () { dernierChamp = 'corps'; });
    if (sujet) sujet.addEventListener('focus', function () { dernierChamp = 'sujet'; });
    form.addEventListener('submit', synchroniser, true);

    // Collage : texte brut seulement, les balises reviennent par la barre d'outils.
    zone.addEventListener('paste', function (e) {
      var texte = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (texte == null) return;
      e.preventDefault();
      document.execCommand('insertText', false, texte);
    });

    // Barre d'outils.
    ed.querySelectorAll('[data-outil]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        var outil = btn.dataset.outil;
        restaurerPlage();
        if (outil === 'gras') document.execCommand('bold');
        else if (outil === 'italique') document.execCommand('italic');
        else if (outil === 'liste') document.execCommand('insertUnorderedList');
        else if (outil === 'citation') document.execCommand('formatBlock', false, 'blockquote');
        else if (outil === 'paragraphe') document.execCommand('formatBlock', false, 'p');
        else if (outil === 'lien') {
          var saisie = ed.querySelector('[data-lien-saisie]');
          if (saisie) {
            saisie.hidden = !saisie.hidden;
            if (!saisie.hidden) {
              var a = plage && plage.commonAncestorContainer.parentElement && plage.commonAncestorContainer.parentElement.closest('a');
              saisie.querySelector('input').value = a ? a.getAttribute('href') : '';
              saisie.querySelector('input').focus();
              return;
            }
          }
        }
        memoriserPlage();
        synchroniser();
      });
    });
    var lienOk = ed.querySelector('[data-lien-appliquer]');
    if (lienOk) {
      lienOk.addEventListener('click', function () {
        var saisie = ed.querySelector('[data-lien-saisie]');
        var url = saisie.querySelector('input').value.trim();
        restaurerPlage();
        if (!url) document.execCommand('unlink');
        else if (plage && plage.collapsed) {
          document.execCommand('insertHTML', false, '<a href="' + url.replace(/"/g, '&quot;') + '">' + url.replace(/</g, '&lt;') + '</a>');
        } else document.execCommand('createLink', false, url);
        saisie.hidden = true;
        memoriserPlage();
        synchroniser();
      });
    }

    // Variables : insérées dans le dernier champ actif.
    document.querySelectorAll('[data-variable]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        var nom = btn.dataset.variable;
        if (sujet && (dernierChamp === 'sujet' || document.activeElement === sujet)) { insererAuCurseur(sujet, '{{' + nom + '}}'); return; }
        if (modeHtml) { insererAuCurseur(source, '{{' + nom + '}}'); return; }
        restaurerPlage();
        var r = selectionDans(zone);
        var j = jeton(nom, false, exemples, montrerExemple);
        var espace = document.createTextNode('​');
        if (r) {
          r.deleteContents();
          r.insertNode(espace);
          r.insertNode(j);
          r.setStartAfter(espace);
          r.collapse(true);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        } else {
          var p = zone.lastElementChild || zone.appendChild(document.createElement('p'));
          p.appendChild(j);
          p.appendChild(espace);
        }
        memoriserPlage();
        synchroniser();
      });
    });

    // Éditeur / HTML.
    var bascule = ed.querySelector('[data-basculer-html]');
    if (bascule) {
      bascule.addEventListener('click', function () {
        if (modeHtml) {
          charger();
          modeHtml = false;
        } else {
          synchroniser();
          modeHtml = true;
        }
        ed.classList.toggle('mode-html', modeHtml);
        bascule.textContent = modeHtml ? 'Revenir à l’éditeur' : 'Afficher le HTML';
        (modeHtml ? source : zone).focus();
      });
    }

    // Jetons : nom de la variable ou valeur d'exemple.
    var ex = ed.querySelector('[data-exemples-toggle]');
    if (ex) {
      ex.addEventListener('change', function () {
        montrerExemple = ex.checked;
        zone.querySelectorAll('.jeton-variable').forEach(function (j) {
          var nom = j.dataset.var;
          j.textContent = montrerExemple && exemples[nom] ? exemples[nom] : (j.dataset.brut ? '{{{' : '{{') + nom + (j.dataset.brut ? '}}}' : '}}');
        });
        ed.classList.toggle('avec-exemples', montrerExemple);
      });
    }
  });
})();
