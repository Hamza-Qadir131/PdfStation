(function () {
  if (!Auth.isLoggedIn()) {
    window.location.href = "/login?next=" + encodeURIComponent("/dashboard");
    return;
  }

  const slot = document.getElementById("jobs-slot");
  const toolLabels = {
    merge: "Merge",
    split: "Split",
    rotate: "Rotate",
    compress: "Compress",
    "images-to-pdf": "Images → PDF",
    "pdf-to-images": "PDF → Images",
  };

  async function load() {
    slot.innerHTML = `<p class="status-msg">Loading…</p>`;
    try {
      const data = await apiRequest("/api/files");
      if (!data.jobs.length) {
        slot.innerHTML = `<div class="empty-state">No files yet. Pick a tool from the home page to get started.</div>`;
        return;
      }

      const rows = data.jobs
        .map(
          (job) => `
        <tr>
          <td>${toolLabels[job.tool] || job.tool}</td>
          <td>${escapeHtml(job.input_name || "—")}</td>
          <td>${new Date(job.created_at).toLocaleString()}</td>
          <td><a href="#" class="dl" data-job="${job.id}">Download</a></td>
        </tr>
      `
        )
        .join("");

      slot.innerHTML = `
        <table class="jobs">
          <thead><tr><th>Tool</th><th>Input</th><th>Date</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      slot.querySelectorAll(".dl").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          downloadJob(`/api/files/${link.dataset.job}`);
        });
      });
    } catch (err) {
      slot.innerHTML = `<p class="status-msg error">${escapeHtml(err.message)}</p>`;
    }
  }

  load();
})();
