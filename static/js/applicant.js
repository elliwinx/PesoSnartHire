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

  function showTab(id) {
    contents.forEach((c) => {
      c.classList.add("hidden");
      c.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("hidden");
      el.style.display = "block";
    }
    buttons.forEach((b) => b.classList.remove("active"));
    const btn = Array.from(buttons).find(
      (b) => b.getAttribute("data-target") === id
    );
    if (btn) btn.classList.add("active");
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () =>
      showTab(btn.getAttribute("data-target"))
    );
  });

  if (applicantStatus === "Reupload") {
    showTab("documents");
  } else {
    showTab("personal-information");
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const focus = params.get("focus");
  if (tab === "documents") {
    showTab("documents");
    if (focus === "reco") {
      const reco = document.getElementById("recommendation_file");
      if (reco) {
        reco.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => reco.focus(), 200);
      }
    }
  }
});

// Default tab depending on applicant status
if (applicantStatus === "Reupload") {
  document.getElementById("personal-information").style.display = "none";
  document.getElementById("documents").style.display = "block";
} else {
  document.getElementById("personal-information").style.display = "block";
  document.getElementById("documents").style.display = "none";
}

// URL-driven activation (e.g., ?tab=documents&focus=reco)
const params = new URLSearchParams(window.location.search);
const tab = params.get("tab");
const focus = params.get("focus");

if (tab === "documents") {
  document.getElementById("personal-information").style.display = "none";
  document.getElementById("documents").style.display = "block";

  buttons.forEach((b) => b.classList.remove("active"));
  const docsBtn = Array.from(buttons).find(
    (b) => b.getAttribute("data-target") === "documents"
  );
  if (docsBtn) docsBtn.classList.add("active");

  if (focus === "reco") {
    const reco = document.getElementById("recommendation_file");
    if (reco) {
      reco.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => reco.focus(), 200);
    }
  }
}

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

  const residencyYes = document.getElementById("residency_yes");
  const residencyNo = document.getElementById("residency_no");
  const cityInput = document.querySelector('input[name="city"]');

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

  function updateConditionals() {
    if (pwdDetails)
      pwdDetails.style.display = pwdYes.checked ? "block" : "none";
    if (workDetails)
      workDetails.style.display = expYes.checked ? "block" : "none";
  }
  [pwdYes, pwdNo, expYes, expNo].forEach(
    (el) => el && el.addEventListener("change", updateConditionals)
  );

  let originalValues = {};

  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();

      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));
      radios.forEach((el) => {
        if (el.id) {
          originalValues[el.id] = el.checked;
        }
      });

      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg) originalValues["avatarSrc"] = avatarImg.src;

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

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (typeof window.setResidencyCancelMode === "function") {
        window.setResidencyCancelMode(true);
      }

      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });

      radios.forEach((el) => {
        if (el.id && originalValues.hasOwnProperty(el.id)) {
          el.checked = originalValues[el.id];
        }
      });

      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg && originalValues["avatarSrc"]) {
        avatarImg.src = originalValues["avatarSrc"];
      }

      profileTop.classList.remove("edit-mode");
      avatar.classList.remove("editable");

      fileInputs.forEach((el) => {
        if (applicantStatus !== "Reupload") el.style.display = "none";
        el.setAttribute("disabled", true);
        el.value = "";
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

      updateConditionals();

      if (typeof window.setResidencyEditMode === "function") {
        window.setResidencyEditMode(false);
      }

      if (typeof window.updateResidencyRequirements === "function") {
        window.updateResidencyRequirements();
      }

      if (typeof window.setResidencyCancelMode === "function") {
        window.setResidencyCancelMode(false);
      }
    });
  }

  if (saveBtn && accountForm) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const currentIsLipeno = residencyYes ? residencyYes.checked : false;
      const originalIsLipeno = originalValues["residency_yes"] === true;
      const changedToNonLipeno = originalIsLipeno && !currentIsLipeno;

      if (changedToNonLipeno) {
        const recommendationFile = document.getElementById(
          "recommendation_file"
        );
        const hasFile =
          recommendationFile && recommendationFile.files.length > 0;

        if (!hasFile) {
          showFlash(
            "You are changing your residency to Non-Lipeño. Please upload your recommendation letter before saving.",
            "danger"
          );
          if (recommendationFile) {
            recommendationFile.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            setTimeout(() => recommendationFile.focus(), 300);
          }
          return;
        }
      }

      accountForm.submit();
    });
  }

  updateConditionals();
  if (applicantStatus === "Reupload") {
    fileInputs.forEach((el) => (el.style.display = "block"));
  } else {
    fileInputs.forEach((el) => (el.style.display = "none"));
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
  ``;
});

document
  .getElementById("deactivateApplicantBtn")
  .addEventListener("click", async () => {
    // 1️⃣ Ask for confirmation
    const confirmDelete = await Swal.fire({
      title: "Are you sure?",
      text: "Your account will be permanently deleted after 30 days.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#8b0d0d",
      cancelButtonColor: "gray",
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
    });

    // 2️⃣ Stop if user canceled
    if (!confirmDelete.isConfirmed) return;

    // 3️⃣ Show loader
    showLoader("Deactivating account — please wait…");

    try {
      // 4️⃣ Call backend
      const res = await fetch("/applicants/deactivate", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setTimeout(() => {
          hideLoader();
          window.location.href = "/"; // logout/redirect
        }, 1500);
      } else {
        hideLoader();
        Swal.fire("Error", data.message, "error");
      }
    } catch (err) {
      hideLoader();
      Swal.fire(
        "Error",
        "Something went wrong. Please try again later.",
        "error"
      );
    }
  });

// ✅ Loader functions
function showLoader(text = "Processing — please wait...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loaderText) loaderText.textContent = text;
  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  loader.style.display = "none";
}

// ========== RESIDENCY TYPE CHANGE HANDLER ==========
document.addEventListener("DOMContentLoaded", () => {
  const residencyYes = document.getElementById("residency_yes");
  const residencyNo = document.getElementById("residency_no");
  const recommendationContainer = document.getElementById(
    "recommendation-upload-container"
  );
  const recommendationFile = document.getElementById("recommendation_file");
  const resumeContainer = document.querySelector(
    ".document-item:has(#resume_file)"
  );
  const warningBanner = document.getElementById("residency-warning-banner");
  const bannerTitle = document.getElementById("banner-title");
  const bannerMessage = document.getElementById("banner-message");
  const editBtn = document.getElementById("editBtn");
  const applicantStatus = document.getElementById("applicantStatus")?.value;
  const cityInput = document.querySelector('input[name="city"]');

  if (!residencyYes || !residencyNo || !recommendationContainer) return;

  let originalIsLipeno = residencyYes.checked;
  let originalCity = cityInput ? cityInput.value : "";
  let isEditMode = false;
  let isCanceling = false;

  function updateResidencyRequirements() {
    const isLipeno = residencyYes.checked;
    const residencyChanged = isEditMode && isLipeno !== originalIsLipeno;

    console.log("[v0] updateResidencyRequirements:", {
      isEditMode,
      isLipeno,
      originalIsLipeno,
      residencyChanged,
    });

    if (applicantStatus === "Reupload") {
      if (!isLipeno) {
        if (resumeContainer) resumeContainer.style.display = "none";
        recommendationContainer.style.display = "block";
        if (recommendationFile) {
          recommendationFile.setAttribute("required", "true");
        }
      } else {
        if (resumeContainer) resumeContainer.style.display = "block";
        recommendationContainer.style.display = "none";
        if (recommendationFile) {
          recommendationFile.removeAttribute("required");
        }
      }

      if (warningBanner) {
        warningBanner.classList.add("show");
        if (bannerTitle) bannerTitle.textContent = "Document Reupload Required";
        if (bannerMessage)
          bannerMessage.textContent =
            "Please reupload the requested document(s) below. Once submitted, the admin will review your documents and update your status.";
      }
      return;
    }

    if (resumeContainer) resumeContainer.style.display = "block";

    if (warningBanner) {
      if (residencyChanged) {
        warningBanner.classList.add("show");
        if (bannerTitle) bannerTitle.textContent = "Residency Type Changed";

        if (isLipeno) {
          if (bannerMessage)
            bannerMessage.innerHTML =
              "<strong>Changed to Lipeño:</strong> Your recommendation letter is no longer required. Only your resume is needed. All documents must be in PDF format.";
        } else {
          if (bannerMessage)
            bannerMessage.innerHTML =
              "<strong>Changed to Non-Lipeño:</strong> You must now upload a recommendation letter from your barangay or local government unit along with your resume. All documents must be in PDF format.";
        }
      } else {
        warningBanner.classList.remove("show");
        console.log("[v0] Banner hidden - residencyChanged is false");
      }
    }

    if (isLipeno) {
      recommendationContainer.style.display = "none";
      if (recommendationFile) {
        recommendationFile.removeAttribute("required");
        recommendationFile.value = "";
      }
    } else {
      recommendationContainer.style.display = "block";
      if (recommendationFile) {
        recommendationFile.setAttribute("required", "true");
      }
    }
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      isEditMode = true;
      isCanceling = false;
      originalIsLipeno = residencyYes.checked;
      originalCity = cityInput ? cityInput.value : "";
      console.log("[v0] Edit mode started:", {
        originalIsLipeno,
        originalCity,
      });
    });
  }

  if (residencyYes) {
    residencyYes.addEventListener("change", () => {
      if (isEditMode && !isCanceling && cityInput) {
        cityInput.value = "Lipa City";
      }
      updateResidencyRequirements();
    });
  }

  if (residencyNo) {
    residencyNo.addEventListener("change", () => {
      if (isEditMode && !isCanceling && cityInput) {
        if (cityInput.value === "Lipa City") {
          cityInput.value = "";
        }
      }
      updateResidencyRequirements();
    });
  }

  if (cityInput) {
    cityInput.addEventListener("input", () => {
      if (!isEditMode || isCanceling) return;

      const cityValue = cityInput.value.trim();
      const isLipaCity = cityValue === "Lipa City" || cityValue === "Lipa";

      if (isLipaCity) {
        residencyYes.checked = true;
        residencyNo.checked = false;
      } else if (cityValue !== "" && !isLipaCity) {
        residencyNo.checked = true;
        residencyYes.checked = false;
      }

      updateResidencyRequirements();
    });
  }

  updateResidencyRequirements();

  window.updateResidencyRequirements = updateResidencyRequirements;
  window.setResidencyCancelMode = (mode) => {
    isCanceling = mode;
    console.log("[v0] isCanceling set to:", mode);
  };
  window.setResidencyEditMode = (mode) => {
    isEditMode = mode;
    console.log("[v0] isEditMode set to:", mode);
  };
  window.getOriginalCity = () => originalCity;
});

function showFlash(message, category = "danger") {
  const flashContainer = document.createElement("div");
  flashContainer.className = `flash ${category}`;
  flashContainer.innerHTML = `
    ${message}
    <button class="close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.insertBefore(flashContainer, document.body.firstChild);

  setTimeout(() => {
    if (flashContainer.parentElement) {
      flashContainer.remove();
    }
  }, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  const resumeInput = document.getElementById("resume_file");
  const recommendationInput = document.getElementById("recommendation_file");

  function validatePDFFile(input) {
    if (!input) return;

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      const isPDF = fileName.endsWith(".pdf");

      if (!isPDF) {
        showFlash(
          "Please upload a PDF file only. Other file formats are not accepted.",
          "danger"
        );
        input.value = "";
        return false;
      }

      console.log(`[v0] Valid PDF uploaded: ${file.name}`);
      return true;
    });
  }

  validatePDFFile(resumeInput);
  validatePDFFile(recommendationInput);
});
