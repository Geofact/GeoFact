(function(root){
  'use strict';
  // The inset uses the original geography only as context. Only its buttons can answer.
  root.GeoFactSmallTerritoryView=function({svg,items,onGuess,label,onClose}){
    const ns='http://www.w3.org/2000/svg';
    const dialog=document.createElement('dialog');dialog.className='small-territory-dialog';
    dialog.innerHTML='<header><h2 id="smallTerritoryTitle" data-i18n="smallViewTitle"></h2><button type="button" class="small-view-close" data-i18n-aria="smallViewClose">×</button></header><div class="small-view-frame"><svg class="small-view-map" aria-hidden="true"></svg><div class="small-view-targets"></div></div><div class="small-view-controls"><button type="button" data-zoom="in" data-i18n-aria="zoomIn">+</button><button type="button" data-zoom="out" data-i18n-aria="zoomOut">−</button></div><p id="smallTerritoryHelp" data-i18n="smallViewHint"></p>';
    dialog.setAttribute('aria-labelledby','smallTerritoryTitle');dialog.setAttribute('aria-describedby','smallTerritoryHelp');
    (svg.closest('.map-wrap')||svg.parentNode).appendChild(dialog);
    const frame=dialog.querySelector('.small-view-frame'),map=dialog.querySelector('svg'),targets=dialog.querySelector('.small-view-targets');
    let choices=[],view=null,initial=null,controls=[],openedAt=0,revision=0,cameraFrame=null;
    const pointers=new Map();let gesture=null,moved=false,multi=false;
    const close=()=>{cancelAnimationFrame(cameraFrame);cameraFrame=null;pointers.clear();gesture=null;moved=multi=false;if(dialog.open){onClose?.();dialog.close();}};
    dialog.querySelector('.small-view-close').addEventListener('click',close);
    dialog.addEventListener('close',()=>{cancelAnimationFrame(cameraFrame);cameraFrame=null;pointers.clear();gesture=null;onClose?.();});
    dialog.addEventListener('cancel',()=>{cancelAnimationFrame(cameraFrame);cameraFrame=null;pointers.clear();gesture=null;});
    // Closing the backdrop is explicit and cannot reach the main map behind it.
    dialog.addEventListener('click',e=>{if(e.target===dialog&&performance.now()-openedAt>=240){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    function translate(){
      for(const el of dialog.querySelectorAll('[data-i18n]'))el.textContent=label(el.dataset.i18n);
      for(const el of dialog.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',label(el.dataset.i18nAria));
    }
    function dimensions(){return {w:frame.clientWidth,h:frame.clientHeight};}
    function fit(group){
      const {w:width,h:height}=dimensions(),xs=group.map(i=>i.anchor.x),ys=group.map(i=>i.anchor.y);
      const spanX=Math.max(...xs)-Math.min(...xs),spanY=Math.max(...ys)-Math.min(...ys);
      const w=Math.max(4,spanX*width/Math.max(1,width-100),spanY*width/Math.max(1,height-100));
      return {x:(Math.min(...xs)+Math.max(...xs))/2-w/2,y:(Math.min(...ys)+Math.max(...ys))/2-w*height/width/2,w};
    }
    function setView(next){view=next;render();}
    function animateView(next){
      cancelAnimationFrame(cameraFrame);cameraFrame=null;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){setView(next);return;}
      const start={...view},time=performance.now();
      const tick=now=>{const t=Math.min(1,(now-time)/180),e=1-Math.pow(1-t,3);setView({x:start.x+(next.x-start.x)*e,y:start.y+(next.y-start.y)*e,w:start.w+(next.w-start.w)*e});cameraFrame=t<1?requestAnimationFrame(tick):null;};
      cameraFrame=requestAnimationFrame(tick);
    }
    function render(){
      if(!dialog.open||!view)return;
      const {w:width,h:height}=dimensions();if(!width||!height)return;
      const scale=width/view.w,h=height/scale;
      map.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${h}`);
      const project=i=>({x:(i.anchor.x-view.x)*scale,y:(i.anchor.y-view.y)*scale});
      // 48 CSS pixels remain 48 CSS pixels through camera zoom and resizing.
      const points=choices.map(item=>({item,...project(item)})).filter(p=>p.x>=24&&p.x<=width-24&&p.y>=24&&p.y<=height-24);
      const groups=points.map(p=>[p]);
      const center=g=>({x:g.reduce((s,p)=>s+p.x,0)/g.length,y:g.reduce((s,p)=>s+p.y,0)/g.length});
      const overlaps=(a,b)=>Math.abs(a.x-b.x)<52&&Math.abs(a.y-b.y)<52;
      let merged=true;
      while(merged){merged=false;
        outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
          if(groups[i].some(a=>groups[j].some(b=>overlaps(a,b)))||overlaps(center(groups[i]),center(groups[j]))){groups[i].push(...groups[j]);groups.splice(j,1);merged=true;break outer;}
        }
      }
      for(const l of map.querySelectorAll('.small-view-tether'))l.remove();
      targets.replaceChildren();controls=[];revision++;
      const occupied=[];
      function button(group,p,cluster){
        const el=document.createElement('button');el.type='button';el.className='small-view-target';el.dataset.kind=cluster?'cluster':'country';
        el.dataset.members=group.map(p=>p.item.source.dataset.iso).join('|');
        if(!cluster)el.dataset.country=group[0].item.source.dataset.iso;
        el.setAttribute('aria-label',label(cluster?'smallViewGroup':'smallViewTarget'));
        el.style.left=p.x+'px';el.style.top=p.y+'px';
        const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');dot.textContent=cluster?'+':'';
        if(!cluster){if(group[0].item.source.classList.contains('country-tried'))el.classList.add('small-view-tried');if(group[0].item.source.classList.contains('country-found'))el.classList.add('small-view-found');}
        el.appendChild(dot);targets.appendChild(el);occupied.push(p);controls.push({el,group,p,cluster});
        el.addEventListener('click',e=>{if(e.detail===0)activate(controls.find(c=>c.el===el));});
      }
      for(const group of groups){
        if(group.length===1){button(group,group[0],false);continue;}
        if(view.w>4.01){button(group,center(group),true);continue;}
        // Exceptional coincident points at the hard zoom limit: separate safely, with short geographic tethers.
        const positions=[];
        for(const point of group){let chosen=null;
          for(let ring=0;ring<6&&!chosen;ring++)for(let step=0;step<16&&!chosen;step++){
            const a=step*Math.PI/8,p={x:point.x+ring*56*Math.cos(a),y:point.y+ring*56*Math.sin(a)};
            if(p.x>=24&&p.x<=width-24&&p.y>=24&&p.y<=height-24&&[...occupied,...positions,...groups.filter(g=>g!==group).map(center)].every(q=>!overlaps(p,q)))chosen=p;
          }
          if(!chosen){positions.length=0;break;}positions.push(chosen);
        }
        if(positions.length===group.length){group.forEach((point,i)=>{
          const p=positions[i];if(Math.hypot(p.x-point.x,p.y-point.y)>1){const line=document.createElementNS(ns,'line');line.classList.add('small-view-tether');line.setAttribute('x1',point.item.anchor.x);line.setAttribute('y1',point.item.anchor.y);line.setAttribute('x2',view.x+p.x/scale);line.setAttribute('y2',view.y+p.y/scale);map.appendChild(line);}button([point],p,false);
        });}
      }
    }
    function activate(control){
      if(!control||!dialog.open||performance.now()-openedAt<240)return;
      if(control.cluster){openedAt=performance.now();const next=fit(control.group.map(p=>p.item));const w=Math.min(view.w*.65,next.w),ratio=frame.clientHeight/frame.clientWidth;animateView({x:next.x+(next.w-w)/2,y:next.y+(next.w-w)*ratio/2,w});return;}
      const iso=control.group[0].item.source.dataset.iso;close();onGuess(iso);
    }
    function coordinate(x,y){const r=frame.getBoundingClientRect(),s=view.w/r.width;return{x:view.x+(x-r.left)*s,y:view.y+(y-r.top)*s};}
    function zoom(factor,x,y,animate=false){
      openedAt=performance.now();cancelAnimationFrame(cameraFrame);cameraFrame=null;
      const r=frame.getBoundingClientRect(),a=coordinate(x??r.x+r.width/2,y??r.y+r.height/2),w=Math.max(4,Math.min(initial.w*3,view.w/factor)),ratio=w/view.w;
      const next={x:a.x-(a.x-view.x)*ratio,y:a.y-(a.y-view.y)*ratio,w};if(animate)animateView(next);else setView(next);
    }
    for(const button of dialog.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>zoom(button.dataset.zoom==='in'?1.6:1/1.6,undefined,undefined,true));
    function begin(){
      const pts=[...pointers.values()];
      if(pts.length>=2){multi=moved=true;const [a,b]=pts;gesture={view:{...view},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchor:coordinate((a.x+b.x)/2,(a.y+b.y)/2)};}
      else if(pts.length){const p=pts[0];gesture={view:{...view},x:p.x,y:p.y,scale:frame.clientWidth/view.w};}
    }
    frame.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();cancelAnimationFrame(cameraFrame);cameraFrame=null;
      if(!pointers.size)moved=multi=false;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,revision});
      try{frame.setPointerCapture(e.pointerId);}catch{/* Synthetic test pointer. */}begin();
    });
    frame.addEventListener('pointermove',e=>{
      const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.startX,p.y-p.startY)>8)moved=true;
      const pts=[...pointers.values()];
      if(pts.length>=2){const [a,b]=pts,w=Math.max(4,Math.min(initial.w*3,gesture.view.w*gesture.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)))),r=frame.getBoundingClientRect(),s=w/r.width;
        setView({x:gesture.anchor.x-((a.x+b.x)/2-r.left)*s,y:gesture.anchor.y-((a.y+b.y)/2-r.top)*s,w});
      }else if(moved)setView({x:gesture.view.x-(p.x-gesture.x)/gesture.scale,y:gesture.view.y-(p.y-gesture.y)/gesture.scale,w:gesture.view.w});
    });
    function end(e,cancel=false){
      const p=pointers.get(e.pointerId);if(!p)return;if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>8)moved=true;
      pointers.delete(e.pointerId);if(cancel)moved=multi=true;
      if(!pointers.size){
        if(!cancel&&!moved&&!multi&&p.revision===revision){const r=frame.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,candidates=controls.filter(c=>Math.abs(c.p.x-x)<=24&&Math.abs(c.p.y-y)<=24);if(candidates.length===1)activate(candidates[0]);}
        gesture=null;
      }else begin();
    }
    frame.addEventListener('pointerup',e=>end(e));frame.addEventListener('pointercancel',e=>end(e,true));frame.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))end(e,true);});
    frame.addEventListener('wheel',e=>{e.preventDefault();if(pointers.size)moved=true;zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.005),e.clientX,e.clientY);},{passive:false});
    new ResizeObserver(()=>{if(dialog.open&&view){for(const l of map.querySelectorAll('.small-view-tether'))l.remove();render();}}).observe(frame);
    return {close,open(seed){
      close();translate();
      // Small neighbours remain anonymous, regardless of the country's question or game mode.
      choices=items.filter(i=>(i.source.classList.contains('territory-detail')||i.area<24)&&(seed.includes(i)||(i.area<4&&seed.some(s=>Math.hypot(i.anchor.x-s.anchor.x,i.anchor.y-s.anchor.y)<12))));
      if(!choices.length)return;
      map.replaceChildren();const ocean=document.createElementNS(ns,'rect');ocean.setAttribute('x','-1200');ocean.setAttribute('y','-600');ocean.setAttribute('width','3600');ocean.setAttribute('height','1800');ocean.setAttribute('fill','#dceef1');map.appendChild(ocean);
      for(const source of svg.querySelectorAll('path.country-shape,path.territory-detail')){const shape=source.cloneNode(true);shape.dataset.context=source.dataset.iso;shape.removeAttribute('data-iso');shape.removeAttribute('id');shape.classList.remove('country-correct','country-wrong');map.appendChild(shape);}
      dialog.showModal();openedAt=performance.now();
      const fitted=fit(choices),minimum=16;const w=Math.max(minimum,fitted.w),ratio=frame.clientHeight/frame.clientWidth;
      initial={x:fitted.x+(fitted.w-w)/2,y:fitted.y+(fitted.w-w)*ratio/2,w};setView(initial);
    }};
  };
})(globalThis);
