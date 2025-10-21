document.addEventListener("DOMContentLoaded", () => {
  // ========== DROPDOWN MENU ==========
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

  // 👇 Default tab depending on applicant status
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
  const fileInputs = document.querySelectorAll(".file-input");
  const applicantStatus = document.getElementById("applicantStatus")?.value;

  const inputs = document.querySelectorAll(".chip");
  const selects = document.querySelectorAll("select");
  const radios = document.querySelectorAll("input[type='radio']");

  // 👇 If Reupload, show file inputs immediately
  if (applicantStatus === "Reupload") {
    fileInputs.forEach((el) => (el.style.display = "block"));
  } else {
    fileInputs.forEach((el) => (el.style.display = "none"));
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => el.removeAttribute("disabled"));
      radios.forEach((el) => el.removeAttribute("disabled"));
      fileInputs.forEach((el) => (el.style.display = "block"));

      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      inputs.forEach((el) => el.setAttribute("readonly", true));
      selects.forEach((el) => el.setAttribute("disabled", true));
      radios.forEach((el) => el.setAttribute("disabled", true));

      // Hide file inputs only if NOT reupload
      if (applicantStatus !== "Reupload") {
        fileInputs.forEach((el) => (el.style.display = "none"));
      }

      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
    });
  }
});

// 3️⃣ CONDITIONAL FIELDS (PWD / WORK)
(function () {
  const el = (sel) => document.querySelector(sel);
  const els = (sel) => Array.from(document.querySelectorAll(sel));

  const pwdYes = el("#pwd_yes");
  const pwdNo = el("#pwd_no");
  const expYes = el("#exp_yes");
  const expNo = el("#exp_no");

  const pwdDetails = el("#pwd_details");
  const workDetails = el("#work_details");

  function updateConditionals() {
    const isPwdCheckedYes = pwdYes && pwdYes.checked;
    if (pwdDetails)
      pwdDetails.style.display = isPwdCheckedYes ? "block" : "none";

    const isExpYes = expYes && expYes.checked;
    if (workDetails) workDetails.style.display = isExpYes ? "block" : "none";
  }

  if (pwdYes) pwdYes.addEventListener("change", updateConditionals);
  if (pwdNo) pwdNo.addEventListener("change", updateConditionals);
  if (expYes) expYes.addEventListener("change", updateConditionals);
  if (expNo) expNo.addEventListener("change", updateConditionals);

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

const jobs = [
  {
    title: "Service Crew",
    company: "McDonald’s Philippines",
    posted: "Posted 1 day ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱18,000",
    vacancies: "30 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Production Operator",
    company: "Nestle Philippines",
    posted: "Posted 1 day ago",
    location: "Laguna",
    salary: "₱16,000 - ₱20,000",
    vacancies: "40 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Cashier",
    company: "Jollibee Food Corporation",
    posted: "Posted 1 day ago",
    location: "Lipa City, Batangas",
    salary: "₱₱14,000 - ₱17,000",
    vacancies: "5 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Sales Associate",
    company: "SM Supermalls",
    posted: "Posted 2 days ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱18,000",
    vacancies: "50 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Call Center Agent",
    company: "Alorica Inc.",
    posted: "Posted 2 days ago",
    location: "SM Lipa City, Batangas",
    salary: "₱18,000 - ₱22,000",
    vacancies: "50 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Customer Service",
    company: "Robinsons",
    posted: "Posted 2 days ago",
    location: "Lipa City, Batangas",
    salary: "₱14,000 - ₱17,000",
    vacancies: "20 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Warehouse Assistant",
    company: "Unilever Philippines",
    posted: "Posted 3 days ago",
    location: "Cavite",
    salary: "₱17,000 - ₱21,000",
    vacancies: "20 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
  {
    title: "Chief",
    company: "Deer Claus Steakhouse and Restaurant",
    posted: "Posted 3 days ago",
    location: "Lipa City, Batangas",
    salary: "₱20,000 - ₱25,000",
    vacancies: "1 Vacancies | Full-Time",
    logo: "",
    status: "Active",
  },
  {
    title: "Data Entry Clerk",
    company: "BPO Solutions Inc.",
    posted: "Posted 3 days ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱19,000",
    vacancies: "3 Vacancies | Full-Time",
    logo: " ",
    status: "Active",
  },
];

const jobGrid = document.querySelector(".job-grid");

jobs.forEach((job) => {
  jobGrid.innerHTML += `
      <div class="job-card">
        <div>
          <div class="job-header">
            <img src="${job.logo}" alt="Logo">
            <span class="badge">${job.status}</span>
          </div>
          <h3>${job.title}</h3>
          <p><strong>${job.company}</strong></p>
          <p>${job.posted}</p>
          <br>
          <div class="job-info">
            <p><span class="icon">📍</span> ${job.location}</p>
            <p><span class="icon">💰</span> ${job.salary}</p>
            <p><span class="icon">👤</span> ${job.vacancies}</p>
          </div>
        </div>
        <div class="job-actions">
          <div class="left-buttons">
            <button class="btn btn-details">Details</button>
            <button class="btn btn-apply">Apply</button>
          </div>
          <button class="btn btn-report" title="Report">
            <i class="fa-solid fa-circle-exclamation"></i>
          </button>
        </div>
      </div>
    `;
});
