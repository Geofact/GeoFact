(function (root) {
  'use strict';
  function createMap(svg, onGuess) {
    const base = { x: 0, y: 0, w: 1200, h: 600 };
    let view = { ...base }, drag = null, pinch = null, moved = false, multi = false;
    const pointers = new Map();
    const microstates = [...svg.querySelectorAll('circle[data-iso]')];
    function setView(next) {
      const w = Math.min(1200, Math.max(15, next.w)), h = w / 2;
      view = { x: Math.min(1200 - w, Math.max(0, next.x)), y: Math.min(600 - h, Math.max(0, next.y)), w, h };
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    }
    function point(x, y) {
      const p = svg.createSVGPoint(); p.x = x; p.y = y;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function zoom(factor, clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const anchor = point(clientX ?? rect.x + rect.width / 2, clientY ?? rect.y + rect.height / 2);
      const w = Math.min(1200, Math.max(15, view.w / factor));
      const ratio = w / view.w;
      setView({ x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, w });
    }
    function resolveCountry(target, x, y, type) {
      const real = target?.closest?.('path[data-iso]');
      if (real && svg.contains(real)) return real.dataset.iso;
      const hit = target?.closest?.('circle[data-iso]');
      if (hit && svg.contains(hit)) return hit.dataset.iso;
      let nearest = null, distance = type === 'touch' ? 24 : 12;
      const matrix = svg.getScreenCTM();
      for (const circle of microstates) {
        const p = svg.createSVGPoint(); p.x = +circle.getAttribute('cx'); p.y = +circle.getAttribute('cy');
        const screen = p.matrixTransform(matrix);
        const d = Math.hypot(screen.x - x, screen.y - y);
        if (d < distance) { distance = d; nearest = circle.dataset.iso; }
      }
      return nearest;
    }
    function beginDrag(p) { drag = { x: p.x, y: p.y, view: { ...view }, scale: svg.getScreenCTM().a }; }
    function beginPinch() {
      const [a, b] = [...pointers.values()];
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view: { ...view }, anchor: point(x, y) };
    }
    svg.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (!pointers.size) { moved = false; multi = false; }
      const p = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, target: e.target, type: e.pointerType };
      pointers.set(e.pointerId, p);
      try { svg.setPointerCapture(e.pointerId); } catch { /* Synthetic events have no native pointer capture. */ }
      if (pointers.size === 1) beginDrag(p);
      else { multi = true; moved = true; beginPinch(); }
    });
    svg.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.startX, p.y - p.startY) > 8) moved = true;
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const w = Math.min(1200, Math.max(15, pinch.view.w * pinch.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
        const mid = point((a.x + b.x) / 2, (a.y + b.y) / 2);
        setView({ x: pinch.anchor.x - (mid.x - view.x) * w / view.w, y: pinch.anchor.y - (mid.y - view.y) * w / view.w, w });
      } else if (moved && drag) {
        setView({ x: drag.view.x - (p.x - drag.x) / drag.scale, y: drag.view.y - (p.y - drag.y) / drag.scale, w: drag.view.w });
      }
    });
    function end(e, cancelled = false) {
      const p = pointers.get(e.pointerId); if (!p) return;
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 8) moved = true;
      pointers.delete(e.pointerId);
      if (cancelled) { moved = true; multi = true; }
      if (pointers.size >= 2) beginPinch();
      else if (pointers.size === 1) { pinch = null; beginDrag([...pointers.values()][0]); }
      else {
        if (!moved && !multi && !cancelled) {
          const iso = resolveCountry(p.target, e.clientX, e.clientY, p.type);
          if (iso) onGuess(iso);
        }
        drag = pinch = null;
      }
    }
    svg.addEventListener('pointerup', e => end(e));
    svg.addEventListener('pointercancel', e => end(e, true));
    svg.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) end(e, true); });
    svg.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * .005), e.clientX, e.clientY); }, { passive: false });
    function animateCountry(iso, className, duration) {
      const shapes = [...svg.querySelectorAll(`[data-iso="${iso}"]`)];
      for (const shape of shapes) { shape.classList.remove(className); void shape.getBoundingClientRect(); shape.classList.add(className); }
      setTimeout(() => { for (const shape of shapes) shape.classList.remove(className); }, duration);
    }
    function celebrate(iso) { animateCountry(iso, 'country-correct', 780); }
    function reject(iso) {
      const shapes = [...svg.querySelectorAll(`[data-iso="${iso}"]`)];
      for (const shape of shapes) {
        shape.classList.remove('country-wrong');
        void shape.getBoundingClientRect();
        shape.classList.add('country-wrong', 'country-tried');
      }
      setTimeout(() => { for (const shape of shapes) shape.classList.remove('country-wrong'); }, 430);
    }
    function clearTried() { for (const shape of svg.querySelectorAll('.country-tried')) shape.classList.remove('country-tried'); }
    return { zoom, celebrate, reject, reset() { pointers.clear(); drag = pinch = null; moved = multi = false; clearTried(); setView(base); }, getView: () => ({ ...view }), resolveCountry };
  }
  root.GeoFactMap = createMap;
})(globalThis);
