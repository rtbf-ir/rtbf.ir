const track = document.getElementById("latest-posts-track");
const controls = document.querySelector(".latest-posts-controls");
const previous = controls.querySelector('[data-posts-step="-1"]');
const next = controls.querySelector('[data-posts-step="1"]');
const isRtl = getComputedStyle(track).direction === "rtl";

function updateControls() {
  const position = Math.abs(track.scrollLeft);
  previous.setAttribute("aria-disabled", String(position < 1));
  next.setAttribute("aria-disabled", String(position >= track.scrollWidth - track.clientWidth - 1));
}

controls.addEventListener("click", event => {
  const button = event.target.closest("[data-posts-step]");
  if (!button || button.getAttribute("aria-disabled") === "true") return;

  const [first, second] = track.children;
  const cardStep = Math.abs(second.offsetLeft - first.offsetLeft);
  track.scrollBy({
    left: cardStep * Number(button.dataset.postsStep) * (isRtl ? -1 : 1),
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
});

track.addEventListener("scroll", updateControls, { passive: true });
window.addEventListener("resize", updateControls);
updateControls();
controls.hidden = false;
