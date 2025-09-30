document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("button[data-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.href = btn.getAttribute("data-url");
    });
  });
});
