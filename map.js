(function (root) {
  'use strict';
  function createMap(svg, onGuess) {
    const base = { x: 0, y: 0, w: 1200, h: 600 };
    let view = { ...base }, drag = null, pinch = null, moved = false, multi = false;
    const pointers = new Map();
    const microstates = [...svg.querySelectorAll('circle[data-iso]')];
    const markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerLayer.setAttribute('class', 'microstate-marker-layer');
    svg.appendChild(markerLayer);
    const markers = microstates.map(source => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('class', 'microstate-marker');
      marker.dataset.iso = source.dataset.iso;
      marker.dataset.sourceIso = source.dataset.iso;
      markerLayer.appendChild(marker);
      return { source, marker };
    });
    function layoutMicrostateMarkers() {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const inverse = matrix.inverse(), placed = [];
      const radius = 4.5, gap = 3, minDistance = radius * 2 + gap;
      for (const item of markers) {
        const p = svg.createSVGPoint();
        p.x = +item.source.getAttribute('cx'); p.y = +item.source.getAttribute('cy');
        const anchor = p.matrixTransform(matrix);
        let chosen = { x: anchor.x, y: anchor.y }, found = false;
        for (let ring = 0; ring <= 5 && !found; ring++) {
          const distance = ring * (minDistance + 1);
          const steps = ring === 0 ? 1 : Math.max(8, ring * 10);
          for (let step = 0; step < steps; step++) {
            const angle = ring === 0 ? 0 : (step / steps) * Math.PI * 2;
            const candidate = { x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance };
            if (placed.every(q => Math.hypot(candidate.x - q.x, candidate.y - q.y) >= minDistance)) {
              chosen = candidate; found = true; break;
            }
          }
        }
        placed.push(chosen);
        const local = svg.createSVGPoint(); local.x = chosen.x; local.y = chosen.y;
        const svgPoint = local.matrixTransform(inverse);
        const scale = Math.max(.0001, Math.hypot(matrix.a, matrix.b));
        item.marker.setAttribute('cx', svgPoint.x);
        item.marker.setAttribute('cy', svgPoint.y);
        item.marker.setAttribute('r', radius / scale);
        item.marker.style.setProperty('--marker-stroke', `${1.4 / scale}px`);
      }
    }
    function setView(next) {
      const w = Math.min(1200, Math.max(4, next.w)), h = w / 2;
      view = { x: Math.min(1200 - w, Math.max(0, next.x)), y: Math.min(600 - h, Math.max(0, next.y)), w, h };
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      requestAnimationFrame(layoutMicrostateMarkers);
    }
    function point(x, y) {
      const p = svg.createSVGPoint(); p.x = x; p.y = y;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function zoom(factor, clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const anchor = point(clientX ?? rect.x + rect.width / 2, clientY ?? rect.y + rect.height / 2);
      const w = Math.min(1200, Math.max(4, view.w / factor));
      const ratio = w / view.w;
      setView({ x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, w });
    }
    function resolveCountry(target, x, y, type) {
      const marker = target?.closest?.('.microstate-marker[data-iso]');
      if (marker && svg.contains(marker)) return marker.dataset.iso;
      const real = target?.closest?.('path[data-iso]');
      if (real && svg.contains(real)) return real.dataset.iso;
      const hit = target?.closest?.('circle[data-iso]');
      if (hit && svg.contains(hit)) return hit.dataset.iso;
      let nearest = null, distance = type === 'touch' ? 16 : 10;
      for (const item of markers) {
        const screen = item.marker.getBoundingClientRect();
        const d = Math.hypot(screen.left + screen.width / 2 - x, screen.top + screen.height / 2 - y);
        if (d < distance) { distance = d; nearest = item.source.dataset.iso; }
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
        const w = Math.min(1200, Math.max(4, pinch.view.w * pinch.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
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
          const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
          const iso = resolveCountry(actualTarget && svg.contains(actualTarget) ? actualTarget : p.target, e.clientX, e.clientY, p.type);
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
    addEventListener('resize', () => requestAnimationFrame(layoutMicrostateMarkers));
    requestAnimationFrame(layoutMicrostateMarkers);
    return { zoom, celebrate, reject, reset() { pointers.clear(); drag = pinch = null; moved = multi = false; clearTried(); setView(base); }, getView: () => ({ ...view }), resolveCountry };
  }
  root.GeoFactMap = createMap;
})(globalThis);
