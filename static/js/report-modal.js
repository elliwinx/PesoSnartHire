document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("globalReportModal");
  if (!modal) return;

  const form = modal.querySelector("[data-report-form]");
  const closeBtn = modal.querySelector("[data-report-close]");
  const titleEl = modal.querySelector("[data-report-title]");
  const helperEl = modal.querySelector("[data-report-helper]");
  const contextWrapper = modal.querySelector("[data-report-context]");
  const contextSelect = modal.querySelector("[data-report-context-select]");
  const contextLabel = modal.querySelector("[data-report-context-label]");
  const reasonTextarea = modal.querySelector("[data-report-reason]");
  const detailsField = modal.querySelector("[data-report-details]");
  const toast = modal.querySelector(".report-modal-toast");
  const submitBtn = modal.querySelector(".report-submit-btn");
  const hiddenType = form.querySelector("input[name='report_type']");
  const hiddenId = form.querySelector("input[name='reported_id']");
  const hiddenContext = form.querySelector("input[name='context_id']");
  let currentEndpoint = null;
  let currentMethod = "POST";
  let successMessage = "Report submitted successfully.";
  let minCharacters = 0;
  let extraPayload = null;
  let contextFieldName = "context";

  const defaultHelper =
    "Provide a short explanation so our moderators can look into the issue.";

  const triggers = document.querySelectorAll("[data-report-trigger]");

  const parseJSON = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn("[reportModal] Failed to parse JSON:", err);
      return null;
    }
  };

  const resetForm = () => {
    form.reset();
    hiddenType.value = "";
    hiddenId.value = "";
    hiddenContext.value = "";
    extraPayload = null;
    minCharacters = 0;
    contextWrapper.hidden = true;
    contextSelect.innerHTML = "";
  };

  const renderContextOptions = (config) => {
    const options = parseJSON(config.contextOptions);
    if (!options || !options.length) {
      contextWrapper.hidden = true;
      contextSelect.innerHTML = "";
      return;
    }
    contextWrapper.hidden = false;
    contextLabel.textContent = config.contextLabel || "Related to";
    contextSelect.innerHTML = "";
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value ?? "";
      opt.textContent = option.label ?? option.value ?? "";
      contextSelect.appendChild(opt);
    });
    if (config.contextValue) {
      contextSelect.value = config.contextValue;
    }
  };

  const openModal = (config) => {
    resetForm();
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    titleEl.textContent = config.title || "Submit Report";
    helperEl.textContent = config.helper || defaultHelper;
    reasonTextarea.placeholder =
      config.reasonPlaceholder || "Describe what happened...";
    reasonTextarea.value = "";
    detailsField.value = "";

    hiddenType.value = config.reportType || "";
    hiddenId.value = config.reportedId || "";
    hiddenContext.value = config.contextId || "";
    minCharacters = Number(config.minLength || 0);
    extraPayload = parseJSON(config.extraPayload) || null;
    successMessage =
      config.successMessage || "Thanks! Our moderators will review this soon.";
    currentEndpoint = config.endpoint || null;
    currentMethod = config.method || "POST";
    contextFieldName = config.contextField || "context";

    renderContextOptions(config);
    if (reasonTextarea) {
      setTimeout(() => reasonTextarea.focus(), 100);
    }
  };

  const closeModal = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const showToast = (message, type = "success") => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("show", "error");
    if (type === "error") toast.classList.add("error");
    requestAnimationFrame(() => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3200);
    });
  };

  const setSubmitting = (isSubmitting) => {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.innerHTML = isSubmitting
      ? `<span class="spinner"></span> Sending...`
      : `<i class="fa-solid fa-paper-plane"></i> Submit Report`;
  };

  const pageLoader = document.getElementById("ajaxLoader");
  const pageLoaderText = document.getElementById("ajaxLoaderText");
  const togglePageLoader = (isLoading, message = "Submitting report...") => {
    if (!pageLoader) return;
    if (isLoading) {
      if (pageLoaderText) pageLoaderText.textContent = message;
      pageLoader.style.display = "flex";
    } else {
      pageLoader.style.display = "none";
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const config = {
        title: trigger.dataset.reportTitle,
        helper: trigger.dataset.reportHelper,
        endpoint: trigger.dataset.reportEndpoint,
        method: trigger.dataset.reportMethod || "POST",
        reportedId:
          trigger.dataset.reportedId || trigger.dataset.reportId || "",
        reportType: trigger.dataset.reportType || "",
        contextId: trigger.dataset.reportContextId || "",
        contextOptions: trigger.dataset.reportContextOptions,
        contextLabel: trigger.dataset.reportContextLabel,
        contextValue: trigger.dataset.reportContextValue,
        contextField: trigger.dataset.reportContextField,
        successMessage: trigger.dataset.reportSuccess,
        reasonPlaceholder: trigger.dataset.reportPlaceholder,
        minLength: trigger.dataset.reportMinLength,
        extraPayload: trigger.dataset.reportExtra,
      };

      if (!config.endpoint) {
        console.warn("[reportModal] Missing endpoint for trigger", trigger);
        return;
      }

      openModal(config);
    });
  });

  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentEndpoint) return;

    const reason = (reasonTextarea.value || "").trim();
    if (!reason || (minCharacters && reason.length < minCharacters)) {
      reasonTextarea.focus();
      return showToast(
        minCharacters
          ? `Please provide at least ${minCharacters} characters.`
          : "Reason is required.",
        "error"
      );
    }

    const payload = {
      reason,
      report_type: hiddenType.value || undefined,
      reported_id: hiddenId.value || undefined,
    };

    const contextValue = contextWrapper.hidden
      ? ""
      : contextSelect.value || "";
    if (contextValue) {
      payload.context = contextValue;
      hiddenContext.value = contextValue;
    }
    if (contextValue && contextFieldName) {
      payload[contextFieldName] = contextValue;
    }

    const details = (detailsField.value || "").trim();
    if (details) {
      payload.details = details;
    }

    if (extraPayload) {
      Object.assign(payload, extraPayload);
    }

    setSubmitting(true);
    togglePageLoader(true);
    try {
      const response = await fetch(currentEndpoint, {
        method: currentMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to submit report.");
      }
      showToast(data.message || successMessage);
      document.dispatchEvent(
        new CustomEvent("report:submitted", {
          detail: { payload, response: data },
        })
      );
      closeModal();
    } catch (error) {
      console.error("[reportModal] Submit failed:", error);
      showToast(error.message || "Unable to submit report.", "error");
    } finally {
      setSubmitting(false);
      togglePageLoader(false);
    }
  });
});

