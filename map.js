(function (root) {
  'use strict';
  function createMap(svg, onGuess) {
    const base = { x: 0, y: 0, w: 1200, h: 600 };
    let view = { ...base }, drag = null, pinch = null, moved = false, multi = false;
    const pointers = new Map();
    let celebrationTimer = null, zoomGuardUntil = 0;
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
      const tether=make('line','microstate-tether'), marker=make('circle','microstate-marker'), core=make('circle','target-core');
      core.setAttribute('aria-hidden','true');
      marker.dataset.iso=source.dataset.iso;
      marker.dataset.anchorX=anchor.x;marker.dataset.anchorY=anchor.y;
      marker.setAttribute('role','button'); marker.dataset.i18nAria='smallCountryTarget';
      marker.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(marker.dataset.active==='true'&&performance.now()>=zoomGuardUntil)smallView.open([markers.find(i=>i.source===source)]);}});
      return {source,marker,core,tether,anchor,box,area:main.area};
    });
    let clusters = [], visible = [];
    const clusterPool = new Map();
    const coarse = matchMedia('(pointer: coarse)');
    const label = key => root.GeoFactTranslations?.[document.documentElement.lang]?.[key] || root.GeoFactTranslations?.fr?.[key] || '';
    const smallView=root.GeoFactSmallTerritoryView({svg,items:markers,onGuess,label,onClose:()=>{zoomGuardUntil=performance.now()+240;}});
    function reveal(el, active, opacity = 1) {
      clearTimeout(el.hideTimer);
      const entering = active && el.dataset.active !== 'true';
      if(!active && el.dataset.active==='true')el.fading=true;
      if(active)el.fading=false;
      el.dataset.active = String(active);
      el.style.pointerEvents = active||el.fading ? 'all' : 'none';
      el.setAttribute('tabindex', active ? '0' : '-1');
      if (active) {
        el.style.display = '';
        if (entering) { el.classList.remove('marker-enter'); void el.getBoundingClientRect(); el.classList.add('marker-enter'); setTimeout(()=>el.classList.remove('marker-enter'),190); }
        el.style.opacity = opacity;
      } else {
        el.style.opacity = 0;
        el.hideTimer = setTimeout(() => { if (el.dataset.active === 'false') { el.style.display = 'none'; el.style.pointerEvents='none'; el.fading=false; } }, 180);
      }
    }
    function layoutMicrostateMarkers() {
      const matrix = svg.getScreenCTM(); if (!matrix) return;
      const inverse=matrix.inverse(), scale=Math.hypot(matrix.a,matrix.b), rect=svg.getBoundingClientRect();
      const detail=Math.max(0,Math.min(1,(Math.log2(1200/view.w)-1.5)/1.5));
      const radius=3+10*detail, hit=coarse.matches?44:32;
      const spacing=detail>.8?hit+6:34+detail*16;
      const screen=p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f});
      const local=p=>{const q=svg.createSVGPoint();q.x=p.x;q.y=p.y;return q.matrixTransform(inverse);};
      const controls=[...(svg.closest('.map-wrap')?.querySelectorAll('.map-controls')||[])].map(el=>el.getBoundingClientRect());
      const margin=radius+2;
      const clearance=hit/2+5;
      const blocked=p=>controls.some(r=>p.x+clearance>r.left&&p.x-clearance<r.right&&p.y+clearance>r.top&&p.y-clearance<r.bottom);
      const inMap=p=>p.x>=rect.left+margin&&p.x<=rect.right-margin&&p.y>=rect.top+margin&&p.y<=rect.bottom-margin&&!blocked(p);
      const clamp=p=>{
        const q={x:Math.max(rect.left+margin,Math.min(rect.right-margin,p.x)),y:Math.max(rect.top+margin,Math.min(rect.bottom-margin,p.y))};
        for(const r of controls)if(blocked(q))q.x=Math.max(rect.left+margin,r.left-clearance-1);
        return q;
      };
      const eligible=[];
      for(const item of markers){
        const size=Math.min(Math.sqrt(item.area),Math.min(item.box.w,item.box.h)*2)*scale;
        // A dot is useful for genuinely tiny land, not every narrow or medium country.
        const threshold=coarse.matches?18+10*detail:14+8*detail;
        item.opacity=Math.max(0,Math.min(1,(threshold-size)/(threshold*.35)));
        item.screen=screen(item.anchor);item.localTarget=detail>.8;item.hitSize=hit;
        item.marker.dataset.local=String(item.localTarget);
        if((item.source.classList.contains('territory-detail')||item.area<24)&&item.opacity>.02&&item.screen.x>=rect.left&&item.screen.x<=rect.right&&item.screen.y>=rect.top&&item.screen.y<=rect.bottom)eligible.push(item);
      }
      const close=(a,b)=>detail>.8?Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<spacing:Math.hypot(a.x-b.x,a.y-b.y)<spacing;
      const pending=new Set(eligible), groups=[];
      while(pending.size){
        const group=[pending.values().next().value];pending.delete(group[0]);
        for(let i=0;i<group.length;i++)for(const item of pending){
          if(close(group[i].screen,item.screen) && (detail>.8 || group.every(other=>Math.abs(other.screen.x-item.screen.x)<56&&Math.abs(other.screen.y-item.screen.y)<56))){pending.delete(item);group.push(item);}
        }
        groups.push(group);
      }
      const center=group=>clamp({x:group.reduce((sum,i)=>sum+i.screen.x,0)/group.length,y:group.reduce((sum,i)=>sum+i.screen.y,0)/group.length});
      // Individual controls and group controls must never occupy ambiguous overlapping positions.
      let merged=true;
      while(merged){merged=false;
        outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
          const a=center(groups[i]),b=center(groups[j]);
          if(close(a,b) && (detail>.8 || groups[i].every(p=>groups[j].every(q=>Math.abs(p.screen.x-q.screen.x)<70&&Math.abs(p.screen.y-q.screen.y)<70)))){groups[i].push(...groups[j]);groups.splice(j,1);merged=true;break outer;}
        }
      }
      visible=[];const occupied=[];const activeClusters=new Set();clusters=[];
      const place=(item,p)=>{
        const q=local(p),a=item.anchor;
        occupied.push(p);visible.push(item);
        item.marker.setAttribute('cx',q.x);item.marker.setAttribute('cy',q.y);item.marker.setAttribute('r',radius/scale);
        item.core.setAttribute('cx',q.x);item.core.setAttribute('cy',q.y);item.core.setAttribute('r',(1.4+.6*detail)/scale);item.core.style.display='';item.core.style.opacity=item.opacity;
        item.marker.dataset.local=String(item.localTarget);
        item.marker.setAttribute('aria-label',label('smallCountryTarget'));
        reveal(item.marker,true,item.opacity);
        const shifted=Math.hypot(p.x-item.screen.x,p.y-item.screen.y)>1;
        item.tether.style.display=shifted?'':'none';item.tether.style.pointerEvents='none';item.tether.style.opacity=item.opacity;
        if(shifted){item.tether.setAttribute('x1',a.x);item.tether.setAttribute('y1',a.y);item.tether.setAttribute('x2',q.x);item.tether.setAttribute('y2',q.y);}
      };
      const free=p=>inMap(p)&&occupied.every(q=>!close(q,p));
      const separate=item=>{
        const start=clamp(item.screen);
        if(free(start))return start;
        for(let ring=1;ring<=12;ring++)for(let step=0;step<32;step++){
          const angle=step*Math.PI/16,p={x:start.x+ring*(hit+4)*Math.cos(angle),y:start.y+ring*(hit+4)*Math.sin(angle)};
          if(free(p))return p;
        }
        return null;
      };
      for(const group of groups){
        // Keep nearby countries grouped until zoom separates their actual geographic positions.
        // Only at the hard zoom limit use a compact, tethered fallback.
        const spread=group.length===1||view.w<=4.01;
        if(spread){
          const chosen=[],previous=occupied.length;
          for(const item of group){const p=view.w<=4.01?separate(item):(!blocked(item.screen)&&free(clamp(item.screen))?clamp(item.screen):null);if(!p)break;chosen.push({item,p});occupied.push(p);}
          occupied.length=previous;
          if(chosen.length===group.length){for(const {item,p} of chosen)place(item,p);continue;}
        }
        if(group.length===1)continue;
        const key=group.map(i=>i.source.dataset.iso).sort().join('|');
        let cluster=clusterPool.get(key);
        if(!cluster){
          const el=make('g','microstate-cluster');
          const disc=document.createElementNS(ns,'circle'),plus=document.createElementNS(ns,'path');
          disc.setAttribute('class','cluster-disc');plus.setAttribute('class','cluster-plus');el.append(disc,plus);
          el.setAttribute('role','button');el.dataset.i18nAria='smallCountriesCluster';
          cluster={el,disc,plus,group};clusterPool.set(key,cluster);
          el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(el.dataset.active==='true')openCluster(cluster);}});
        }
        cluster.group=group;cluster.el.dataset.members=key;cluster.el.dataset.local=String(detail>.8);activeClusters.add(key);clusters.push(cluster);
        const p=center(group),q=local(p),r=(6+5*detail)/scale,arm=4/scale;
        occupied.push(p);cluster.el.setAttribute('cx',q.x);cluster.el.setAttribute('cy',q.y);
        cluster.disc.setAttribute('cx',q.x);cluster.disc.setAttribute('cy',q.y);cluster.disc.setAttribute('r',r);
        cluster.plus.setAttribute('d',`M${q.x-arm},${q.y}H${q.x+arm} M${q.x},${q.y-arm}V${q.y+arm}`);
        cluster.el.setAttribute('aria-label',label('smallCountriesCluster'));reveal(cluster.el,true);
      }
      const shown=new Set(visible);
      for(const item of markers)if(!shown.has(item)){reveal(item.marker,false);item.core.style.opacity=0;setTimeout(()=>{if(item.marker.dataset.active==='false')item.core.style.display='none';},180);item.tether.style.display='none';}
      for(const [key,c] of clusterPool)if(!activeClusters.has(key)){
        if(c.el.dataset.active!=='false')reveal(c.el,false);
        // Keep a bounded pool while allowing opacity transitions to finish.
        if(clusterPool.size>240&&c.el.style.display==='none'){c.el.remove();clusterPool.delete(key);}
      }
      refreshHint();
    }
    function refreshHint(){
      const hint=svg.closest('#playing')?.querySelector('.map-zoom-hint [data-i18n]');
      if(hint){hint.dataset.i18n=clusters.length||visible.length?'mapSmallHint':'mapZoomHint';hint.textContent=label(hint.dataset.i18n);}
    }
    function openCluster(cluster){
      zoomGuardUntil=performance.now()+240;
      smallView.open(cluster.group);
    }
    function setView(next) {
      const w = Math.min(1200, Math.max(4, next.w)), h = w / 2;
      // Leave ocean padding at the dateline when zoomed, so islands stay clear of the controls.
      const oceanPadding=w<1200?w*.3:0;
      view = { x: Math.min(1200 - w + oceanPadding, Math.max(-oceanPadding, next.x)), y: Math.min(600 - h, Math.max(0, next.y)), w, h };
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
      if (marker && svg.contains(marker) && marker.dataset.active === 'true') return marker.dataset.iso;
      const real = target?.closest?.('path[data-iso]');
      const candidates=visible.filter(i=>{
        const p=markerScreenCenter(i.marker),half=type==='touch'?22:16;
        return i.marker.dataset.active==='true' && Math.abs(p.x-x)<=half && Math.abs(p.y-y)<=half;
      });
      // A local control is a deliberate 44px touch target and takes precedence over neighbouring polygons.
      if(candidates.some(i=>i.localTarget))return candidates.length===1?candidates[0].source.dataset.iso:null;
      if (real && svg.contains(real)) return real.dataset.iso;
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
        if (!moved && !multi && !cancelled && performance.now()>=zoomGuardUntil) {
          const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
          if(e.isTrusted && (!actualTarget || !svg.contains(actualTarget))){drag=pinch=null;return;}
          const hitTarget=actualTarget && svg.contains(actualTarget) ? actualTarget : p.target;
          if(hitTarget?.closest?.('.microstate-marker[data-active="false"], .microstate-cluster[data-active="false"]')){drag=pinch=null;return;}
          const directCluster=hitTarget?.closest?.('.microstate-cluster[data-active="true"]');
          const directMarker=hitTarget?.closest?.('.microstate-marker[data-active="true"]');
          const clusterCandidates=directMarker?[]:directCluster?clusters.filter(c=>c.el===directCluster):clusters.filter(c=>{const q=markerScreenCenter(c.el),half=p.type==='touch'?22:16;return (view.w<500||!hitTarget?.closest?.('path[data-iso]'))&&Math.abs(q.x-e.clientX)<=half&&Math.abs(q.y-e.clientY)<=half;});
          if(clusterCandidates.length>1){drag=pinch=null;return;}
          const cluster=clusterCandidates[0];
          if(cluster){openCluster(cluster);drag=pinch=null;return;}
          const iso = resolveCountry(actualTarget && svg.contains(actualTarget) ? actualTarget : p.target, e.clientX, e.clientY, p.type);
          if(iso){
            const item=visible.find(i=>i.source.dataset.iso===iso),q=item&&markerScreenCenter(item.marker),half=p.type==='touch'?22:16;
            if(item&&(directMarker||(Math.abs(q.x-e.clientX)<=half&&Math.abs(q.y-e.clientY)<=half))){zoomGuardUntil=performance.now()+240;smallView.open([item]);}
            else onGuess(iso);
          }
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
      if(svg.querySelector('.country-found,.country-correct'))smallView.close();
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
    return { zoom, celebrate, clearFound, reject, reset() { smallView.close(); zoomGuardUntil=0; pointers.clear(); drag = pinch = null; moved = multi = false; clearTried(); setView(base); }, getView: () => ({ ...view }), refreshHint, resolveCountry };
  }
  root.GeoFactMap = createMap;
})(globalThis);
