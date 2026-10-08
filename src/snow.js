// Falling white dots drawn on a full-screen canvas behind the page.
// Shared by the app (src/index.html) and the download site (copied there when it's deployed).
(function () {
  const canvas = document.createElement("canvas");
  canvas.className = "snow";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dots = [];
  let width = 0;
  let height = 0;
  let lastTime = 0;
  let frame = null;

  function makeDot(startAnywhere) {
    const radius = 0.6 + Math.random() * 2.2;
    return {
      x: Math.random() * width,
      y: startAnywhere ? Math.random() * height : -radius * 2,
      radius,
      // Bigger dots fall faster so they look closer.
      speed: 18 + radius * 22 + Math.random() * 12,
      drift: (Math.random() - 0.5) * 14,
      sway: Math.random() * Math.PI * 2,
      opacity: 0.35 + Math.random() * 0.55,
    };
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.round(Math.min(160, (width * height) / 9000));
    dots = Array.from({ length: count }, () => makeDot(true));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const dot of dots) {
      ctx.globalAlpha = dot.opacity;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function step(time) {
    const seconds = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      dot.sway += seconds;
      dot.y += dot.speed * seconds;
      dot.x += (dot.drift + Math.sin(dot.sway) * 8) * seconds;
      if (dot.y - dot.radius > height || dot.x < -10 || dot.x > width + 10) {
        dots[i] = makeDot(false);
      }
    }
    draw();
    frame = requestAnimationFrame(step);
  }

  function start() {
    if (frame === null && !reduceMotion.matches && !document.hidden) {
      lastTime = 0;
      frame = requestAnimationFrame(step);
    }
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener("change", () => (reduceMotion.matches ? stop() : start()));

  resize();
  start();
})();
