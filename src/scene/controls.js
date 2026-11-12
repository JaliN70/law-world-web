export function attachPanZoom(canvas, rig, { onTap, reducedMotion }) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let pinchStart = null;

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 8) moved = true;
    startX = e.clientX;
    startY = e.clientY;
    rig.pan(dx, dy, canvas.clientHeight);
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!moved && onTap) onTap(e.clientX, e.clientY);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    rig.setZoom(rig.zoom + delta);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinchStart = {
          dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          zoom: rig.zoom,
        };
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 2 && pinchStart) {
        const [a, b] = e.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = dist / pinchStart.dist;
        rig.setZoom(pinchStart.zoom * ratio);
      }
    },
    { passive: true }
  );

  canvas.addEventListener('touchend', () => {
    pinchStart = null;
  });

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}
