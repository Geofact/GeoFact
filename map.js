(function (root) {
  'use strict';
  function createMap(svg, onGuess) {
    const base = { x: 0, y: 0, w: 1200, h: 600 };
    let view = { ...base }, drag = null, pinch = null, moved = false, multi = false;
    const pointers = new Map();
    let celebrationTimer = null;
    const microstates = [...svg.querySelectorAll('circle[data-iso]')];
    const frenchPath = svg.querySelector('path.country-shape[data-iso="FRA"]');
    if (frenchPath) {
      const parts = frenchPath.getAttribute('d').match(/M[^M]+/g) || [];
      const guiana = parts.find(part => /^M427\.81,286\.15\b/.test(part));
      if (guiana) {
        frenchPath.setAttribute('d', parts.filter(part => part !== guiana).join(' '));
        const region = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        region.setAttribute('d', guiana);
        region.setAttribute('class', 'country-shape');
        region.dataset.iso = 'FRA-GF';
        frenchPath.parentNode.insertBefore(region, frenchPath);
      }
    }
    // Separate geographically distant US territories from the contiguous states.
    const usPath = svg.querySelector('path.country-shape[data-iso="USA"]');
    if (usPath) {
      const parts = usPath.getAttribute('d').match(/M[^M]+/g) || [];
      if (parts.length === 10 && parts[0].startsWith('M190.53,136.67')) {
        usPath.setAttribute('d', parts[0]);
        for (const [iso, subset] of [['USA-HI', parts.slice(1, 6)], ['USA-AK', parts.slice(6)]]) {
          const region = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          region.setAttribute('d', subset.join(' '));
          region.setAttribute('class', 'country-shape');
          region.dataset.iso = iso;
          usPath.parentNode.insertBefore(region, usPath);
        }
      }
    }
    // Legacy circles are distance references only. Selection uses sourced coastlines.
    for (const source of microstates) {
      source.style.display = 'none';
      const parts = root.GeoFactSmallTerritories?.[source.dataset.iso];
      if (!parts) throw new Error(`Missing territory geometry: ${source.dataset.iso}`);
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', parts.join(' '));
      shape.setAttribute('class', 'territory-detail');
      shape.setAttribute('fill-rule', 'evenodd');
      shape.dataset.iso = source.dataset.iso;
      source.parentNode.appendChild(shape);
    }
    const ns = 'http://www.w3.org/2000/svg';
    const markerLayer = document.createElementNS(ns, 'g');
    markerLayer.setAttribute('class', 'microstate-marker-layer');
    svg.appendChild(markerLayer);
    const make = (tag, cls) => {
      const el = document.createElementNS(ns, tag); el.setAttribute('class', cls); markerLayer.appendChild(el); return el;
    };
    // Use the largest connected land component, not the bounding box of an ocean-spanning archipelago.
    const markers = [...svg.querySelectorAll('path.country-shape[data-iso], path.territory-detail[data-iso]')].map(source => {
      const components = (source.getAttribute('d').match(/M[^M]+/g) || []).map(d => {
        const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number), vertices = [];
        for (let i = 0; i < nums.length; i += 2) vertices.push({x:nums[i],y:nums[i+1]});
        let area = 0;
        for (let i = 0; i < vertices.length; i++) { const a=vertices[i],b=vertices[(i+1)%vertices.length]; area += a.x*b.y-b.x*a.y; }
        return {vertices, area:Math.abs(area)/2};
      }).sort((a,b)=>b.area-a.area);
      const main = components[0], xs=main.vertices.map(p=>p.x), ys=main.vertices.map(p=>p.y);
      const box = {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
      // Pure point-in-polygon also works while the game screen is display:none.
      const inside = (x,y) => {
        let result=false;
        for(const {vertices} of components) {
          let contained=false;
          for(let i=0,j=vertices.length-1;i<vertices.length;j=i++) {
            const a=vertices[i],b=vertices[j];
            if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) contained=!contained;
          }
          if(contained)result=!result;
        }
        return result;
      };
      let anchor;
      // A verified interior point, away from the coastline, in the dominant component.
      for (const resolution of [9,25,65]) {
        const candidates=[];
        for (let i=1;i<resolution;i++) for(let j=1;j<resolution;j++) {
          const x=box.x+box.w*i/resolution,y=box.y+box.h*j/resolution;
          if(inside(x,y)) candidates.push({x,y});
        }
        candidates.sort((a,b)=>Math.hypot(a.x-box.x-box.w/2,a.y-box.y-box.h/2)-Math.hypot(b.x-box.x-box.w/2,b.y-box.y-box.h/2));
        if(candidates.length){anchor=candidates[0];break;}
      }
      if (!anchor) throw new Error(`No interior anchor: ${source.dataset.iso}`);
      const tether=make('line','microstate-tether'), marker=make('circle','microstate-marker');
      marker.dataset.iso=source.dataset.iso;
      marker.setAttribute('role','button'); marker.dataset.i18nAria='smallCountryTarget';
      marker.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(marker.style.display!=='none')onGuess(source.dataset.iso);}});
      return {source,marker,tether,anchor,box,area:main.area};
    });
    let clusters = [], visible = [];
    const coarse = matchMedia('(pointer: coarse)');
    const label = key => root.GeoFactTranslations?.[document.documentElement.lang]?.[key] || root.GeoFactTranslations?.fr?.[key] || '';
    function layoutMicrostateMarkers() {
      const matrix = svg.getScreenCTM(); if (!matrix) return;
      const inverse=matrix.inverse(), scale=Math.hypot(matrix.a,matrix.b), rect=svg.getBoundingClientRect();
      const diameter=coarse.matches?44:24, radius=4.5;
      const screen=p=>{const q=svg.createSVGPoint();q.x=p.x;q.y=p.y;return q.matrixTransform(matrix);};
      const local=p=>{const q=svg.createSVGPoint();q.x=p.x;q.y=p.y;return q.matrixTransform(inverse);};
      const clamp=p=>({x:Math.max(rect.left+radius+2,Math.min(rect.right-radius-2,p.x)),y:Math.max(rect.top+radius+2,Math.min(rect.bottom-radius-2,p.y))});
      const inMap=p=>p.x>=rect.left+radius+2&&p.x<=rect.right-radius-2&&p.y>=rect.top+radius+2&&p.y<=rect.bottom-radius-2;
      visible=[];
      for(const item of markers){
        const size=Math.min(item.box.w*scale,item.box.h*scale,Math.sqrt(item.area)*scale);
        const opacity=Math.max(0,Math.min(1,(diameter-size)/(diameter*.35)));
        item.screen=screen(item.anchor); item.opacity=opacity;
        item.marker.style.display='none';item.tether.style.display='none';item.marker.setAttribute('tabindex','-1');
        if(opacity>.02&&item.screen.x>=rect.left&&item.screen.x<=rect.right&&item.screen.y>=rect.top&&item.screen.y<=rect.bottom)visible.push(item);
      }
      for(const c of clusters)c.el.remove(); clusters=[];
      const pending=new Set(visible), groups=[];
      while(pending.size){
        const group=[pending.values().next().value];pending.delete(group[0]);
        for(let i=0;i<group.length;i++)for(const item of pending)if(Math.hypot(group[i].screen.x-item.screen.x,group[i].screen.y-item.screen.y)<diameter+4){pending.delete(item);group.push(item);}
        groups.push(group);
      }
      // Clamping or averaging a group must not create a new collision with another group.
      const center=group=>clamp({x:group.reduce((sum,i)=>sum+i.screen.x,0)/group.length,y:group.reduce((sum,i)=>sum+i.screen.y,0)/group.length});
      let merged=true;
      while(merged){merged=false;
        outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
          const a=center(groups[i]),b=center(groups[j]);
          if(Math.hypot(a.x-b.x,a.y-b.y)<diameter+4){groups[i].push(...groups[j]);groups.splice(j,1);merged=true;break outer;}
        }
      }
      const place=(item,p)=>{
        p=clamp(p);
        const q=local(p),a=item.anchor;
        item.display=p;item.marker.style.display='';item.marker.style.opacity=item.opacity;
        item.marker.setAttribute('cx',q.x);item.marker.setAttribute('cy',q.y);item.marker.setAttribute('r',radius/scale);
        item.marker.setAttribute('tabindex','0');item.marker.setAttribute('aria-label',label('smallCountryTarget'));
        if(Math.hypot(p.x-item.screen.x,p.y-item.screen.y)>1){
          item.tether.style.display='';item.tether.setAttribute('x1',a.x);item.tether.setAttribute('y1',a.y);item.tether.setAttribute('x2',q.x);item.tether.setAttribute('y2',q.y);
        }
      };
      for(const group of groups){
        if(group.length===1){place(group[0],group[0].screen);continue;}
        // Never leave an unresolvable cluster at the zoom cap: separate with explicit leader lines.
        if(view.w<=4.01){
          const placed=[];
          for(const item of group){let p=item.screen;
            search:for(let ring=0;ring<20;ring++)for(let step=0;step<32;step++){
              const angle=step*Math.PI/16,candidate={x:item.screen.x+ring*diameter*Math.cos(angle),y:item.screen.y+ring*diameter*Math.sin(angle)};
              if(inMap(candidate)&&placed.every(q=>Math.hypot(q.x-candidate.x,q.y-candidate.y)>=diameter+2)){p=candidate;break search;}
            }
            placed.push(p);place(item,p);
          }
          continue;
        }
        const p={x:group.reduce((sum,i)=>sum+i.screen.x,0)/group.length,y:group.reduce((sum,i)=>sum+i.screen.y,0)/group.length};
        const painted=clamp(p),q=local(painted),el=make('circle','microstate-cluster');el.setAttribute('cx',q.x);el.setAttribute('cy',q.y);el.setAttribute('r',6/scale);
        el.setAttribute('role','button');el.setAttribute('tabindex','0');el.dataset.i18nAria='smallCountriesCluster';el.setAttribute('aria-label',label('smallCountriesCluster'));
        const cluster={el,screen:painted,group};clusters.push(cluster);
        el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();expandCluster(cluster);}});
      }
    }
    function expandCluster(cluster){
      const xs=cluster.group.map(i=>i.anchor.x),ys=cluster.group.map(i=>i.anchor.y);
      const span=Math.max(Math.max(...xs)-Math.min(...xs),2*(Math.max(...ys)-Math.min(...ys)));
      const w=Math.max(4,Math.min(view.w/2,Math.max(span*1.6,4)));
      const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
      setView({x:x-w/2,y:y-w/4,w});
    }
    function setView(next) {
      const w = Math.min(1200, Math.max(4, next.w)), h = w / 2;
      view = { x: Math.min(1200 - w, Math.max(0, next.x)), y: Math.min(600 - h, Math.max(0, next.y)), w, h };
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      layoutMicrostateMarkers();
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
    function markerScreenCenter(el) {
      // Page scrolling and HUD changes can translate the SVG without a resize.
      // Hit testing must use the current matrix, not the last layout's screen coordinates.
      const m=svg.getScreenCTM();
      if(!m)return {x:Infinity,y:Infinity};
      const x=+el.getAttribute('cx'),y=+el.getAttribute('cy');
      return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
    }
    function resolveCountry(target, x, y, type) {
      const marker = target?.closest?.('.microstate-marker[data-iso]');
      if (marker && svg.contains(marker) && marker.style.display !== 'none') return marker.dataset.iso;
      // Only the visible dot may override neighbouring land. Its invisible comfort zone may not.
      const real = target?.closest?.('path[data-iso]');
      if (real && svg.contains(real)) return real.dataset.iso;
      const radius = type === 'touch' ? 22 : 12;
      const candidates=visible.filter(i=>{const p=markerScreenCenter(i.marker);return i.marker.style.display!== 'none' && Math.hypot(p.x-x,p.y-y)<=radius;});
      return candidates.length===1 ? candidates[0].source.dataset.iso : null;
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
          if(e.isTrusted && (!actualTarget || !svg.contains(actualTarget))){drag=pinch=null;return;}
          const hitTarget=actualTarget && svg.contains(actualTarget) ? actualTarget : p.target;
          const cluster=clusters.find(c=>{const q=markerScreenCenter(c.el);return c.el===hitTarget || (!hitTarget?.closest?.('path[data-iso], .microstate-marker') && Math.hypot(q.x-e.clientX,q.y-e.clientY)<(p.type==='touch'?22:12));});
          if(cluster){expandCluster(cluster);drag=pinch=null;return;}
          const iso = resolveCountry(actualTarget && svg.contains(actualTarget) ? actualTarget : p.target, e.clientX, e.clientY, p.type);
          if (iso) onGuess(iso);
        }
        drag = pinch = null;
      }
    }
    svg.addEventListener('pointerup', e => end(e));
    svg.addEventListener('pointercancel', e => end(e, true));
    svg.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) end(e, true); });
    svg.addEventListener('wheel', e => { e.preventDefault(); if(pointers.size)moved=true; zoom(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * .005), e.clientX, e.clientY); }, { passive: false });
    function animateCountry(iso, className, duration) {
      const shapes = [...svg.querySelectorAll(`[data-iso="${iso}"]`)];
      for (const shape of shapes) { shape.classList.remove(className); void shape.getBoundingClientRect(); shape.classList.add(className); }
      return setTimeout(() => { for (const shape of shapes) shape.classList.remove(className); }, duration);
    }
    function clearFound() {
      clearTimeout(celebrationTimer);
      celebrationTimer = null;
      for (const shape of svg.querySelectorAll('.country-found, .country-correct')) {
        shape.classList.remove('country-found', 'country-correct');
      }
    }
    function celebrate(countryISO, guessedISO = countryISO) {
      clearFound();
      // Include the country's independently selectable overseas regions and markers.
      for (const shape of svg.querySelectorAll(`[data-iso="${countryISO}"], [data-iso^="${countryISO}-"]`)) {
        shape.classList.add('country-found');
      }
      celebrationTimer = animateCountry(guessedISO, 'country-correct', 780);
    }
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
    if(typeof ResizeObserver !== 'undefined') new ResizeObserver(()=>requestAnimationFrame(layoutMicrostateMarkers)).observe(svg);
    coarse.addEventListener('change',()=>requestAnimationFrame(layoutMicrostateMarkers));
    addEventListener('resize', () => requestAnimationFrame(layoutMicrostateMarkers));
    requestAnimationFrame(layoutMicrostateMarkers);
    return { zoom, celebrate, clearFound, reject, reset() { pointers.clear(); drag = pinch = null; moved = multi = false; clearTried(); setView(base); }, getView: () => ({ ...view }), resolveCountry };
  }
  root.GeoFactMap = createMap;
})(globalThis);
