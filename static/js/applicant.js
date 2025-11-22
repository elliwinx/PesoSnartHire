// ========== UTILITY FUNCTIONS ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showFlash(message, category = "info") {
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

function showLoader(text = "Processing — please wait...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loaderText) loaderText.textContent = text;
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  if (loader) loader.style.display = "none";
}

// ========== GLOBAL APPLICANT STATUS ==========
const applicantStatus = document.getElementById("applicantStatus")?.value;

// ========== MAIN DOM READY ==========
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Initializing applicant.js");

  // ================== DROPDOWN MENU ==================
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

  // ================== TAB SWITCHING ==================
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");

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
    btn.addEventListener("click", () => {
      showTab(btn.getAttribute("data-target"));
    });
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

  // ================== EDIT / SAVE / CANCEL ==================
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const accountForm = document.getElementById("accountForm");

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
  const barangayInput = document.querySelector('input[name="barangay"]');
  const provinceInput = document.querySelector('input[name="province"]');
  const provinceSelect = document.getElementById("applicantProvince");
  const citySelect = document.getElementById("applicantCity");
  const cityTextInput = document.getElementById("applicantCityText");
  const barangaySelect = document.getElementById("applicantBarangay");
  const barangayTextInput = document.getElementById("applicantBarangayText");

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
    if (pwdDetails && pwdYes)
      pwdDetails.style.display = pwdYes.checked ? "block" : "none";
    if (workDetails && expYes)
      workDetails.style.display = expYes.checked ? "block" : "none";
  }
  [pwdYes, pwdNo, expYes, expNo].forEach((el) => {
    if (el) el.addEventListener("change", updateConditionals);
  });

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

      profileTop?.classList.add("edit-mode");
      avatar?.classList.add("editable");

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
      if (avatarImg && originalValues["avatarSrc"])
        avatarImg.src = originalValues["avatarSrc"];

      profileTop?.classList.remove("edit-mode");
      avatar?.classList.remove("editable");

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

      if (typeof window.copyDynamicBarangayToInput === "function") {
        window.copyDynamicBarangayToInput();
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

  if (provinceSelect) {
    provinceSelect.addEventListener("change", () => {
      if (residencyYes && residencyYes.checked) return;

      if (citySelect) {
        citySelect.style.display = "none";
        citySelect.required = false;
        citySelect.value = "";
      }
      if (cityTextInput) {
        cityTextInput.style.display = "block";
        cityTextInput.required = true;
      }

      if (barangaySelect) {
        barangaySelect.style.display = "none";
        barangaySelect.required = false;
        barangaySelect.value = "";
      }
      if (barangayTextInput) {
        barangayTextInput.style.display = "block";
        barangayTextInput.required = true;
      }
    });
  }

  // ================== PHONE INPUT ==================
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

  // ================== AVATAR PREVIEW ==================
  const avatar_el = document.querySelector(".avatar");
  if (avatar_el) {
    const input = avatar_el.querySelector("input[type='file']");
    const img = document.getElementById("profilePicPreview");
    if (input && img) {
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // ================== DEACTIVATE APPLICANT ==================
  const deactivateBtn = document.getElementById("deactivateApplicantBtn");
  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", async () => {
      const confirmDelete = await window.Swal.fire({
        title: "Are you sure?",
        text: "Your account will be permanently deleted after 30 days.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#8b0d0d",
        cancelButtonColor: "gray",
        confirmButtonText: "Confirm",
        cancelButtonText: "Cancel",
      });

      if (!confirmDelete.isConfirmed) return;

      showLoader("Deactivating account — please wait…");

      try {
        const res = await fetch("/applicants/deactivate", { method: "POST" });
        const data = await res.json();

        if (data.success) {
          setTimeout(() => {
            hideLoader();
            window.location.href = "/";
          }, 1500);
        } else {
          hideLoader();
          window.Swal.fire("Error", data.message, "error");
        }
      } catch (err) {
        hideLoader();
        window.Swal.fire(
          "Error",
          "Something went wrong. Please try again later.",
          "error"
        );
      }
    });
  }

  // ========== RESIDENCY TYPE CHANGE HANDLER ==========
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

  if (!residencyYes || !residencyNo) {
    // Skip residency logic if elements don't exist
  } else {
    let originalIsLipeno = residencyYes.checked;
    let originalCity = cityInput ? cityInput.value : "";
    let originalProvince = provinceInput ? provinceInput.value : "";
    let originalBarangay = barangayInput ? barangayInput.value : "";
    let isEditMode = false;
    let isCanceling = false;
    let dynamicBarangaySelect = null;

    function createBarangaySelect(selectedValue) {
      if (!barangayInput) return;
      if (dynamicBarangaySelect) return dynamicBarangaySelect;

      const sel = document.createElement("select");
      sel.id = "dynamic_barangay_select";
      sel.className = "chip";
      sel.innerHTML = '<option value="">Select Barangay</option>';
      lipaBarangays.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        sel.appendChild(opt);
      });

      sel.addEventListener("change", () => {
        barangayInput.value = sel.value;
      });

      barangayInput.style.display = "none";
      barangayInput.parentNode.insertBefore(sel, barangayInput.nextSibling);
      dynamicBarangaySelect = sel;

      if (selectedValue) {
        try {
          sel.value = selectedValue;
          barangayInput.value = selectedValue;
        } catch (e) {}
      }

      return sel;
    }

    function removeBarangaySelect() {
      if (!dynamicBarangaySelect) return;
      try {
        barangayInput.value =
          dynamicBarangaySelect.value || barangayInput.value || "";
      } catch (e) {}
      dynamicBarangaySelect.remove();
      dynamicBarangaySelect = null;
      if (barangayInput) barangayInput.style.display = "block";
    }

    const lipaBarangays = [
      "Adya",
      "Anilao",
      "Antipolo Del Norte",
      "Antipolo Del Sur",
      "Bagong Pook",
      "Balintawak",
      "Banaybanay",
      "Bolbok",
      "Bugtong Na Pulo",
      "Bulacnin",
      "Bulaklakan",
      "Calamias",
      "Cumba",
      "Dagatan",
      "Duhatan",
      "Halang",
      "Inosluban",
      "Kayumanggi",
      "Latag",
      "Lodlod",
      "Lumbang",
      "Mabini",
      "Malagonlong",
      "Marawoy",
      "Mataas Na Lupa",
      "Munting Pulo",
      "Pagolingin Bata",
      "Pagolingin East",
      "Pagolingin West",
      "Pangao",
      "Pinagkawitan",
      "Pinagtongulan",
      "Plaridel",
      "Poblacion Barangay 1",
      "Poblacion Barangay 2",
      "Poblacion Barangay 3",
      "Poblacion Barangay 4",
      "Poblacion Barangay 5",
      "Poblacion Barangay 6",
      "Poblacion Barangay 7",
      "Poblacion Barangay 8",
      "Poblacion Barangay 9",
      "Poblacion Barangay 9-A",
      "Poblacion Barangay 10",
      "Poblacion Barangay 11",
      "Poblacion Barangay 12",
      "Pusil",
      "Quezon",
      "Rizal",
      "Sabang",
      "Sampaguita",
      "San Benito",
      "San Carlos",
      "San Celestino",
      "San Francisco",
      "San Guillermo",
      "San Jose",
      "San Lucas",
      "San Salvador",
      "San Sebastian",
      "Santo Nino",
      "Santo Toribio",
      "Sapac",
      "Sico",
      "Talisay",
      "Tambo",
      "Tangob",
      "Tanguay",
      "Tibig",
      "Tipacan",
    ];

    function updateResidencyRequirements() {
      const isLipeno = residencyYes.checked;
      const residencyChanged = isEditMode && isLipeno !== originalIsLipeno;

      console.log("[v0] updateResidencyRequirements:", {
        isEditMode,
        isLipeno,
        originalIsLipeno,
        residencyChanged,
        isCanceling,
      });

      if (applicantStatus === "Reupload") {
        if (!isLipeno) {
          if (resumeContainer) resumeContainer.style.display = "none";
          if (recommendationContainer)
            recommendationContainer.style.display = "block";
          if (recommendationFile) {
            recommendationFile.setAttribute("required", "true");
          }
        } else {
          if (resumeContainer) resumeContainer.style.display = "block";
          if (recommendationContainer)
            recommendationContainer.style.display = "none";
          if (recommendationFile) {
            recommendationFile.removeAttribute("required");
          }
        }

        if (warningBanner) {
          warningBanner.classList.add("show");
          if (bannerTitle)
            bannerTitle.textContent = "Document Reupload Required";
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
        if (recommendationContainer)
          recommendationContainer.style.display = "none";
        if (recommendationFile) {
          recommendationFile.removeAttribute("required");
          recommendationFile.value = "";
        }
        if (isEditMode && !isCanceling) {
          if (provinceInput) provinceInput.value = "Batangas";
          if (cityInput) cityInput.value = "Lipa City";
          createBarangaySelect(
            originalBarangay || (barangayInput ? barangayInput.value : "")
          );
        } else {
          removeBarangaySelect();
        }
      } else {
        if (recommendationContainer)
          recommendationContainer.style.display = "block";
        if (recommendationFile) {
          recommendationFile.setAttribute("required", "true");
        }
        if (isEditMode && !isCanceling) {
          if (provinceInput) provinceInput.value = "";
          if (cityInput) cityInput.value = "";
          if (barangayInput) barangayInput.value = "";
        }
        removeBarangaySelect();
      }
    }

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        isEditMode = true;
        isCanceling = false;
        originalIsLipeno = residencyYes.checked;
        originalCity = cityInput ? cityInput.value : "";
        originalProvince = provinceInput ? provinceInput.value : "";
        originalBarangay = barangayInput ? barangayInput.value : "";
        console.log("[v0] Edit mode started:", {
          originalIsLipeno,
          originalCity,
          originalProvince,
          originalBarangay,
        });
      });
    }

    if (residencyYes) {
      residencyYes.addEventListener("change", () => {
        console.log(
          "[v0] residencyYes changed, isEditMode:",
          isEditMode,
          "isCanceling:",
          isCanceling
        );
        if (isEditMode && !isCanceling) {
          if (provinceInput) provinceInput.value = "Batangas";
          if (cityInput) cityInput.value = "Lipa City";
          createBarangaySelect(
            originalBarangay || (barangayInput ? barangayInput.value : "")
          );
        }
        updateResidencyRequirements();
      });
    }

    if (residencyNo) {
      residencyNo.addEventListener("change", () => {
        console.log(
          "[v0] residencyNo changed, isEditMode:",
          isEditMode,
          "isCanceling:",
          isCanceling
        );
        if (isEditMode && !isCanceling) {
          if (provinceInput) provinceInput.value = "";
          if (cityInput) cityInput.value = "";
          if (barangayInput) barangayInput.value = "";
          removeBarangaySelect();
        }
        updateResidencyRequirements();
      });
    }

    updateResidencyRequirements();

    window.updateResidencyRequirements = updateResidencyRequirements;
    window.copyDynamicBarangayToInput = () => {
      try {
        if (dynamicBarangaySelect && barangayInput) {
          barangayInput.value = dynamicBarangaySelect.value;
        }
      } catch (e) {}
    };
    window.setResidencyCancelMode = (mode) => {
      isCanceling = mode;
      console.log("[v0] isCanceling set to:", mode);
    };
    window.setResidencyEditMode = (mode) => {
      isEditMode = mode;
      console.log("[v0] isEditMode set to:", mode);
    };

    if (cancelBtn) {
      cancelBtn.addEventListener("click", (e) => {
        setTimeout(() => {
          originalIsLipeno = residencyYes.checked;
          originalCity = cityInput ? cityInput.value : "";
          originalProvince = provinceInput ? provinceInput.value : "";
          originalBarangay = barangayInput ? barangayInput.value : "";
          isEditMode = false;

          console.log("[v0] Cancel clicked - restored original state:", {
            originalIsLipeno,
            originalCity,
            originalProvince,
            originalBarangay,
          });

          const event = new Event("change", { bubbles: true });
          residencyYes.dispatchEvent(event);
        }, 50);
      });
    }
  }

  // ================== PDF FILE VALIDATION ==================
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

  // ================== FORCE PASSWORD CHANGE MODAL ==========
  const dataAttr = document.body.getAttribute("data-must-change-password");
  console.log("[v0] data-must-change-password attribute:", dataAttr);

  let mustChangePassword = false;
  try {
    if (dataAttr) {
      const parsed = JSON.parse(dataAttr);
      mustChangePassword = parsed === true;
    }
  } catch (e) {
    console.error("[v0] Error parsing must_change_password:", e);
    mustChangePassword = false;
  }

  console.log("[v0] mustChangePassword after parsing:", mustChangePassword);

  if (mustChangePassword === true) {
    const modal = document.getElementById("forcePasswordModal");
    if (modal) {
      modal.style.display = "flex";
      console.log("[v0] Password change modal shown");
    }
  } else {
    const modal = document.getElementById("forcePasswordModal");
    if (modal) {
      modal.style.display = "none";
      console.log("[v0] Password change modal hidden");
    }
  }

  // ================== SHOW / HIDE PASSWORD ==========
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

  // ================== PASSWORD VALIDATION ==========
  const forcePasswordForm = document.getElementById("forcePasswordForm");
  const newPass = document.getElementById("newPassword");
  const confirmPass = document.getElementById("confirmPassword");
  const submitBtn = document.getElementById("submitBtn");
  const hint = document.getElementById("passwordHint");
  const requirements = document.querySelectorAll("#passwordRequirements li");

  if (!forcePasswordForm || !newPass || !confirmPass || !submitBtn || !hint) {
    console.log(
      "[v0] Force password form elements not found, skipping validation setup"
    );
  } else {
    function validatePasswords() {
      const password = newPass.value.trim();
      const confirm = confirmPass.value.trim();

      const hasMinLength = /.{8,}/.test(password);
      const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSpecialChar = /[@$!%*?&]/.test(password);

      const rules = [hasMinLength, hasUpperAndLower, hasNumber, hasSpecialChar];

      requirements.forEach((li, i) => {
        li.style.color = rules[i] ? "green" : "#ff6666";
      });

      const allRequirementsMet = rules.every(Boolean);

      if (password === "" && confirm === "") {
        hint.textContent = "";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: both empty, button disabled");
        return false;
      }

      if (password !== "" && !allRequirementsMet) {
        hint.textContent = "Password does not meet all requirements.";
        hint.style.color = "#ff6666";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: requirements not met, button disabled");
        return false;
      }

      if (allRequirementsMet && password !== confirm) {
        hint.textContent = "Passwords do not match.";
        hint.style.color = "#ff6666";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: mismatch, button disabled");
        return false;
      }

      if (allRequirementsMet && password === confirm && password !== "") {
        hint.textContent = "Password looks good!";
        hint.style.color = "green";
        submitBtn.disabled = false;
        console.log("[v0] Passwords: valid and match, button enabled");
        return true;
      }

      submitBtn.disabled = true;
      return false;
    }

    newPass.addEventListener("input", validatePasswords);
    confirmPass.addEventListener("input", validatePasswords);

    forcePasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const password = newPass.value.trim();
      const confirm = confirmPass.value.trim();

      const hasMinLength = /.{8,}/.test(password);
      const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSpecialChar = /[@$!%*?&]/.test(password);

      const allRequirementsMet =
        hasMinLength &&
        hasUpperAndLower &&
        hasNumber &&
        hasSpecialChar &&
        password === confirm &&
        password !== "";

      if (!allRequirementsMet) {
        hint.textContent = "Please fix the errors above before submitting.";
        hint.style.color = "#ff6666";
        return;
      }

      const modal = document.getElementById("forcePasswordModal");
      if (modal) modal.style.display = "none";

      forcePasswordForm.submit();
    });

    validatePasswords();
  }

  // ==================== APPLICATION TAB FILTER ====================
  const tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));
    const cards = Array.from(document.querySelectorAll(".application-card"));

    function setActiveButton(activeBtn) {
      tabButtons.forEach((b) => b.classList.toggle("active", b === activeBtn));
    }

    function filterCards(filter) {
      cards.forEach((card) => {
        const status = card.getAttribute("data-status") || "";
        if (filter === "all" || filter === "") card.classList.remove("hidden");
        else
          status === filter
            ? card.classList.remove("hidden")
            : card.classList.add("hidden");
      });
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        setActiveButton(btn);
        filterCards(filter);
        btn.focus();
      });
    });

    const initialBtn =
      tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) {
      setActiveButton(initialBtn);
      filterCards(initialBtn.dataset.filter || "all");
    }
  }

  // ==================== JOB SEARCH & FILTER ====================
  const searchEl = document.getElementById("searchInput");
  const industrySelect = document.getElementById("industrySelect");
  const typeSelect = document.getElementById("typeSelect");
  const scheduleSelect = document.getElementById("scheduleSelect");

  function _normalize(str) {
    return (str || "").toString().trim().toLowerCase();
  }

  const jobCards = Array.from(document.querySelectorAll(".job-card"));
  jobCards.forEach((card) => {
    const cs = window.getComputedStyle(card);
    card.dataset.defaultDisplay =
      cs.display === "inline" ? "inline-block" : cs.display || "block";
  });

  function filterJobs() {
    const searchValue = _normalize(searchEl?.value);
    const industryValue = _normalize(industrySelect?.value);
    const typeValue = _normalize(typeSelect?.value);
    const scheduleValue = _normalize(scheduleSelect?.value);

    jobCards.forEach((card) => {
      const jobTitle = _normalize(
        card.querySelector(".job-title")?.textContent
      );
      const companyName = _normalize(
        card.querySelector(".company-name")?.textContent
      );
      const cardIndustry = _normalize(
        card.querySelector(".job-industry")?.textContent
      );
      const cardType = _normalize(card.querySelector(".job-type")?.textContent);
      const cardSchedule = _normalize(
        card.querySelector(".job-schedule")?.textContent
      );

      const matchesSearch =
        !searchValue ||
        jobTitle.includes(searchValue) ||
        companyName.includes(searchValue);
      const matchesIndustry =
        !industryValue || cardIndustry.includes(industryValue);
      const matchesType = !typeValue || cardType.includes(typeValue);
      const matchesSchedule =
        !scheduleValue || cardSchedule.includes(scheduleValue);

      const show =
        matchesSearch && matchesIndustry && matchesType && matchesSchedule;

      card.style.display = show ? card.dataset.defaultDisplay : "none";
      card.classList.toggle("hidden", !show);
    });
  }

  if (searchEl) searchEl.addEventListener("input", filterJobs);
  [industrySelect, typeSelect, scheduleSelect].forEach((el) => {
    if (el) el.addEventListener("change", filterJobs);
  });

  filterJobs();

  // ==================== REPORT MODAL ====================
  const reportModal = document.getElementById("reportModalUnique");
  const closeReportBtn = reportModal?.querySelector(".close-report-unique");
  const cancelReportBtn = document.getElementById("cancelReportUnique");
  const confirmReportBtn = document.getElementById("confirmReportUnique");
  const reportReasonSelect = document.getElementById("reportReasonUnique");
  let reportingJobId = null;

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-report");
    if (!btn) return;
    reportingJobId = btn.closest(".job-card")?.querySelector(".btn-details")
      ?.dataset.jobId;
    if (reportModal) reportModal.style.display = "flex";
  });

  if (closeReportBtn) {
    closeReportBtn.addEventListener("click", () => {
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    });
  }

  if (cancelReportBtn) {
    cancelReportBtn.addEventListener("click", () => {
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    });
  }

  if (confirmReportBtn) {
    confirmReportBtn.addEventListener("click", async () => {
      const reason = reportReasonSelect?.value;
      if (!reason) {
        showFlash("Please select a reason for the report.", "warning");
        return;
      }

      try {
        const res = await fetch("/applicants/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.JSON.stringify({ job_id: reportingJobId, reason }),
          credentials: "same-origin",
        });
        const data = await res.json();

        if (data.success) {
          showFlash("Report submitted successfully. Thank you!", "success");
          if (reportModal) reportModal.style.display = "none";
          if (reportReasonSelect) reportReasonSelect.value = "";
        } else {
          showFlash(data.message || "Failed to submit report.", "danger");
        }
      } catch (err) {
        console.error("[v0] Report error:", err);
        showFlash("An error occurred while submitting your report.", "danger");
      }
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === reportModal) {
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    }
  });

  // ==================== APPLY MODAL FLOW ====================
  let selectedJobId = null;
  const confirmModal = document.getElementById("confirmModalUnique");
  const successModal = document.getElementById("successModalUnique");
  const confirmApplyBtn = confirmModal?.querySelector(".btn-confirm");
  const cancelConfirmBtn = confirmModal?.querySelector(".btn-cancel-confirm");
  const successConfirmBtn = successModal?.querySelector(".btn-confirm");

  function showAlreadyAppliedToast() {
    const toast = document.getElementById("alreadyAppliedToast");
    if (!toast) return;

    toast.style.display = "flex";
    setTimeout(() => (toast.style.display = "none"), 3000);
  }

  document
    .getElementById("alreadyAppliedClose")
    ?.addEventListener("click", () => {
      document.getElementById("alreadyAppliedToast").style.display = "none";
    });

  async function hasApplied(jobId) {
    try {
      const res = await fetch(
        `/applicants/api/check-application?jobId=${jobId}`
      );
      const data = await res.json();
      return data.applied;
    } catch (err) {
      console.error("Error checking application:", err);
      return false;
    }
  }

  document.querySelectorAll(".btn-apply").forEach((button) => {
    button.addEventListener("click", async () => {
      selectedJobId = button.dataset.jobId;

      if (await hasApplied(selectedJobId)) {
        showAlreadyAppliedToast();
        return;
      }

      if (confirmModal) confirmModal.style.display = "flex";
    });
  });

  if (cancelConfirmBtn) {
    cancelConfirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[v0] Cancel button clicked");

      if (confirmModal) {
        confirmModal.style.display = "none";
      }
      selectedJobId = null;
    });
  }

  if (confirmApplyBtn) {
    confirmApplyBtn.addEventListener("click", async () => {
      if (!selectedJobId) return;

      showLoader("Submitting your application...");

      try {
        const res = await fetch(`/applicants/apply/${selectedJobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        });

        const data = await res.json();

        hideLoader();
        if (confirmModal) confirmModal.style.display = "none";

        if (data.success) {
          if (successModal) successModal.style.display = "flex";

          const jobCard = document
            .querySelector(`.job-card [data-job-id="${selectedJobId}"]`)
            ?.closest(".job-card");
          if (jobCard) {
            const applyBtn = jobCard.querySelector(".btn-apply");
            if (applyBtn) {
              applyBtn.textContent = "Applied";
              applyBtn.disabled = true;
              applyBtn.style.backgroundColor = "#6b7280";
              applyBtn.style.cursor = "not-allowed";
            }
          }
        } else {
          showFlash(data.message || "Failed to submit application.", "danger");
        }
      } catch (err) {
        hideLoader();
        console.error("[v0] Apply error:", err);
        showFlash(
          "An error occurred while submitting your application.",
          "danger"
        );
      }
    });
  }

  if (successConfirmBtn) {
    successConfirmBtn.addEventListener("click", () => {
      if (successModal) successModal.style.display = "none";
      location.reload();
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
      if (confirmModal) confirmModal.style.display = "none";
      selectedJobId = null;
    }
    if (e.target === successModal && successModal)
      successModal.style.display = "none";
  });

  // ==================== JOB DETAILS MODAL ====================
  const jobDetailsModal = document.getElementById("jobDetailsModalUnique");
  const modalApplyBtn = document.getElementById("modal-apply-btn");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const closeBtn = jobDetailsModal?.querySelector(".close-unique");

  document.addEventListener("click", (e) => {
    const detailsBtn = e.target.closest(".btn-details");
    if (!detailsBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const jobId = detailsBtn.dataset.jobId;
    console.log("[v0] Details clicked for job:", jobId);

    if (!jobId) {
      console.log("[v0] No job ID found");
      return;
    }

    if (!jobDetailsModal) {
      console.log("[v0] Modal not found in DOM");
      return;
    }

    jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
      "<p style='text-align: center; padding: 20px;'>Loading job details...</p>";
    jobDetailsModal.dataset.modalJobId = jobId;
    jobDetailsModal.style.display = "flex";
    console.log("[v0] Modal displayed");

    fetch(`/applicants/job/${jobId}`, { credentials: "same-origin" })
      .then((res) => {
        console.log("[v0] Response status:", res.status);
        return res.text();
      })
      .then((html) => {
        console.log("[v0] Loaded HTML length:", html.length);
        jobDetailsModal.querySelector("#modal-body-unique").innerHTML = html;
      })
      .catch((err) => {
        console.error("[v0] Fetch error:", err);
        jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
          "<p style='color: red; text-align: center;'>Failed to load job details. Please try again.</p>";
      });
  });

  document.addEventListener("click", async (e) => {
    const applyBtn = e.target.closest(
      "#jobDetailsModalUnique .btn-apply, #jobDetailsModalUnique #modal-apply-btn"
    );
    if (!applyBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const jobIdFromModal = jobDetailsModal?.dataset?.modalJobId;
    if (!jobIdFromModal) {
      console.log("[v0] No job ID in modal");
      return;
    }

    selectedJobId = jobIdFromModal;

    if (await hasApplied(selectedJobId)) {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
      showAlreadyAppliedToast();
      return;
    }

    if (jobDetailsModal) jobDetailsModal.style.display = "none";
    if (confirmModal) confirmModal.style.display = "flex";
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === jobDetailsModal && jobDetailsModal) {
      jobDetailsModal.style.display = "none";
    }
  });

  // ==================== RENDER APPLICATIONS ====================
  async function renderApplications() {
    const applicationsList = document.getElementById("applicationsList");
    if (!applicationsList) return;

    try {
      const res = await fetch("/applicants/api/applications", {
        credentials: "same-origin",
      });

      console.log(
        "[v0] /applicants/api/applications status:",
        res.status,
        res.statusText
      );

      if (!res.ok) {
        let bodyText = "";
        try {
          const errJson = await res.json();
          bodyText = errJson.message || JSON.stringify(errJson);
        } catch (e) {
          bodyText = await res.text().catch(() => "Failed to read response");
        }
        console.warn("[v0] Failed to load applications:", bodyText);
        applicationsList.innerHTML = `<div class="empty-state"><p>Error loading applications: ${bodyText}</p></div>`;
        return;
      }

      const applications = await res.json();

      if (
        !applications ||
        (Array.isArray(applications) === false &&
          applications.success === false)
      ) {
        const msg = Array.isArray(applications)
          ? "No applications yet."
          : applications.message || "No applications yet.";
        applicationsList.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
        console.log(
          "[v0] Applications API returned empty or error:",
          applications
        );
        return;
      }

      if (!applications || applications.length === 0) {
        applicationsList.innerHTML = `<div class="empty-state"><p>No applications yet.</p></div>`;
        return;
      }

      applicationsList.innerHTML = applications
        .map((app) => {
          const statusText = app.status || "Applied";
          const statusKey = (statusText || "").toString().toLowerCase();
          let badgeClass = "badge-default";
          if (statusKey.includes("pending") || statusKey === "applied")
            badgeClass = "badge-pending";
          else if (statusKey.includes("shortlist"))
            badgeClass = "badge-shortlisted";
          else if (statusKey.includes("interview"))
            badgeClass = "badge-interview";
          else if (statusKey.includes("hired")) badgeClass = "badge-hired";
          else if (statusKey.includes("reject")) badgeClass = "badge-rejected";

          const canCancel = ["pending", "applied"].includes(statusKey);

          return `
            <div class="application-card" data-app-id="${app.id}">
              <div class="application-info">
                <h3 class="app-job">${app.jobTitle || "N/A"}</h3>
                <p class="app-company">${app.companyName || ""} ${
            app.location ? "• " + app.location : ""
          }</p>
                <small class="app-date">${new Date(
                  app.date
                ).toLocaleString()}</small>
              </div>
              <div class="application-meta">
                <span class="status-badge ${badgeClass}">${statusText}</span>
                ${
                  canCancel
                    ? `<button class="btn btn-cancel-app" data-app-id="${app.id}">Cancel</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      console.error("Failed to load applications:", err);
      applicationsList.innerHTML = `<div class="empty-state"><p>Error loading applications.</p></div>`;
    }
  }

  document.addEventListener("click", async (e) => {
    const cancelBtn = e.target.closest(".btn-cancel-app");
    if (cancelBtn) {
      e.preventDefault();
      const appId = cancelBtn.dataset.appId;
      if (!appId) return;
      if (!confirm("Are you sure you want to cancel this application?")) return;
      try {
        const res = await fetch(`/applicants/api/delete-application/${appId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const data = await res.json();
        if (data.success) {
          if (typeof renderApplications === "function") renderApplications();
          showFlash("Application cancelled.", "success");
          try {
            if (window.fetchJobCounts) window.fetchJobCounts();
          } catch (e) {}
        } else {
          showFlash(data.message || "Failed to cancel application", "danger");
        }
      } catch (err) {
        console.error("Cancel error", err);
        showFlash("Error cancelling application", "danger");
      }
      return;
    }

    const card = e.target.closest(".application-card");
    if (card && !e.target.closest(".btn-cancel-app")) {
      const appId = card.dataset.appId;
      // Card interaction can be added here if needed
    }
  });
});
