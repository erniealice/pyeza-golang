/**
 * Table Export - Export functionality
 */

(function() {
    'use strict';

    function init() {
        initExport();
    }

    function initExport() {
        const exportOptions = document.querySelectorAll('.export-option');

        exportOptions.forEach(option => {
            option.addEventListener('click', function() {
                const format = this.dataset.format;
                const dropdown = this.closest('.toolbar-dropdown');
                const toolbar = dropdown.closest('.table-toolbar');
                const tableId = toolbar ? toolbar.dataset.table : null;

                if (!tableId) return;

                const table = document.getElementById(tableId);
                if (!table) return;

                if (format === 'csv') {
                    exportToCSV(table, tableId);
                } else if (format === 'excel') {
                    exportToExcel(table, tableId);
                }

                if (window.TableCore) {
                    window.TableCore.closeAllDropdowns();
                }
            });
        });
    }

    function exportToCSV(table, filename) {
        const rows = [];
        const headers = [];

        // Get visible headers
        table.querySelectorAll('thead th').forEach(th => {
            if (th.style.display !== 'none' && !th.classList.contains('row-checkbox') && !th.classList.contains('actions-column')) {
                headers.push('"' + th.textContent.trim().replace(/"/g, '""') + '"');
            }
        });
        rows.push(headers.join(','));

        // Get visible rows
        table.querySelectorAll('tbody tr[data-id]').forEach(tr => {
            if (tr.style.display === 'none') return;

            const cells = [];
            tr.querySelectorAll('td').forEach((td, index) => {
                const th = table.querySelector(`thead th:nth-child(${index + 1})`);
                if (th && th.style.display !== 'none' && !th.classList.contains('row-checkbox') && !th.classList.contains('actions-column')) {
                    cells.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
                }
            });
            if (cells.length) rows.push(cells.join(','));
        });

        const csv = rows.join('\n');
        downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
    }

    function exportToExcel(table, filename) {
        // For Excel, we'll create a simple HTML table that Excel can open
        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head><meta charset="UTF-8"></head>
            <body>
                <table>${table.innerHTML}</table>
            </body>
            </html>
        `;

        downloadFile(html, `${filename}.xls`, 'application/vnd.ms-excel');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Expose module
    window.TableExport = {
        init,
        initExport,
        exportToCSV,
        exportToExcel,
        downloadFile
    };

})();
