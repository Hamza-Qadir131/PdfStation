// VIP effect: tool cards tilt in 3D toward the mouse cursor,
// and a glow follows the cursor position across the card.
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  function initTilt() {
    const cards = document.querySelectorAll(".tool-card");
    cards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const px = x / rect.width;
        const py = y / rect.height;

        const rotateX = (0.5 - py) * 22; // tilt up/down
        const rotateY = (px - 0.5) * 22; // tilt left/right

        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px) scale3d(1.06, 1.06, 1.06)`;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateZ(0) scale3d(1, 1, 1)";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTilt);
  } else {
    initTilt();
  }
})();
