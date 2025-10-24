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

// ====== PASSWORD VALIDATION ======
const newPass = document.getElementById("newPassword");
const confirmPass = document.getElementById("confirmPassword");
const confirmBtn = document.getElementById("confirmBtn");
const hint = document.getElementById("passwordHint");
const requirements = document.querySelectorAll("#passwordRequirements li");

function validatePasswords() {
  const password = newPass.value.trim();
  const confirm = confirmPass.value.trim();

  // Define each rule separately
  const rules = [
    /.{8,}/.test(password),
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[@$!%*?&]/.test(password),
  ];

  // Highlight rules dynamically
  requirements.forEach((li, i) => {
    li.style.color = rules[i] ? "green" : "#ff6666";
  });

  // Check if all valid
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

  // Everything valid
  hint.textContent = "Password looks good!";
  hint.style.color = "green";
  confirmBtn.disabled = false;
}

// Validate as user types
[newPass, confirmPass].forEach((input) =>
  input.addEventListener("input", validatePasswords)
);
