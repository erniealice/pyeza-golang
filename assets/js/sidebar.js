/**
 * Sidebar & App Switcher
 * Auto-copied from pyeza to apps via CopyStaticAssets().
 */
(function() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const appSwitcher = document.getElementById('appSwitcher');
    const appSwitcherBtn = document.getElementById('appSwitcherBtn');
    const appNav = document.getElementById('appNav');

    const STORAGE_KEY = 'sidebarCollapsed';

    // ========================================
    // Sidebar Toggle
    // ========================================

    function saveSidebarState(isCollapsed) {
        localStorage.setItem(STORAGE_KEY, isCollapsed);
    }

    function toggleSidebar() {
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        saveSidebarState(sidebar.classList.contains('collapsed'));
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }

    // Ctrl+B to toggle sidebar
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
    });

    // ========================================
    // App Switcher
    // ========================================

    if (appSwitcher && appSwitcherBtn) {
        function toggleAppSwitcher(open) {
            const isOpen = typeof open === 'boolean' ? open : !appSwitcher.classList.contains('open');
            appSwitcher.classList.toggle('open', isOpen);
            appSwitcherBtn.setAttribute('aria-expanded', isOpen);
        }

        function selectApp(href) {
            // Close before navigating so bfcache stores the closed state
            toggleAppSwitcher(false);

            if (appNav) {
                appNav.classList.add('switching');
                setTimeout(() => appNav.classList.remove('switching'), 300);
            }
            if (href) {
                window.location.href = href;
            }
        }

        // Toggle on button click
        appSwitcherBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleAppSwitcher();
        });

        // Accordion group toggles
        appSwitcher.querySelectorAll('.app-switcher-group-title').forEach(function(title) {
            title.addEventListener('click', function(e) {
                e.stopPropagation();
                var group = title.closest('.app-switcher-group');
                var isOpen = group.classList.toggle('open');
                title.setAttribute('aria-expanded', isOpen);
            });
        });

        // App option selection
        appSwitcher.querySelectorAll('.app-option').forEach(function(option) {
            option.addEventListener('click', function() {
                selectApp(option.dataset.href);
            });

            option.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    option.click();
                }
            });
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!appSwitcher.contains(e.target)) {
                toggleAppSwitcher(false);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Escape to close
            if (e.key === 'Escape' && appSwitcher.classList.contains('open')) {
                toggleAppSwitcher(false);
                appSwitcherBtn.focus();
            }

            // Ctrl+Shift+A to toggle
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                toggleAppSwitcher();
            }
        });

        // Arrow key navigation in menu (vertical, only visible items)
        appSwitcher.addEventListener('keydown', function(e) {
            if (!appSwitcher.classList.contains('open')) return;

            var options = Array.from(appSwitcher.querySelectorAll('.app-switcher-group.open .app-option'));
            var currentIndex = options.findIndex(function(opt) { return opt === document.activeElement; });

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
                options[nextIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
                options[prevIndex].focus();
            }
        });
    }

    // ========================================
    // User Menu
    // ========================================

    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');

    if (userMenuBtn && userMenu) {
        function toggleUserMenu(open) {
            const isOpen = typeof open === 'boolean' ? open : !userMenu.classList.contains('active');
            userMenu.classList.toggle('active', isOpen);
            userMenuBtn.classList.toggle('active', isOpen);
            userMenuBtn.setAttribute('aria-expanded', isOpen);
        }

        // Toggle on button click
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleUserMenu();
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
                toggleUserMenu(false);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Escape to close
            if (e.key === 'Escape' && userMenu.classList.contains('active')) {
                toggleUserMenu(false);
                userMenuBtn.focus();
            }
        });

        // Arrow key navigation in menu
        userMenu.addEventListener('keydown', function(e) {
            if (!userMenu.classList.contains('active')) return;

            const items = Array.from(userMenu.querySelectorAll('.user-menu-item'));
            const currentIndex = items.findIndex(item => item === document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                items[nextIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                items[prevIndex].focus();
            }
        });
    }
})();
