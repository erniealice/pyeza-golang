/**
 * Image Upload — drag-and-drop + file input for image management.
 *
 * Handles:
 * - Drag-and-drop onto the upload zone
 * - File input click-to-browse
 * - Client-side validation (size, type)
 * - Multipart upload via fetch()
 * - Progress feedback (uploading → done / error)
 * - Gallery refresh after upload
 * - Bulk delete checkbox enable/disable
 */
(function () {
  const zone = document.getElementById("image-upload-zone");
  const fileInput = document.getElementById("image-file-input");
  const progressArea = document.getElementById("image-upload-progress");
  const gallery = document.getElementById("image-gallery");

  if (!zone || !fileInput) return;

  const uploadUrl = zone.dataset.uploadUrl;
  const maxSize = parseInt(zone.dataset.maxSize, 10) || 5 * 1024 * 1024;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  // --- Drag-and-drop ---

  zone.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add("image-upload-zone--dragover");
  });

  zone.addEventListener("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("image-upload-zone--dragover");
  });

  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("image-upload-zone--dragover");
    var files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  });

  // --- Click to browse ---

  zone.addEventListener("click", function (e) {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
      fileInput.value = "";
    }
  });

  // --- File handling ---

  function handleFiles(fileList) {
    var validFiles = [];
    progressArea.innerHTML = "";

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      var item = createProgressItem(file.name);
      progressArea.appendChild(item);

      if (file.size > maxSize) {
        setProgressError(item, "File too large (max 5 MB)");
        continue;
      }
      if (allowedTypes.indexOf(file.type) === -1) {
        setProgressError(item, "Invalid type. Use JPEG, PNG, or WebP.");
        continue;
      }

      validFiles.push({ file: file, item: item });
    }

    if (validFiles.length === 0) return;

    uploadFiles(validFiles);
  }

  function uploadFiles(entries) {
    var formData = new FormData();
    entries.forEach(function (entry) {
      formData.append("files", entry.file);
      setProgressUploading(entry.item);
    });

    fetch(uploadUrl, {
      method: "POST",
      body: formData,
    })
      .then(function (resp) {
        if (!resp.ok) throw new Error("Upload failed: " + resp.status);
        return resp.text();
      })
      .then(function (html) {
        entries.forEach(function (entry) {
          setProgressDone(entry.item);
        });
        // Replace gallery content with server response
        if (gallery) {
          gallery.innerHTML = html;
        }
        // Reinitialize bulk delete listeners
        initBulkDelete();
        // Clear progress after delay
        setTimeout(function () {
          progressArea.innerHTML = "";
        }, 3000);
      })
      .catch(function (err) {
        entries.forEach(function (entry) {
          setProgressError(entry.item, err.message || "Upload failed");
        });
      });
  }

  // --- Progress indicators ---

  function createProgressItem(filename) {
    var div = document.createElement("div");
    div.className = "image-upload-progress__item";
    div.innerHTML =
      '<span class="image-upload-progress__name">' +
      escapeHtml(filename) +
      "</span>" +
      '<span class="image-upload-progress__status">Pending</span>';
    return div;
  }

  function setProgressUploading(item) {
    var status = item.querySelector(".image-upload-progress__status");
    if (status) {
      status.textContent = "Uploading...";
      status.className =
        "image-upload-progress__status image-upload-progress__status--uploading";
    }
  }

  function setProgressDone(item) {
    var status = item.querySelector(".image-upload-progress__status");
    if (status) {
      status.textContent = "Done";
      status.className =
        "image-upload-progress__status image-upload-progress__status--done";
    }
  }

  function setProgressError(item, message) {
    var status = item.querySelector(".image-upload-progress__status");
    if (status) {
      status.textContent = message;
      status.className =
        "image-upload-progress__status image-upload-progress__status--error";
    }
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Bulk delete ---

  function initBulkDelete() {
    var btn = document.getElementById("bulk-delete-btn");
    if (!btn) return;

    var gallery = document.getElementById("image-gallery");
    if (!gallery) return;

    gallery.addEventListener("change", function (e) {
      if (
        e.target &&
        e.target.classList.contains("image-gallery__checkbox")
      ) {
        var checked = gallery.querySelectorAll(
          ".image-gallery__checkbox:checked"
        );
        btn.disabled = checked.length === 0;
      }
    });
  }

  initBulkDelete();
})();
