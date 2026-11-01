// Cloche : marque les notifications lues à l'ouverture du menu, rafraîchit le compteur
// toutes les deux minutes. Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        var bouton = document.getElementById('notif-bouton');
        if (!bouton) return;
        var csrf = bouton.dataset.csrf || '';
        bouton.addEventListener('shown.bs.dropdown', function () {
            var nonLues = document.querySelectorAll('.notif.non-lue');
            if (!nonLues.length) return;
            fetch('/api/notifications/lues', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrf } })
                .then(function () {
                    var dot = bouton.querySelector('.dot');
                    if (dot) dot.remove();
                    setTimeout(function () { nonLues.forEach(function (n) { n.classList.remove('non-lue'); }); }, 1500);
                })
                .catch(function () {});
        });
        setInterval(function () {
            fetch('/api/notifications/count', { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (!d) return;
                    var dot = bouton.querySelector('.dot');
                    if (d.count > 0 && !dot) {
                        var s = document.createElement('span');
                        s.className = 'dot';
                        bouton.appendChild(s);
                    } else if (d.count === 0 && dot) dot.remove();
                })
                .catch(function () {});
        }, 120000);
    });
})();
