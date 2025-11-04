(function () {
  emailjs.init("ymvg4Db5q7Fviryui"); // Your EmailJS public key
})();

document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");

  if (!contactForm) return;

  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();

    // --- Show loader ---
    if (loader) {
      loader.style.display = "flex";
      if (loaderText)
        loaderText.textContent = "Sending message — please wait...";
    }

    emailjs
      .sendForm("service_38a27a4", "template_p1v9ddf", this)
      .then(() => {
        if (loader) loader.style.display = "none";

        // Trigger Jinja flash (redirect or reload to show it)
        fetch("/flash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message:
              "Thank you for reaching out. Your message was sent successfully!",
            category: "success",
          }),
        }).then(() => window.location.reload());
      })
      .catch((error) => {
        console.error("Error:", error);
        if (loader) loader.style.display = "none";

        fetch("/flash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Failed to send message. Please try again.",
            category: "error",
          }),
        }).then(() => window.location.reload());
      });
  });

  // --- Smooth scrolling for navigation ---
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
});
