// ---------------- JOB DATA ---------------- //
const jobs = [
  {
    title: "Service Crew",
    company: "McDonald’s Philippines",
    posted: "Posted 1 day ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱18,000",
    vacancies: "30 Vacancies | Full-Time",
    logo: "/Assets/mcdo_logo.png",
    status: "Active",
    description: "Join McDonald's as a Service Crew and be part of a dynamic team that delivers exceptional customer service in a fast-paced environment. Responsibilities include taking orders, preparing food, maintaining cleanliness, and ensuring customer satisfaction. Ideal candidates are energetic, friendly, and able to work well under pressure."
  },
  {
    title: "Production Operator",
    company: "Nestle Philippines",
    posted: "Posted 1 day ago",
    location: "Laguna",
    salary: "₱16,000 - ₱20,000",
    vacancies: "40 Vacancies | Full-Time",
    logo: "/Assets/nestle_logo.png",
    status: "Active",
    description: "Nestle Philippines is seeking Production Operators to join our manufacturing team. Responsibilities include operating machinery, monitoring production processes, ensuring quality control, and maintaining a safe work environment. Candidates should have a keen eye for detail, strong problem-solving skills, and the ability to work collaboratively in a team setting."
  },
  {
    title: "Cashier",
    company: "Jollibee Food Corporation",
    posted: "Posted 1 day ago",
    location: "Lipa City, Batangas",
    salary: "₱14,000 - ₱17,000",
    vacancies: "5 Vacancies | Full-Time",
    logo: "/Assets/jollibee_logo.png",
    status: "Active",
    description: "Join Jollibee as a Cashier and be the friendly face that welcomes our customers. Responsibilities include handling cash transactions, providing excellent customer service, maintaining the cleanliness of the cashier area, and assisting with other duties as needed. Ideal candidates are personable, detail-oriented, and able to work efficiently in a fast-paced environment."
  },
  {
    title: "Sales Associate",
    company: "SM Supermalls",
    posted: "Posted 2 days ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱18,000",
    vacancies: "50 Vacancies | Full-Time",
    logo: "/Assets/sm_logo.png",
    status: "Active",
    description: "SM Supermalls is looking for enthusiastic Sales Associates to join our retail team. Responsibilities include assisting customers, maintaining product displays, processing transactions, and ensuring a positive shopping experience. Candidates should have strong communication skills, a customer-focused attitude, and the ability to work in a team environment."
  },
  {
    title: "Call Center Agent",
    company: "Alorica Inc.",
    posted: "Posted 2 days ago",
    location: "SM Lipa City, Batangas",
    salary: "₱18,000 - ₱22,000",
    vacancies: "50 Vacancies | Full-Time",
    logo: "/Assets/alorica_logo.png",
    status: "Active",
    description: "Alorica Inc. is seeking Call Center Agents to provide exceptional customer service and support. Responsibilities include handling inbound and outbound calls, resolving customer inquiries, and maintaining accurate records. Ideal candidates are articulate, patient, and able to work in a fast-paced environment while delivering high-quality service."
  },
  {
    title: "Customer Service",
    company: "Robinsons",
    posted: "Posted 2 days ago",
    location: "Lipa City, Batangas",
    salary: "₱14,000 - ₱17,000",
    vacancies: "20 Vacancies | Full-Time",
    logo: "/Assets/Rob_logo.png",
    status: "Active",
    description: "Robinsons is looking for dedicated Customer Service Representatives to join our team. Responsibilities include assisting customers with inquiries, processing returns and exchanges, and ensuring a positive shopping experience. Candidates should have excellent communication skills, a friendly demeanor, and the ability to handle customer concerns effectively."
  },
  {
    title: "Warehouse Assistant",
    company: "Unilever Philippines",
    posted: "Posted 3 days ago",
    location: "Cavite",
    salary: "₱17,000 - ₱21,000",
    vacancies: "20 Vacancies | Full-Time",
    logo: "/Assets/unilever_logo.png",
    status: "Active",
    description: "Unilever Philippines is seeking Warehouse Assistants to support our logistics operations. Responsibilities include receiving and storing inventory, preparing orders for shipment, maintaining a clean and organized warehouse, and assisting with inventory counts. Ideal candidates are detail-oriented, physically fit, and able to work in a fast-paced environment."
  },
  {
    title: "Chief",
    company: "Deer Claus Steakhouse and Restaurant",
    posted: "Posted 3 days ago",
    location: "Lipa City, Batangas",
    salary: "₱20,000 - ₱25,000",
    vacancies: "1 Vacancies | Full-Time",
    logo: "/Assets/deerclaus_logo.png",
    status: "Active",
    description: "Deer Claus Steakhouse and Restaurant is looking for a skilled Chief to lead our kitchen team. Responsibilities include preparing high-quality dishes, managing kitchen staff, ensuring food safety standards, and maintaining inventory. Candidates should have culinary expertise, leadership skills, and the ability to work efficiently in a fast-paced environment."
  },
  {
    title: "Data Entry Clerk",
    company: "BPO Solutions Inc.",
    posted: "Posted 3 days ago",
    location: "Lipa City, Batangas",
    salary: "₱15,000 - ₱19,000",
    vacancies: "3 Vacancies | Full-Time",
    logo: "/Assets/ResultsCX_logo.png",
    status: "Active",
    description: "BPO Solutions Inc. is seeking Data Entry Clerks to join our administrative team. Responsibilities include entering and updating data in databases, verifying accuracy, and maintaining confidentiality. Ideal candidates are detail-oriented, proficient in typing, and able to work independently while meeting deadlines."
  }
];

// ---------------- RENDER JOBS ---------------- //
const jobGrid = document.querySelector(".job-grid");

jobs.forEach((job, index) => {
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
          <button class="btn btn-details" data-modal="modal-${index}">Details</button>
          <button class="btn btn-apply">Apply</button>
        </div>
        <button class="btn btn-report" title="Report">
          <i class="fa-solid fa-circle-exclamation"></i>
        </button>
      </div>
    </div>

    <!-- Details Modal -->
    <div id="modal-${index}" class="modal">
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>${job.title}</h2>
        <p><strong>Company</strong> <br> ${job.company}</p>
        <p><strong>Location</strong> <br> 📍${job.location}</p>
        <p><strong>Salary</strong> <br> 💰${job.salary}</p> <br>
        <p><strong>Job Description</strong> <br> ${job.description}</p>
      </div>
    </div>
  `;
});


// ---------------- MODALS ---------------- //
const modals = {
  apply: document.getElementById("modal-apply"),
  report: document.getElementById("modal-report"),
  applySent: document.getElementById("modal-apply-sent")
};

const openModal = (modal) => { modal.style.display = "block"; };
const closeModal = (modal) => { modal.style.display = "none"; };

// Details modal
document.querySelectorAll(".btn-details").forEach(button => {
  button.addEventListener("click", () => {
    const modalId = button.getAttribute("data-modal");
    document.getElementById(modalId).style.display = "block";
  });
});

// Apply modal
document.querySelectorAll(".btn-apply").forEach(btn => {
  btn.addEventListener("click", () => openModal(modals.apply));
});

// Report modal
document.querySelectorAll(".btn-report").forEach(btn => {
  btn.addEventListener("click", () => openModal(modals.report));
});

// Close buttons
document.querySelectorAll(".modal .close").forEach(btn => {
  btn.addEventListener("click", (e) => {
    closeModal(e.target.closest(".modal"));
  });
});

// Close when clicking outside
window.addEventListener("click", (e) => {
  document.querySelectorAll(".modal").forEach(modal => {
    if (e.target === modal) closeModal(modal);
  });
});


// ---------------- APPLY FLOW ---------------- //
// Confirm button sa Application Confirmation
document.querySelector(".btn-confirm-apply").addEventListener("click", () => {
  closeModal(modals.apply);
  openModal(modals.applySent);
});

// Cancel button sa Application Confirmation
document.querySelector(".btn-cancel-apply").addEventListener("click", () => {
  closeModal(modals.apply);
});

// Confirm button sa Application Sent
document.querySelector(".btn-confirm-apply-sent").addEventListener("click", () => {
  closeModal(modals.applySent);
});

// ---------------- REPORT FLOW ---------------- //
// Confirm button sa Report Job Post
document.querySelector(".btn-confirm-report").addEventListener("click", () => {
  closeModal(modals.report);
  openModal(document.getElementById("modal-report-sent"));
});

// Cancel button sa Report Job Post
document.querySelector(".btn-cancel-report").addEventListener("click", () => {
  closeModal(modals.report);
});


 // Logout Modal Functionality
    const logoutLink = document.getElementById("logoutLink");
    const logoutModal = document.getElementById("logoutModal");
    const closeLogout = document.getElementById("closeLogout");
    const cancelLogout = document.getElementById("cancelLogout");
    const confirmLogout = document.getElementById("confirmLogout");

    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      logoutModal.style.display = "flex";
    });

    closeLogout.addEventListener("click", () => {
      logoutModal.style.display = "none";
    });

    cancelLogout.addEventListener("click", () => {
      logoutModal.style.display = "none";
    });

    confirmLogout.addEventListener("click", () => {
      window.location.href = "/Landing_Page/index.html"; 
    });

    window.addEventListener("click", (e) => {
      if (e.target === logoutModal) {
        logoutModal.style.display = "none";
      }
    });