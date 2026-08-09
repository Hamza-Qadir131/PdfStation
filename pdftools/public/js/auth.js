(function () {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorMsg = document.getElementById("error-msg");
      errorMsg.textContent = "";
      try {
        const data = await apiRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
          },
        });
        Auth.setSession(data.token, data.user);
        window.location.href = next || "/dashboard";
      } catch (err) {
        errorMsg.textContent = err.message;
      }
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorMsg = document.getElementById("error-msg");
      errorMsg.textContent = "";
      try {
        const data = await apiRequest("/api/auth/register", {
          method: "POST",
          body: {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
          },
        });
        Auth.setSession(data.token, data.user);
        window.location.href = next || "/dashboard";
      } catch (err) {
        errorMsg.textContent = err.message;
      }
    });
  }
})();
