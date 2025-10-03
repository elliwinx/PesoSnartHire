// DOM Elements
const form = document.getElementById("jobPostForm")
const clearFormBtn = document.getElementById("clearForm")
const addJobVacancyBtn = document.getElementById("addJobVacancy")
const modal = document.getElementById("successModal")
const closeModal = document.querySelector(".close")
const modalOk = document.getElementById("modalOk")

// Form validation functions
function showError(fieldId, message) {
  const field = document.getElementById(fieldId)
  const errorElement = document.getElementById(fieldId + "Error")

  field.classList.add("error")
  errorElement.textContent = message
  errorElement.classList.add("show")
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId)
  const errorElement = document.getElementById(fieldId + "Error")

  field.classList.remove("error")
  errorElement.classList.remove("show")
}

function clearAllErrors() {
  const errorElements = document.querySelectorAll(".error-message")
  const inputElements = document.querySelectorAll(".error")

  errorElements.forEach((element) => element.classList.remove("show"))
  inputElements.forEach((element) => element.classList.remove("error"))
}

function validateForm() {
  let isValid = true
  clearAllErrors()

  // Get form values
  const jobPosition = document.getElementById("jobPosition").value.trim()
  const workSchedule = document.getElementById("workSchedule").value
  const numVacancy = Number.parseInt(document.getElementById("numVacancy").value)
  const minSalary = Number.parseFloat(document.getElementById("minSalary").value)
  const maxSalary = Number.parseFloat(document.getElementById("maxSalary").value)
  const jobDescription = document.getElementById("jobDescription").value.trim()
  const qualifications = document.getElementById("qualifications").value.trim()

  // Validate Job Position
  if (!jobPosition) {
    showError("jobPosition", "Job position is required")
    isValid = false
  }

  // Validate Work Schedule
  if (!workSchedule) {
    showError("workSchedule", "Work schedule is required")
    isValid = false
  }

  // Validate Number of Vacancy
  if (!numVacancy || numVacancy < 1) {
    showError("numVacancy", "Number of vacancy must be at least 1")
    isValid = false
  }

  // Validate Minimum Salary
  if (isNaN(minSalary) || minSalary < 0) {
    showError("minSalary", "Minimum salary must be a valid number ≥ 0")
    isValid = false
  }

  // Validate Maximum Salary
  if (isNaN(maxSalary) || maxSalary < 0) {
    showError("maxSalary", "Maximum salary must be a valid number ≥ 0")
    isValid = false
  } else if (!isNaN(minSalary) && maxSalary < minSalary) {
    showError("maxSalary", "Maximum salary must be greater than or equal to minimum salary")
    isValid = false
  }

  // Validate Job Description
  if (!jobDescription) {
    showError("jobDescription", "Job description is required")
    isValid = false
  }

  // Validate Qualifications
  if (!qualifications) {
    showError("qualifications", "Qualifications are required")
    isValid = false
  }

  return isValid
}

// Event Listeners
form.addEventListener("submit", (e) => {
  e.preventDefault()

  if (validateForm()) {
    // Show success modal
    modal.style.display = "block"
  }
})

clearFormBtn.addEventListener("click", () => {
  // Reset form
  form.reset()

  // Reset number of vacancy to 1
  document.getElementById("numVacancy").value = 1

  // Clear all errors
  clearAllErrors()
})

addJobVacancyBtn.addEventListener("click", () => {
  // This could navigate to a new page or open a modal
  // For now, we'll just show an alert
  alert("Add Job Vacancy functionality would be implemented here")
})

// Modal event listeners
closeModal.addEventListener("click", () => {
  modal.style.display = "none"
})

modalOk.addEventListener("click", () => {
  modal.style.display = "none"
  // Optionally reset the form after successful submission
  form.reset()
  document.getElementById("numVacancy").value = 1
  clearAllErrors()
})

// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none"
  }
})

// Real-time validation for salary fields
document.getElementById("minSalary").addEventListener("input", function () {
  const minSalary = Number.parseFloat(this.value)
  const maxSalaryField = document.getElementById("maxSalary")
  const maxSalary = Number.parseFloat(maxSalaryField.value)

  if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
    showError("maxSalary", "Maximum salary must be greater than or equal to minimum salary")
  } else {
    clearError("maxSalary")
  }
})

document.getElementById("maxSalary").addEventListener("input", function () {
  const maxSalary = Number.parseFloat(this.value)
  const minSalaryField = document.getElementById("minSalary")
  const minSalary = Number.parseFloat(minSalaryField.value)

  if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
    showError("maxSalary", "Maximum salary must be greater than or equal to minimum salary")
  } else {
    clearError("maxSalary")
  }
})

// Clear individual field errors on input
document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      clearError(this.id)
    }
  })
})


// APPLICATION MANAGEMENT
// Sample job data
let jobs = [
    {
        id: 1,
        title: 'Service Crew',
        status: 'active',
        date: '2025-09-10',
        applicants: 28,
        maxApplicants: 30,
        workSchedule: 'Full-time',
        numVacancy: 30,
        minSalary: 15000,
        maxSalary: 18000,
        description: 'Responsible for providing excellent customer service, taking orders, preparing food, and maintaining cleanliness.',
        qualifications: 'High school graduate, good communication skills, customer service oriented, willing to work on shifts.'
    },
    {
        id: 2,
        title: 'General Manager',
        status: 'inactive',
        date: '2025-04-10',
        applicants: 1,
        maxApplicants: 1,
        workSchedule: 'Full-time',
        numVacancy: 1,
        minSalary: 50000,
        maxSalary: 70000,
        description: 'Oversee all restaurant operations, manage staff, ensure quality standards, and drive business growth.',
        qualifications: 'Bachelor\'s degree in Business Management, 5+ years management experience, strong leadership skills.'
    },
    {
        id: 3,
        title: 'Service Crew',
        status: 'inactive',
        date: '2025-01-10',
        applicants: 20,
        maxApplicants: 20,
        workSchedule: 'Part-time',
        numVacancy: 20,
        minSalary: 12000,
        maxSalary: 15000,
        description: 'Assist in daily restaurant operations, serve customers, and maintain store cleanliness.',
        qualifications: 'High school level, friendly personality, team player, flexible schedule.'
    },
    {
        id: 4,
        title: 'Kitchen Staff',
        status: 'suspended',
        date: '2025-02-15',
        applicants: 5,
        maxApplicants: 10,
        workSchedule: 'Shift Work',
        numVacancy: 10,
        minSalary: 14000,
        maxSalary: 17000,
        description: 'Prepare food items, maintain kitchen cleanliness, and follow food safety standards.',
        qualifications: 'Experience in food preparation, knowledge of food safety, physically fit.'
    },
    {
        id: 5,
        title: 'Cashier',
        status: 'archive',
        date: '2024-12-01',
        applicants: 15,
        maxApplicants: 15,
        workSchedule: 'Full-time',
        numVacancy: 15,
        minSalary: 13000,
        maxSalary: 16000,
        description: 'Handle cash transactions, provide customer service, and maintain accurate records.',
        qualifications: 'High school graduate, basic math skills, honest and trustworthy.'
    }
];

let currentTab = 'all';
let currentEditingJob = null;
let pendingAction = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    renderJobs();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            renderJobs();
        });
    });

    // Close modal
    document.getElementById('closeModal').addEventListener('click', closeEditModal);

    // Edit form submission
    document.getElementById('editForm').addEventListener('submit', handleFormSubmit);

    // Edit status button
    document.getElementById('editStatusBtn').addEventListener('click', openStatusModal);

    // Status options
    document.querySelectorAll('.status-option').forEach(btn => {
        btn.addEventListener('click', function() {
            if (currentEditingJob) {
                currentEditingJob.status = this.dataset.status;
                closeStatusModal();
                showToast(`Status changed to ${this.dataset.status}`);
            }
        });
    });

    // Cancel status
    document.getElementById('cancelStatus').addEventListener('click', closeStatusModal);

    // Confirmation modal
    document.getElementById('cancelConfirm').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmAction').addEventListener('click', executeAction);

    // Close modals on outside click
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
}

// Render Jobs
function renderJobs() {
    const container = document.getElementById('jobsContainer');
    const filteredJobs = currentTab === 'all' 
        ? jobs 
        : jobs.filter(job => job.status === currentTab);

    if (filteredJobs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No jobs found in this category.</p>';
        return;
    }

    container.innerHTML = filteredJobs.map(job => `
        <div class="job-card">
            <div class="job-header">
                <h3 class="job-title">${job.title}</h3>
                <span class="status-badge ${job.status}">${job.status.charAt(0).toUpperCase() + job.status.slice(1)}</span>
            </div>
            <p class="job-date">Posted ${job.date}</p>
            <div class="job-applicants">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>${job.applicants}/${job.maxApplicants}</span>
            </div>
            <div class="job-actions">
                <button class="btn btn-edit" onclick="openEditModal(${job.id})">Edit</button>
                <button class="btn btn-archive" onclick="confirmArchive(${job.id})">Archive</button>
                <button class="btn btn-delete" onclick="confirmDelete(${job.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Open Edit Modal
function openEditModal(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    currentEditingJob = job;

    // Populate form
    document.getElementById('jobPosition').value = job.title;
    document.getElementById('workSchedule').value = job.workSchedule;
    document.getElementById('numVacancy').value = job.numVacancy;
    document.getElementById('minSalary').value = job.minSalary;
    document.getElementById('maxSalary').value = job.maxSalary;
    document.getElementById('jobDescription').value = job.description;
    document.getElementById('qualifications').value = job.qualifications;

    // Clear errors
    clearErrors();

    // Show modal
    document.getElementById('editModal').classList.add('show');
}

// Close Edit Modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentEditingJob = null;
    clearErrors();
}

// Open Status Modal
function openStatusModal() {
    document.getElementById('statusModal').classList.add('show');
}

// Close Status Modal
function closeStatusModal() {
    document.getElementById('statusModal').classList.remove('show');
}

// Handle Form Submit
function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    if (!currentEditingJob) return;

    // Update job data
    currentEditingJob.title = document.getElementById('jobPosition').value;
    currentEditingJob.workSchedule = document.getElementById('workSchedule').value;
    currentEditingJob.numVacancy = parseInt(document.getElementById('numVacancy').value);
    currentEditingJob.minSalary = parseFloat(document.getElementById('minSalary').value);
    currentEditingJob.maxSalary = parseFloat(document.getElementById('maxSalary').value);
    currentEditingJob.description = document.getElementById('jobDescription').value;
    currentEditingJob.qualifications = document.getElementById('qualifications').value;

    closeEditModal();
    renderJobs();
    showToast('Job details updated successfully!');
}

// Validate Form
function validateForm() {
    let isValid = true;
    clearErrors();

    // Job Position
    const jobPosition = document.getElementById('jobPosition');
    if (!jobPosition.value.trim()) {
        showError('jobPosition', 'Job position is required');
        isValid = false;
    }

    // Work Schedule
    const workSchedule = document.getElementById('workSchedule');
    if (!workSchedule.value) {
        showError('workSchedule', 'Work schedule is required');
        isValid = false;
    }

    // Number of Vacancy
    const numVacancy = document.getElementById('numVacancy');
    if (!numVacancy.value || numVacancy.value < 1) {
        showError('numVacancy', 'Number of vacancy must be at least 1');
        isValid = false;
    }

    // Minimum Salary
    const minSalary = document.getElementById('minSalary');
    if (!minSalary.value || minSalary.value < 0) {
        showError('minSalary', 'Minimum salary is required');
        isValid = false;
    }

    // Maximum Salary
    const maxSalary = document.getElementById('maxSalary');
    if (!maxSalary.value || maxSalary.value < 0) {
        showError('maxSalary', 'Maximum salary is required');
        isValid = false;
    } else if (parseFloat(maxSalary.value) < parseFloat(minSalary.value)) {
        showError('maxSalary', 'Maximum salary must be greater than minimum salary');
        isValid = false;
    }

    // Job Description
    const jobDescription = document.getElementById('jobDescription');
    if (!jobDescription.value.trim()) {
        showError('jobDescription', 'Job description is required');
        isValid = false;
    }

    // Qualifications
    const qualifications = document.getElementById('qualifications');
    if (!qualifications.value.trim()) {
        showError('qualifications', 'Qualifications are required');
        isValid = false;
    }

    return isValid;
}

// Show Error
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');
    
    field.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

// Clear Errors
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.classList.remove('error');
    });
}

// Confirm Archive
function confirmArchive(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    pendingAction = {
        type: 'archive',
        jobId: jobId
    };

    document.getElementById('confirmTitle').textContent = 'Archive Job?';
    document.getElementById('confirmMessage').textContent = `Are you sure you want to archive "${job.title}"?`;
    document.getElementById('confirmModal').classList.add('show');
}

// Confirm Delete
function confirmDelete(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    pendingAction = {
        type: 'delete',
        jobId: jobId
    };

    document.getElementById('confirmTitle').textContent = 'Delete Job?';
    document.getElementById('confirmMessage').textContent = `Are you sure you want to delete "${job.title}"? This action cannot be undone.`;
    document.getElementById('confirmModal').classList.add('show');
}

// Execute Action
function executeAction() {
    if (!pendingAction) return;

    const job = jobs.find(j => j.id === pendingAction.jobId);
    if (!job) return;

    if (pendingAction.type === 'archive') {
        job.status = 'archive';
        showToast(`"${job.title}" has been archived`);
    } else if (pendingAction.type === 'delete') {
        jobs = jobs.filter(j => j.id !== pendingAction.jobId);
        showToast(`"${job.title}" has been deleted`);
    }

    closeConfirmModal();
    renderJobs();
    pendingAction = null;
}

// Close Confirm Modal
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
}

// Close All Modals
function closeAllModals() {
    closeEditModal();
    closeStatusModal();
    closeConfirmModal();
}

// Show Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// REAL-TIME NOTIFICATION

// Notification Data Store
const notifications = [
  {
    id: 1,
    type: "application",
    icon: "✓",
    iconType: "success",
    title: "New Application Received",
    message: "Juan Poncio Dela Cruz applied for Service Crew Position. Review application to proceed.",
    time: "2 hours ago",
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    isNew: true,
    unread: true,
    details: {
      jobPosition: "Service Crew Position",
      workSchedule: "Full-time",
      vacancies: 1,
      minSalary: "15000",
      maxSalary: "18000",
      description: "We are looking for enthusiastic Service Crew members to join our team.",
      qualifications: "High school graduate, good communication skills, customer service oriented",
      applicantCount: 28,
      applicants: [
        { name: "Juan Poncio Dela Cruz", date: "March 15, 2024", status: "For Interview" },
        { name: "Juan Poncio Dela Cruz", date: "March 15, 2024", status: "For Interview" },
        { name: "Juan Poncio Dela Cruz", date: "March 15, 2024", status: "For Interview" },
        { name: "Juan Poncio Dela Cruz", date: "March 15, 2024", status: "For Interview" },
        { name: "Juan Poncio Dela Cruz", date: "March 15, 2024", status: "For Interview" },
      ],
    },
  },
  {
    id: 2,
    type: "application",
    icon: "✓",
    iconType: "success",
    title: "New Application Received",
    message: "Andrea Amazona Levita applied for Service Crew Position. Review application to proceed.",
    time: "1 day ago",
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    isNew: true,
    unread: false,
    details: {
      jobPosition: "Service Crew Position",
      workSchedule: "Part-time",
      vacancies: 2,
      minSalary: "12000",
      maxSalary: "15000",
      description: "Join our dynamic team as a part-time Service Crew member.",
      qualifications: "High school graduate, flexible schedule, team player",
      applicantCount: 15,
      applicants: [{ name: "Andrea Amazona Levita", date: "March 14, 2024", status: "For Interview" }],
    },
  },
  {
    id: 3,
    type: "verification",
    icon: "!",
    iconType: "warning",
    title: "Account Verification Required",
    message: "Your company profile needs verification. Please upload required business documents.",
    time: "3 days ago",
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    isNew: false,
    unread: false,
    details: null,
  },
  {
    id: 4,
    type: "performance",
    icon: "i",
    iconType: "info",
    title: "Job Post Performance",
    message: "Your Service Crew posting has received 24 application in the past week.",
    time: "1 week ago",
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    isNew: false,
    unread: false,
    details: null,
  },
]

// DOM Elements
const notificationsList = document.getElementById("notificationsList")
const modalOverlay = document.getElementById("modalOverlay")
const modal = document.getElementById("modal")
const modalClose = document.getElementById("modalClose")
const modalContent = document.getElementById("modalContent")
const toast = document.getElementById("toast")
const toastMessage = document.getElementById("toastMessage")

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  renderNotifications()
  startRealTimeSimulation()
  setupEventListeners()
})

// Render Notifications
function renderNotifications() {
  notificationsList.innerHTML = ""

  // Sort by timestamp (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp)

  sortedNotifications.forEach((notification) => {
    const card = createNotificationCard(notification)
    notificationsList.appendChild(card)
  })
}

// Create Notification Card
function createNotificationCard(notification) {
  const card = document.createElement("div")
  card.className = `notification-card ${notification.unread ? "unread" : ""}`
  card.dataset.id = notification.id

  card.innerHTML = `
        <div class="notification-icon ${notification.iconType}">
            ${notification.icon}
        </div>
        <div class="notification-body">
            <div class="notification-title-row">
                <h3 class="notification-title">${notification.title}</h3>
                ${notification.isNew ? '<span class="badge">NEW</span>' : ""}
            </div>
            <p class="notification-message">${notification.message}</p>
        </div>
        <div class="notification-time">${notification.time}</div>
    `

  card.addEventListener("click", () => openNotificationModal(notification))

  return card
}

// Open Notification Modal
function openNotificationModal(notification) {
  // Mark as read
  notification.unread = false
  renderNotifications()

  if (notification.details) {
    // Show job details modal
    modalContent.innerHTML = createJobDetailsModal(notification.details)
    setupModalEventListeners()
  } else {
    // Show simple notification modal
    modalContent.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <div class="notification-icon ${notification.iconType}" style="width: 80px; height: 80px; margin: 0 auto 1rem; font-size: 2.5rem;">
                    ${notification.icon}
                </div>
                <h2 style="color: #7c2d12; margin-bottom: 1rem;">${notification.title}</h2>
                <p style="color: #6b7280; font-size: 1.125rem;">${notification.message}</p>
                <p style="color: #9ca3af; margin-top: 1rem;">${notification.time}</p>
            </div>
        `
  }

  modalOverlay.classList.add("active")
  document.body.style.overflow = "hidden"
}

// Create Job Details Modal
function createJobDetailsModal(details) {
  return `
        <div class="job-details-section">
            <h2 class="job-details-title">Job Vacancy Details</h2>
            <form class="job-form" id="jobForm">
                <div class="job-form-grid">
                    <div class="job-form-group">
                        <label class="job-form-label">Job Position</label>
                        <input type="text" class="job-form-input" value="${details.jobPosition}" readonly>
                    </div>
                    <div class="job-form-group">
                        <label class="job-form-label">Work Schedule</label>
                        <select class="job-form-select" disabled>
                            <option>${details.workSchedule}</option>
                        </select>
                    </div>
                    <div class="job-form-group">
                        <label class="job-form-label">Number of Vacancy</label>
                        <input type="number" class="job-form-input" value="${details.vacancies}" readonly>
                    </div>
                    <div class="job-form-group">
                        <label class="job-form-label">Minimum Salary (₱)</label>
                        <input type="text" class="job-form-input" value="${details.minSalary}" readonly>
                    </div>
                    <div class="job-form-group">
                        <label class="job-form-label">Maximum Salary (₱)</label>
                        <input type="text" class="job-form-input" value="${details.maxSalary}" readonly>
                    </div>
                    <div class="job-form-group full-width">
                        <label class="job-form-label">Job Description</label>
                        <textarea class="job-form-textarea" readonly>${details.description}</textarea>
                    </div>
                    <div class="job-form-group full-width">
                        <label class="job-form-label">Qualifications</label>
                        <textarea class="job-form-textarea" readonly>${details.qualifications}</textarea>
                    </div>
                </div>
                <button type="button" class="edit-button" id="editJobButton">Edit Job Post</button>
            </form>
        </div>
        
        <div class="applicants-section">
            <h2 class="applicants-title">List of Applicants</h2>
            <div class="applicants-controls">
                <input type="text" class="search-input" placeholder="Search an Applicant" id="searchApplicant">
                <select class="filter-select" id="filterStatus">
                    <option value="">Filter by Status</option>
                    <option value="For Interview">For Interview</option>
                    <option value="Hired">Hired</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>
            <div class="applicant-count">Applicant Count: ${details.applicantCount}</div>
            <div class="applicants-list" id="applicantsList">
                ${details.applicants
                  .map(
                    (applicant, index) => `
                    <div class="applicant-card" data-index="${index}">
                        <div class="applicant-info">
                            <h4>${applicant.name}</h4>
                            <p class="applicant-date">Applied on ${applicant.date}</p>
                            <p class="applicant-status">${applicant.status}</p>
                        </div>
                        <div class="applicant-actions">
                            <button class="view-button" onclick="viewApplicant(${index})">View</button>
                            <button class="edit-status-button" onclick="editApplicantStatus(${index})">Edit Status</button>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
    `
}

// Setup Modal Event Listeners
function setupModalEventListeners() {
  const editJobButton = document.getElementById("editJobButton")
  const searchInput = document.getElementById("searchApplicant")
  const filterSelect = document.getElementById("filterStatus")

  if (editJobButton) {
    editJobButton.addEventListener("click", () => {
      showToast("Edit functionality will be implemented")
    })
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterApplicants(e.target.value, filterSelect.value)
    })
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", (e) => {
      filterApplicants(searchInput.value, e.target.value)
    })
  }
}

// Filter Applicants
function filterApplicants(searchTerm, statusFilter) {
  const applicantCards = document.querySelectorAll(".applicant-card")

  applicantCards.forEach((card) => {
    const name = card.querySelector("h4").textContent.toLowerCase()
    const status = card.querySelector(".applicant-status").textContent

    const matchesSearch = name.includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || status === statusFilter

    if (matchesSearch && matchesStatus) {
      card.style.display = "flex"
    } else {
      card.style.display = "none"
    }
  })
}

// View Applicant
function viewApplicant(index) {
  showToast(`Viewing applicant details for applicant #${index + 1}`)
}

// Edit Applicant Status
function editApplicantStatus(index) {
  const statuses = ["For Interview", "Hired", "Rejected"]
  const currentStatus = document.querySelectorAll(".applicant-status")[index].textContent
  const currentIndex = statuses.indexOf(currentStatus)
  const nextStatus = statuses[(currentIndex + 1) % statuses.length]

  // Validation: Confirm status change
  if (confirm(`Change status to "${nextStatus}"?`)) {
    document.querySelectorAll(".applicant-status")[index].textContent = nextStatus
    showToast(`Status updated to "${nextStatus}"`)
  }
}

// Close Modal
function closeModal() {
  modalOverlay.classList.remove("active")
  document.body.style.overflow = "auto"
}

// Setup Event Listeners
function setupEventListeners() {
  modalClose.addEventListener("click", closeModal)

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal()
    }
  })

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
      closeModal()
    }
  })
}

// Show Toast Notification
function showToast(message) {
  toastMessage.textContent = message
  toast.classList.add("active")

  setTimeout(() => {
    toast.classList.remove("active")
  }, 3000)
}

// Real-Time Simulation
function startRealTimeSimulation() {
  setInterval(() => {
    addNewNotification()
  }, 15000) // Add new notification every 15 seconds
}

// Add New Notification
function addNewNotification() {
  const newApplicants = ["Maria Santos", "Jose Reyes", "Ana Garcia", "Pedro Martinez", "Sofia Rodriguez"]

  const randomName = newApplicants[Math.floor(Math.random() * newApplicants.length)]

  const newNotification = {
    id: Date.now(),
    type: "application",
    icon: "✓",
    iconType: "success",
    title: "New Application Received",
    message: `${randomName} applied for Service Crew Position. Review application to proceed.`,
    time: "Just now",
    timestamp: Date.now(),
    isNew: true,
    unread: true,
    details: {
      jobPosition: "Service Crew Position",
      workSchedule: "Full-time",
      vacancies: 1,
      minSalary: "15000",
      maxSalary: "18000",
      description: "We are looking for enthusiastic Service Crew members to join our team.",
      qualifications: "High school graduate, good communication skills, customer service oriented",
      applicantCount: 1,
      applicants: [
        {
          name: randomName,
          date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          status: "For Interview",
        },
      ],
    },
  }

  notifications.unshift(newNotification)
  renderNotifications()
  showToast(`New application from ${randomName}!`)
}

// Update Time Display (optional enhancement)
function updateTimeDisplay() {
  notifications.forEach((notification) => {
    const elapsed = Date.now() - notification.timestamp
    const minutes = Math.floor(elapsed / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) {
      notification.time = "Just now"
    } else if (minutes < 60) {
      notification.time = `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    } else if (hours < 24) {
      notification.time = `${hours} hour${hours > 1 ? "s" : ""} ago`
    } else if (days < 7) {
      notification.time = `${days} day${days > 1 ? "s" : ""} ago`
    } else {
      notification.time = `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`
    }
  })
}

// Update time display every minute
setInterval(() => {
  updateTimeDisplay()
  renderNotifications()
}, 60000)
