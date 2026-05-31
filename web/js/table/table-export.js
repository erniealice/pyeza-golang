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
            if (option.dataset.exportInit) return;
            option.dataset.exportInit = 'true';
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

                if (lf.TableCore) {
                    lf.TableCore.closeAllDropdowns();
                }
            });
        });
    }

    function exportToCSV(table, filename) {
        const rows = [];
        const headers = [];

        // Header text: prefer the inner .column-label (the sort button or span set
        // by table.html) so we strip sort-indicator SVGs and any trailing whitespace.
        // Falls back to the th's full textContent for non-standard headers.
        function headerText(th) {
            const lbl = th.querySelector('.column-label');
            return (lbl ? lbl.textContent : th.textContent).trim();
        }

        // Cell text: prefer the server-emitted data-csv attribute (canonical
        // export string per cell type — see types.CellCSV in pyeza-golang).
        // Falls back to textContent.trim() for cells that don't go through the
        // typed-cell path (raw HTML, custom row groups, totals row, etc.).
        function cellText(td) {
            return (td.dataset.csv != null ? td.dataset.csv : td.textContent).trim();
        }

        function csvField(s) {
            return '"' + String(s).replace(/"/g, '""') + '"';
        }

        function isExportable(th) {
            return th.style.display !== 'none'
                && !th.classList.contains('row-checkbox')
                && !th.classList.contains('actions-column');
        }

        const ths = Array.from(table.querySelectorAll('thead th'));
        ths.forEach(th => {
            if (isExportable(th)) headers.push(csvField(headerText(th)));
        });
        rows.push(headers.join(','));

        table.querySelectorAll('tbody tr[data-id]').forEach(tr => {
            if (tr.style.display === 'none') return;

            const cells = [];
            tr.querySelectorAll('td').forEach((td, index) => {
                const th = ths[index];
                if (th && isExportable(th)) cells.push(csvField(cellText(td)));
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
    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.table = window.lf.ui.table || {};
    window.lf.ui.table.TableExport = {
        init,
        initExport,
        exportToCSV,
        exportToExcel,
        downloadFile
    };

})();
