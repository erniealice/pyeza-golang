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

    const STORAGE_KEY = 'lf-sidebar-collapsed';

    // ========================================
    // Sidebar Toggle
    // ========================================

    function saveSidebarState(isCollapsed) {
        localStorage.setItem(STORAGE_KEY, isCollapsed);
    }

    function toggleSidebar() {
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        saveSidebarState(isCollapsed);
        // P2: sync aria-expanded on the toggle button
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        }
    }

    // Sync body class on load if sidebar starts collapsed (e.g. restored from localStorage)
    if (sidebar && sidebar.classList.contains('collapsed')) {
        document.body.classList.add('sidebar-collapsed');
    }

    // P2: set initial aria-expanded on the toggle button to reflect current sidebar state
    if (toggleBtn && sidebar) {
        toggleBtn.setAttribute('aria-expanded', sidebar.classList.contains('collapsed') ? 'false' : 'true');
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
        function updateMenuMaxHeight() {
            var menu = appSwitcher.querySelector('.app-switcher-menu');
            if (!menu) return;
            var rect = appSwitcher.getBoundingClientRect();
            var menuTop = rect.bottom + 4; // 0.25rem gap below the button
            var availableHeight = window.innerHeight - menuTop - 16; // 16px bottom padding
            menu.style.maxHeight = Math.max(availableHeight, 120) + 'px'; // at least 120px
        }

        function toggleAppSwitcher(open) {
            const isOpen = typeof open === 'boolean' ? open : !appSwitcher.classList.contains('open');
            appSwitcher.classList.toggle('open', isOpen);
            appSwitcherBtn.setAttribute('aria-expanded', isOpen);

            if (isOpen) {
                // Expand all groups so the user sees everything on open
                appSwitcher.querySelectorAll('.app-switcher-group').forEach(function(group) {
                    group.classList.add('open');
                    var title = group.querySelector('.app-switcher-group-title');
                    if (title) title.setAttribute('aria-expanded', 'true');
                });
                // Calculate max height based on remaining viewport space
                requestAnimationFrame(updateMenuMaxHeight);
            } else {
                // Clear inline max-height when closing
                var menu = appSwitcher.querySelector('.app-switcher-menu');
                if (menu) menu.style.maxHeight = '';
            }
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

        // Close button in menu header
        var closeBtn = appSwitcher.querySelector('.app-switcher-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleAppSwitcher(false);
            });
        }

        // P2: wire aria-controls on app-switcher group titles to their panel
        appSwitcher.querySelectorAll('.app-switcher-group').forEach(function(group) {
            var title = group.querySelector('.app-switcher-group-title');
            var panel = group.querySelector('.app-switcher-group-items, .app-switcher-options, ul, [role="group"]');
            if (title && panel) {
                if (!panel.id) {
                    panel.id = 'app-switcher-group-' + Math.random().toString(36).slice(2, 8);
                }
                title.setAttribute('aria-controls', panel.id);
            }
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

        // Recalculate max-height on resize while open
        window.addEventListener('resize', function() {
            if (appSwitcher.classList.contains('open')) {
                updateMenuMaxHeight();
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
    // Mobile Sidebar
    // ========================================

    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    /**
     * Calculate the offset for the scrollable nav area.
     * Measures sidebar-header + app-switcher heights, then sets a CSS
     * custom property so the max-height calc stays accurate.
     */
    function updateMobileNavHeight() {
        if (!sidebar || !isMobile()) return;
        var offset = 0;
        var header = sidebar.querySelector('.sidebar-header');
        var switcher = sidebar.querySelector('.app-switcher');
        if (header) offset += header.offsetHeight;
        if (switcher) offset += switcher.offsetHeight;
        sidebar.style.setProperty('--sidebar-mobile-header-offset', offset + 'px');
    }

    function openMobileSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('mobile-open');
        if (sidebarOverlay) sidebarOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden'; // prevent body scroll

        // Expand ALL app-switcher groups so user sees everything
        sidebar.querySelectorAll('.app-switcher-group').forEach(function(group) {
            group.classList.add('open');
            var title = group.querySelector('.app-switcher-group-title');
            if (title) title.setAttribute('aria-expanded', 'true');
        });

        // Calculate offset after groups expand (in next frame for accurate measurement)
        requestAnimationFrame(updateMobileNavHeight);
    }

    function closeMobileSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('mobile-open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    // #mobileMenuToggle lives inside #page-header which is OOB-swapped on every
    // HTMX navigation — use document delegation so the handler survives swaps.
    lf.on('click', '#mobileMenuToggle', function(e) {
        e.stopPropagation();
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    });

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // Close mobile sidebar on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
            closeMobileSidebar();
        }
    });

    // Close mobile sidebar when navigating (HTMX or link click inside nav)
    if (sidebar) {
        sidebar.querySelectorAll('.nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                if (isMobile()) closeMobileSidebar();
            });
        });
    }

    // Recalculate on resize
    window.addEventListener('resize', function() {
        if (!isMobile() && sidebar) {
            sidebar.classList.remove('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
            document.body.style.overflow = '';
        }
    });

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

    // ========================================
    // Active Nav Highlight (HTMX navigation)
    // ========================================
    // hx-boost swaps only #main-content — sidebar stays stale.
    // Update the active nav item by matching the new URL against
    // nav-item hrefs using longest common path-prefix.

    function updateActiveNav() {
        if (!appNav) return;

        var pathname = location.pathname;
        var items = appNav.querySelectorAll('.nav-item');
        var bestItems = [];
        var bestLen = 0;

        items.forEach(function(item) {
            var href = item.getAttribute('href');
            if (!href) return;

            var hrefParts = href.split('/').filter(Boolean);
            var pathParts = pathname.split('/').filter(Boolean);
            var matchLen = 0;

            for (var i = 0; i < Math.min(hrefParts.length, pathParts.length); i++) {
                if (hrefParts[i] === pathParts[i]) matchLen++;
                else break;
            }

            if (matchLen > bestLen) {
                bestLen = matchLen;
                bestItems = [item];
            } else if (matchLen === bestLen && matchLen > 0) {
                bestItems.push(item);
            }
        });

        if (bestLen < 2) return; // need at least /app/{section} match

        // If tie, keep current active if it's one of the candidates
        if (bestItems.length > 1) {
            var current = appNav.querySelector('.nav-item.active');
            if (current && bestItems.indexOf(current) !== -1) return;
        }

        items.forEach(function(i) { i.classList.remove('active'); });
        bestItems[0].classList.add('active');
    }

    document.addEventListener('htmx:pushedIntoHistory', updateActiveNav);
    window.addEventListener('popstate', updateActiveNav);
})();
