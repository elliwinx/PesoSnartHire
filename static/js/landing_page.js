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

  // Handle form submissions in modals
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const modal = form.closest(".modal");

    if (modal && form.id === "adminLoginForm") {
      e.preventDefault();
      console.log("Admin login form submitted");
      // Add your login logic here

      // Close modal after submission
      modal.style.display = "none";
      document.body.style.overflow = "auto";
    }
  });
});

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
  document.getElementById("quick-summary").style.display = "block";
});

document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("agree");
  const proceedBtn = document.querySelector(".proceed-btn");

  // Initially disable the button
  proceedBtn.disabled = true;

  checkbox.addEventListener("change", () => {
    proceedBtn.disabled = !checkbox.checked;
  });
});
document.addEventListener("DOMContentLoaded", () => {
  // Get form elements
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

  // Function to populate barangay dropdown
  function populateBarangayDropdown(barangays) {
    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
    barangays.forEach((barangay) => {
      const option = document.createElement("option");
      option.value = barangay;
      option.textContent = barangay;
      barangaySelect.appendChild(option);
    });
  }

  // Function to convert text to sentence case
  function toSentenceCase(str) {
    return str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // Handle "I am from Lipa City" checkbox
  fromLipaCheckbox.addEventListener("change", function () {
    if (this.checked) {
      // Auto-populate Province and City
      provinceSelect.value = "Batangas";
      citySelect.value = "Lipa City";

      // Ensure city dropdown is visible and text input is hidden
      citySelect.style.display = "block";
      cityTextInput.style.display = "none";
      citySelect.required = true;
      cityTextInput.required = false;

      // Show barangay dropdown, hide text input
      barangaySelect.style.display = "block";
      barangayTextInput.style.display = "none";
      barangaySelect.required = true;
      barangayTextInput.required = false;

      // Populate with Lipa barangays
      populateBarangayDropdown(lipaBarangays);

      // Hide recommendation letter section
      recommendationLetterSection.style.display = "none";
      document.getElementById("applicantRecommendationLetter").required = false;

      // Show Lipenos reminder
      reminderLipenos.style.display = "block";
      reminderNonLipenos.style.display = "none";
    } else {
      // Reset province and city
      provinceSelect.value = "";
      citySelect.value = "";

      // Show text inputs for city and barangay
      citySelect.style.display = "none";
      cityTextInput.style.display = "block";
      barangaySelect.style.display = "none";
      barangayTextInput.style.display = "block";

      cityTextInput.required = true;
      citySelect.required = false;
      barangayTextInput.required = true;
      barangaySelect.required = false;

      // Show recommendation letter section
      recommendationLetterSection.style.display = "block";
      document.getElementById("applicantRecommendationLetter").required = true;

      // Show Non-Lipenos reminder
      reminderLipenos.style.display = "none";
      reminderNonLipenos.style.display = "block";
    }
  });

  // Handle province change for non-Lipa residents
  provinceSelect.addEventListener("change", function () {
    if (!fromLipaCheckbox.checked && this.value !== "Batangas") {
      citySelect.style.display = "none";
      cityTextInput.style.display = "block";
      cityTextInput.required = true;
      citySelect.required = false;
    } else if (!fromLipaCheckbox.checked && this.value === "Batangas") {
      citySelect.style.display = "block";
      cityTextInput.style.display = "none";
      citySelect.required = true;
      cityTextInput.required = false;
    }
  });

  // Handle PWD checkbox
  pwdCheckbox.addEventListener("change", function () {
    if (this.checked) {
      pwdSpecification.style.display = "block";
      document.getElementById("applicantIsPWD").required = true;
    } else {
      pwdSpecification.style.display = "none";
      document.getElementById("applicantIsPWD").required = false;
      document.getElementById("applicantIsPWD").value = "";
    }
  });

  // Handle work experience checkbox
  workExperienceCheckbox.addEventListener("change", function () {
    if (this.checked) {
      workExperienceDetails.style.display = "block";
      document.getElementById("applicantHasWorkExp").required = true;
    } else {
      workExperienceDetails.style.display = "none";
      document.getElementById("applicantHasWorkExp").required = false;
      document.getElementById("applicantHasWorkExp").value = "";
    }
  });

  // Handle city text input formatting
  cityTextInput.addEventListener("blur", function () {
    if (this.value) {
      this.value = toSentenceCase(this.value);
    }
  });

  // Handle barangay text input formatting
  barangayTextInput.addEventListener("blur", function () {
    if (this.value) {
      this.value = toSentenceCase(this.value);
    }
  });

  // Form submission handler
  document
    .getElementById("applicantRegistrationForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      // Basic validation
      const requiredFields = this.querySelectorAll("[required]");
      let isValid = true;

      requiredFields.forEach((field) => {
        if (!field.value.trim()) {
          isValid = false;
          field.style.borderColor = "red";
        } else {
          field.style.borderColor = "";
        }
      });

      if (!isValid) {
        alert("Please fill in all required fields.");
        return;
      }

      // Here you would typically send the form data to your server
      alert("Registration submitted successfully!");
      console.log("Form data:", new FormData(this));
    });

  // Initialize form state
  // Set initial state for non-Lipa residents (recommendation letter should be visible)
  recommendationLetterSection.style.display = "block";
  document.getElementById("applicantRecommendationLetter").required = true;
  reminderNonLipenos.style.display = "block";
  reminderLipenos.style.display = "none";
});
