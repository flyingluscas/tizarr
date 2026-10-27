// Loads <img data-src> only when it gets near the screen, so long grids and rows don't
// download dozens of posters up front.
import { $$ } from '../dom.js';

// Start loading a bit before the image scrolls into view.
const PRELOAD_MARGIN = '600px';

let observer = null;

function load(img) {
  img.src = img.dataset.src;
  img.removeAttribute('data-src');
}

export function observeImages(root) {
  const images = $$('img[data-src]', root);
  if (!('IntersectionObserver' in window)) {
    images.forEach(load);
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          load(entry.target);
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
  }
  for (const img of images) observer.observe(img);
}
