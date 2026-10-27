// The UI is designed for a 1920×1080 TV canvas. Scaling the whole stage keeps that exact
// layout on any screen: TVs that report a 1280×720 viewport and desktop browsers used for
// previews. A transform is cheap for the TV's GPU and needs no per-element CSS.

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export function fitStageToWindow(stage) {
  function fit() {
    const scale = Math.min(innerWidth / DESIGN_WIDTH, innerHeight / DESIGN_HEIGHT);
    const left = (innerWidth - DESIGN_WIDTH * scale) / 2;
    const top = (innerHeight - DESIGN_HEIGHT * scale) / 2;
    stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  }
  fit();
  window.addEventListener('resize', fit);
}
