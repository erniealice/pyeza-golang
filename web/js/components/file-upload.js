/**
 * File Upload Dropzone — drag-and-drop + file input for generic file uploads.
 *
 * Handles:
 * - Drag-and-drop onto .file-dropzone elements
 * - File input click-to-browse
 * - Client-side validation (size, type)
 * - Preview with filename + size + remove button
 * - Reinitializes on htmx:afterSwap for dynamic drawer content
 *
 * Does NOT handle upload — HTMX form submission handles that.
 *
 * Configuration via data attributes:
 * - data-max-size: max file size in bytes (default 10MB)
 * - data-accept: comma-separated extensions/MIME types
 */
(function () {
  function initDropzone(zone) {
    var input = zone.querySelector(".file-dropzone__input");
    var prompt = zone.querySelector(".file-dropzone__prompt");
    var preview = zone.querySelector(".file-dropzone__preview");
    var previewName = zone.querySelector(".file-dropzone__preview-name");
    var previewSize = zone.querySelector(".file-dropzone__preview-size");
    var removeBtn = zone.querySelector(".file-dropzone__remove");
    var errorEl = zone.querySelector(".file-dropzone__error");

    if (!input) return;

    var maxSize = parseInt(zone.dataset.maxSize, 10) || 10 * 1024 * 1024;
    var accept = zone.dataset.accept || "";

    // --- Drag events ---

    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("file-dropzone--dragover");
    });

    zone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("file-dropzone--dragover");
    });

    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("file-dropzone--dragover");
      if (e.dataTransfer.files.length > 0) {
        validateAndShow(e.dataTransfer.files[0]);
      }
    });

    // --- Click to browse ---

    zone.addEventListener("click", function (e) {
      if (
        e.target === input ||
        e.target === removeBtn ||
        e.target.closest(".file-dropzone__remove")
      )
        return;
      input.click();
    });

    input.addEventListener("change", function () {
      if (input.files.length > 0) {
        validateAndShow(input.files[0]);
      }
    });

    // --- Remove button ---

    if (removeBtn) {
      removeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        clearFile();
      });
    }

    // --- Validation and preview ---

    function validateAndShow(file) {
      // Clear previous error
      zone.classList.remove("file-dropzone--error");
      if (errorEl) errorEl.textContent = "";

      // Size check
      if (file.size > maxSize) {
        showError("File too large. Maximum size: " + formatSize(maxSize));
        return;
      }

      // Type check
      if (accept) {
        var allowed = accept.split(",").map(function (s) {
          return s.trim().toLowerCase();
        });
        var ext = "." + file.name.split(".").pop().toLowerCase();
        var typeMatch = allowed.some(function (a) {
          return (
            a === ext ||
            a === file.type ||
            (a.endsWith("/*") && file.type.startsWith(a.replace("/*", "/")))
          );
        });
        if (!typeMatch) {
          showError("File type not allowed. Accepted: " + accept);
          return;
        }
      }

      // Transfer file to input (for drop events)
      if (typeof DataTransfer !== "undefined") {
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      }

      // Show preview
      zone.classList.add("file-dropzone--has-file");
      if (previewName) previewName.textContent = file.name;
      if (previewSize) previewSize.textContent = formatSize(file.size);
    }

    function clearFile() {
      input.value = "";
      zone.classList.remove("file-dropzone--has-file", "file-dropzone--error");
      if (errorEl) errorEl.textContent = "";
      if (previewName) previewName.textContent = "";
      if (previewSize) previewSize.textContent = "";
    }

    function showError(msg) {
      zone.classList.add("file-dropzone--error");
      if (errorEl) errorEl.textContent = msg;
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    zone._dropzoneInit = true;
  }

  function initAll() {
    document.querySelectorAll(".file-dropzone").forEach(function (zone) {
      if (!zone._dropzoneInit) initDropzone(zone);
    });
  }

  // Init on load
  initAll();

  // Re-init when HTMX swaps in new content (e.g. drawers)
  document.addEventListener("htmx:afterSwap", initAll);
})();
