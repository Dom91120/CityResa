// Thème clair / sombre, menu latéral mobile, raccourci Ctrl K, sections repliables,
// menus utilisateur et messages flash. Aucun attribut inline (CSP à nonce).
function applyThemeIcons(theme) {
    document.querySelectorAll('.js-theme-icon').forEach(function (icon) {
        icon.innerHTML = '<svg class="lucide" width="18" height="18" aria-hidden="true"><use href="/vendor/lucide.svg#' + (theme === 'dark' ? 'sun' : 'moon') + '"></use></svg>';
    });
}

function toggleTheme() {
    var html = document.documentElement;
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyThemeIcons(next);
}

function openSidebar() {
    var s = document.querySelector('.sidebar');
    if (s) s.classList.add('open');
    var b = document.querySelector('.sidebar-backdrop');
    if (b) b.classList.add('show');
}
function closeSidebar() {
    var s = document.querySelector('.sidebar');
    if (s) s.classList.remove('open');
    var b = document.querySelector('.sidebar-backdrop');
    if (b) b.classList.remove('show');
}
function toggleSidebar() {
    var s = document.querySelector('.sidebar');
    if (s && s.classList.contains('open')) closeSidebar(); else openSidebar();
}

document.addEventListener('DOMContentLoaded', function () {
    var forced = new URLSearchParams(location.search).get('theme');
    var saved = forced || (function () { try { return localStorage.getItem('theme'); } catch (e) { return null; } })() || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    applyThemeIcons(saved);

    document.querySelectorAll('.sidebar-link').forEach(function (link) {
        link.addEventListener('click', closeSidebar);
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 991) closeSidebar();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            var champ = document.getElementById('recherche-globale');
            if (champ) {
                e.preventDefault();
                champ.focus();
                champ.select();
            }
        }
    });

    document.querySelectorAll('details.sidebar-section--repliable').forEach(function (d) {
        var cle = 'nav-open-' + (d.dataset.section || 'x');
        if (!d.hasAttribute('data-forced-open')) {
            try { if (localStorage.getItem(cle) === '1') d.open = true; } catch (e) {}
        }
        d.addEventListener('toggle', function () {
            try { localStorage.setItem(cle, d.open ? '1' : '0'); } catch (e) {}
        });
    });

    document.querySelectorAll('.alert.js-autodismiss').forEach(function (el) {
        if (/alert-(success|info)/.test(el.className)) {
            setTimeout(function () {
                if (window.bootstrap && bootstrap.Alert) bootstrap.Alert.getOrCreateInstance(el).close();
                else el.classList.remove('show');
            }, 6000);
        }
    });

    document.addEventListener('click', function (e) {
        document.querySelectorAll('details.sidebar-user[open]').forEach(function (d) {
            if (!d.contains(e.target)) d.removeAttribute('open');
        });
    });

    // Un lien « #modal-id » ouvre directement la fenêtre correspondante.
    (function () {
        var id = (location.hash || '').slice(1);
        if (!id || !window.bootstrap) return;
        var el = document.getElementById(id);
        if (el && el.classList.contains('modal') && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(el).show();
            history.replaceState(null, '', location.pathname + location.search);
        }
        if (el && el.classList.contains('offcanvas') && bootstrap.Offcanvas) {
            bootstrap.Offcanvas.getOrCreateInstance(el).show();
            history.replaceState(null, '', location.pathname + location.search);
        }
    })();

    // Infobulles Bootstrap.
    if (window.bootstrap && bootstrap.Tooltip) {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) { new bootstrap.Tooltip(el); });
    }
});
