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




// Global variables
let currentEditingJobId = null;
let currentDeleteJobId = null;
let currentArchiveJobId = null;

// DOM Elements
const filterButtons = document.querySelectorAll('.filter-btn');
const jobCardsGrid = document.getElementById('jobCardsGrid');
const editModal = document.getElementById('editJobModal');
const statusModal = document.getElementById('statusModal');
const deleteModal = document.getElementById('deleteModal');
const archiveModal = document.getElementById('archiveModal');
const successModal = document.getElementById('successModal');
const statusSuccessModal = document.getElementById('statusSuccessModal');
const deleteSuccessModal = document.getElementById('deleteSuccessModal');
const archiveSuccessModal = document.getElementById('archiveSuccessModal');

// Initialize the page
function initializePage() {
    setupFilterButtons();
    setupEditFormListeners();
    setupStatusModalListeners();
    renderJobCards();
}

// Filter functionality
function setupFilterButtons() {
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Filter jobs
            const filter = this.getAttribute('data-filter');
            filterJobs(filter);
        });
    });
}

function filterJobs(filter) {
    const jobCards = document.querySelectorAll('.job-card');
    
    jobCards.forEach(card => {
        const status = card.getAttribute('data-status');
        
        if (filter === 'all' || status === filter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Job card rendering
function renderJobCards() {
    if (!jobCardsGrid) return;
    
    jobCardsGrid.innerHTML = '';
    
    jobsData.forEach(job => {
        const jobCard = createJobCard(job);
        jobCardsGrid.appendChild(jobCard);
    });
}

function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';
    card.setAttribute('data-job-id', job.id);
    card.setAttribute('data-status', job.status);
    
    card.innerHTML = `
        <div class="job-header">
            <h3 class="job-title">${job.title}</h3>
            <span class="status-badge status-${job.status}">${job.status.charAt(0).toUpperCase() + job.status.slice(1)}</span>
        </div>
        <div class="job-info">
            <div class="info-item">
                <span class="info-label">Applicants:</span>
                <span class="info-value">${job.applicants}/<span class="max-applicants">${job.maxApplicants}</span></span>
            </div>
            <div class="info-item">
                <span class="info-label">Posted:</span>
                <span class="info-value">${job.datePosted}</span>
            </div>
        </div>
        <div class="job-actions">
            <button class="btn btn-primary" onclick="editJob(${job.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-secondary archive-btn" onclick="archiveJob(${job.id})" ${job.status === 'archive' ? 'style="display: none;"' : ''}>
                <i class="fas fa-archive"></i> Archive
            </button>
            <button class="btn btn-danger" onclick="deleteJob(${job.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

// Edit modal functions
function editJob(jobId) {
    currentEditingJobId = jobId;
    const job = jobsData.find(j => j.id === jobId);
    
    if (job) {
        // Populate form with job data
        document.getElementById('displayJobPosition').textContent = job.position;
        document.getElementById('displayWorkSchedule').textContent = job.workSchedule === 'full-time' ? 'Full Time' : 
            job.workSchedule === 'part-time' ? 'Part Time' : 
            job.workSchedule.charAt(0).toUpperCase() + job.workSchedule.slice(1);
        document.getElementById('displayNumVacancy').textContent = job.numVacancy;
        document.getElementById('displayMinSalary').textContent = `₱${job.minSalary.toLocaleString()}`;
        document.getElementById('displayMaxSalary').textContent = `₱${job.maxSalary.toLocaleString()}`;
        document.getElementById('displayJobDescription').textContent = job.description;
        document.getElementById('displayQualifications').textContent = job.qualifications;
        
        editModal.style.display = 'block';
    }
}

function closeEditModal() {
    editModal.style.display = 'none';
    currentEditingJobId = null;
}

function setupEditFormListeners() {
    const editStatusBtn = document.getElementById('editStatusBtn');
    
    editStatusBtn.addEventListener('click', function() {
        statusModal.style.display = 'block';
    });
}

// Status modal functions
function setupStatusModalListeners() {
    const statusOptions = document.querySelectorAll('.status-option');
    
    statusOptions.forEach(option => {
        option.addEventListener('click', function() {
            const newStatus = this.getAttribute('data-status');
            showStatusSuccess(newStatus);
            closeStatusModal();
        });
    });
}

function showStatusSuccess(status) {
    const statusTitle = document.getElementById('statusSuccessTitle');
    const statusMessage = document.getElementById('statusSuccessMessage');
    
    switch(status) {
        case 'shortlisted':
            statusTitle.textContent = 'Shortlisted';
            statusMessage.textContent = 'Applicant has been shortlisted successfully.';
            break;
        case 'for-interview':
            statusTitle.textContent = 'For Interview';
            statusMessage.textContent = 'Applicant has been scheduled for interview successfully.';
            break;
        case 'hired':
            statusTitle.textContent = 'Hired';
            statusMessage.textContent = 'Applicant has been hired successfully.';
            break;
        case 'rejected':
            statusTitle.textContent = 'Rejected';
            statusMessage.textContent = 'Applicant has been rejected.';
            break;
    }
    
    statusSuccessModal.style.display = 'block';
}

function closeStatusModal() {
    statusModal.style.display = 'none';
}

// Archive function
function archiveJob(jobId) {
    currentArchiveJobId = jobId;
    archiveModal.style.display = 'block';
    
    // Setup confirm archive button
    const confirmBtn = document.getElementById('confirmArchiveBtn');
    confirmBtn.onclick = function() {
        confirmArchive();
    };
}

function confirmArchive() {
    if (!currentArchiveJobId) return;
    
    const job = jobsData.find(j => j.id === currentArchiveJobId);
    const jobCard = document.querySelector(`[data-job-id="${currentArchiveJobId}"]`);
    
    if (job && jobCard) {
        // Update data
        job.status = 'archive';
        jobCard.setAttribute('data-status', 'archive');
        
        // Update status badge
        const statusBadge = jobCard.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = 'status-badge status-archive';
            statusBadge.textContent = 'Archive';
        }
        
        // Hide archive button
        const archiveBtn = jobCard.querySelector('.archive-btn');
        if (archiveBtn) {
            archiveBtn.style.display = 'none';
        }
        
        // Apply current filter
        const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
        filterJobs(activeFilter);
    }
    
    closeArchiveModal();
    archiveSuccessModal.style.display = 'block';
}

function closeArchiveModal() {
    archiveModal.style.display = 'none';
    currentArchiveJobId = null;
}

// Delete functions
function deleteJob(jobId) {
    currentDeleteJobId = jobId;
    deleteModal.style.display = 'block';
    
    // Setup confirm delete button
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = function() {
        confirmDelete();
    };
}

function confirmDelete() {
    if (!currentDeleteJobId) return;
    
    // Remove from data array
    const jobIndex = jobsData.findIndex(j => j.id === currentDeleteJobId);
    if (jobIndex > -1) {
        jobsData.splice(jobIndex, 1);
    }
    
    // Remove from DOM
    const jobCard = document.querySelector(`[data-job-id="${currentDeleteJobId}"]`);
    if (jobCard) {
        jobCard.remove();
    }
    
    closeDeleteModal();
    deleteSuccessModal.style.display = 'block';
}

function closeDeleteModal() {
    deleteModal.style.display = 'none';
    currentDeleteJobId = null;
}

// Success modal functions
function closeSuccessModal() {
    successModal.style.display = 'none';
}

function closeStatusSuccessModal() {
    statusSuccessModal.style.display = 'none';
}

function closeDeleteSuccessModal() {
    deleteSuccessModal.style.display = 'none';
}

function closeArchiveSuccessModal() {
    archiveSuccessModal.style.display = 'none';
}

// Modal close functionality
window.addEventListener('click', function(e) {
    if (e.target === editModal) {
        closeEditModal();
    }
    if (e.target === statusModal) {
        closeStatusModal();
    }
    if (e.target === deleteModal) {
        closeDeleteModal();
    }
    if (e.target === archiveModal) {
        closeArchiveModal();
    }
    if (e.target === successModal) {
        closeSuccessModal();
    }
    if (e.target === statusSuccessModal) {
        closeStatusSuccessModal();
    }
    if (e.target === deleteSuccessModal) {
        closeDeleteSuccessModal();
    }
    if (e.target === archiveSuccessModal) {
        closeArchiveSuccessModal();
    }
});

// Close modals with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEditModal();
        closeStatusModal();
        closeDeleteModal();
        closeArchiveModal();
        closeSuccessModal();
        closeStatusSuccessModal();
        closeDeleteSuccessModal();
        closeArchiveSuccessModal();
    }
});