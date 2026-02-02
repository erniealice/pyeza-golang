/**
 * Notification Drawer
 * Modern slide-in notification system
 */
(function() {
    'use strict';

    // DOM Elements (will be fetched fresh via getElements)
    const tabs = document.querySelectorAll('.notification-tab');

    // State
    let notifications = [];
    let currentFilter = 'all';
    let isOpen = false;

    // Icon SVG templates
    const icons = {
        'alert-triangle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        'info': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        'alert-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        'user': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        'bell': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
    };

    // Map notification types to icons
    const typeIconMap = {
        'alert': 'alert-triangle',
        'success': 'check-circle',
        'info': 'info',
        'warning': 'alert-circle',
        'client': 'user',
        'quote': 'file-text',
        'system': 'settings'
    };

    /**
     * Format relative time
     */
    function formatRelativeTime(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) {
            return 'Just now';
        } else if (diffMin < 60) {
            return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
        } else if (diffHour < 24) {
            return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
        } else if (diffDay < 7) {
            return diffDay === 1 ? 'Yesterday' : `${diffDay} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    /**
     * Get icon SVG for notification
     */
    function getIconSvg(iconName) {
        return icons[iconName] || icons['bell'];
    }

    /**
     * Create notification card HTML
     */
    function createNotificationCard(notification) {
        const iconName = notification.icon || typeIconMap[notification.type] || 'bell';
        const iconSvg = getIconSvg(iconName);
        const unreadClass = notification.read ? '' : 'unread';

        return `
            <a href="${notification.actionUrl || '#'}" class="notification-card ${unreadClass}" data-id="${notification.id}">
                <div class="notification-icon ${notification.type}">
                    ${iconSvg}
                </div>
                <div class="notification-content">
                    <h4 class="notification-title">${escapeHtml(notification.title)}</h4>
                    <p class="notification-message">${escapeHtml(notification.message)}</p>
                    <span class="notification-time">${formatRelativeTime(notification.timestamp)}</span>
                </div>
                <button class="notification-dismiss" data-dismiss="${notification.id}" aria-label="Dismiss notification">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </a>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Filter notifications based on current filter
     */
    function filterNotifications() {
        let filtered = notifications;

        if (currentFilter === 'unread') {
            filtered = notifications.filter(n => !n.read);
        } else if (currentFilter === 'alert') {
            filtered = notifications.filter(n => n.type === 'alert' || n.type === 'warning');
        }

        return filtered;
    }

    /**
     * Render notifications
     */
    function renderNotifications() {
        const filtered = filterNotifications();
        const els = getElements();
        if (!els.itemsContainer) return;

        if (filtered.length === 0) {
            els.itemsContainer.innerHTML = '';
            els.emptyEl.style.display = 'flex';
        } else {
            els.emptyEl.style.display = 'none';
            els.itemsContainer.innerHTML = filtered.map(createNotificationCard).join('');

            // Attach dismiss handlers
            els.itemsContainer.querySelectorAll('.notification-dismiss').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissNotification(this.dataset.dismiss);
                });
            });

            // Attach click handlers to mark as read
            els.itemsContainer.querySelectorAll('.notification-card').forEach(card => {
                card.addEventListener('click', function(e) {
                    if (e.target.closest('.notification-dismiss')) return;
                    markAsRead(this.dataset.id);
                });
            });
        }

        updateBadge();
    }

    /**
     * Update badge count
     */
    function updateBadge() {
        const unreadCount = notifications.filter(n => !n.read).length;
        const els = getElements();
        let badge = els.bellButton ? els.bellButton.querySelector('.notification-badge') : null;
        const indicator = els.bellButton ? els.bellButton.querySelector('.notification-indicator') : null;

        if (!badge && els.bellButton && unreadCount > 0) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            els.bellButton.appendChild(badge);
        }

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Update indicator dot
        if (indicator) {
            indicator.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    }

    /**
     * Fetch notifications from API
     */
    async function fetchNotifications() {
        const els = getElements();
        if (!els.drawer) return;

        els.loadingEl.style.display = 'flex';
        els.emptyEl.style.display = 'none';
        els.itemsContainer.innerHTML = '';

        try {
            const response = await fetch('/api/notifications');
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            const data = await response.json();
            notifications = data.notifications || [];
        } catch (error) {
            console.error('Error fetching notifications:', error);
            notifications = [];
        } finally {
            const els = getElements();
            if (els.loadingEl) els.loadingEl.style.display = 'none';
            renderNotifications();
        }
    }

    /**
     * Mark notification as read
     */
    function markAsRead(id) {
        const notification = notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            renderNotifications();

            // Send to API (fire and forget)
            fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
        }
    }

    /**
     * Mark all notifications as read
     */
    function markAllAsRead() {
        notifications.forEach(n => n.read = true);
        renderNotifications();

        // Send to API (fire and forget)
        fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    }

    /**
     * Dismiss/delete notification
     */
    function dismissNotification(id) {
        notifications = notifications.filter(n => n.id !== id);
        renderNotifications();

        // Send to API (fire and forget)
        fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
    }

    /**
     * Open drawer
     */
    function openDrawer() {
        if (isOpen) return;
        const els = getElements();
        if (!els.drawer) return;
        isOpen = true;
        els.drawer.classList.add('open');
        els.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        fetchNotifications();
    }

    /**
     * Close drawer
     */
    function closeDrawer() {
        if (!isOpen) return;
        const els = getElements();
        if (!els.drawer) return;
        isOpen = false;
        els.drawer.classList.remove('open');
        els.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Toggle drawer
     */
    function toggleDrawer() {
        if (isOpen) {
            closeDrawer();
        } else {
            openDrawer();
        }
    }

    /**
     * Get fresh references to DOM elements (for OOB swap handling)
     */
    function getElements() {
        return {
            bellButton: document.querySelector('.header-btn[aria-label="Notifications"]'),
            drawer: document.getElementById('notificationDrawer'),
            overlay: document.getElementById('notificationOverlay'),
            closeBtn: document.getElementById('notificationCloseBtn'),
            markAllBtn: document.getElementById('markAllRead'),
            loadingEl: document.getElementById('notificationLoading'),
            emptyEl: document.getElementById('notificationEmpty'),
            itemsContainer: document.getElementById('notificationItems')
        };
    }

    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        const els = getElements();

        // Bell button click
        if (els.bellButton && !els.bellButton._notificationDrawerInitialized) {
            els.bellButton.addEventListener('click', function(e) {
                e.preventDefault();
                toggleDrawer();
            });
            els.bellButton._notificationDrawerInitialized = true;
        }

        // Close button click
        if (els.closeBtn && !els.closeBtn._notificationDrawerInitialized) {
            els.closeBtn.addEventListener('click', closeDrawer);
            els.closeBtn._notificationDrawerInitialized = true;
        }

        // Overlay click
        if (els.overlay && !els.overlay._notificationDrawerInitialized) {
            els.overlay.addEventListener('click', closeDrawer);
            els.overlay._notificationDrawerInitialized = true;
        }

        // Mark all read button
        if (els.markAllBtn && !els.markAllBtn._notificationDrawerInitialized) {
            els.markAllBtn.addEventListener('click', markAllAsRead);
            els.markAllBtn._notificationDrawerInitialized = true;
        }

        // Tab clicks (only attach if not already done)
        tabs.forEach(tab => {
            if (!tab._notificationDrawerInitialized) {
                tab.addEventListener('click', function() {
                    tabs.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    currentFilter = this.dataset.filter;
                    renderNotifications();
                });
                tab._notificationDrawerInitialized = true;
            }
        });

        // Escape key to close (only attach once)
        if (!document._notificationDrawerEscapeInitialized) {
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && isOpen) {
                    closeDrawer();
                }
            });
            document._notificationDrawerEscapeInitialized = true;
        }
    }

    /**
     * Initialize
     */
    function init() {
        const els = getElements();
        if (!els.drawer || !els.overlay) {
            console.warn('Notification drawer elements not found');
            return;
        }

        initEventListeners();

        // Fetch initial badge count (without opening drawer)
        fetch('/api/notifications')
            .then(response => response.json())
            .then(data => {
                notifications = data.notifications || [];
                updateBadge();
            })
            .catch(() => {});
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Periodic check to re-attach event listeners after OOB swaps
    setInterval(function() {
        const els = getElements();
        if (els.drawer) {
            initEventListeners();
        }
    }, 100);

    // Expose API for external use
    window.NotificationDrawer = {
        open: openDrawer,
        close: closeDrawer,
        toggle: toggleDrawer,
        refresh: fetchNotifications
    };
})();
