document.addEventListener("DOMContentLoaded", () => {
  // Declare emailjs variable
  const emailjs = window.emailjs;

  // Initialize EmailJS
  emailjs.init("ymvg4Db5q7Fviryui");

  const contactForm = document.getElementById("contactForm");
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");

  if (!contactForm) return;

  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Show loader
    if (loader) {
      loader.style.display = "flex";
      if (loaderText)
        loaderText.textContent = "Sending message — please wait...";
    }

    try {
      // Send email via EmailJS
      await emailjs.sendForm("service_38a27a4", "template_p1v9ddf", this);

      // Hide loader + reset
      if (loader) loader.style.display = "none";
      contactForm.reset();

      // SUCCESS — redirect to route with Flask flash
      window.location.href = "/contact/success";
    } catch (error) {
      console.error("[v0] EmailJS Error:", error);

      // Hide loader
      if (loader) loader.style.display = "none";

      // ERROR — redirect to route with Flask flash
      window.location.href = "/contact/error";
    }
  });
});
