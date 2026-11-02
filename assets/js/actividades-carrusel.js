(() => {
  "use strict";

  const carousel = document.getElementById("publicaciones-carrusel");
  const previous = document.getElementById("publicaciones-prev");
  const next = document.getElementById("publicaciones-next");
  const track = carousel?.querySelector(".publicaciones-track");
  const first = track?.querySelector("li");
  if (!carousel || !previous || !next || !first) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function updateButtons() {
    previous.disabled = carousel.scrollLeft <= 2;
    next.disabled = carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth - 2;
  }

  function move(direction) {
    const gap = parseFloat(window.getComputedStyle(track).gap) || 0;
    carousel.scrollBy({
      left: direction * (first.getBoundingClientRect().width + gap),
      behavior: reducedMotion.matches ? "instant" : "smooth"
    });
  }

  previous.hidden = false;
  next.hidden = false;
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  carousel.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  carousel.addEventListener("keydown", (event) => {
    if (event.target !== carousel || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  updateButtons();
})();
