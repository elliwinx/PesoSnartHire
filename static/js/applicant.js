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

function hideFlash() {
  const flashContainer = document.querySelector(".flash");
  if (flashContainer) {
    flashContainer.remove();
  }
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
      isEditMode = true;
      isCanceling = false;

      // ... (Keep your existing 'originalValues' capture logic) ...
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));
      radios.forEach((el) => {
        if (el.id) originalValues[el.id] = el.checked;
      });
      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg) originalValues["avatarSrc"] = avatarImg.src;
      // ...

      // Store original state variables
      originalIsLipeno = residencyYes.checked;
      originalCity = cityInput ? cityInput.value : "";
      originalProvince = provinceInput ? provinceInput.value : "";
      originalBarangay = barangayInput ? barangayInput.value : "";

      // UI Updates
      profileTop?.classList.add("edit-mode");
      avatar?.classList.add("editable");

      // 1. Unlock Text Inputs & Radios
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => {
        el.removeAttribute("disabled");
        el.classList.remove("select-readonly");
      });
      radios.forEach((el) => el.removeAttribute("disabled"));
      setConditionalInputsEditable(true);

      // 2. LOCK ALL FILES BY DEFAULT
      fileInputs.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("disabled", "true");
      });

      // 3. EXPLICITLY UNLOCK RESUME (Always allowed)
      const resumeInp = document.getElementById("resume_file");
      if (resumeInp) {
        resumeInp.style.display = "block";
        resumeInp.removeAttribute("disabled");
      }

      // 4. UNLOCK AVATAR UPLOAD
      const avatarInp = document.querySelector(".avatar input[type='file']");
      if (avatarInp) {
        avatarInp.removeAttribute("disabled");
      }

      // 5. CALL FUNCTION TO CHECK RECOMMENDATION EXPIRY
      // This will unlock recommendation_file ONLY if isExpiring=true
      updateResidencyRequirements();

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

      // Get the container and input
      const recContainer = document.getElementById(
        "recommendation-upload-container"
      );
      const recInput = document.getElementById("recommendation_file");

      // Check if backend flagged this as expiring (read from HTML)
      const isExpiring = recContainer
        ? recContainer.getAttribute("data-expiring") === "true"
        : false;

      // 1. Handle "Reupload" status (User is already locked out, just needs to upload)
      if (applicantStatus === "Reupload") {
        if (!isLipeno) {
          if (resumeContainer) resumeContainer.style.display = "none";
          if (recContainer) recContainer.style.display = "block";
          if (recInput) recInput.setAttribute("required", "true");
        } else {
          if (resumeContainer) resumeContainer.style.display = "block";
          if (recContainer) recContainer.style.display = "none";
          if (recInput) recInput.removeAttribute("required");
        }
        // Show banner for reupload
        if (warningBanner) {
          warningBanner.classList.add("show");
          if (bannerTitle)
            bannerTitle.textContent = "Document Reupload Required";
          if (bannerMessage)
            bannerMessage.textContent =
              "Please reupload the requested document(s) below.";
        }
        return;
      }

      // 2. Handle Normal "Approved" / "Pending" status (Edit Mode logic)
      if (resumeContainer) resumeContainer.style.display = "block";

      // Toggle Banner based on residency change
      if (warningBanner) {
        if (residencyChanged) {
          warningBanner.classList.add("show");
          if (bannerTitle) bannerTitle.textContent = "Residency Type Changed";
          // ... (Keep your existing banner message logic here) ...
          if (isLipeno) {
            if (bannerMessage)
              bannerMessage.innerHTML =
                "<strong>Changed to Lipeño:</strong> Recommendation letter no longer required.";
          } else {
            if (bannerMessage)
              bannerMessage.innerHTML =
                "<strong>Changed to Non-Lipeño:</strong> You must now upload a recommendation letter.";
          }
        } else {
          warningBanner.classList.remove("show");
        }
      }

      // Visibility & Locking Logic
      if (isLipeno) {
        // HIDE if Lipeno
        if (recContainer) recContainer.style.display = "none";
        if (recInput) {
          recInput.removeAttribute("required");
          recInput.value = "";
        }
        // ... (Keep your existing address auto-fill logic for Lipa) ...
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
        // SHOW if Non-Lipeno
        if (recContainer) recContainer.style.display = "block";

        // SECURITY CHECK: Should the input be unlocked?
        // Unlock ONLY if: (Edit Mode is ON) AND (Residency Changed OR Document is Expiring)
        if (recInput) {
          if (isEditMode && (residencyChanged || isExpiring)) {
            recInput.style.display = "block";
            recInput.removeAttribute("disabled");
            recInput.setAttribute("required", "true");
          } else {
            // Otherwise, keep it physically present but hidden/disabled
            // This prevents users from "accidentally" uploading a file when they shouldn't
            recInput.style.display = "none";
            recInput.setAttribute("disabled", "true");
          }
        }

        // ... (Keep your existing address clear logic) ...
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
  // The original code for this section had a redeclaration of tabGroup, which is now fixed.
  let tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));
    const cards = Array.from(document.querySelectorAll(".application-card")); // This line might not be needed for the filter logic itself, but kept for context.

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

      if (!reportingJobId) {
        showFlash("Unable to determine which job to report.", "danger");
        return;
      }

      try {
        const res = await fetch(`/applicants/report_job/${reportingJobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to submit report.");
        }

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

    // ✅ NEW: Get the applied status from the button we clicked
    // This reads the data-has-applied="1" we added in HTML
    const hasApplied = detailsBtn.getAttribute("data-has-applied") === "1";

    console.log("[v0] Details clicked for job:", jobId, "Applied:", hasApplied);

    if (!jobId) {
      console.log("[v0] No job ID found");
      return;
    }

    if (!jobDetailsModal) {
      console.log("[v0] Modal not found in DOM");
      return;
    }

    // ✅ NEW: Update the Modal Apply Button based on status
    if (modalApplyBtn) {
      if (hasApplied) {
        modalApplyBtn.textContent = "Application Sent";
        modalApplyBtn.disabled = true;
        modalApplyBtn.style.backgroundColor = "#6c757d"; // Optional: Gray it out
        modalApplyBtn.style.cursor = "not-allowed";
      } else {
        modalApplyBtn.textContent = "Apply Now";
        modalApplyBtn.disabled = false;
        modalApplyBtn.style.backgroundColor = ""; // Reset to default
        modalApplyBtn.style.cursor = "pointer";
      }
    }

    // --- The rest of your existing code stays the same ---
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
  // ========== ADDED FUNCTIONS FOR APPLICATION MANAGEMENT ==========

  // PART 2: Fix renderApplications in applicant.js
  window.renderApplications = async (filter = "all") => {
    const container = document.getElementById("applicationsList");
    if (!container) return;

    console.log("[v0] renderApplications called with filter:", filter);

    try {
      container.innerHTML = '<div class="loader">Loading applications...</div>';

      const response = await fetch(
        `/applicants/api/applications?filter=${filter}`
      );

      console.log("[v0] API response status:", response.status);

      if (!response.ok) throw new Error("Failed to fetch applications");

      const data = await response.json();
      console.log("[v0] API response data:", data);

      const applications = data.applications || [];
      console.log("[v0] Applications array length:", applications.length);

      if (applications.length === 0) {
        container.innerHTML = '<p class="empty-msg">No applications found.</p>';
        return;
      }

      container.innerHTML = applications
        .map((app) => {
          const statusClass = app.status.toLowerCase().replace(/\s+/g, "-");
          console.log(
            "[v0] Rendering application:",
            app.job_position,
            "Status:",
            app.status,
            "StatusClass:",
            statusClass
          );

          return `
        <div class="application-card" data-status="${statusClass}" onclick="viewApplicationDetails(${
            app.id
          })" style="cursor: pointer;">
        <div class="app-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3> ${app.job_position}</h3>
          <span class="status-badge ${statusClass}">${app.status}</span>
        </div>

          <div class="app-body">
            <p><strong>${app.employer_name || "N/A"}</strong> </p>
            <p>Applied on</strong> ${new Date(
              app.applied_at
            ).toLocaleDateString()}</p>
            <p class="click-hint" style="font-size: 0.8rem; color: #666; margin-top: 8px;"></p>
          </div>
        </div>
      `;
        })
        .join("");
    } catch (error) {
      console.error("[v0] Error rendering applications:", error);
      container.innerHTML =
        '<p class="error-msg">Failed to load applications. Please try again.</p>';
    }
  };

  // <CHANGE> FIXED: Properly handle the existing modal buttons and make them work
  window.viewApplicationDetails = async (applicationId) => {
    const modal = document.getElementById("applicationDetailsModal");
    const content = document.getElementById("applicationDetailsContent");
    const cancelBtn = document.getElementById("applicationCancelBtn");
    const closeBtn = document.getElementById("applicationCloseBtn");

    if (!modal || !content) {
      console.log("[v0] Modal elements not found");
      return;
    }

    content.innerHTML = '<div class="loader">Loading details...</div>';
    modal.style.display = "block";

    try {
      console.log("[v0] Fetching application details for ID:", applicationId);
      const response = await fetch(
        `/applicants/api/applications/${applicationId}`
      );

      console.log("[v0] Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log("[v0] Error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("[v0] Application data received:", data);

      if (!data.success || !data.application) {
        throw new Error(data.message || "Invalid response format");
      }

      const app = data.application;

      content.innerHTML = `
      <div class="header-row" id="header-row-${app.id}">
        <h2>Current Application Status</h2>
        <p class="status">
          <strong>Status:</strong>
          <span class="status-badge ${app.status
            .toLowerCase()
            .replace(/\s+/g, "-")}">${app.status}</span>
        </p>
      </div>
      <p><strong>Application Information:</strong></p>
      <div class="detail-group" style="margin: 2px 0;">
        <p>${app.job_position}</p>
        <p>${app.employer_name}</p>
        <p>${app.location}</p>
        <p>Applied On ${new Date(app.applied_at).toLocaleDateString()}</p>
      </div>
    `;

      // <CHANGE> Show/hide cancel button based on status and attach click handler
      if (cancelBtn) {
        if (app.status === "Pending") {
          cancelBtn.style.display = "inline-block";
          cancelBtn.onclick = () => window.cancelApplication(app.id);
        } else {
          cancelBtn.style.display = "none";
        }
      }

      // <CHANGE> Make sure close button is clickable
      if (closeBtn) {
        closeBtn.style.display = "inline-block";
        closeBtn.onclick = () => {
          modal.style.display = "none";
        };
      }
    } catch (error) {
      console.error("[v0] Error in viewApplicationDetails:", error);
      content.innerHTML = `<p class="error" style="color: #dc3545;">Failed to load details: ${error.message}</p>`;
    }
  };

  const proceedCancel = async (applicationId) => {
    try {
      window.showLoader("Cancelling application...");
      console.log("[v0] Calling cancel endpoint for app:", applicationId);

      // <CHANGE> Correct endpoint path: /applicants/api/cancel-application (legacy delete path delegated server-side)
      // Use POST method (not DELETE)
      const response = await fetch(
        `/applicants/api/cancel-application/${applicationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        }
      );

      window.hideLoader();

      if (response.ok) {
        const data = await response.json();
        console.log("[v0] Cancel response:", data);

        if (data.success) {
          window.showFlash("Application cancelled successfully", "success");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          console.error("[v0] Cancel failed:", data.message);
          window.showFlash(
            data.message || "Failed to cancel application",
            "error"
          );
        }
      } else {
        console.error("[v0] HTTP error:", response.status);
        window.showFlash(
          "Failed to cancel application with status: " + response.status,
          "error"
        );
      }
    } catch (error) {
      window.hideLoader();
      console.error("[v0] Error cancelling application:", error);
      window.showFlash(
        "An error occurred while cancelling the application",
        "error"
      );
    }
  };

  window.cancelApplication = (applicationId) => {
    const modal = document.getElementById("cancelConfirmModal");

    if (!modal) {
      console.error("[v0] cancelConfirmModal not found in DOM");
      return;
    }

    modal.style.display = "flex";

    // When YES is clicked
    const confirmYesBtn = document.getElementById("confirmCancelYes");
    if (confirmYesBtn) {
      confirmYesBtn.onclick = () => {
        modal.style.display = "none";
        proceedCancel(applicationId);
      };
    }

    // When NO is clicked
    const confirmNoBtn = document.getElementById("confirmCancelNo");
    if (confirmNoBtn) {
      confirmNoBtn.onclick = () => {
        modal.style.display = "none";
      };
    }

    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        modal.style.display = "none";
      }
    });
  };

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("applicationDetailsModal");
    if (
      event.target === modal ||
      event.target.classList.contains("close-modal")
    ) {
      if (modal) modal.style.display = "none";
    }
  });
  // END OF ADDED FUNCTIONS FOR APPLICATION MANAGEMENT

  // ==================== APPLICATION TAB FILTER UPDATE ====================
  // Re-selecting tabGroup here to fix lint/suspicious/noRedeclare
  tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        console.log("[v0] Tab clicked with filter:", filter);

        // Set active button
        tabButtons.forEach((b) => b.classList.toggle("active", b === btn));

        if (typeof window.renderApplications === "function") {
          window.renderApplications(filter);
        }
        btn.focus();
      });
    });

    // Load initial applications
    const initialBtn =
      tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) {
      tabButtons.forEach((b) => b.classList.toggle("active", b === initialBtn));
      if (typeof window.renderApplications === "function") {
        window.renderApplications(initialBtn.dataset.filter || "all");
      }
    }
  }
});
