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
        const savedDensity = getDensityPreference();
        if (savedDensity) {
            setDensity(savedDensity);
        }

        densityMenus.forEach(menu => {
            const options = menu.querySelectorAll('.density-option');

            // Update active state based on current body class
            const currentDensity = getCurrentDensity();
            options.forEach(o => {
                o.classList.toggle('active', o.dataset.density === currentDensity);
            });

            options.forEach(option => {
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
                    if (window.TableCore) {
                        window.TableCore.closeAllDropdowns();
                    }
                });
            });
        });
    }

    function getCurrentDensity() {
        if (document.body.classList.contains('density-compact')) return 'compact';
        if (document.body.classList.contains('density-comfortable')) return 'comfortable';
        return 'default';
    }

    function setDensity(density) {
        // Remove all density classes from body
        document.body.classList.remove('density-compact', 'density-default', 'density-comfortable');

        // Add the selected density class to body
        document.body.classList.add(`density-${density}`);

        // Update all density menus on the page
        document.querySelectorAll('.density-option').forEach(o => {
            o.classList.toggle('active', o.dataset.density === density);
        });
    }

    function saveDensityPreference(density) {
        try {
            localStorage.setItem('page_density', density);
        } catch (e) {
            console.warn('Could not save density preference', e);
        }
    }

    function getDensityPreference() {
        try {
            return localStorage.getItem('page_density');
        } catch (e) {
            console.warn('Could not get density preference', e);
            return null;
        }
    }

    // Expose module
    window.TableDensity = {
        init,
        initDensity,
        getCurrentDensity,
        setDensity,
        saveDensityPreference,
        getDensityPreference
    };

})();
