  const jobs = [
    {
      title: "Service Crew",
      company: "McDonald’s Philippines",
      posted: "Posted 1 day ago",
      location: "Lipa City, Batangas",
      salary: "₱15,000 - ₱18,000",
      vacancies: "30 Vacancies | Full-Time",
      logo: "/static/Assets/McDo.png",
      status: "Active"
    },
    {
      title: "Production Operator",
      company: "Nestle Philippines",
      posted: "Posted 1 day ago",
      location: "Laguna",
      salary: "₱16,000 - ₱20,000",
      vacancies: "40 Vacancies | Full-Time",
      logo: "/static/Assets/Nestle.png",
      status: "Active"
    },
    {
      title: "Cashier",
      company: "Jollibee Food Corporation",
      posted: "Posted 1 day ago",
      location: "Lipa City, Batangas",
      salary: "₱₱14,000 - ₱17,000",
      vacancies: "5 Vacancies | Full-Time",
      logo: "/static/Assets/Jollibee.png",
      status: "Active"
    },
    {
      title: "Sales Associate",
      company: "SM Supermalls",
      posted: "Posted 2 days ago",
      location: "Lipa City, Batangas",
      salary: "₱15,000 - ₱18,000",
      vacancies: "50 Vacancies | Full-Time",
      logo: "/static/Assets/SM.png",
      status: "Active"
    },
    {
      title: "Call Center Agent",
      company: "Alorica Inc.",
      posted: "Posted 2 days ago",
      location: "SM Lipa City, Batangas",
      salary: "₱18,000 - ₱22,000",
      vacancies: "50 Vacancies | Full-Time",
      logo: "/static/Assets/Alorica.png",
      status: "Active"
    },
    {
      title: "Customer Service",
      company: "Robinsons",
      posted: "Posted 2 days ago",
      location: "Lipa City, Batangas",
      salary: "₱14,000 - ₱17,000",
      vacancies: "20 Vacancies | Full-Time",
      logo: "/static/Assets/Robinsons.png",
      status: "Active"
    },
    {
      title: "Warehouse Assistant",
      company: "Unilever Philippines",
      posted: "Posted 3 days ago",
      location: "Cavite",
      salary: "₱17,000 - ₱21,000",
      vacancies: "20 Vacancies | Full-Time",
      logo: "/static/Assets/Uniliver.png",
      status: "Active"
    },
    {
      title: "Chief",
      company: "Deer Claus Steakhouse and Restaurant",
      posted: "Posted 3 days ago",
      location: "Lipa City, Batangas",
      salary: "₱20,000 - ₱25,000",
      vacancies: "1 Vacancies | Full-Time",
      logo: "/static/Assets/Deer Claus.png",
      status: "Active"
    },
    {
      title: "Data Entry Clerk",
      company: "BPO Solutions Inc.",
      posted: "Posted 3 days ago",
      location: "Lipa City, Batangas",
      salary: "₱15,000 - ₱19,000",
      vacancies: "3 Vacancies | Full-Time",
      logo: "/static/Assets/Result.png",
      status: "Active"
    }
  ];

  const jobGrid = document.querySelector(".job-grid");

  jobs.forEach(job => {
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