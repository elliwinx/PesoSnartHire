document.addEventListener("DOMContentLoaded", () => {
  // ====== SHOW / HIDE PASSWORD ======
  document.querySelectorAll(".toggle-password").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = toggle.previousElementSibling;
      if (input.type === "password") {
        input.type = "text";
        toggle.textContent = "Hide";
      } else {
        input.type = "password";
        toggle.textContent = "Show";
      }
    });
  });

  // ====== PHONE NUMBER HANDLING ======
  const phoneInput = document.getElementById("forgotPasswordPhoneNumber");
  if (phoneInput) {
    phoneInput.value = "+63";

    phoneInput.addEventListener("focus", () => {
      if (!phoneInput.value.startsWith("+63")) {
        phoneInput.value = "+63";
      }
    });

    phoneInput.addEventListener("input", () => {
      if (!phoneInput.value.startsWith("+63")) {
        phoneInput.value = "+63";
      }
      phoneInput.value = "+63" + phoneInput.value.slice(3).replace(/\D/g, "");
    });

    phoneInput.addEventListener("keydown", (e) => {
      if (
        (phoneInput.selectionStart <= 3 && e.key === "Backspace") ||
        (phoneInput.selectionStart <= 3 && e.key === "ArrowLeft")
      ) {
        e.preventDefault();
      }
    });
  }

  // ====== PASSWORD VALIDATION ======
  const newPass = document.getElementById("newPassword");
  const confirmPass = document.getElementById("confirmPassword");
  const confirmBtn = document.getElementById("confirmBtn");
  const hint = document.getElementById("passwordHint");
  const requirements = document.querySelectorAll("#passwordRequirements li");

  function validatePasswords() {
    const password = newPass.value.trim();
    const confirm = confirmPass.value.trim();

    const rules = [
      /.{8,}/.test(password),
      /[A-Z]/.test(password) && /[a-z]/.test(password),
      /\d/.test(password),
      /[@$!%*?&]/.test(password),
    ];

    requirements.forEach((li, i) => {
      li.style.color = rules[i] ? "green" : "#ff6666";
    });

    const allValid = rules.every(Boolean);

    if (!allValid) {
      hint.textContent = "Password does not meet all requirements.";
      confirmBtn.disabled = true;
      return;
    }

    if (password !== confirm) {
      hint.textContent = "Passwords do not match.";
      confirmBtn.disabled = true;
      return;
    }

    hint.textContent = "Password looks good!";
    hint.style.color = "green";
    confirmBtn.disabled = false;
  }

  [newPass, confirmPass].forEach((input) =>
    input.addEventListener("input", validatePasswords)
  );
});
