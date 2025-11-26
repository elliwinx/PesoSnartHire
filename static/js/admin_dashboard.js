(() => {
  const PAGE_CLASS = "admin-home-page";
  const charts = {};
  const numberFormatter = new Intl.NumberFormat("en-PH");
  let statusEl = null;
  let activeModule = "applicants";

  // Shared filter state for Applicants (can be extended for other modules)
  const currentFilters = {
    date_from: null,
    date_to: null,
    quick_range: null,
    applicant_province: [],
    applicant_city: [],
    applicant_barangay: [],
    employer_province: [],
    employer_city: [],
    employer_barangay: [],
    applicant_status: [],
    applicant_is_active: [],
    age_bracket: [],
    sex: [],
    education: [],
    is_pwd: [],
    pwd_type: [],
    has_work_exp: [],
    years_experience: [],
    registration_reason: [],
    // Employers
    employer_status: [],
    employer_is_active: [],
    industry: [],
    recruitment_type: [],
    // Jobs & applications
    job_status: [],
    work_schedule: [],
    application_status: [],
  };

  const CHECKBOX_FILTERS = [
    "sex",
    "education",
    "is_pwd",
    "pwd_type",
    "age_bracket",
    "has_work_exp",
    "years_experience",
    "applicant_status",
    "applicant_is_active",
    "registration_reason",
    "recruitment_type",
    "employer_status",
    "employer_is_active",
    "job_status",
    "work_schedule",
    "application_status",
  ];

  const CHART_COLORS = {
    darkGreen: "#1b5e20",
    burgundy: "#7c2d12",
    gold: "#f59e0b",
    blue: "#0284c7",
    emerald: "#059669",
    red: "#dc2626",
    slate: "#64748b",
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.classList.contains(PAGE_CLASS)) return;
    statusEl = document.getElementById("analyticsTimestamp");
    initModuleTabs();
    initFilterPanel();
    initChartViewSwitchers();
    initExport();
    initLocationFilters();
    syncFilterSections();
    refreshModuleAnalytics();
  });

  function initModuleTabs() {
    const tabs = document.querySelectorAll(".module-tab");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeModule = btn.dataset.module;

        document
          .querySelectorAll(".analytics-module")
          .forEach((m) => (m.style.display = "none"));
        const target = document.getElementById(`module-${activeModule}`);
        if (target) target.style.display = "block";

        syncFilterSections();
        refreshModuleAnalytics();
      });
    });
  }

  function initFilterPanel() {
    const panel = document.getElementById("filterPanel");
    const openBtn = document.getElementById("toggleFilterPanelBtn");
    const closeBtn = document.getElementById("closeFilterPanelBtn");
    const applyBtn = document.getElementById("applyFiltersBtn");
    const clearBtn = document.getElementById("clearAllFiltersBtn");

    if (openBtn && panel) {
      openBtn.addEventListener("click", () => panel.classList.add("open"));
    }
    if (closeBtn && panel) {
      closeBtn.addEventListener("click", () => panel.classList.remove("open"));
    }
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        readFiltersFromUI();
        renderActiveFilterChips();
        refreshModuleAnalytics();
        if (panel) panel.classList.remove("open");
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        Object.keys(currentFilters).forEach((k) => {
          currentFilters[k] = Array.isArray(currentFilters[k]) ? [] : null;
        });
        resetFilterUI();
        renderActiveFilterChips();
        refreshModuleAnalytics();
      });
    }

    // Quick presets
    document.querySelectorAll("#timeQuickPresets .chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        document
          .querySelectorAll("#timeQuickPresets .chip")
          .forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilters.quick_range = chip.dataset.range;
        currentFilters.date_from = null;
        currentFilters.date_to = null;
        const fromEl = document.getElementById("filterDateFrom");
        const toEl = document.getElementById("filterDateTo");
        if (fromEl) fromEl.value = "";
        if (toEl) toEl.value = "";
      })
    );

    syncFilterSections();
  }

  function readFiltersFromUI() {
    const dateFromEl = document.getElementById("filterDateFrom");
    const dateToEl = document.getElementById("filterDateTo");
    currentFilters.date_from = dateFromEl?.value || null;
    currentFilters.date_to = dateToEl?.value || null;

    const multi = (id) => {
      const el = document.getElementById(id);
      if (!el) return [];
      return Array.from(el.selectedOptions)
        .map((o) => o.value)
        .filter(Boolean);
    };

    const single = (id) => {
      const el = document.getElementById(id);
      if (!el || !el.value) return [];
      return [el.value];
    };

    currentFilters.industry = multi("filterIndustry");

    currentFilters.applicant_province = single("filterApplicantProvince");
    currentFilters.applicant_city = single("filterApplicantCity");
    currentFilters.applicant_barangay = single("filterApplicantBarangay");

    currentFilters.employer_province = single("filterEmployerProvince");
    currentFilters.employer_city = single("filterEmployerCity");
    currentFilters.employer_barangay = single("filterEmployerBarangay");

    CHECKBOX_FILTERS.forEach((key) => {
      currentFilters[key] = readCheckboxValues(key);
    });
  }

  function renderActiveFilterChips() {
    const container = document.getElementById("activeFiltersChips");
    if (!container) return;
    container.innerHTML = "";

    const entries = [];
    const valueOverrides = {
      applicant_is_active: { 1: "Active", 0: "Inactive" },
      has_work_exp: { 1: "Yes", 0: "No" },
      is_pwd: { 1: "Yes", 0: "No" },
    };

    const pushChip = (key, label, value) => {
      entries.push({ key, label, value });
    };

    if (
      currentFilters.date_from ||
      currentFilters.date_to ||
      currentFilters.quick_range
    ) {
      const label =
        currentFilters.quick_range ||
        `${currentFilters.date_from || "…"} → ${currentFilters.date_to || "…"}`;
      pushChip("time", "Date", label);
    }

    const chipMapping = [
      ["age_bracket", "Age"],
      ["sex", "Sex"],
      ["education", "Education"],
      ["is_pwd", "PWD"],
      ["applicant_status", "Applicant Status"],
      ["applicant_is_active", "Applicant Active"],
      ["has_work_exp", "Work Experience"],
      ["years_experience", "Experience Range"],
      ["registration_reason", "Reason"],
      ["pwd_type", "PWD Type"],
      ["industry", "Industry"],
      ["recruitment_type", "Recruitment"],
      ["employer_status", "Employer Status"],
      ["employer_is_active", "Employer Active"],
      ["job_status", "Job Status"],
      ["work_schedule", "Work Schedule"],
      ["application_status", "Application Status"],
    ];

    chipMapping.forEach(([key, label]) => {
      (currentFilters[key] || []).forEach((value) =>
        pushChip(key, label, value)
      );
    });

    const locationMapping = [
      ["applicant_province", "Applicant Province"],
      ["applicant_city", "Applicant City"],
      ["applicant_barangay", "Applicant Barangay"],
      ["employer_province", "Employer Province"],
      ["employer_city", "Employer City"],
      ["employer_barangay", "Employer Barangay"],
    ];

    locationMapping.forEach(([key, label]) => {
      (currentFilters[key] || []).forEach((value) =>
        pushChip(key, label, value)
      );
    });

    if (!entries.length) {
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";
    entries.forEach((entry) => {
      const chip = document.createElement("button");
      chip.className = "chip active-filter-chip";
      const valueLabel =
        valueOverrides[entry.key]?.[entry.value] ?? entry.value;
      chip.textContent = `${entry.label}: ${valueLabel} ✕`;
      chip.addEventListener("click", async () => {
        if (entry.key === "time") {
          currentFilters.date_from = null;
          currentFilters.date_to = null;
          currentFilters.quick_range = null;
        } else if (Array.isArray(currentFilters[entry.key])) {
          currentFilters[entry.key] = currentFilters[entry.key].filter(
            (v) => v !== entry.value
          );
        }
        await applyFiltersToInputs();
        renderActiveFilterChips();
        refreshModuleAnalytics();
      });
      container.appendChild(chip);
    });
  }

  function resetFilterUI() {
    const multiSelectIds = ["filterIndustry"];
    multiSelectIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        Array.from(el.options).forEach((opt) => (opt.selected = false));
      }
    });

    const provinceSelects = [
      "filterApplicantProvince",
      "filterEmployerProvince",
    ];
    provinceSelects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const cityBarangaySelects = [
      "filterApplicantCity",
      "filterApplicantBarangay",
      "filterEmployerCity",
      "filterEmployerBarangay",
    ];
    cityBarangaySelects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    resetDependentLocationSelect("Applicant");
    resetDependentLocationSelect("Employer");

    document
      .querySelectorAll(".filter-checkbox-group input[type='checkbox']")
      .forEach((checkbox) => (checkbox.checked = false));

    const fromEl = document.getElementById("filterDateFrom");
    const toEl = document.getElementById("filterDateTo");
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";

    document
      .querySelectorAll("#timeQuickPresets .chip")
      .forEach((c) => c.classList.remove("active"));
  }

  function resetDependentLocationSelect(scope) {
    resetSelectElement(document.getElementById(`filter${scope}City`), true);
    resetSelectElement(document.getElementById(`filter${scope}Barangay`), true);
  }

  function resetSelectElement(select, disable = false) {
    if (!select) return;
    select.innerHTML = '<option value="">All</option>';
    select.disabled = disable;
  }

  function readCheckboxValues(filterKey) {
    return Array.from(
      document.querySelectorAll(
        `.filter-checkbox-group[data-filter="${filterKey}"] input[type="checkbox"]:checked`
      )
    ).map((input) => input.value);
  }

  function syncFilterSections() {
    document
      .querySelectorAll("#filterPanel .filter-panel-section")
      .forEach((section) => {
        const module = section.dataset.module;
        if (!module || module === "all") {
          section.classList.remove("hidden");
        } else {
          section.classList.toggle("hidden", module !== activeModule);
        }
      });
  }

  async function initLocationFilters() {
    await populateSelectWithValues(
      document.getElementById("filterApplicantProvince"),
      await fetchLocationOptions(
        "/admin/api/filters/applicants/locations?level=province"
      )
    );
    await populateSelectWithValues(
      document.getElementById("filterEmployerProvince"),
      await fetchLocationOptions(
        "/admin/api/filters/employers/locations?level=province"
      )
    );

    document
      .getElementById("filterApplicantProvince")
      ?.addEventListener("change", handleApplicantProvinceChange);
    document
      .getElementById("filterApplicantCity")
      ?.addEventListener("change", handleApplicantCityChange);

    document
      .getElementById("filterEmployerProvince")
      ?.addEventListener("change", handleEmployerProvinceChange);
    document
      .getElementById("filterEmployerCity")
      ?.addEventListener("change", handleEmployerCityChange);
  }

  async function handleApplicantProvinceChange(event) {
    const province = event.target.value;
    await populateApplicantCities(province);
  }

  async function handleApplicantCityChange(event) {
    const city = event.target.value;
    await populateApplicantBarangays(city);
  }

  async function handleEmployerProvinceChange(event) {
    const province = event.target.value;
    await populateEmployerCities(province);
  }

  async function handleEmployerCityChange(event) {
    const city = event.target.value;
    await populateEmployerBarangays(city);
  }

  async function populateApplicantCities(province) {
    const citySelect = document.getElementById("filterApplicantCity");
    const barangaySelect = document.getElementById("filterApplicantBarangay");
    resetSelectElement(barangaySelect, true);
    if (!citySelect) return;
    if (!province) {
      resetSelectElement(citySelect, true);
      return;
    }
    const values = await fetchLocationOptions(
      `/admin/api/filters/applicants/locations?level=city&parent=${encodeURIComponent(
        province
      )}`
    );
    populateSelectWithValues(citySelect, values);
  }

  async function populateApplicantBarangays(city) {
    const barangaySelect = document.getElementById("filterApplicantBarangay");
    if (!barangaySelect) return;
    if (!city) {
      resetSelectElement(barangaySelect, true);
      return;
    }
    const values = await fetchLocationOptions(
      `/admin/api/filters/applicants/locations?level=barangay&parent=${encodeURIComponent(
        city
      )}`
    );
    populateSelectWithValues(barangaySelect, values);
  }

  async function populateEmployerCities(province) {
    const citySelect = document.getElementById("filterEmployerCity");
    const barangaySelect = document.getElementById("filterEmployerBarangay");
    resetSelectElement(barangaySelect, true);
    if (!citySelect) return;
    if (!province) {
      resetSelectElement(citySelect, true);
      return;
    }
    const values = await fetchLocationOptions(
      `/admin/api/filters/employers/locations?level=city&parent=${encodeURIComponent(
        province
      )}`
    );
    populateSelectWithValues(citySelect, values);
  }

  async function populateEmployerBarangays(city) {
    const barangaySelect = document.getElementById("filterEmployerBarangay");
    if (!barangaySelect) return;
    if (!city) {
      resetSelectElement(barangaySelect, true);
      return;
    }
    const values = await fetchLocationOptions(
      `/admin/api/filters/employers/locations?level=barangay&parent=${encodeURIComponent(
        city
      )}`
    );
    populateSelectWithValues(barangaySelect, values);
  }

  async function fetchLocationOptions(url) {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const payload = await res.json();
      return payload?.data || [];
    } catch {
      return [];
    }
  }

  function populateSelectWithValues(select, values) {
    if (!select) return;
    resetSelectElement(select, false);
    if (!values.length) {
      select.disabled = true;
      return;
    }
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.disabled = false;
  }

  async function applyFiltersToInputs() {
    resetFilterUI();

    const fromEl = document.getElementById("filterDateFrom");
    const toEl = document.getElementById("filterDateTo");
    if (fromEl && currentFilters.date_from)
      fromEl.value = currentFilters.date_from;
    if (toEl && currentFilters.date_to) toEl.value = currentFilters.date_to;

    if (currentFilters.quick_range) {
      const chip = document.querySelector(
        `#timeQuickPresets .chip[data-range="${currentFilters.quick_range}"]`
      );
      chip?.classList.add("active");
    }

    const industrySelect = document.getElementById("filterIndustry");
    if (industrySelect) {
      Array.from(industrySelect.options).forEach((opt) => {
        opt.selected = currentFilters.industry.includes(opt.value);
      });
    }

    CHECKBOX_FILTERS.forEach((key) => {
      document
        .querySelectorAll(
          `.filter-checkbox-group[data-filter="${key}"] input[type="checkbox"]`
        )
        .forEach((checkbox) => {
          checkbox.checked = currentFilters[key]?.includes(checkbox.value);
        });
    });

    if (currentFilters.applicant_province.length) {
      const province = currentFilters.applicant_province[0];
      const select = document.getElementById("filterApplicantProvince");
      if (select) select.value = province;
      await populateApplicantCities(province);
      if (currentFilters.applicant_city.length) {
        const city = currentFilters.applicant_city[0];
        const citySelect = document.getElementById("filterApplicantCity");
        if (citySelect) citySelect.value = city;
        await populateApplicantBarangays(city);
        if (currentFilters.applicant_barangay.length) {
          const barangaySelect = document.getElementById(
            "filterApplicantBarangay"
          );
          if (barangaySelect)
            barangaySelect.value = currentFilters.applicant_barangay[0];
        }
      }
    }

    if (currentFilters.employer_province.length) {
      const province = currentFilters.employer_province[0];
      const select = document.getElementById("filterEmployerProvince");
      if (select) select.value = province;
      await populateEmployerCities(province);
      if (currentFilters.employer_city.length) {
        const city = currentFilters.employer_city[0];
        const citySelect = document.getElementById("filterEmployerCity");
        if (citySelect) citySelect.value = city;
        await populateEmployerBarangays(city);
        if (currentFilters.employer_barangay.length) {
          const barangaySelect = document.getElementById(
            "filterEmployerBarangay"
          );
          if (barangaySelect)
            barangaySelect.value = currentFilters.employer_barangay[0];
        }
      }
    }
  }

  function buildQuery(params = {}) {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value) && value.length === 0) return;
      if (Array.isArray(value)) {
        urlParams.set(key, value.join(","));
      } else {
        urlParams.set(key, value);
      }
    });
    return urlParams.toString();
  }

  async function refreshModuleAnalytics() {
    setStatusMessage("Loading analytics...");
    try {
      if (activeModule === "applicants") {
        await Promise.allSettled([
          loadApplicantsSummary(),
          loadApplicantsTrend(),
          loadApplicantsDemographics(),
          loadApplicantsLocation(),
          loadApplicantsExperience(),
          loadApplicantsPWD(),
        ]);
      } else if (activeModule === "employers") {
        await Promise.allSettled([
          loadEmployersSummary(),
          loadEmployersBusiness(),
          loadEmployersLocation(),
          loadEmployersStatus(),
        ]);
      } else if (activeModule === "jobs") {
        await Promise.allSettled([
          loadJobsSummary(),
          loadJobsDemand(),
          loadApplicationsSummary(),
          loadApplicationsTrend(),
        ]);
      }
      // TODO: add employers and jobs modules when their APIs are ready
      setStatusMessage(`Last refreshed ${new Date().toLocaleString()}`);
    } catch (e) {
      console.error(e);
      setStatusMessage("Failed to load some analytics", true);
    }
  }

  async function loadApplicantsSummary() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      applicant_is_active: currentFilters.applicant_is_active,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants/summary?${qs}`
    );
    const data = res?.data;
    if (!data) return;
    updateMetric("metricApplicantsTotal", data.total_registered);
    updateMetric("metricApplicantsActive", data.active_applicants);
    updateMetric("metricApplicantsNew", data.new_registrations);
  }

  async function loadApplicantsTrend() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants-per-month?${qs}`
    );
    const list = res?.data || [];
    // Check if we have meaningful data (at least one entry with count > 0)
    const hasData = list.length > 0 && list.some((i) => (i.count || 0) > 0);
    if (!hasData) {
      toggleChartState(
        "applicantsTrendChart",
        false,
        "No applicant registrations in this period."
      );
      return;
    }
    toggleChartState("applicantsTrendChart", true);
    const labels = list.map((i) => i.label || `${i.month}/${i.year}`);
    const values = list.map((i) => i.count || 0);
    renderGenericChart("applicantsTrendChart", labels, values, "Applicants");
  }

  async function loadApplicantsDemographics() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants/demographics?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    // Sex
    const sexData = data.by_sex || [];
    const hasSexData =
      sexData.length > 0 && sexData.some((x) => (x.count || 0) > 0);
    if (!hasSexData) {
      toggleChartState("applicantsBySexChart", false, "No sex data available.");
    } else {
      toggleChartState("applicantsBySexChart", true);
      renderGenericChart(
        "applicantsBySexChart",
        sexData.map((x) => x.label),
        sexData.map((x) => x.count || 0),
        "Applicants"
      );
    }

    // Education
    const educationData = data.by_education || [];
    const hasEducationData =
      educationData.length > 0 && educationData.some((x) => (x.count || 0) > 0);
    if (!hasEducationData) {
      toggleChartState(
        "applicantsByEducationChart",
        false,
        "No education data available."
      );
    } else {
      toggleChartState("applicantsByEducationChart", true);
      renderGenericChart(
        "applicantsByEducationChart",
        educationData.map((x) => x.label),
        educationData.map((x) => x.count || 0),
        "Applicants"
      );
    }

    // Age groups
    const ageData = data.by_age_group || [];
    const hasAgeData =
      ageData.length > 0 && ageData.some((x) => (x.count || 0) > 0);
    if (!hasAgeData) {
      toggleChartState(
        "applicantsByAgeGroupChart",
        false,
        "No age data available."
      );
    } else {
      toggleChartState("applicantsByAgeGroupChart", true);
      renderGenericChart(
        "applicantsByAgeGroupChart",
        ageData.map((x) => x.age_group),
        ageData.map((x) => x.count || 0),
        "Applicants"
      );
    }
  }

  async function loadApplicantsLocation() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      applicant_is_active: currentFilters.applicant_is_active,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants/location?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    // Top 10 Cities
    const cityData = data.by_city || [];
    const hasCityData =
      cityData.length > 0 && cityData.some((x) => (x.count || 0) > 0);
    if (!hasCityData) {
      toggleChartState(
        "applicantsByCityChart",
        false,
        "No city data available."
      );
    } else {
      toggleChartState("applicantsByCityChart", true);
      renderGenericChart(
        "applicantsByCityChart",
        cityData.map((x) => x.city),
        cityData.map((x) => x.count || 0),
        "Applicants"
      );
    }

    // Is From Lipa
    const lipaData = data.by_is_from_lipa || [];
    const hasLipaData =
      lipaData.length > 0 && lipaData.some((x) => (x.count || 0) > 0);
    if (!hasLipaData) {
      toggleChartState(
        "applicantsIsFromLipaChart",
        false,
        "No data available."
      );
    } else {
      toggleChartState("applicantsIsFromLipaChart", true);
      renderGenericChart(
        "applicantsIsFromLipaChart",
        lipaData.map((x) => x.status),
        lipaData.map((x) => x.count || 0),
        "Applicants"
      );
    }
  }

  async function loadApplicantsExperience() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      applicant_is_active: currentFilters.applicant_is_active,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants/experience?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    const experienceData = data.by_experience || [];
    const hasExperienceData =
      experienceData.length > 0 &&
      experienceData.some((x) => (x.count || 0) > 0);
    if (!hasExperienceData) {
      toggleChartState(
        "applicantsByExperienceChart",
        false,
        "No experience data available."
      );
    } else {
      toggleChartState("applicantsByExperienceChart", true);
      renderGenericChart(
        "applicantsYearsExperienceChart",
        experienceData.map((x) => x.range),
        experienceData.map((x) => x.count || 0),
        "Applicants"
      );
    }
  }

  async function loadApplicantsPWD() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      age_bracket: currentFilters.age_bracket,
      applicant_status: currentFilters.applicant_status,
      applicant_is_active: currentFilters.applicant_is_active,
      sex: currentFilters.sex,
      education: currentFilters.education,
      is_pwd: currentFilters.is_pwd,
      pwd_type: currentFilters.pwd_type,
      has_work_exp: currentFilters.has_work_exp,
      years_experience: currentFilters.years_experience,
      registration_reason: currentFilters.registration_reason,
      applicant_province: currentFilters.applicant_province,
      applicant_city: currentFilters.applicant_city,
      applicant_barangay: currentFilters.applicant_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applicants/pwd?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    const pwdData = data.by_pwd_type || [];
    const hasPWDData =
      pwdData.length > 0 && pwdData.some((x) => (x.count || 0) > 0);
    if (!hasPWDData) {
      toggleChartState(
        "applicantsByPWDTypeChart",
        false,
        "No PWD data available."
      );
    } else {
      toggleChartState("applicantsByPWDTypeChart", true);
      renderGenericChart(
        "applicantsByPWDTypeChart",
        pwdData.map((x) => x.pwd_type),
        pwdData.map((x) => x.count || 0),
        "Applicants"
      );
    }
  }

  async function loadEmployersSummary() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      employer_status: currentFilters.employer_status,
      employer_is_active: currentFilters.employer_is_active,
      industry: currentFilters.industry,
      recruitment_type: currentFilters.recruitment_type,
      employer_province: currentFilters.employer_province,
      employer_city: currentFilters.employer_city,
      employer_barangay: currentFilters.employer_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/employers/summary?${qs}`
    );
    const data = res?.data;
    if (!data) return;
    updateMetric("metricEmployersTotal", data.total_employers);
    updateMetric("metricEmployersActive", data.active_employers);
    updateMetric("metricEmployersPendingDocs", data.pending_documents);
  }

  async function loadEmployersBusiness() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      employer_status: currentFilters.employer_status,
      employer_is_active: currentFilters.employer_is_active,
      industry: currentFilters.industry,
      recruitment_type: currentFilters.recruitment_type,
      employer_province: currentFilters.employer_province,
      employer_city: currentFilters.employer_city,
      employer_barangay: currentFilters.employer_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/employers/business?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    const industryData = data.by_industry || [];
    const recData = data.by_recruitment_type || [];

    // Populate industry filter options dynamically once
    const industrySelect = document.getElementById("filterIndustry");
    if (
      industrySelect &&
      industrySelect.options.length <= 1 &&
      industryData.length
    ) {
      industryData.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.industry || "Unspecified";
        opt.textContent = item.industry || "Unspecified";
        industrySelect.appendChild(opt);
      });
    }

    // Render charts if containers exist
    const industryCanvasId = "employersByIndustryChart";
    const recCanvasId = "employersByRecruitmentTypeChart";

    if (document.getElementById(industryCanvasId)) {
      const hasIndustryData =
        industryData.length > 0 && industryData.some((x) => (x.count || 0) > 0);
      if (!hasIndustryData) {
        toggleChartState(
          industryCanvasId,
          false,
          "No employer industry data available."
        );
      } else {
        toggleChartState(industryCanvasId, true);
        renderGenericChart(
          industryCanvasId,
          industryData.map((x) => x.industry || "Unspecified"),
          industryData.map((x) => x.count || 0),
          "Employers"
        );
      }
    }

    if (document.getElementById(recCanvasId)) {
      const hasRecData =
        recData.length > 0 && recData.some((x) => (x.count || 0) > 0);
      if (!hasRecData) {
        toggleChartState(
          recCanvasId,
          false,
          "No recruitment type data available."
        );
      } else {
        toggleChartState(recCanvasId, true);
        renderGenericChart(
          recCanvasId,
          recData.map((x) => x.recruitment_type || "Unspecified"),
          recData.map((x) => x.count || 0),
          "Employers"
        );
      }
    }
  }

  async function loadEmployersLocation() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      employer_status: currentFilters.employer_status,
      employer_is_active: currentFilters.employer_is_active,
      industry: currentFilters.industry,
      recruitment_type: currentFilters.recruitment_type,
      employer_province: currentFilters.employer_province,
      employer_city: currentFilters.employer_city,
      employer_barangay: currentFilters.employer_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/employers/location?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    // Top 10 Cities
    const employerCityData = data.by_city || [];
    const hasEmployerCityData =
      employerCityData.length > 0 &&
      employerCityData.some((x) => (x.count || 0) > 0);
    if (!hasEmployerCityData) {
      toggleChartState(
        "employersByCityChart",
        false,
        "No city data available."
      );
    } else {
      toggleChartState("employersByCityChart", true);
      renderGenericChart(
        "employersByCityChart",
        employerCityData.map((x) => x.city),
        employerCityData.map((x) => x.count || 0),
        "Employers"
      );
    }

    // Top 10 Provinces
    const provinceData = data.by_province || [];
    const hasProvinceData =
      provinceData.length > 0 && provinceData.some((x) => (x.count || 0) > 0);
    if (!hasProvinceData) {
      toggleChartState(
        "employersByProvinceChart",
        false,
        "No province data available."
      );
    } else {
      toggleChartState("employersByProvinceChart", true);
      renderGenericChart(
        "employersByProvinceChart",
        provinceData.map((x) => x.province),
        provinceData.map((x) => x.count || 0),
        "Employers"
      );
    }
  }

  async function loadEmployersStatus() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      employer_status: currentFilters.employer_status,
      employer_is_active: currentFilters.employer_is_active,
      industry: currentFilters.industry,
      recruitment_type: currentFilters.recruitment_type,
      employer_province: currentFilters.employer_province,
      employer_city: currentFilters.employer_city,
      employer_barangay: currentFilters.employer_barangay,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/employers/status?${qs}`
    );
    const data = res?.data;
    if (!data) return;

    const statusData = data.by_status || [];
    const hasStatusData =
      statusData.length > 0 && statusData.some((x) => (x.count || 0) > 0);
    if (!hasStatusData) {
      toggleChartState(
        "employersByStatusChart",
        false,
        "No status data available."
      );
    } else {
      toggleChartState("employersByStatusChart", true);
      renderGenericChart(
        "employersByStatusChart",
        statusData.map((x) => x.status),
        statusData.map((x) => x.count || 0),
        "Employers"
      );
    }
  }

  async function loadJobsSummary() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      job_status: currentFilters.job_status,
      work_schedule: currentFilters.work_schedule,
    });
    const res = await fetchAnalytics(`/admin/api/analytics/jobs/summary?${qs}`);
    const data = res?.data;
    if (!data) return;
    updateMetric("metricJobsOpen", data.total_open_jobs);
  }

  async function loadJobsDemand() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      job_status: currentFilters.job_status,
      work_schedule: currentFilters.work_schedule,
    });
    const res = await fetchAnalytics(`/admin/api/analytics/jobs/demand?${qs}`);
    const data = res?.data;
    if (!data) return;

    const posData = data.by_position || [];
    const schedData = data.by_work_schedule || [];

    if (document.getElementById("jobsByPositionChart")) {
      const hasPosData =
        posData.length > 0 && posData.some((x) => (x.count || 0) > 0);
      if (!hasPosData) {
        toggleChartState(
          "jobsByPositionChart",
          false,
          "No job position data available."
        );
      } else {
        toggleChartState("jobsByPositionChart", true);
        renderGenericChart(
          "jobsByPositionChart",
          posData.map((x) => x.job_position || "Unspecified"),
          posData.map((x) => x.count || 0),
          "Jobs"
        );
      }
    }

    if (document.getElementById("jobsByWorkScheduleChart")) {
      const hasSchedData =
        schedData.length > 0 && schedData.some((x) => (x.count || 0) > 0);
      if (!hasSchedData) {
        toggleChartState(
          "jobsByWorkScheduleChart",
          false,
          "No work schedule data available."
        );
      } else {
        toggleChartState("jobsByWorkScheduleChart", true);
        renderGenericChart(
          "jobsByWorkScheduleChart",
          schedData.map((x) => x.work_schedule || "Unspecified"),
          schedData.map((x) => x.count || 0),
          "Jobs"
        );
      }
    }
  }

  async function loadApplicationsSummary() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      application_status: currentFilters.application_status,
      work_schedule: currentFilters.work_schedule,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applications/summary?${qs}`
    );
    const data = res?.data;
    if (!data) return;
    updateMetric("metricApplicationsTotal", data.total_applications);
    updateMetric("metricApplicationsSuccessRate", data.success_rate_percentage);

    // Status breakdown chart
    const statusCanvasId = "applicationsByStatusChart";
    const statusData = data.by_status || [];
    if (document.getElementById(statusCanvasId)) {
      const hasStatusData =
        statusData.length > 0 && statusData.some((x) => (x.count || 0) > 0);
      if (!hasStatusData) {
        toggleChartState(
          statusCanvasId,
          false,
          "No application status data available."
        );
      } else {
        toggleChartState(statusCanvasId, true);
        renderGenericChart(
          statusCanvasId,
          statusData.map((x) => x.status || "Unspecified"),
          statusData.map((x) => x.count || 0),
          "Applications"
        );
      }
    }
  }

  async function loadApplicationsTrend() {
    const qs = buildQuery({
      date_from: currentFilters.date_from,
      date_to: currentFilters.date_to,
      quick_range: currentFilters.quick_range,
      application_status: currentFilters.application_status,
    });
    const res = await fetchAnalytics(
      `/admin/api/analytics/applications/trend?${qs}`
    );
    const list = res?.data || [];
    const chartId = "applicationsTrendChart";
    // Check if we have meaningful data (at least one entry with count > 0)
    const hasData = list.length > 0 && list.some((x) => (x.count || 0) > 0);
    if (!hasData) {
      toggleChartState(chartId, false, "No application trend data available.");
      return;
    }
    toggleChartState(chartId, true);
    renderGenericChart(
      chartId,
      list.map((x) => x.label),
      list.map((x) => x.count || 0),
      "Applications"
    );
  }

  function initChartViewSwitchers() {
    document.querySelectorAll(".chart-view-switcher").forEach((switcher) => {
      const chartId = switcher.dataset.chartId;
      switcher.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          switcher
            .querySelectorAll(".chip")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          // Re-render the chart with the new type
          refreshModuleAnalytics();
        });
      });
    });
  }

  function renderGenericChart(canvasId, labels, values, datasetLabel) {
    // Decide chart type from the active switcher
    const switcher = document.querySelector(
      `.chart-view-switcher[data-chart-id="${canvasId}"]`
    );
    let type = "bar";
    if (switcher) {
      const activeBtn = switcher.querySelector(".chip.active");
      if (activeBtn) {
        const t = activeBtn.dataset.type;
        if (t === "line") type = "line";
        else if (t === "doughnut") type = "doughnut";
        else type = "bar";
      }
    }

    if (type === "doughnut") {
      renderDoughnutChart(canvasId, { labels, values, colors: null });
    } else if (type === "line") {
      renderLineChart(canvasId, { labels, values, datasetLabel });
    } else {
      renderBarChart(canvasId, { labels, values, datasetLabel });
    }
  }

  function renderLineChart(canvasId, { labels, values, datasetLabel }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    destroyChart(canvasId);

    charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            borderColor: CHART_COLORS.darkGreen,
            backgroundColor: "rgba(27,94,32,0.1)",
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: "#6b7280", font: { size: 12 } },
            grid: { color: "rgba(229,231,235,0.5)" },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#6b7280",
              precision: 0,
              callback: (value) =>
                Number.isInteger(value) ? value : Number(value).toFixed(1),
              font: { size: 12 },
            },
            grid: { color: "rgba(229,231,235,0.5)" },
          },
        },
      },
    });
  }

  function initExport() {
    const btn = document.getElementById("exportModuleBtn");
    const formatSelect = document.getElementById("exportFormatSelect");
    if (!btn || !formatSelect) return;

    btn.addEventListener("click", async () => {
      const format = formatSelect.value || "csv";
      const filters = { ...currentFilters };

      try {
        const res = await fetch("/admin/api/analytics/export", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            module:
              activeModule === "jobs" ? "jobs_applications" : activeModule,
            format,
            filters,
          }),
        });

        if (!res.ok) {
          let message = "Export failed. Please try again.";
          try {
            const err = await res.json();
            if (err && err.message) message = err.message;
          } catch (_) {
            // ignore, fallback to default
          }
          alert(message);
          return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = format.toLowerCase();
        a.download = `${activeModule}_export.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Export error", e);
        alert("Export failed. Please try again.");
      }
    });
  }

  async function fetchAnalytics(endpoint) {
    try {
      const res = await fetch(endpoint, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.success === false || payload.error) {
        throw new Error(payload.message || payload.error || "Request failed");
      }
      return payload;
    } catch (error) {
      console.error(`[admin-dashboard] ${endpoint} failed`, error);
      setStatusMessage(
        "Some analytics failed to load. Please refresh the page.",
        true
      );
      return null;
    }
  }

  function updateMetric(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value === null || value === undefined) {
      el.textContent = "--";
      return;
    }
    el.textContent = numberFormatter.format(value);
  }

  function setStatusMessage(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#dc2626" : "";
  }

  function toggleChartState(canvasId, hasData, emptyMessage) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const container = canvas.parentElement;
    let emptyEl = container.querySelector(".chart-empty-state");

    if (!emptyEl) {
      emptyEl = document.createElement("p");
      emptyEl.className = "chart-empty-state";
      container.appendChild(emptyEl);
    }

    if (hasData) {
      canvas.style.display = "block";
      emptyEl.classList.remove("show");
      emptyEl.style.display = "none";
    } else {
      canvas.style.display = "none";
      emptyEl.textContent = emptyMessage || "No data available.";
      emptyEl.classList.add("show");
      emptyEl.style.display = "flex";
      destroyChart(canvasId);
    }
  }

  function renderBarChart(
    canvasId,
    {
      labels,
      values,
      datasetLabel,
      indexAxis = "x",
      barColor = CHART_COLORS.darkGreen,
    }
  ) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    destroyChart(canvasId);

    const baseScales = {
      x: {
        ticks: {
          color: "#6b7280",
          autoSkip: true,
          maxRotation: 45,
          font: { size: 12 },
        },
        grid: { color: "rgba(229,231,235,0.5)" },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#6b7280",
          precision: 0,
          callback: (value) =>
            Number.isInteger(value) ? value : Number(value).toFixed(1),
          font: { size: 12 },
        },
        grid: { color: "rgba(229,231,235,0.5)" },
      },
    };

    const scales =
      indexAxis === "y" ? { x: baseScales.y, y: baseScales.x } : baseScales;

    charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            backgroundColor: barColor,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(0,0,0,0.8)",
          },
        },
        scales,
      },
    });
  }

  function renderDoughnutChart(canvasId, { labels, values, colors }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    destroyChart(canvasId);
    charts[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors || [
              CHART_COLORS.emerald,
              CHART_COLORS.burgundy,
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              font: { size: 12 },
              color: "#6b7280",
            },
          },
          tooltip: { backgroundColor: "rgba(0,0,0,0.8)" },
        },
      },
    });
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  // Enhanced Widgets functionality
  const WIDGET_DEFINITIONS = [
    {
      name: "clock",
      icon: "fa-clock",
      title: "Time & Weather",
      description: "Real-time clock and weather information",
    },
    {
      name: "calendar",
      icon: "fa-calendar",
      title: "Calendar",
      description: "Monthly calendar view",
    },
    {
      name: "notes",
      icon: "fa-sticky-note",
      title: "Notes",
      description: "Create and manage notes",
    },
    {
      name: "todo",
      icon: "fa-tasks",
      title: "To-Do List",
      description: "Task management with priorities",
    },
    {
      name: "countdown",
      icon: "fa-hourglass-half",
      title: "Countdown",
      description: "Event countdown timers",
    },
    {
      name: "quickLinks",
      icon: "fa-link",
      title: "Quick Links",
      description: "Quick navigation shortcuts",
    },
    {
      name: "quotes",
      icon: "fa-quote-left",
      title: "Daily Quote",
      description: "Inspirational daily quotes",
    },
    {
      name: "notifications",
      icon: "fa-bell",
      title: "System Alerts",
      description: "Recent system notifications",
    },
    {
      name: "productivity",
      icon: "fa-chart-line",
      title: "Productivity Stats",
      description: "Today's productivity metrics",
    },
  ];

  function getDefaultWidgetLayout() {
    return {
      visibility: WIDGET_DEFINITIONS.reduce((acc, widget) => {
        acc[widget.name] = true;
        return acc;
      }, {}),
      order: WIDGET_DEFINITIONS.map((widget) => widget.name),
    };
  }

  function normalizeWidgetLayout(payload) {
    const defaults = getDefaultWidgetLayout();
    if (!payload || typeof payload !== "object") {
      return defaults;
    }

    if ("visibility" in payload && "order" in payload) {
      const visibility = { ...defaults.visibility };
      Object.entries(payload.visibility || {}).forEach(([name, value]) => {
        if (visibility.hasOwnProperty(name)) {
          visibility[name] = Boolean(value);
        }
      });
      const order = Array.isArray(payload.order)
        ? payload.order.filter((name) => visibility.hasOwnProperty(name))
        : [];
      defaults.order.forEach((name) => {
        if (!order.includes(name)) order.push(name);
      });
      return { visibility, order };
    }

    // Legacy payload (flat visibility map)
    const visibility = { ...defaults.visibility };
    Object.entries(payload).forEach(([name, value]) => {
      if (visibility.hasOwnProperty(name)) {
        visibility[name] = Boolean(value);
      }
    });
    return { visibility, order: defaults.order.slice() };
  }

  let widgetLayout = getDefaultWidgetLayout();
  let notes = [];
  let todos = [];
  let countdownEvents = [];
  let layoutDirty = false;

  function updateSaveLayoutButton(isVisible) {
    const btn = document.getElementById("saveWidgetPreferences");
    if (!btn) return;
    btn.style.display = isVisible ? "inline-flex" : "none";
    btn.disabled = !isVisible;
  }

  function markLayoutDirty() {
    layoutDirty = true;
    updateSaveLayoutButton(true);
  }

  function clearLayoutDirtyState() {
    layoutDirty = false;
    updateSaveLayoutButton(false);
  }

  async function initWidgets() {
    const toggleWidgetsBtn = document.getElementById("toggleWidgetsBtn");
    const widgetsPanel = document.getElementById("widgetsPanel");
    const widgetManagerBtn = document.getElementById("widgetManagerBtn");

    if (toggleWidgetsBtn && widgetsPanel) {
      toggleWidgetsBtn.addEventListener("click", () => {
        widgetsPanel.style.display =
          widgetsPanel.style.display === "none" ? "block" : "none";
        if (widgetsPanel.style.display === "block") {
          renderWidgetToggles();
        }
      });
    }

    // Widget Manager button
    if (widgetManagerBtn) {
      widgetManagerBtn.addEventListener("click", () => {
        openWidgetManager();
      });
    }

    // Load widget preferences
    await loadWidgetPreferences();

    // Widget toggle buttons
    document.querySelectorAll(".widget-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const widgetName = btn.getAttribute("data-widget");
        const content = document.querySelector(
          `[data-widget-content="${widgetName}"]`
        );
        if (content) {
          content.classList.toggle("collapsed");
          const icon = btn.querySelector("i");
          if (icon) {
            icon.classList.toggle("fa-chevron-up");
            icon.classList.toggle("fa-chevron-down");
          }
        }
      });
    });

    // Widget hide buttons
    document.querySelectorAll(".widget-hide").forEach((btn) => {
      btn.addEventListener("click", () => {
        const widgetName = btn.getAttribute("data-widget");
        hideWidget(widgetName);
      });
    });

    // Save preferences button
    const savePrefsBtn = document.getElementById("saveWidgetPreferences");
    if (savePrefsBtn) {
      savePrefsBtn.addEventListener("click", saveWidgetPreferences);
    }
    clearLayoutDirtyState();

    // Initialize all widgets
    initClock();
    initWeather();
    initCalendar();
    initNotes();
    initTodos();
    initCountdown();
    initQuickLinks();
    initQuotes();
    initNotifications();
    initProductivity();
    enableWidgetDragAndDrop();
    captureWidgetOrder();
  }

  async function loadWidgetPreferences() {
    try {
      const res = await fetch("/admin/api/widgets/preferences", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        widgetLayout = normalizeWidgetLayout(data.data);
        applyWidgetPreferences();
        renderWidgetToggles();
        clearLayoutDirtyState();
      }
    } catch (error) {
      console.error("Failed to load widget preferences:", error);
      // Use defaults
      widgetLayout = getDefaultWidgetLayout();
      applyWidgetPreferences();
      renderWidgetToggles();
      clearLayoutDirtyState();
    }
  }

  function applyWidgetPreferences() {
    const grid = document.getElementById("widgetsGrid");
    if (!grid) return;

    const { visibility, order } = widgetLayout;
    const cards = Array.from(grid.querySelectorAll(".widget-card"));
    const desiredOrder =
      Array.isArray(order) && order.length
        ? [...order]
        : getDefaultWidgetLayout().order;

    desiredOrder.forEach((widgetName) => {
      const card = grid.querySelector(`[data-widget-name="${widgetName}"]`);
      if (card) {
        grid.appendChild(card);
      }
    });

    cards.forEach((card) => {
      const widgetName = card.dataset.widgetName;
      if (!desiredOrder.includes(widgetName)) {
        grid.appendChild(card);
      }
      card.style.display = visibility[widgetName] === false ? "none" : "block";
    });

    enableWidgetDragAndDrop();
  }

  function hideWidget(widgetName) {
    widgetLayout.visibility[widgetName] = false;
    updateWidgetVisibility(widgetName, false);
    markLayoutDirty();
  }

  function showWidget(widgetName) {
    widgetLayout.visibility[widgetName] = true;
    updateWidgetVisibility(widgetName, true);
    markLayoutDirty();
  }

  function updateWidgetVisibility(widgetName, isVisible) {
    const widgetCard = document.querySelector(
      `[data-widget-name="${widgetName}"]`
    );
    if (widgetCard) {
      widgetCard.style.display = isVisible ? "block" : "none";
    }
  }

  async function openWidgetManager() {
    const modal = document.getElementById("widgetManagerModal");
    if (!modal) return;

    renderWidgetToggles();
    modal.style.display = "flex";
  }

  window.closeWidgetManager = () => {
    const modal = document.getElementById("widgetManagerModal");
    if (modal) {
      modal.style.display = "none";
    }
  };

  function renderWidgetToggles() {
    const toggleList = document.getElementById("widgetToggleList");
    if (!toggleList) return;

    toggleList.innerHTML = WIDGET_DEFINITIONS.map(
      (widget) => `
      <div class="widget-toggle-item ${
        widgetLayout.visibility[widget.name] === false ? "disabled" : ""
      }">
        <div class="widget-toggle-info">
          <div class="widget-toggle-icon">
            <i class="fas ${widget.icon}"></i>
          </div>
          <div class="widget-toggle-details">
            <div class="widget-toggle-name">${widget.title}</div>
            <div class="widget-toggle-description">${widget.description}</div>
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox"
                 data-widget="${widget.name}"
                 ${
                   widgetLayout.visibility[widget.name] === false
                     ? ""
                     : "checked"
                 }>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `
    ).join("");

    toggleList
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
          const widgetName = checkbox.dataset.widget;
          toggleWidgetVisibility(widgetName, checkbox.checked, event);
        });
      });
  }

  function toggleWidgetVisibility(widgetName, isVisible, evt) {
    widgetLayout.visibility[widgetName] = isVisible;
    updateWidgetVisibility(widgetName, isVisible);
    if (evt && evt.target) {
      const toggleItem = evt.target.closest(".widget-toggle-item");
      if (toggleItem) {
        toggleItem.classList.toggle("disabled", !isVisible);
      }
    }
    markLayoutDirty();
  }

  window.toggleWidgetVisibility = toggleWidgetVisibility;

  function enableWidgetDragAndDrop() {
    const grid = document.getElementById("widgetsGrid");
    if (!grid) return;

    let draggedCard = null;

    grid.querySelectorAll(".widget-card").forEach((card) => {
      card.setAttribute("draggable", "true");
      if (card._dragStartHandler) {
        card.removeEventListener("dragstart", card._dragStartHandler);
      }
      if (card._dragEndHandler) {
        card.removeEventListener("dragend", card._dragEndHandler);
      }

      card._dragStartHandler = (event) => {
        draggedCard = card;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
      };
      card._dragEndHandler = () => {
        card.classList.remove("dragging");
        draggedCard = null;
        captureWidgetOrder();
      };

      card.addEventListener("dragstart", card._dragStartHandler);
      card.addEventListener("dragend", card._dragEndHandler);
    });

    if (grid._dragOverHandler) {
      grid.removeEventListener("dragover", grid._dragOverHandler);
    }
    grid._dragOverHandler = (event) => {
      event.preventDefault();
      const afterElement = getDragAfterElement(grid, event.clientY);
      if (!draggedCard) return;
      if (afterElement === null) {
        grid.appendChild(draggedCard);
      } else {
        grid.insertBefore(draggedCard, afterElement);
      }
    };
    grid.addEventListener("dragover", grid._dragOverHandler);
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".widget-card:not(.dragging)"),
    ];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function captureWidgetOrder() {
    const grid = document.getElementById("widgetsGrid");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(".widget-card"));
    const order = cards.map((card) => card.dataset.widgetName);
    if (
      order.length &&
      JSON.stringify(order) !== JSON.stringify(widgetLayout.order)
    ) {
      widgetLayout.order = order;
      markLayoutDirty();
    }
  }

  async function resetDashboard() {
    if (
      !confirm(
        "Are you sure you want to reset the dashboard? This will restore all widgets to their default state."
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/admin/api/widgets/preferences/reset", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        widgetLayout = normalizeWidgetLayout(data.data);
        applyWidgetPreferences();
        renderWidgetToggles();
        alert("Dashboard reset successfully! All widgets are now visible.");
        clearLayoutDirtyState();
      } else {
        alert("Failed to reset dashboard");
      }
    } catch (error) {
      console.error("Failed to reset dashboard:", error);
      alert("Failed to reset dashboard");
    }
  }

  window.resetDashboard = resetDashboard;

  async function saveWidgetPreferences() {
    if (!layoutDirty) return;
    captureWidgetOrder();
    try {
      const res = await fetch("/admin/api/widgets/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ preferences: widgetLayout }),
      });
      const data = await res.json();
      if (data.success) {
        // Silently save - no alert needed for better UX
        console.log("Widget preferences saved");
        clearLayoutDirtyState();
      }
    } catch (error) {
      console.error("Failed to save widget preferences:", error);
    }
  }

  function initClock() {
    const clockTime = document.querySelector(".clock-time");
    const clockDate = document.querySelector(".clock-date");
    if (!clockTime || !clockDate) return;

    function updateClock() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      clockTime.textContent = timeStr;
      clockDate.textContent = dateStr;
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  async function initWeather() {
    const weatherWidget = document.getElementById("weatherWidget");
    if (!weatherWidget) return;

    try {
      const res = await fetch("/admin/api/widgets/weather?city=Lipa City", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success && data.data) {
        const w = data.data;
        weatherWidget.innerHTML = `
          <div class="weather-info">
            <div class="weather-icon">
              <i class="fas fa-${getWeatherIcon(w.description)}"></i>
            </div>
            <div class="weather-details">
              <div class="weather-temp">${w.temperature}°C</div>
              <div class="weather-desc">${w.description}</div>
              <div class="weather-location">
                <i class="fas fa-map-marker-alt"></i> ${w.city}
              </div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error("Failed to load weather:", error);
      weatherWidget.innerHTML =
        '<div class="weather-loading">Weather unavailable</div>';
    }
  }

  function getWeatherIcon(description) {
    const desc = description.toLowerCase();
    if (desc.includes("sun") || desc.includes("clear")) return "sun";
    if (desc.includes("cloud")) return "cloud";
    if (desc.includes("rain")) return "cloud-rain";
    if (desc.includes("storm")) return "bolt";
    if (desc.includes("snow")) return "snowflake";
    return "cloud-sun";
  }

  function initCalendar() {
    const calendarWidget = document.getElementById("calendarWidget");
    if (!calendarWidget) return;

    const now = new Date();
    let currentMonth = now.getMonth();
    let currentYear = now.getFullYear();

    function renderCalendar() {
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      let html = `
        <div class="calendar-header">
          <button class="calendar-nav" onclick="changeMonth(-1)">‹</button>
          <strong>${monthNames[currentMonth]} ${currentYear}</strong>
          <button class="calendar-nav" onclick="changeMonth(1)">›</button>
        </div>
        <div class="calendar-grid">
      `;

      // Day headers
      dayNames.forEach((day) => {
        html += `<div class="calendar-day-header">${day}</div>`;
      });

      // Empty cells for days before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        html += `<div class="calendar-day other-month"></div>`;
      }

      // Days of the month
      const today = new Date();
      for (let day = 1; day <= daysInMonth; day++) {
        const isToday =
          day === today.getDate() &&
          currentMonth === today.getMonth() &&
          currentYear === today.getFullYear();
        html += `<div class="calendar-day ${
          isToday ? "today" : ""
        }">${day}</div>`;
      }

      html += `</div>`;
      calendarWidget.innerHTML = html;
    }

    window.changeMonth = (direction) => {
      currentMonth += direction;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    };

    renderCalendar();
  }

  async function initNotes() {
    await loadNotes();
    const addNoteBtn = document.getElementById("addNoteBtn");
    if (addNoteBtn) {
      addNoteBtn.addEventListener("click", () => openNoteModal());
    }
  }

  async function loadNotes() {
    try {
      const res = await fetch("/admin/api/widgets/notes", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        notes = data.data || [];
        renderNotes();
      }
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  }

  function renderNotes() {
    const notesList = document.getElementById("notesList");
    if (!notesList) return;

    if (notes.length === 0) {
      notesList.innerHTML =
        '<p class="text-muted">No notes yet. Click "New Note" to create one.</p>';
      return;
    }

    notesList.innerHTML = notes
      .map(
        (note) => `
      <div class="note-card ${note.is_pinned ? "pinned" : ""}">
        <div class="note-header">
          <div class="note-title">${note.title || "Untitled"}</div>
          <div class="note-actions">
            <button class="note-action-btn" onclick="pinNote(${
              note.id
            })" title="Pin/Unpin">
              <i class="fas fa-${
                note.is_pinned ? "thumbtack" : "thumbtack"
              }"></i>
            </button>
            <button class="note-action-btn" onclick="editNote(${
              note.id
            })" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="note-action-btn" onclick="deleteNote(${
              note.id
            })" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="note-content">${note.content}</div>
        <div class="note-meta">Updated: ${new Date(
          note.updated_at
        ).toLocaleString()}</div>
      </div>
    `
      )
      .join("");
  }

  function openNoteModal(noteId = null) {
    const note = noteId ? notes.find((n) => n.id === noteId) : null;
    const modal = document.createElement("div");
    modal.className = "note-modal";
    modal.innerHTML = `
      <div class="note-modal-content">
        <div class="note-modal-header">
          <h3>${note ? "Edit Note" : "New Note"}</h3>
          <button onclick="this.closest('.note-modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="note-form-group">
          <label>Title (optional)</label>
          <input type="text" id="noteTitleInput" value="${
            note?.title || ""
          }" placeholder="Note title">
        </div>
        <div class="note-form-group">
          <label>Content</label>
          <textarea id="noteContentInput" placeholder="Write your note here...">${
            note?.content || ""
          }</textarea>
        </div>
        <div class="note-form-group">
          <label>
            <input type="checkbox" id="notePinnedInput" ${
              note?.is_pinned ? "checked" : ""
            }>
            Pin this note
          </label>
        </div>
        <div class="note-form-actions">
          <button class="btn-small" onclick="this.closest('.note-modal').remove()">Cancel</button>
          <button class="btn-small btn-primary" onclick="saveNoteFromModal(${
            noteId || "null"
          })">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = "flex";
  }

  window.editNote = (noteId) => openNoteModal(noteId);

  async function saveNoteFromModal(noteId) {
    const title = document.getElementById("noteTitleInput").value.trim();
    const content = document.getElementById("noteContentInput").value.trim();
    const isPinned = document.getElementById("notePinnedInput").checked;

    if (!content) {
      alert("Note content is required");
      return;
    }

    try {
      const url = noteId
        ? `/admin/api/widgets/notes/${noteId}`
        : "/admin/api/widgets/notes";
      const method = noteId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title, content, is_pinned: isPinned }),
      });

      const data = await res.json();
      if (data.success) {
        document.querySelector(".note-modal").remove();
        await loadNotes();
      } else {
        alert(data.message || "Failed to save note");
      }
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note");
    }
  }

  window.saveNoteFromModal = saveNoteFromModal;

  async function pinNote(noteId) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    try {
      const res = await fetch(`/admin/api/widgets/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          is_pinned: !note.is_pinned,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await loadNotes();
      }
    } catch (error) {
      console.error("Failed to pin note:", error);
    }
  }

  window.pinNote = pinNote;

  async function deleteNote(noteId) {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/admin/api/widgets/notes/${noteId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const data = await res.json();
      if (data.success) {
        await loadNotes();
      } else {
        alert(data.message || "Failed to delete note");
      }
    } catch (error) {
      console.error("Failed to delete note:", error);
      alert("Failed to delete note");
    }
  }

  window.deleteNote = deleteNote;

  function initTodos() {
    loadTodos();
    // Enable drag and drop
    enableTodoDragDrop();
  }

  function addTodo() {
    const todoInput = document.getElementById("todoInput");
    const prioritySelect = document.getElementById("todoPriority");
    if (!todoInput) return;

    const text = todoInput.value.trim();
    if (!text) return;

    const priority = prioritySelect?.value || "medium";
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
      priority,
      sort_order: todos.filter((t) => !t.completed).length,
    };
    todos.push(newTodo);
    saveTodos();
    renderTodos();

    todoInput.value = "";
  }

  window.addTodo = addTodo;

  function getTodos() {
    return todos;
  }

  function saveTodos() {
    localStorage.setItem("admin_todos", JSON.stringify(todos));
  }

  function loadTodos() {
    const saved = localStorage.getItem("admin_todos");
    todos = saved ? JSON.parse(saved) : [];
    renderTodos();
  }

  function renderTodos() {
    const todoList = document.getElementById("todoList");
    const completedList = document.getElementById("completedTodoList");
    const completedSection = document.getElementById("completedTodosSection");
    if (!todoList) return;

    const activeTodos = todos
      .filter((t) => !t.completed)
      .sort((a, b) => a.sort_order - b.sort_order);
    const completedTodos = todos.filter((t) => t.completed);

    todoList.innerHTML = "";
    activeTodos.forEach((todo) => {
      const li = createTodoItem(todo);
      todoList.appendChild(li);
    });

    if (completedList && completedSection) {
      if (completedTodos.length > 0) {
        completedSection.style.display = "block";
        completedList.innerHTML = "";
        completedTodos.forEach((todo) => {
          const li = createTodoItem(todo);
          completedList.appendChild(li);
        });
      } else {
        completedSection.style.display = "none";
      }
    }
  }

  function createTodoItem(todo) {
    const li = document.createElement("li");
    li.className = `todo-item priority-${todo.priority} ${
      todo.completed ? "completed" : ""
    }`;
    li.draggable = !todo.completed;
    li.dataset.todoId = todo.id;
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${
        todo.completed ? "checked" : ""
      } onchange="toggleTodo(${todo.id})">
      <span class="todo-text">${todo.text}</span>
      <button class="todo-delete" onclick="deleteTodo(${
        todo.id
      })">Delete</button>
    `;
    return li;
  }

  function enableTodoDragDrop() {
    const todoList = document.getElementById("todoList");
    if (!todoList) return;

    let draggedElement = null;

    todoList.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("todo-item")) {
        draggedElement = e.target;
        e.target.classList.add("dragging");
      }
    });

    todoList.addEventListener("dragend", (e) => {
      if (e.target.classList.contains("todo-item")) {
        e.target.classList.remove("dragging");
        draggedElement = null;
      }
    });

    todoList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(todoList, e.clientY);
      if (draggedElement && afterElement == null) {
        todoList.appendChild(draggedElement);
      } else if (draggedElement && afterElement) {
        todoList.insertBefore(draggedElement, afterElement);
      }
    });

    todoList.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedElement) {
        const items = Array.from(todoList.children);
        items.forEach((item, index) => {
          const todoId = parseInt(item.dataset.todoId);
          const todo = todos.find((t) => t.id === todoId);
          if (todo) {
            todo.sort_order = index;
          }
        });
        saveTodos();
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".todo-item:not(.dragging)"),
    ];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  window.toggleTodo = (id) => {
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      if (todo.completed) {
        todo.sort_order = todos.filter((t) => !t.completed).length;
      }
      saveTodos();
      renderTodos();
    }
  };

  window.deleteTodo = (id) => {
    todos = todos.filter((t) => t.id !== id);
    saveTodos();
    renderTodos();
  };

  window.toggleCompletedTodos = () => {
    const completedList = document.getElementById("completedTodoList");
    if (completedList) {
      completedList.style.display =
        completedList.style.display === "none" ? "block" : "none";
    }
  };

  function initCountdown() {
    loadCountdownEvents();
    const addBtn = document.getElementById("addCountdownBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => openCountdownModal());
    }
    updateCountdowns();
    setInterval(updateCountdowns, 1000);
  }

  function loadCountdownEvents() {
    // For now, use localStorage. In production, use API
    const saved = localStorage.getItem("admin_countdown_events");
    countdownEvents = saved ? JSON.parse(saved) : [];
    renderCountdowns();
  }

  function saveCountdownEvents() {
    localStorage.setItem(
      "admin_countdown_events",
      JSON.stringify(countdownEvents)
    );
  }

  function renderCountdowns() {
    const countdownList = document.getElementById("countdownList");
    if (!countdownList) return;

    if (countdownEvents.length === 0) {
      countdownList.innerHTML =
        '<p class="text-muted">No events. Click "New Event" to add one.</p>';
      return;
    }

    countdownList.innerHTML = countdownEvents
      .map(
        (event) => `
      <div class="countdown-item">
        <div class="countdown-title">${event.title}</div>
        <div class="countdown-timer" id="countdown-${event.id}">--</div>
        <div class="countdown-date">${new Date(
          event.target_date
        ).toLocaleString()}</div>
        <button class="btn-small" onclick="deleteCountdown(${
          event.id
        })" style="margin-top: 0.5rem; width: 100%;">Delete</button>
      </div>
    `
      )
      .join("");
  }

  function updateCountdowns() {
    countdownEvents.forEach((event) => {
      const timerEl = document.getElementById(`countdown-${event.id}`);
      if (!timerEl) return;

      const target = new Date(event.target_date);
      const now = new Date();
      const diff = target - now;

      if (diff <= 0) {
        timerEl.textContent = "Expired";
        timerEl.classList.add("countdown-expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    });
  }

  function openCountdownModal() {
    const modal = document.createElement("div");
    modal.className = "note-modal";
    modal.innerHTML = `
      <div class="note-modal-content">
        <div class="note-modal-header">
          <h3>New Countdown Event</h3>
          <button onclick="this.closest('.note-modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="note-form-group">
          <label>Event Title</label>
          <input type="text" id="countdownTitleInput" placeholder="e.g., Project Deadline">
        </div>
        <div class="note-form-group">
          <label>Target Date & Time</label>
          <input type="datetime-local" id="countdownDateInput">
        </div>
        <div class="note-form-actions">
          <button class="btn-small" onclick="this.closest('.note-modal').remove()">Cancel</button>
          <button class="btn-small btn-primary" onclick="saveCountdownFromModal()">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = "flex";
  }

  window.saveCountdownFromModal = () => {
    const title = document.getElementById("countdownTitleInput").value.trim();
    const dateInput = document.getElementById("countdownDateInput").value;

    if (!title || !dateInput) {
      alert("Please fill in all fields");
      return;
    }

    const newEvent = {
      id: Date.now(),
      title,
      target_date: new Date(dateInput).toISOString(),
    };

    countdownEvents.push(newEvent);
    saveCountdownEvents();
    renderCountdowns();
    updateCountdowns();
    document.querySelector(".note-modal").remove();
  };

  window.deleteCountdown = (id) => {
    countdownEvents = countdownEvents.filter((e) => e.id !== id);
    saveCountdownEvents();
    renderCountdowns();
  };

  function initQuickLinks() {
    // Quick links are static, no initialization needed
  }

  async function initQuotes() {
    await loadQuote();
  }

  async function loadQuote() {
    const quoteWidget = document.getElementById("quoteWidget");
    if (!quoteWidget) return;

    // Using a free quotes API (quotable.io)
    try {
      const res = await fetch("https://api.quotable.io/random");
      const data = await res.json();
      quoteWidget.innerHTML = `
        <p class="quote-text">"${data.content}"</p>
        <p class="quote-author">— ${data.author}</p>
        <button class="btn-small" onclick="refreshQuote()" style="margin-top: 0.5rem;">
          <i class="fas fa-sync"></i> New Quote
        </button>
      `;
    } catch (error) {
      console.error("Failed to load quote:", error);
      quoteWidget.innerHTML = `
        <p class="quote-text">"The only way to do great work is to love what you do."</p>
        <p class="quote-author">— Steve Jobs</p>
        <button class="btn-small" onclick="refreshQuote()" style="margin-top: 0.5rem;">
          <i class="fas fa-sync"></i> New Quote
        </button>
      `;
    }
  }

  window.refreshQuote = loadQuote;

  async function initNotifications() {
    await loadSystemNotifications();
  }

  async function loadSystemNotifications() {
    const widget = document.getElementById("systemNotificationsWidget");
    if (!widget) return;

    try {
      // Use existing notifications API
      const res = await fetch("/admin/api/notifications?limit=5", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success && data.notifications) {
        if (data.notifications.length === 0) {
          widget.innerHTML = '<p class="text-muted">No new notifications</p>';
          return;
        }
        widget.innerHTML = data.notifications
          .map(
            (notif) => `
          <div class="notification-item ${notif.is_read ? "" : "unread"}">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-message">${notif.message}</div>
          </div>
        `
          )
          .join("");
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
      widget.innerHTML =
        '<p class="text-muted">Failed to load notifications</p>';
    }
  }

  async function initProductivity() {
    await loadProductivityStats();
  }

  async function loadProductivityStats() {
    try {
      const res = await fetch("/admin/api/widgets/productivity", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success && data.data) {
        const stats = data.data;
        const tasksEl = document.getElementById("statTasksCompleted");
        const appsEl = document.getElementById("statAppsReviewed");
        const regsEl = document.getElementById("statNewRegs");

        if (tasksEl) tasksEl.textContent = stats.tasks_completed || 0;
        if (appsEl) appsEl.textContent = stats.applications_reviewed || 0;
        if (regsEl) regsEl.textContent = stats.new_registrations || 0;
      }
    } catch (error) {
      console.error("Failed to load productivity stats:", error);
    }
  }

  // Initialize widgets on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains(PAGE_CLASS)) {
      initWidgets();
    }
  });
})();
