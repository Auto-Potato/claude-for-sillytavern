import { createPanelTransition } from './panel-transition.js';

export function mountPanelMotion({doc,win,rail,drawers,media,toggleDrawer}) {
  const abort=new win.AbortController(),signal=abort.signal;
  const previous=new Map(drawers.map(({panel})=>[panel,panel.inert]));
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  const opened=()=>drawers.find(({panel})=>panel.classList.contains('openDrawer'))?.panel||null;
  rail.classList.add('cwn-panels-managed');
  const transition=createPanelTransition({
    initial:opened(),reduced:()=>reduced.matches,
    paint(from,to,moving){
      rail.classList.toggle('cwn-panel-in-motion',moving);
      for(const {panel} of drawers){
        const layer=panel===to?'front':panel===from?'base':'hidden';
        panel.dataset.cwnPanelLayer=layer;
        panel.inert=previous.get(panel)||moving||layer==='hidden';
      }
    },
    animate(panel,entering){
      const hidden={translate:'-100% 0',clipPath:media.matches?'inset(0)':'inset(0 0 0 100%)'};
      const visible={translate:'0 0',clipPath:'inset(0)'};
      return panel.animate(entering?[hidden,visible]:[visible,hidden],{duration:300,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});
    },
  });
  // Close native state synchronously before opening the next drawer, so the
  // host sees no outgoing drawer to delay on. Visual state is owned above.
  function toggle(entry){
    const closing=entry.panel.classList.contains('openDrawer');
    if(!closing)for(const other of drawers)if(other!==entry&&other.panel.classList.contains('openDrawer'))void toggleDrawer(other.toggle);
    void toggleDrawer(entry.toggle);
    transition.select(opened());
  }
  const findEntry=target=>drawers.find(entry=>entry.toggle.contains(target));
  // Native html-level mousedown closes the old panel before the click when a
  // label is clicked. Prevent only that navigation path; keep normal controls.
  for(const type of ['mousedown','touchstart'])doc.addEventListener(type,event=>{if(findEntry(event.target))event.stopPropagation();},{capture:true,signal});
  doc.addEventListener('click',event=>{
    const entry=findEntry(event.target);if(!entry)return;
    event.preventDefault();event.stopImmediatePropagation();toggle(entry);
  },{capture:true,signal});
  const observer=new win.MutationObserver(()=>transition.select(opened()));
  for(const {panel} of drawers)observer.observe(panel,{attributes:true,attributeFilter:['class']});
  win.addEventListener('resize',()=>transition.settle(),{signal});
  reduced.addEventListener('change',()=>transition.settle(),{signal});
  return()=>{abort.abort();observer.disconnect();transition.dispose();rail.classList.remove('cwn-panels-managed','cwn-panel-in-motion');for(const {panel} of drawers){delete panel.dataset.cwnPanelLayer;panel.inert=previous.get(panel);}};
}
