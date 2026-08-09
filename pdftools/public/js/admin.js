(function () {
  if (!Auth.isLoggedIn()) {
    window.location.href = "/login?next=" + encodeURIComponent("/admin");
    return;
  }

  const slot = document.getElementById("admin-slot");

  async function load() {
    slot.innerHTML = `<p class="status-msg">Loading…</p>`;
    try {
      const data = await apiRequest("/api/admin/users");

      const rows = data.users
        .map(
          (u) => `
        <tr>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.name || "—")}</td>
          <td>${new Date(u.created_at).toLocaleString()}</td>
          <td>${u.job_count}</td>
          <td><button class="btn btn-ghost reset-btn" data-id="${u.id}" data-email="${escapeHtml(u.email)}">Reset password</button></td>
        </tr>
      `
        )
        .join("");

      slot.innerHTML = `
        <table class="jobs">
          <thead><tr><th>Email</th><th>Name</th><th>Signed up</th><th>Jobs run</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      slot.querySelectorAll(".reset-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const newPassword = prompt(`New password for ${btn.dataset.email} (min 8 characters):`);
          if (!newPassword) return;
          try {
            await apiRequest(`/api/admin/users/${btn.dataset.id}/reset-password`, {
              method: "POST",
              body: { newPassword },
            });
            alert("Password reset. Share the new password with the user directly.");
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      slot.innerHTML = `<p class="status-msg error">${escapeHtml(err.message)}</p>`;
    }
  }

  load();
})();
