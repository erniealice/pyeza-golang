/**
 * Table Density - Density functionality
 */

(function() {
    'use strict';

    function init() {
        initDensity();
    }

    function initDensity() {
        const densityMenus = document.querySelectorAll('.density-menu');

        // Restore saved density on page load (page-level setting)
        // Falls back to data-default-density on <html> (theme-level default)
        const savedDensity = getDensityPreference();
        const defaultDensity = document.documentElement.dataset.defaultDensity || 'default';
        const effectiveDensity = savedDensity || defaultDensity;
        if (effectiveDensity && effectiveDensity !== 'default') {
            setDensity(effectiveDensity);
        }

        densityMenus.forEach(menu => {
            const options = menu.querySelectorAll('.density-option');

            // Update active state based on current body class
            const currentDensity = getCurrentDensity();
            options.forEach(o => {
                o.classList.toggle('active', o.dataset.density === currentDensity);
            });

            options.forEach(option => {
                if (option.dataset.densityInit) return;
                option.dataset.densityInit = 'true';
                option.addEventListener('click', function() {
                    const density = this.dataset.density;

                    // Update active state in menu
                    options.forEach(o => o.classList.remove('active'));
                    this.classList.add('active');

                    // Apply density to page (body)
                    setDensity(density);

                    // Save preference
                    saveDensityPreference(density);

                    // Close dropdown
                    if (lf.TableCore) {
                        lf.TableCore.closeAllDropdowns();
                    }
                });
            });
        });
    }

    function getCurrentDensity() {
        if (document.body.classList.contains('density-dense')) return 'dense';
        if (document.body.classList.contains('density-compact')) return 'compact';
        if (document.body.classList.contains('density-comfortable')) return 'comfortable';
        return 'default';
    }

    function setDensity(density) {
        // Remove all density classes from body
        document.body.classList.remove('density-dense', 'density-compact', 'density-default', 'density-comfortable');

        // Add the selected density class to body
        document.body.classList.add(`density-${density}`);

        // Update all density menus on the page
        document.querySelectorAll('.density-option').forEach(o => {
            o.classList.toggle('active', o.dataset.density === density);
        });
    }

    function saveDensityPreference(density) {
        try {
            localStorage.setItem('lf-page-density', density);
        } catch (e) {
            console.warn('Could not save density preference', e);
        }
    }

    function getDensityPreference() {
        try {
            return localStorage.getItem('lf-page-density');
        } catch (e) {
            console.warn('Could not get density preference', e);
            return null;
        }
    }

    // Expose module
    window.lf = window.lf || {};
    window.lf.TableDensity = {
        init,
        initDensity,
        getCurrentDensity,
        setDensity,
        saveDensityPreference,
        getDensityPreference
    };

})();
