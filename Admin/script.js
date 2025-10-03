document.querySelector(".account-menu-btn").addEventListener("click", function (e) {
  e.stopPropagation();
  const menu = document.querySelector(".account-menu-content");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// close dropdown pag-click sa labas
window.addEventListener("click", function () {
  document.querySelector(".account-menu-content").style.display = "none";
});



