


document.addEventListener("DOMContentLoaded", function () {

 
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const navRight = document.querySelector(".nav-right");

  if (menuToggle) {
    
    menuToggle.addEventListener("click", function () {
     
      navLinks.classList.toggle("open");
      if (navRight) navRight.classList.toggle("open");
    });
  }

  
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll(".nav-links a");

  links.forEach(function (link) {
    const href = link.getAttribute("href");
    const isAnchorLink = href.includes("#");
    const linkPage = href.split("#")[0];
     
    if (!isAnchorLink && linkPage === currentPage) {
      link.classList.add("active");

    }
  });

  
  const searchBox = document.querySelector(".search");
  const menuItems = document.querySelectorAll(".menu-item");
  const noResults = document.querySelector(".no-results");

  if (searchBox && menuItems.length > 0) {
  
    searchBox.addEventListener("input", function () {
      const query = searchBox.value.trim().toLowerCase();
      let visibleCount = 0;

      menuItems.forEach(function (item) {
        const name = item.querySelector("h3").textContent.toLowerCase();
        const matches = name.includes(query);

       
        item.classList.toggle("hidden", !matches);

        if (matches) visibleCount++;
      });

      if (noResults) {
        noResults.style.display = visibleCount === 0 ? "block" : "none";
      }
    });
  }

});
