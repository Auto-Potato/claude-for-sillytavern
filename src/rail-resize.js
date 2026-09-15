export function mountRailResize(doc,win,rail,media) {
  const root=doc.documentElement,abort=new win.AbortController();
  const previous=root.style.getPropertyValue('--cwn-rail');
  const priority=root.style.getPropertyPriority('--cwn-rail');
  const grip=doc.createElement('div');grip.id='cwn-rail-grip';grip.tabIndex=0;
  grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');
  grip.setAttribute('aria-label','调整侧边栏宽度');
  grip.setAttribute('aria-valuemin','190');grip.setAttribute('aria-valuemax','420');
  doc.body.append(grip);
  let active=null, moveFrame=0, pendingWidth=null;
  function apply(value){
    const width=Math.min(420,Math.max(190,value));
    root.style.setProperty('--cwn-rail',`${width}px`);
    grip.setAttribute('aria-valuenow',String(Math.round(width)));
  }
  function save(){try{win.localStorage.setItem('cwn-rail-width',String(rail.getBoundingClientRect().width));}catch{}}
  try{const saved=Number(win.localStorage.getItem('cwn-rail-width'));if(Number.isFinite(saved)&&saved>0)apply(saved);}catch{}
  const on=(target,type,fn)=>target.addEventListener(type,fn,{signal:abort.signal});
  on(grip,'pointerdown',event=>{
    if(media.matches || event.button!==0)return;
    event.preventDefault();active=event.pointerId;grip.setPointerCapture(active);
    root.classList.add('cwn-rail-resizing');
  });
  on(grip,'pointermove',event=>{if(active!==event.pointerId)return;pendingWidth=event.clientX;if(!moveFrame)moveFrame=win.requestAnimationFrame(()=>{moveFrame=0;apply(pendingWidth);pendingWidth=null;});});
  function end(){if(active===null)return;win.cancelAnimationFrame(moveFrame);moveFrame=0;if(pendingWidth!==null){apply(pendingWidth);pendingWidth=null;}active=null;root.classList.remove('cwn-rail-resizing');save();}
  on(grip,'pointerup',end);on(grip,'pointercancel',end);on(grip,'lostpointercapture',end);
  on(media,'change',end);
  on(grip,'keydown',event=>{
    if(media.matches || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    apply(event.key==='Home'?190:event.key==='End'?420:rail.getBoundingClientRect().width+(event.key==='ArrowLeft'?-10:10));save();
  });
  return ()=>{win.cancelAnimationFrame(moveFrame);abort.abort();grip.remove();root.classList.remove('cwn-rail-resizing');
    if(previous)root.style.setProperty('--cwn-rail',previous,priority);else root.style.removeProperty('--cwn-rail');};
}