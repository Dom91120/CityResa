// Graphiques du tableau de bord et des statistiques (Chart.js, vendor). Chaque <canvas
// data-graphique> porte sa configuration en JSON dans un <script type="application/json">
// voisin (id = data-graphique). Aucun attribut inline (CSP à nonce).
(function () {
    'use strict';
    function couleurs() {
        var cs = getComputedStyle(document.documentElement);
        return {
            texte: cs.getPropertyValue('--muted').trim() || '#6b7280',
            ligne: cs.getPropertyValue('--line').trim() || '#ececf1',
            primaire: cs.getPropertyValue('--primary').trim() || '#006e46',
        };
    }
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.Chart) return;
        var c = couleurs();
        Chart.defaults.font.family = "'Poppins', sans-serif";
        Chart.defaults.color = c.texte;
        Chart.defaults.borderColor = c.ligne;
        document.querySelectorAll('canvas[data-graphique]').forEach(function (canvas) {
            var src = document.getElementById(canvas.dataset.graphique);
            if (!src) return;
            var cfg;
            try { cfg = JSON.parse(src.textContent); } catch (e) { return; }
            cfg.options = cfg.options || {};
            cfg.options.responsive = true;
            cfg.options.maintainAspectRatio = false;
            if (cfg.type === 'bar' || cfg.type === 'line') {
                cfg.options.scales = cfg.options.scales || {};
                cfg.options.scales.x = Object.assign({ grid: { display: false } }, cfg.options.scales.x || {});
                cfg.options.scales.y = Object.assign({ beginAtZero: true, grid: { color: c.ligne }, border: { display: false } }, cfg.options.scales.y || {});
            }
            cfg.options.plugins = cfg.options.plugins || {};
            if (cfg.options.plugins.legend === undefined) cfg.options.plugins.legend = { display: cfg.type === 'doughnut' ? false : true, position: 'bottom' };
            new Chart(canvas.getContext('2d'), cfg);
        });
    });
})();
