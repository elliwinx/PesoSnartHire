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
  const applicantStatus = document.getElementById("applicantStatus")?.value;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      contents.forEach((c) => (c.style.display = "none"));
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).style.display = "block";

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Default tab depending on applicant status
  if (applicantStatus === "Reupload") {
    document.getElementById("personal-information").style.display = "none";
    document.getElementById("documents").style.display = "block";
  } else {
    document.getElementById("personal-information").style.display = "block";
    document.getElementById("documents").style.display = "none";
  }
});

// 2️⃣ EDIT / SAVE / CANCEL LOGIC
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const accountForm = document.getElementById("accountForm");
  const applicantStatus = document.getElementById("applicantStatus")?.value;

  const inputs = document.querySelectorAll(".chip");
  const selects = document.querySelectorAll("select");
  const radios = document.querySelectorAll("input[type='radio']");
  const fileInputs = document.querySelectorAll(
    ".file-input, .avatar input[type='file']"
  );
  const profileTop = document.querySelector(".profile-top");
  const avatar = document.querySelector(".profile-top .avatar");

  const pwdYes = document.getElementById("pwd_yes");
  const pwdNo = document.getElementById("pwd_no");
  const pwdDetails = document.getElementById("pwd_details");
  const expYes = document.getElementById("exp_yes");
  const expNo = document.getElementById("exp_no");
  const workDetails = document.getElementById("work_details");

  // helper: enable/disable conditional inputs
  function setConditionalInputsEditable(editable) {
    [pwdDetails, workDetails].forEach((section) => {
      if (section) {
        section.querySelectorAll("input, select, textarea").forEach((el) => {
          if (editable) {
            el.removeAttribute("disabled");
            if (el.tagName === "SELECT") el.classList.remove("select-readonly");
          } else {
            el.setAttribute("disabled", true);
            if (el.tagName === "SELECT") el.classList.add("select-readonly");
          }
        });
      }
    });
  }

  // show/hide conditional sections
  function updateConditionals() {
    if (pwdDetails)
      pwdDetails.style.display = pwdYes.checked ? "block" : "none";
    if (workDetails)
      workDetails.style.display = expYes.checked ? "block" : "none";
  }

  [pwdYes, pwdNo, expYes, expNo].forEach(
    (el) => el && el.addEventListener("change", updateConditionals)
  );

  // 🧠 store original values here
  let originalValues = {};

  // --- EDIT BUTTON ---
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // store all original field values
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));
      radios.forEach((el) => (originalValues[el.name] = el.checked));

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
      radios.forEach((el) => el.removeAttribute("disabled"));
      setConditionalInputsEditable(true);

      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";

      updateConditionals();
    });
  }

  // --- CANCEL BUTTON ---
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // restore previous values
      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      radios.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.checked = originalValues[el.name];
      });

      profileTop.classList.remove("edit-mode");
      avatar.classList.remove("editable");

      fileInputs.forEach((el) => {
        if (applicantStatus !== "Reupload") el.style.display = "none";
        el.setAttribute("disabled", true);
      });
      inputs.forEach((el) => el.setAttribute("readonly", true));
      selects.forEach((el) => {
        el.setAttribute("disabled", true);
        el.classList.add("select-readonly");
      });
      radios.forEach((el) => el.setAttribute("disabled", true));
      setConditionalInputsEditable(false);

      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";

      updateConditionals(); // reflect restored state
    });
  }

  // --- SAVE BUTTON ---
  if (saveBtn && accountForm) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      accountForm.submit();
    });
  }

  // initial conditional visibility setup
  updateConditionals();
  if (applicantStatus === "Reupload") {
    fileInputs.forEach((el) => (el.style.display = "block"));
  } else {
    fileInputs.forEach((el) => (el.style.display = "none"));
  }
});

// 3️⃣ CONDITIONAL FIELDS OBSERVER (PWD / WORK)
(() => {
  const el = (sel) => document.querySelector(sel);
  const els = (sel) => Array.from(document.querySelectorAll(sel));

  const pwdYes = el("#pwd_yes");
  const pwdNo = el("#pwd_no");
  const expYes = el("#exp_yes");
  const expNo = el("#exp_no");

  const pwdDetails = el("#pwd_details");
  const workDetails = el("#work_details");

  function updateConditionals() {
    if (pwdDetails)
      pwdDetails.style.display = pwdYes.checked ? "block" : "none";
    if (workDetails)
      workDetails.style.display = expYes.checked ? "block" : "none";
  }

  [pwdYes, pwdNo, expYes, expNo].forEach((el) => {
    if (el) el.addEventListener("change", updateConditionals);
  });

  document.addEventListener("DOMContentLoaded", updateConditionals);

  const radiosToObserve = els("#personal-information input[type='radio']");
  if (radiosToObserve.length) {
    const observer = new MutationObserver(updateConditionals);
    radiosToObserve.forEach((r) =>
      observer.observe(r, {
        attributes: true,
        attributeFilter: ["disabled", "checked"],
      })
    );
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const pwdYes = document.getElementById("pwd_yes");
  const pwdDetails = document.getElementById("pwd_details");

  if (pwdYes && pwdYes.checked) {
    pwdDetails.style.display = "block"; // show the dropdown
  }

  const expYes = document.getElementById("exp_yes");
  const workDetails = document.getElementById("work_details");

  if (expYes && expYes.checked) {
    workDetails.style.display = "block"; // show the work dropdown
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.querySelector(".avatar");
  if (!avatar) return; // safety check

  const input = avatar.querySelector("input[type='file']");
  const img = document.getElementById("profilePicPreview");
  if (!input || !img) return; // safety check

  // Live preview
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Optional: click avatar image to open file picker
  img.addEventListener("click", () => input.click());
});
