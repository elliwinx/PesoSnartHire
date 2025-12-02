// New scalable modal system - handles unlimited modals with data attributes
document.addEventListener("DOMContentLoaded", () => {
  // Open modal when clicking triggers with data-modal-target
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-modal-target]");
    if (trigger) {
      e.preventDefault();
      const modalId = trigger.getAttribute("data-modal-target");
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent background scrolling
      }
    }
  });

  // Close modal when clicking close buttons or outside modal
  document.addEventListener("click", (e) => {
    // Close button clicked
    if (e.target.closest("[data-modal-close]")) {
      const modal = e.target.closest(".modal");
      if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }

    // Clicked outside modal (on backdrop)
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
      document.body.style.overflow = "auto";
    }
  });

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModal = document.querySelector('.modal[style*="block"]');
      if (openModal) {
        openModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }
  });
});

// T AND C QUICK SUMMARY AND FULL TERMS BUTTONS
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Hide all content
      contents.forEach((c) => (c.style.display = "none"));

      // Show target content
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).style.display = "block";

      // Update active button
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Show quick summary by default
  // T AND C JS
  document.getElementById("quick-summary").style.display = "block";
});

// T AND C JS TO ENABLE THE BUTTON ONCE CHECKBOX IS CHECKED
document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("accepted_terms");
  const proceedBtn = document.getElementById("proceed-btn");

  // Initially disable the button
  proceedBtn.disabled = true;

  checkbox.addEventListener("change", () => {
    proceedBtn.disabled = !checkbox.checked;
  });
});

//APPLICANT REGISTRATION FORM JS
document.addEventListener("DOMContentLoaded", () => {
  // Elements (guarded)
  const form = document.getElementById("applicantRegistrationForm");
  const phoneInput = document.getElementById("applicantPhoneNumber");
  const fromLipaCheckbox = document.getElementById("fromLipa");
  const provinceSelect = document.getElementById("applicantProvince");
  const citySelect = document.getElementById("applicantCity");
  const cityTextInput = document.getElementById("applicantCityText");
  const barangaySelect = document.getElementById("applicantBarangay");
  const barangayTextInput = document.getElementById("applicantBarangayText");
  const pwdCheckbox = document.getElementById("pwd");
  const pwdSpecification = document.getElementById("pwdSpecification");
  const workExperienceCheckbox = document.getElementById("workExperience");
  const workExperienceDetails = document.getElementById(
    "workExperienceDetails"
  );
  const recommendationLetterSection = document.getElementById(
    "recommendationLetterSection"
  );
  const recommendationInput = document.getElementById(
    "applicantRecommendationLetter"
  );
  const profilePicInput = document.getElementById("applicantProfilePic");
  const resumeInput = document.getElementById("applicantResume");
  const reminderLipenos = document.getElementById("reminderLipenos");
  const reminderNonLipenos = document.getElementById("reminderNonLipenos");

  const BASE_URL = "https://psgc.gitlab.io/api";
  const METRO_MANILA_CODE = "130000000";

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

  function populateSelect(element, items, defaultText) {
    element.innerHTML = `<option value="">${defaultText}</option>`;
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name; // Save NAME (e.g., "Batangas")
      option.dataset.code = item.code; // Use CODE for API calls
      option.textContent = item.name;
      element.appendChild(option);
    });
  }

  function updateRecommendationRequirementFromLipa() {
    if (!recommendationInput || !recommendationLetterSection) return;

    if (fromLipaCheckbox && fromLipaCheckbox.checked) {
      // Lipeno: Hide recommendation
      recommendationLetterSection.style.display = "none";
      recommendationInput.required = false;
      recommendationInput.value = "";
      if (reminderLipenos) reminderLipenos.style.display = "block";
      if (reminderNonLipenos) reminderNonLipenos.style.display = "none";
    } else {
      // Non-Lipeno: Show recommendation
      recommendationLetterSection.style.display = "block";
      recommendationInput.required = true;
      if (reminderLipenos) reminderLipenos.style.display = "none";
      if (reminderNonLipenos) reminderNonLipenos.style.display = "block";
    }
  }

  async function loadProvinces() {
    try {
      const response = await fetch(`${BASE_URL}/provinces/`);
      if (!response.ok) throw new Error("Failed to fetch provinces");
      const data = await response.json();

      // FIXED: Add Metro Manila manually
      data.push({
        code: METRO_MANILA_CODE,
        name: "Metro Manila",
      });

      data.sort((a, b) => a.name.localeCompare(b.name));
      populateSelect(provinceSelect, data, "Select Province");
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function loadCities(provinceCode) {
    citySelect.innerHTML = '<option value="">Loading...</option>';
    citySelect.disabled = true;
    barangaySelect.innerHTML = '<option value="">Select City First</option>';
    barangaySelect.disabled = true;

    try {
      // FIXED: Check if Metro Manila (Region) or standard Province
      let url;
      if (provinceCode === METRO_MANILA_CODE) {
        url = `${BASE_URL}/regions/${METRO_MANILA_CODE}/cities-municipalities/`;
      } else {
        url = `${BASE_URL}/provinces/${provinceCode}/cities-municipalities/`;
      }

      const response = await fetch(url);
      const data = await response.json();
      data.sort((a, b) => a.name.localeCompare(b.name));
      populateSelect(citySelect, data, "Select Municipality/City");
      citySelect.disabled = false;
    } catch (error) {
      console.error("Error:", error);
      citySelect.innerHTML = '<option value="">Error loading data</option>';
    }
  }

  async function loadBarangays(code) {
    barangaySelect.innerHTML = '<option value="">Loading...</option>';
    barangaySelect.disabled = true;

    try {
      const response = await fetch(
        `${BASE_URL}/cities-municipalities/${code}/barangays/`
      );
      const data = await response.json();
      data.sort((a, b) => a.name.localeCompare(b.name));
      populateSelect(barangaySelect, data, "Select Barangay");
      barangaySelect.disabled = false;
    } catch (error) {
      console.error("Error:", error);
      barangaySelect.innerHTML = '<option value="">Error loading data</option>';
    }
  }

  if (provinceSelect) {
    provinceSelect.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      if (code) loadCities(code);
      else {
        citySelect.innerHTML =
          '<option value="">Select Province First</option>';
        citySelect.disabled = true;
        barangaySelect.innerHTML =
          '<option value="">Select City First</option>';
        barangaySelect.disabled = true;
      }

      // Uncheck "From Lipa" if they pick a different province
      if (
        this.value !== "Batangas" &&
        fromLipaCheckbox &&
        fromLipaCheckbox.checked
      ) {
        fromLipaCheckbox.checked = false;
        updateRecommendationRequirementFromLipa();
      }
    });
  }

  if (citySelect) {
    citySelect.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;
      if (code) loadBarangays(code);

      // Auto-check logic
      if (fromLipaCheckbox) {
        // FIXED: Match "City of Lipa"
        const isLipa =
          this.value === "City of Lipa" && provinceSelect.value === "Batangas";
        if (fromLipaCheckbox.checked !== isLipa) {
          fromLipaCheckbox.checked = isLipa;
          updateRecommendationRequirementFromLipa();
        }
      }
    });
  }

  if (fromLipaCheckbox) {
    fromLipaCheckbox.addEventListener("change", async function () {
      updateRecommendationRequirementFromLipa();

      if (this.checked) {
        // Auto-select Batangas -> City of Lipa
        const batOption = Array.from(provinceSelect.options).find(
          (o) => o.value === "Batangas"
        );
        if (batOption) {
          provinceSelect.value = "Batangas";
          await loadCities(batOption.dataset.code);

          // FIXED: Look for "City of Lipa" instead of "Lipa City"
          const lipaOption = Array.from(citySelect.options).find(
            (o) => o.value === "City of Lipa"
          );
          if (lipaOption) {
            citySelect.value = "City of Lipa";
            await loadBarangays(lipaOption.dataset.code);
          }
        }
      } else {
        // Reset
        provinceSelect.value = "";
        citySelect.innerHTML =
          '<option value="">Select Province First</option>';
        citySelect.disabled = true;
        barangaySelect.innerHTML =
          '<option value="">Select City First</option>';
        barangaySelect.disabled = true;
      }
    });
  }

  if (pwdCheckbox) {
    pwdCheckbox.addEventListener("change", function () {
      if (this.checked) {
        pwdSpecification && (pwdSpecification.style.display = "block");
        const sel = document.getElementById("applicantIsPWD");
        if (sel) sel.required = true;
      } else {
        pwdSpecification && (pwdSpecification.style.display = "none");
        const sel = document.getElementById("applicantIsPWD");
        if (sel) {
          sel.required = false;
          sel.value = "";
        }
      }
    });
  }

  if (workExperienceCheckbox) {
    workExperienceCheckbox.addEventListener("change", function () {
      if (this.checked) {
        workExperienceDetails &&
          (workExperienceDetails.style.display = "block");
        const sel = document.getElementById("applicantHasWorkExp");
        if (sel) sel.required = true;
      } else {
        workExperienceDetails && (workExperienceDetails.style.display = "none");
        const sel = document.getElementById("applicantHasWorkExp");
        if (sel) {
          sel.required = false;
          sel.value = "";
        }
      }
    });
  }

  if (provinceSelect) loadProvinces();
  updateRecommendationRequirementFromLipa();

  function showFlash(message, type = "danger") {
    // Check for existing container or create one
    let container = document.getElementById("flash-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "flash-container";
      document.body.insertBefore(container, document.body.firstChild);
    }

    const flash = document.createElement("div");
    flash.className = `flash ${type}`;
    flash.innerHTML = `${message} <button class="close" onclick="this.parentElement.remove()">×</button>`;

    container.appendChild(flash);

    // Auto remove
    setTimeout(() => {
      flash.classList.add("fade-out");
      setTimeout(() => flash.remove(), 500);
    }, 3000);
  }

  function showLoader(text = "Processing — please wait...") {
    const loader = document.getElementById("ajaxLoader");
    const loaderText = document.getElementById("ajaxLoaderText");
    if (loaderText) loaderText.textContent = text;
    if (loader) loader.style.display = "flex";
  }

  // === Form submit validation (client-side) ===
  if (form) {
    form.addEventListener("submit", function (e) {
      // perform client-side checks; allow form to submit if all good
      // check required text/select fields
      const requiredFields = form.querySelectorAll("[required]");
      for (let i = 0; i < requiredFields.length; i++) {
        const f = requiredFields[i];
        // file inputs: check files length; text/select: check value
        if (f.type === "file") {
          if (!f.files || f.files.length === 0) {
            showFlash("Please upload all required files.", "danger");
            f.focus();
            e.preventDefault();
            return;
          }
        } else if (!f.value || !f.value.trim()) {
          showFlash("Please fill in all required fields.", "danger");
          f.focus();
          e.preventDefault();
          return;
        }
      }

      // Additional file type checks (optional but helpful)
      if (
        profilePicInput &&
        profilePicInput.files &&
        profilePicInput.files[0]
      ) {
        const ext = profilePicInput.files[0].name
          .split(".")
          .pop()
          .toLowerCase();
        if (ext !== "png") {
          showFlash("Profile picture must be a PNG file.", "danger");
          e.preventDefault();
          return;
        }
      }
      if (resumeInput && resumeInput.files && resumeInput.files[0]) {
        const ext = resumeInput.files[0].name.split(".").pop().toLowerCase();
        if (ext !== "pdf") {
          showFlash("Resume must be a PDF file.", "danger");
          e.preventDefault();
          return;
        }
      }
      if (
        recommendationInput &&
        recommendationInput.required &&
        recommendationInput.files &&
        recommendationInput.files[0]
      ) {
        const ext = recommendationInput.files[0].name
          .split(".")
          .pop()
          .toLowerCase();
        if (ext !== "pdf") {
          showFlash("Recommendation letter must be a PDF file.", "danger");
          e.preventDefault();
          return;
        }
      }
      showLoader("Registering... please wait");
    });
  }
  setTimeout(() => {
    console.log("Initializing on page load...");
    checkIsFromLipaAuto();

    // Also manually trigger the province change to ensure UI updates
    if (provinceSelect && provinceSelect.value === "Batangas") {
      console.log("Manually triggering province change");
      provinceSelect.dispatchEvent(new Event("change"));
    }
  }, 100);
});

//EMPLOYER REGISTRATION JS
document.addEventListener("DOMContentLoaded", () => {
  const phoneInput = document.getElementById("employerPhoneNumber");
  const form = document.getElementById("employerRegistrationForm");
  const recruitmentType = document.getElementById("employerRecruitment");
  const doleGroup = document.querySelector(".dole-group");
  const dmwGroup = document.querySelector(".dmw-group");

  phoneInput.addEventListener("input", () => {
    // Always keep the +63 prefix
    if (!phoneInput.value.startsWith("+63")) {
      phoneInput.value = "+63";
    }

    // Keep only digits after +63 and limit to 10 digits
    const digits = phoneInput.value.slice(3).replace(/\D/g, "").slice(0, 10);
    phoneInput.value = "+63" + digits;
  });

  phoneInput.addEventListener("blur", () => {
    // If user leaves field empty, restore +63
    if (phoneInput.value.trim() === "" || phoneInput.value === "+63") {
      phoneInput.value = "+63";
    }
  });

  const doleNoPendingInput = document.getElementById(
    "employerDOLENoPendingCase"
  );
  const doleAuthorityInput = document.getElementById(
    "employerDOLEAuthorityToRecruit"
  );
  const dmwNoPendingInput = document.getElementById("employerDMWNoPendingCase");
  const licenseInput = document.getElementById("employerLicenseToRecruit");

  // Toggle DOLE/DMW uploads and set required attributes
  recruitmentType.addEventListener("change", function () {
    console.log("[v0] Recruitment type changed to:", this.value);

    if (this.value === "Local") {
      doleGroup.style.display = "block";
      dmwGroup.style.display = "none";

      if (doleNoPendingInput) doleNoPendingInput.required = true;
      if (doleAuthorityInput) doleAuthorityInput.required = true;
      if (dmwNoPendingInput) dmwNoPendingInput.required = false;
      if (licenseInput) licenseInput.required = false;
    } else if (this.value === "International") {
      doleGroup.style.display = "none";
      dmwGroup.style.display = "block";

      if (doleNoPendingInput) doleNoPendingInput.required = false;
      if (doleAuthorityInput) doleAuthorityInput.required = false;
      if (dmwNoPendingInput) dmwNoPendingInput.required = true;
      if (licenseInput) licenseInput.required = true;
    } else {
      doleGroup.style.display = "none";
      dmwGroup.style.display = "none";

      if (doleNoPendingInput) doleNoPendingInput.required = false;
      if (doleAuthorityInput) doleAuthorityInput.required = false;
      if (dmwNoPendingInput) dmwNoPendingInput.required = false;
      if (licenseInput) licenseInput.required = false;
    }
  });

  if (form) {
    form.addEventListener("submit", (e) => {
      console.log("[v0] Form submission started");

      const recruitmentTypeValue = recruitmentType.value;
      console.log("[v0] Recruitment type:", recruitmentTypeValue);

      // Check all required fields
      const requiredFields = form.querySelectorAll("[required]");
      for (let i = 0; i < requiredFields.length; i++) {
        const field = requiredFields[i];

        if (field.type === "file") {
          if (!field.files || field.files.length === 0) {
            showFlash(
              `Please upload: ${field.previousElementSibling.textContent}`,
              "danger"
            );
            field.focus();
            e.preventDefault();
            console.log("[v0] Missing required file:", field.name);
            return;
          }
        } else if (!field.value || !field.value.trim()) {
          // Get label text if available
          const label = field.previousElementSibling
            ? field.previousElementSibling.textContent
            : field.name;
          showFlash(`Please fill in: ${label}`, "danger");
          field.focus();
          e.preventDefault();
          console.log("[v0] Missing required field:", field.name);
          return;
        }
      }

      // Additional validation for recruitment-specific documents
      if (recruitmentTypeValue === "Local") {
        if (
          !doleNoPendingInput.files ||
          doleNoPendingInput.files.length === 0
        ) {
          showFlash(
            "Please upload DOLE - No Pending Case Certificate for Local recruitment.",
            "danger"
          );
          doleNoPendingInput.focus();
          e.preventDefault();
          return;
        }
        if (
          !doleAuthorityInput.files ||
          doleAuthorityInput.files.length === 0
        ) {
          showFlash(
            "Please upload DOLE - Authority to Recruit for Local recruitment.",
            "danger"
          );
          doleAuthorityInput.focus();
          e.preventDefault();
          return;
        }
      } else if (recruitmentTypeValue === "International") {
        if (!dmwNoPendingInput.files || dmwNoPendingInput.files.length === 0) {
          showFlash(
            "Please upload DMW - No Pending Case Certificate for International recruitment.",
            "danger"
          );
          dmwNoPendingInput.focus();
          e.preventDefault();
          return;
        }
        if (!licenseInput.files || licenseInput.files.length === 0) {
          showFlash(
            "Please upload DMW - License to Recruit for International recruitment.",
            "danger"
          );
          licenseInput.focus();
          e.preventDefault();
          return;
        }
      }

      console.log("[v0] Form validation passed, submitting...");
      showLoader("Registering... please wait");
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const empProvince = document.getElementById("employerProvince");
  const empCity = document.getElementById("employerCity");
  const empBarangay = document.getElementById("employerBarangay");
  const BASE_URL = "https://psgc.gitlab.io/api";

  // Special code for NCR/Metro Manila (Region XIII)
  const METRO_MANILA_CODE = "130000000";

  // Helper to populate dropdowns
  function populateSelect(element, items, defaultText) {
    element.innerHTML = `<option value="">${defaultText}</option>`;
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.dataset.code = item.code;
      option.textContent = item.name;
      element.appendChild(option);
    });
  }

  async function loadEmpProvinces() {
    try {
      const response = await fetch(`${BASE_URL}/provinces/`);
      if (!response.ok) throw new Error("Failed to fetch provinces");
      const data = await response.json();

      // MANUAL FIX: Add Metro Manila (NCR) as a "Province" option
      data.push({
        code: METRO_MANILA_CODE,
        name: "Metro Manila",
      });

      // Sort alphabetically so Metro Manila appears in correct order
      data.sort((a, b) => a.name.localeCompare(b.name));

      populateSelect(empProvince, data, "Select Province");
    } catch (error) {
      console.error("Error loading provinces:", error);
    }
  }

  async function loadEmpCities(code) {
    empCity.innerHTML = '<option value="">Loading...</option>';
    empCity.disabled = true;

    if (empBarangay) {
      empBarangay.innerHTML = '<option value="">Select City First</option>';
      empBarangay.disabled = true;
    }

    try {
      // LOGIC BRANCH: Use Region endpoint for Metro Manila, Province endpoint for others
      let url;
      if (code === METRO_MANILA_CODE) {
        url = `${BASE_URL}/regions/${METRO_MANILA_CODE}/cities-municipalities/`;
      } else {
        url = `${BASE_URL}/provinces/${code}/cities-municipalities/`;
      }

      const response = await fetch(url);
      const data = await response.json();

      data.sort((a, b) => a.name.localeCompare(b.name));
      populateSelect(empCity, data, "Select Municipality/City");
      empCity.disabled = false;
    } catch (error) {
      console.error("Error loading cities:", error);
      empCity.innerHTML = '<option value="">Error loading data</option>';
    }
  }

  async function loadEmpBarangays(cityCode) {
    empBarangay.innerHTML = '<option value="">Loading...</option>';
    empBarangay.disabled = true;

    try {
      const response = await fetch(
        `${BASE_URL}/cities-municipalities/${cityCode}/barangays/`
      );
      const data = await response.json();
      data.sort((a, b) => a.name.localeCompare(b.name));
      populateSelect(empBarangay, data, "Select Barangay");
      empBarangay.disabled = false;
    } catch (error) {
      console.error("Error loading barangays:", error);
      empBarangay.innerHTML = '<option value="">Error loading data</option>';
    }
  }

  // Event Listeners
  if (empProvince) {
    loadEmpProvinces();

    empProvince.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      if (code) {
        loadEmpCities(code);
      } else {
        empCity.innerHTML = '<option value="">Select Province First</option>';
        empCity.disabled = true;
        if (empBarangay) {
          empBarangay.innerHTML = '<option value="">Select City First</option>';
          empBarangay.disabled = true;
        }
      }
    });
  }

  if (empCity) {
    empCity.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;
      if (code) {
        loadEmpBarangays(code);
      } else {
        empBarangay.innerHTML = '<option value="">Select City First</option>';
        empBarangay.disabled = true;
      }
    });
  }
});

// ====== SHOW / HIDE PASSWORD TOGGLE ======
document.querySelectorAll(".toggle-password").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const targetId = toggle.getAttribute("data-target");
    const input = document.getElementById(targetId);

    if (input.type === "password") {
      input.type = "text";
      toggle.textContent = "Hide";
    } else {
      input.type = "password";
      toggle.textContent = "Show";
    }
  });
});

document.querySelectorAll(".faq-question").forEach((button) => {
  button.addEventListener("click", () => {
    const faqItem = button.parentElement;

    // Close other FAQ items
    document.querySelectorAll(".faq-item").forEach((item) => {
      if (item !== faqItem) item.classList.remove("active");
    });

    // Toggle current FAQ item
    faqItem.classList.toggle("active");
  });
});

function showLoader(text = "Processing...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loaderText) loaderText.textContent = text;
  if (loader) loader.style.display = "flex";
}

// Target all login/register forms by ID
const formsToLoad = [
  "applicantLoginForm",
  "employerLogInForm",
  "adminLoginForm",
  "applicantRegistrationForm",
  "employerRegistrationForm",
];

formsToLoad.forEach((id) => {
  const form = document.getElementById(id);
  if (form) {
    form.addEventListener("submit", (e) => {
      // Only show loader if the form is valid (browser validation)
      if (form.checkValidity()) {
        // Check if reCAPTCHA is checked (if present)
        const recaptchaResponse = form.querySelector(
          '[name="g-recaptcha-response"]'
        );
        if (recaptchaResponse && !recaptchaResponse.value) {
          // Don't show loader if captcha missing (let backend or default alert handle it)
          return;
        }
        showLoader("Processing request...");
      }
    });
  }
});
