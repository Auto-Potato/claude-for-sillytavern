import { createPanelTransition } from './panel-transition.js';
import { runLeaveGuard } from './leave-guard.js';

const EASE='cubic-bezier(.22,.61,.36,1)',DURATION=300;

export function mountPanelMotion({doc,win,rail,drawers,media,toggleDrawer}) {
  const abort=new win.AbortController(),signal=abort.signal;
  const previous=new Map(drawers.map(({panel})=>[panel,panel.inert]));
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  const opened=()=>drawers.find(({panel})=>panel.classList.contains('openDrawer'))?.panel||null;
  const desktop=()=>!media.matches;
  const layers=new Map();
  // Desktop panels stack like folded pages: rail, first level, second level.
  // A first level that leaves the stage folds its second level back with it.
  const fold=(panel,animate)=>{if(panel&&desktop())panel.cwnLevels?.collapse?.({animate});};
  rail.classList.add('cwn-panels-managed');
  const transition=createPanelTransition({
    initial:opened(),reduced:()=>reduced.matches,
    paint(from,to,moving){
      rail.classList.toggle('cwn-panel-in-motion',moving);
      for(const {panel} of drawers){
        const layer=panel===to?'front':panel===from?'base':'hidden';
        const before=layers.get(panel);
        if(layer==='hidden'&&before&&before!=='hidden')fold(panel,false);
        layers.set(panel,layer);
        panel.dataset.cwnPanelLayer=layer;
        panel.inert=previous.get(panel)||moving||layer==='hidden';
      }
    },
    animate(panel,entering,from){
      const timing={duration:DURATION,easing:EASE,fill:'both'};
      const visible={translate:'0 0',clipPath:'inset(0)'};
      if(!desktop()){
        const hidden={translate:'-100% 0',clipPath:'inset(0)'};
        return panel.animate(entering?[hidden,visible]:[visible,hidden],timing);
      }
      if(!entering){
        fold(panel,true);
        return panel.animate([visible,{translate:'-100% 0',clipPath:'inset(0 0 0 100%)'}],timing);
      }
      // The new first level emerges from under the rail with a soft leading
      // shadow. The clip extends past its right edge only to keep that shadow.
      const motion=panel.animate([
        {translate:'-100% 0',clipPath:'inset(0 -48px 0 100%)','--cwn-panel-shadow':'1'},
        {offset:.7,'--cwn-panel-shadow':'1'},
        {translate:'0 0',clipPath:'inset(0 -48px 0 0)','--cwn-panel-shadow':'0'},
      ],timing);
      if(!from||from===panel)return motion;
      // The covered page stays opaque (nothing behind it shows through) and
      // dims slightly. Any width beyond the new page retracts with the cover,
      // so no strip of a wider page disappears in one frame at the end.
      const spare=Math.max(0,from.offsetWidth-panel.offsetWidth);
      const under=from.animate([{clipPath:'inset(0)','--cwn-panel-dim':'0'},{clipPath:`inset(0 ${spare}px 0 0)`,'--cwn-panel-dim':'1'}],timing);
      fold(from,true);
      return {finished:motion.finished,cancel(){motion.cancel();under.cancel();}};
    },
  });
  // Close native state synchronously before opening the next drawer, so the
  // host sees no outgoing drawer to delay on. Visual state is owned above.
  rail.cwnSettlePanel=()=>{transition.select(opened());transition.settle();};
  function commit(entry){
    if(!desktop())transition.settle();
    const closing=entry.panel.classList.contains('openDrawer');
    if(!closing)for(const other of drawers)if(other!==entry&&other.panel.classList.contains('openDrawer'))void toggleDrawer(other.toggle);
    void toggleDrawer(entry.toggle);
    transition.select(opened());
  }
  // Unsaved second-level edits are resolved before the page may leave.
  let leaving=null;
  function toggle(entry){
    if(leaving)return;
    const current=desktop()?opened():null;
    const allowed=current?runLeaveGuard(current.cwnLevels):true;
    if(allowed===true){commit(entry);return;}
    if(allowed===false)return;
    leaving=allowed.then(ok=>{
      leaving=null;
      if(ok&&!signal.aborted&&opened()===current)commit(entry);
    });
  }
  const findEntry=target=>drawers.find(entry=>entry.toggle.contains(target));
  // Native html-level mousedown closes the old panel before the click when a
  // label is clicked. Prevent only that navigation path; keep normal controls.
  for(const type of ['mousedown','touchstart'])doc.addEventListener(type,event=>{if(findEntry(event.target))event.stopPropagation();},{capture:true,signal});
  doc.addEventListener('click',event=>{
    const entry=findEntry(event.target);if(!entry)return;
    event.preventDefault();event.stopImmediatePropagation();toggle(entry);
  },{capture:true,signal});
  // The host closes drawers on an outside mousedown at <html>, which would drop
  // unsaved second-level edits. With a pending draft, stop that press at <body>
  // (after the target's own handlers); the panel's outside click then asks first.
  for(const type of ['mousedown','touchstart'])doc.body.addEventListener(type,event=>{
    if(!desktop()||!opened()?.cwnLevels?.dirty?.())return;
    if(event.composedPath().includes(rail)||event.target.closest?.('dialog,.popup'))return;
    event.stopPropagation();
  },{signal});
  const observer=new win.MutationObserver(()=>transition.select(opened()));
  for(const {panel} of drawers)observer.observe(panel,{attributes:true,attributeFilter:['class']});
  win.addEventListener('resize',()=>transition.settle(),{signal});
  reduced.addEventListener('change',()=>transition.settle(),{signal});
  return()=>{abort.abort();observer.disconnect();transition.dispose();delete rail.cwnSettlePanel;rail.classList.remove('cwn-panels-managed','cwn-panel-in-motion');for(const {panel} of drawers){delete panel.dataset.cwnPanelLayer;panel.inert=previous.get(panel);}};
}
