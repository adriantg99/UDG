(() => {
  "use strict";

  const modal = document.getElementById("actividad-modal");
  const player = document.getElementById("actividad-player");
  const title = document.getElementById("actividad-modal-title");
  const note = document.getElementById("actividad-modal-note");
  const error = document.getElementById("actividad-video-error");
  const download = document.getElementById("actividad-video-download");
  const links = [...document.querySelectorAll(".actividad-video-link")];
  if (!modal || !player || !links.length || typeof modal.showModal !== "function") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let origin = links[0];
  let opening = 0;

  function openVideo(link, automatic = false) {
    origin = link;
    const currentOpening = ++opening;
    error.hidden = true;
    title.textContent = link.dataset.videoTitle;
    download.href = link.href;
    player.poster = link.querySelector("img").src;
    player.muted = automatic;
    player.src = link.href;
    note.textContent = automatic
      ? "El video comienza sin sonido. Puedes activarlo desde los controles. Al terminar, se cierra automáticamente."
      : "Al terminar, el video se cierra y puedes seguir explorando las tarjetas.";
    modal.showModal();
    document.body.classList.add("actividad-modal-open");
    if (automatic && reducedMotion.matches) {
      note.textContent = "Pulsa reproducir para ver el video. Se respeta tu preferencia de movimiento reducido.";
      return;
    }
    const playback = player.play();
    if (playback) {
      playback.catch(() => {
        if (currentOpening === opening && modal.open) {
          note.textContent = "Pulsa reproducir en los controles para iniciar el video.";
        }
      });
    }
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      openVideo(link);
    });
  });

  modal.querySelector(".actividad-modal-close").addEventListener("click", () => modal.close());
  player.addEventListener("ended", () => {
    if (modal.open) modal.close();
  });
  player.addEventListener("error", () => {
    if (modal.open) error.hidden = false;
  });
  modal.addEventListener("close", () => {
    ++opening;
    player.pause();
    player.currentTime = 0;
    document.body.classList.remove("actividad-modal-open");
    origin.focus({ preventScroll: true });
  });
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      modal.close();
    }
  });

  openVideo(links[0], true);
})();
