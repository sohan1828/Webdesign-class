var header = document.querySelector(".site-header"), btn = document.querySelector(".menu-btn");
btn.addEventListener("click", function () {
  var open = header.classList.toggle("open");
  btn.setAttribute("aria-expanded", open);
  btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
header.querySelectorAll("nav a").forEach(function (a) {
  a.addEventListener("click", function () { header.classList.remove("open"); btn.setAttribute("aria-expanded", false); });
});
