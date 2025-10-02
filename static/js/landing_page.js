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

  // Lipa City barangays (complete list)
  const lipaBarangays = [
    "Adya",
    "Anilao",
    "Anilao-Labac",
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

  function populateBarangayDropdown(barangays) {
    if (!barangaySelect) return;
    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
    barangays.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      barangaySelect.appendChild(opt);
    });
  }

  function toSentenceCase(str) {
    return str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // Toggle recommendation requirement + UI based on Lipa checkbox
  function updateRecommendationRequirementFromLipa() {
    if (!recommendationInput || !recommendationLetterSection) return;

    if (fromLipaCheckbox && fromLipaCheckbox.checked) {
      // Lipeno: hide recommendation and make NOT required
      recommendationLetterSection.style.display = "none";
      recommendationInput.required = false;
      // clear any previously selected file so it isn't submitted accidentally
      try {
        recommendationInput.value = "";
      } catch (err) {
        /* ignore */
      }
      if (reminderLipenos) reminderLipenos.style.display = "block";
      if (reminderNonLipenos) reminderNonLipenos.style.display = "none";
    } else {
      // Non-Lipeno: show recommendation and make REQUIRED
      recommendationLetterSection.style.display = "block";
      recommendationInput.required = true;
      if (reminderLipenos) reminderLipenos.style.display = "none";
      if (reminderNonLipenos) reminderNonLipenos.style.display = "block";
    }
  }

  // Handler when 'from Lipa' toggled
  if (fromLipaCheckbox) {
    fromLipaCheckbox.addEventListener("change", () => {
      if (fromLipaCheckbox.checked) {
        if (provinceSelect) provinceSelect.value = "Batangas";
        if (citySelect) {
          citySelect.value = "Lipa City";
          citySelect.style.display = "block";
          citySelect.required = true;
        }
        if (cityTextInput) {
          cityTextInput.style.display = "none";
          cityTextInput.required = false;
          cityTextInput.value = "";
        }
        if (barangaySelect) {
          barangaySelect.style.display = "block";
          barangaySelect.required = true;
          populateBarangayDropdown(lipaBarangays);
        }
        if (barangayTextInput) {
          barangayTextInput.style.display = "none";
          barangayTextInput.required = false;
        }
      } else {
        // not from Lipa: allow text input for city/barangay
        if (provinceSelect) provinceSelect.value = "";
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
      }

      // update recommendation UI/requirement
      updateRecommendationRequirementFromLipa();
    });
  }

  // Province change behavior (when not Lipeno)
  if (provinceSelect) {
    provinceSelect.addEventListener("change", function () {
      if (fromLipaCheckbox && fromLipaCheckbox.checked) return;

      // Always show text inputs for city/barangay when NOT from Lipa
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

  // PWD toggle
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

  // Work experience toggle
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

  // City/Barangay formatting
  cityTextInput &&
    cityTextInput.addEventListener("blur", function () {
      if (this.value) this.value = toSentenceCase(this.value);
    });
  barangayTextInput &&
    barangayTextInput.addEventListener("blur", function () {
      if (this.value) this.value = toSentenceCase(this.value);
    });

  // Initialize recommendation state on load
  // Ensure recommendation/visibility is consistent with current checkbox/province state
  if (fromLipaCheckbox) {
    // run handler logic once so other UI pieces (city/barangay) are consistent too
    // (this also calls updateRecommendationRequirementFromLipa indirectly)
    fromLipaCheckbox.dispatchEvent(new Event("change"));
  } else {
    updateRecommendationRequirementFromLipa();
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
            alert("Please upload all required files.");
            f.focus();
            e.preventDefault();
            return;
          }
        } else if (!f.value || !f.value.trim()) {
          alert("Please fill in all required fields.");
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
          alert("Profile picture must be a PNG file.");
          e.preventDefault();
          return;
        }
      }
      if (resumeInput && resumeInput.files && resumeInput.files[0]) {
        const ext = resumeInput.files[0].name.split(".").pop().toLowerCase();
        if (ext !== "pdf") {
          alert("Resume must be a PDF file.");
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
          alert("Recommendation letter must be a PDF file.");
          e.preventDefault();
          return;
        }
      }

      // If everything passes, let the browser submit the form normally.
      // Do not call e.preventDefault() here.
    });
  }
});

//EMPLOYER REGISTRATION JS
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("employerRegistrationForm");
  const recruitmentType = document.getElementById("employerRecruitment");
  const doleGroup = document.querySelector(".dole-group");
  const dmwGroup = document.querySelector(".dmw-group");

  // Toggle DOLE/DMW uploads
  recruitmentType.addEventListener("change", function () {
    if (this.value === "Local") {
      doleGroup.style.display = "block";
      dmwGroup.style.display = "none";
    } else if (this.value === "International") {
      doleGroup.style.display = "none";
      dmwGroup.style.display = "block";
    } else {
      doleGroup.style.display = "none";
      dmwGroup.style.display = "none";
    }
  });
});
