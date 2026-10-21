/** Close native menus via their triggers, preserving the host's private state. */
export function mountComposerMenuDismiss(doc,win) {
  const abort=new win.AbortController();
  const pairs=[['options','options_button'],['extensionsMenu','extensionsMenuButton']];
  function close(menu,button){
    if(!menu||!button)return;
    // Finish a pending native fade before reading visibility or toggling again.
    win.jQuery?.(menu).stop(true,true);
    if(win.getComputedStyle(menu).display==='none')return;
    button.click();
    win.jQuery?.(menu).stop(true,true);
  }
  function dismiss(event){
    for(const [menuId,buttonId] of pairs){
      const menu=doc.getElementById(menuId),button=doc.getElementById(buttonId);
      const path=event.composedPath();
      if(path.includes(menu)||path.includes(button))continue;
      close(menu,button);
    }
  }
  // Capture survives sidebar handlers which stop propagation. Do not cancel
  // the outside click: the user's intended navigation must still happen.
  let dismissing=false;
  doc.addEventListener('click',event=>{
    if(dismissing)return;
    dismissing=true;try{dismiss(event);}finally{dismissing=false;}
  },{capture:true,signal:abort.signal});
  doc.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    dismissing=true;try{for(const [m,b] of pairs)close(doc.getElementById(m),doc.getElementById(b));}finally{dismissing=false;}
  },{capture:true,signal:abort.signal});
  return()=>abort.abort();
}
