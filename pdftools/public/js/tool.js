(function () {
  const params = new URLSearchParams(window.location.search);
  const toolId = params.get("tool");
  const config = TOOLS_CONFIG[toolId];

  const root = document.getElementById("workspace-root");

  if (!config) {
    root.innerHTML = `<p class="status-msg error">Unknown tool. <a href="/index">Back to home</a>.</p>`;
    return;
  }

  document.title = `${config.title} — PDFStation`;

  let selectedFiles = [];

  root.innerHTML = `
    <h1>${config.title}</h1>
    <p class="sub">${config.sub}</p>

    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="${config.dzLabel}">
      <div class="dz-label">${config.dzLabel}</div>
      <div class="dz-sub">${config.dzSub}</div>
      <input type="file" id="file-input" accept="${config.accept}" ${config.multiple ? "multiple" : ""} />
    </div>

    <ul class="file-list" id="file-list"></ul>

    <div id="extra-fields"></div>

    <div class="workspace-actions">
      <button class="btn btn-primary" id="submit-btn" disabled>${config.submitLabel}</button>
      <span id="status-msg" class="status-msg"></span>
    </div>

    <div id="result-slot"></div>
  `;

  // ---- extra fields (ranges input, rotation angle select, etc.) ----
  const extraFieldsEl = document.getElementById("extra-fields");
  if (config.extraFields) {
    config.extraFields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      if (f.type === "text") {
        wrap.innerHTML = `
          <label for="field-${f.name}">${f.label}</label>
          <input type="text" id="field-${f.name}" placeholder="${f.placeholder || ""}" />
        `;
      } else if (f.type === "select") {
        wrap.innerHTML = `
          <label for="field-${f.name}">${f.label}</label>
          <select id="field-${f.name}">
            ${f.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}
          </select>
        `;
      }
      extraFieldsEl.appendChild(wrap);
    });
  }

  // ---- dropzone wiring ----
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileListEl = document.getElementById("file-list");
  const submitBtn = document.getElementById("submit-btn");
  const statusMsg = document.getElementById("status-msg");
  const resultSlot = document.getElementById("result-slot");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
  });

  function addFiles(fileListObj) {
    const incoming = Array.from(fileListObj);
    if (!config.multiple) {
      selectedFiles = incoming.slice(0, 1);
    } else {
      selectedFiles = selectedFiles.concat(incoming);
    }
    renderFileList();
  }

  function renderFileList() {
    fileListEl.innerHTML = "";
    selectedFiles.forEach((file, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(file.name)} — ${formatBytes(file.size)}</span><span class="remove" data-idx="${idx}">Remove</span>`;
      fileListEl.appendChild(li);
    });
    fileListEl.querySelectorAll(".remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedFiles.splice(Number(btn.dataset.idx), 1);
        renderFileList();
      });
    });

    const min = config.minFiles || 1;
    submitBtn.disabled = selectedFiles.length < min;
  }

  // ---- submit ----
  submitBtn.addEventListener("click", async () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.href)}`;
      return;
    }

    statusMsg.textContent = "Processing…";
    statusMsg.className = "status-msg";
    resultSlot.innerHTML = "";
    submitBtn.disabled = true;

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append(config.fieldName, f));

      if (config.extraFields) {
        config.extraFields.forEach((f) => {
          const el = document.getElementById(`field-${f.name}`);
          if (el) formData.append(f.name, el.value);
        });
      }

      const data = await apiRequest(config.endpoint, { method: "POST", body: formData, isForm: true });

      statusMsg.textContent = "Done.";
      statusMsg.className = "status-msg success";

      let sizeLine = "";
      if (config.showSizeComparison && data.originalSize && data.newSize) {
        const pct = Math.max(0, Math.round((1 - data.newSize / data.originalSize) * 100));
        sizeLine = `<div style="font-family:var(--font-mono); font-size:13px; color:var(--paper-dim); margin-top:6px;">
          ${formatBytes(data.originalSize)} → ${formatBytes(data.newSize)} (${pct}% smaller)
        </div>`;
      }

      resultSlot.innerHTML = `
        <div class="result-card">
          <div>
            <div style="font-family:var(--font-display); font-size:17px;">Your file is ready</div>
            ${sizeLine}
          </div>
          <button class="btn btn-primary" id="download-btn">Download</button>
        </div>
      `;
      document.getElementById("download-btn").addEventListener("click", () => downloadJob(data.downloadUrl));
    } catch (err) {
      statusMsg.textContent = err.message;
      statusMsg.className = "status-msg error";
    } finally {
      submitBtn.disabled = selectedFiles.length < (config.minFiles || 1);
    }
  });
})();
