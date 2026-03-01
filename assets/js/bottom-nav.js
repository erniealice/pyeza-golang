// Bottom Nav — More sheet toggle & FAB navigation
(function() {
    'use strict';

    var sheet = document.getElementById('mobile-app-grid');
    var backdrop = document.getElementById('mobile-app-sheet-backdrop');

    function openSheet() {
        if (sheet) sheet.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeSheet() {
        if (sheet) sheet.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    function isSheetOpen() {
        return sheet && sheet.classList.contains('open');
    }

    // More tab click — toggle sheet
    document.addEventListener('click', function(e) {
        var moreTab = e.target.closest('.bottom-nav-tab[href="#more"]');
        if (moreTab) {
            e.preventDefault();
            if (isSheetOpen()) {
                closeSheet();
            } else {
                openSheet();
            }
            return;
        }

        // FAB click — navigate to href
        var fab = e.target.closest('.bottom-nav-fab');
        if (fab) {
            var href = fab.getAttribute('data-href');
            if (href) {
                window.location.href = href;
            }
            return;
        }
    });

    // Backdrop click — close sheet
    if (backdrop) {
        backdrop.addEventListener('click', closeSheet);
    }

    // Escape key — close sheet
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isSheetOpen()) {
            closeSheet();
        }
    });

    // Close sheet on navigation (HTMX)
    document.addEventListener('htmx:beforeRequest', function() {
        if (isSheetOpen()) {
            closeSheet();
        }
    });

    // Close sheet when clicking an app link inside it
    if (sheet) {
        sheet.addEventListener('click', function(e) {
            if (e.target.closest('.mobile-app-sheet-item')) {
                closeSheet();
            }
        });
    }
})();
