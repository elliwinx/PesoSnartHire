// ============================================
// EMPLOYER ACCOUNT & SECURITY PAGE
// Mirrors applicant flow: Tab switching, Edit/Save/Cancel, Company logo hover upload
// ============================================

// ========== DROPDOWN MENU ==========
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (menuToggle && dropdownMenu) {
    dropdownMenu.classList.remove("show", "open");
    dropdownMenu.style.display = "none";
    menuToggle.setAttribute("aria-expanded", "false");

    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.classList.toggle("show");
      dropdownMenu.classList.toggle("open", isOpen);
      dropdownMenu.style.display = isOpen ? "block" : "none";
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!dropdownMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        if (dropdownMenu.classList.contains("show")) {
          dropdownMenu.classList.remove("show", "open");
          dropdownMenu.style.display = "none";
          menuToggle.setAttribute("aria-expanded", "false");
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdownMenu.classList.contains("show")) {
        dropdownMenu.classList.remove("show", "open");
        dropdownMenu.style.display = "none";
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
});

// 1️⃣ TAB SWITCHING LOGIC
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");
  const employerStatus = document
    .querySelector(".form-card")
    ?.getAttribute("data-employer-status");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      contents.forEach((c) => (c.style.display = "none"));
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).style.display = "block";

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Default tab depending on employer status
  if (employerStatus === "Reupload") {
    document.getElementById("company-information").style.display = "none";
    document.getElementById("documents").style.display = "block";
  } else {
    document.getElementById("company-information").style.display = "block";
    document.getElementById("documents").style.display = "none";
  }
});

// 2️⃣ EDIT / SAVE / CANCEL LOGIC
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const accountForm = document.getElementById("accountForm");

  const inputs = document.querySelectorAll(".chip");
  const selects = document.querySelectorAll("select");
  const fileInputs = document.querySelectorAll("#documents .file-input");
  const profileTop = document.querySelector(".profile-top");
  const avatar = document.querySelector(".profile-top .avatar");

  // store original values before editing
  let originalValues = {};

  // --- EDIT BUTTON ---
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // store initial values before enabling edit
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));

      // ✅ store original company logo
      const logoImg = document.getElementById("companyLogoPreview");
      if (logoImg) originalValues["logoSrc"] = logoImg.src;

      profileTop.classList.add("edit-mode");
      avatar.classList.add("editable");

      fileInputs.forEach((el) => {
        el.style.display = "block";
        el.removeAttribute("disabled");
      });
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => {
        el.removeAttribute("disabled");
        el.classList.remove("select-readonly");
      });

      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";
    });
  }

  // --- CANCEL BUTTON ---
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // restore original values
      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name)) {
          el.value = originalValues[el.name];
        }
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name)) {
          el.value = originalValues[el.name];
        }
      });

      // ✅ restore original company logo
      const logoImg = document.getElementById("companyLogoPreview");
      if (logoImg && originalValues["logoSrc"]) {
        logoImg.src = originalValues["logoSrc"];
      }

      // disable again
      profileTop.classList.remove("edit-mode");
      avatar.classList.remove("editable");

      fileInputs.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("disabled", true);
        el.value = ""; // clear file input
      });
      inputs.forEach((el) => el.setAttribute("readonly", true));
      selects.forEach((el) => {
        el.setAttribute("disabled", true);
        el.classList.add("select-readonly");
      });

      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";

      // 🔄 trigger change handler for recruitment_type (so DOLE/DMW toggles back)
      const recruitmentSelect = document.getElementById("recruitment_type");
      if (recruitmentSelect) {
        recruitmentSelect.dispatchEvent(new Event("change"));
      }
    });
  }

  // --- SAVE BUTTON ---
  if (saveBtn && accountForm) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      accountForm.submit();
    });
  }
});

// === PHONE INPUT HANDLER (+63 lock + 10-digit limit) ===
const phoneInput = document.querySelector("input[name='phone']");

if (phoneInput) {
  phoneInput.addEventListener("focus", () => {
    if (!phoneInput.value.startsWith("+63")) phoneInput.value = "+63";
  });

  phoneInput.addEventListener("input", () => {
    if (!phoneInput.value.startsWith("+63")) phoneInput.value = "+63";
    const digits = phoneInput.value.slice(3).replace(/\D/g, "").slice(0, 10);
    phoneInput.value = "+63" + digits;
  });

  phoneInput.addEventListener("blur", () => {
    if (phoneInput.value.trim() === "" || phoneInput.value === "+63") {
      phoneInput.value = "+63";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const recruitmentSelect = document.getElementById("recruitment_type");
  const doleFields = document.querySelectorAll(".dole-docs");
  const dmwFields = document.querySelectorAll(".dmw-docs");

  function updateDocumentVisibility() {
    const type = recruitmentSelect.value;

    if (type === "Local") {
      doleFields.forEach((el) => (el.style.display = "block"));
      dmwFields.forEach((el) => (el.style.display = "none"));
    } else if (type === "International") {
      doleFields.forEach((el) => (el.style.display = "none"));
      dmwFields.forEach((el) => (el.style.display = "block"));
    } else {
      doleFields.forEach((el) => (el.style.display = "none"));
      dmwFields.forEach((el) => (el.style.display = "none"));
    }
  }

  recruitmentSelect.addEventListener("change", updateDocumentVisibility);
  updateDocumentVisibility(); // run once on page load
});

// ============================================
// AUTO SHOW FILE INPUTS FOR REUPLOAD STATE
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const employerStatus = document
    .querySelector(".form-card")
    ?.getAttribute("data-employer-status");

  if (employerStatus === "Reupload") {
    const fileInputs = document.querySelectorAll("#documents .file-input");

    // 🔹 Show all file inputs immediately
    fileInputs.forEach((el) => {
      el.style.display = "block";
      el.removeAttribute("disabled");
    });

    // 🔹 Make sure the correct tab is active
    document.getElementById("company-information").style.display = "none";
    document.getElementById("documents").style.display = "block";

    // 🔹 Lock other input fields (so only files are editable)
    const textInputs = document.querySelectorAll(".chip, select");
    textInputs.forEach((el) => {
      el.setAttribute("readonly", true);
      el.setAttribute("disabled", true);
      el.classList.add("select-readonly");
    });
  }
});

// ============================================
// COMPANY LOGO HOVER UPLOAD (like applicant avatar)
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.querySelector(".avatar");
  if (!avatar) return;

  const input = avatar.querySelector("input[type='file']");
  const img = document.getElementById("companyLogoPreview");
  if (!input || !img) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  img.addEventListener("click", () => {
    const employerStatus = document
      .querySelector(".form-card")
      ?.getAttribute("data-employer-status");

    // Only allow upload in Edit mode or Reupload state
    if (
      avatar.classList.contains("editable") ||
      employerStatus === "Reupload"
    ) {
      input.click();
    }
  });

  img.addEventListener("mouseenter", () => {
    if (avatar.classList.contains("editable")) {
      img.style.opacity = "0.7";
      img.style.cursor = "pointer";
    }
  });

  img.addEventListener("mouseleave", () => {
    img.style.opacity = "1";
  });
});
