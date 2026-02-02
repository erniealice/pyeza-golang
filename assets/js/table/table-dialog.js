/**
 * Table Dialog - Confirmation dialog
 */

(function() {
    'use strict';

    function showConfirmDialog(options) {
        const {
            title = 'Confirm Action',
            message = 'Are you sure you want to proceed?',
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            variant = 'default', // 'default', 'danger', 'primary'
            onConfirm = () => {},
            onCancel = () => {}
        } = options;

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.innerHTML = `
            <div class="dialog-container">
                <div class="dialog-header">
                    <h3 class="dialog-title">${title}</h3>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">${message}</p>
                </div>
                <div class="dialog-footer">
                    <button type="button" class="dialog-btn dialog-btn-cancel">${cancelLabel}</button>
                    <button type="button" class="dialog-btn dialog-btn-confirm dialog-btn-${variant}">${confirmLabel}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        const closeDialog = () => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
            }, 200);
        };

        // Event listeners
        overlay.querySelector('.dialog-btn-cancel').addEventListener('click', () => {
            closeDialog();
            onCancel();
        });

        overlay.querySelector('.dialog-btn-confirm').addEventListener('click', () => {
            closeDialog();
            onConfirm();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
                onCancel();
            }
        });

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                onCancel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return { close: closeDialog };
    }

    // Expose module
    window.TableDialog = {
        showConfirmDialog
    };

})();
