import { Popup } from '../../../../popup.js';
import { createMenuHistory } from './menu-history.js';

export function mountBrowserNavigation(doc,win) {
  const root=doc.documentElement,rail=doc.getElementById('top-settings-holder');
  const library=doc.getElementById('cwn-character-library');
  const shell=doc.getElementById('sheld');
  const chatOpen=()=>win.innerWidth<=700&&!!shell?.cwnNavigation?.isChat();
  const panels=[...rail.querySelectorAll('.drawer > .drawer-content')];
  const panel=()=>panels.find(p=>p.classList.contains('openDrawer'));
  const popups=()=>Popup.util.popups.filter(p=>p.dlg.open&&!p.dlg.hasAttribute('closing'));
  const railOpen=()=>win.innerWidth<=700?root.classList.contains('cwn-menu-open'):!root.classList.contains('cwn-rail-hidden');
  const read=()=>{
    const p=panel();
    return (chatOpen()?1:0)+(railOpen()||p?1:0)+(p?1:0)+(p?.id==='right-nav-panel'&&library?.cwnNavigation?.isDetail()?1:0)+popups().length;
  };
  const controller=createMenuHistory({history:win.history,read,
    dismissPopup:async()=>{await popups().at(-1)?.completeCancelled();},
    listen:fn=>{win.addEventListener('popstate',fn);return()=>win.removeEventListener('popstate',fn);},
    onError:error=>{console.error('[Claude navigation]',error);win.toastr.error('返回未完成，请重试');},
    closeOne:async()=>{
      const popup=popups().at(-1);
      if(popup){await popup.completeCancelled();return true;}
      const p=panel();
      if(p?.id==='right-nav-panel'&&library?.cwnNavigation?.isDetail())return library.cwnNavigation.back();
      if(p){p.querySelector('.cwn-panel-back')?.click();return true;}
      if(railOpen()){doc.getElementById(win.innerWidth<=700?'cwn-menu':'cwn-desktop-rail-icon')?.click();return true;}
      if(chatOpen())return shell.cwnNavigation.back();
      return false;
    },
  });
  const observer=new win.MutationObserver(()=>controller.sync());
  observer.observe(root,{attributes:true,attributeFilter:['class']});
  if(shell)observer.observe(shell,{attributes:true,attributeFilter:['class']});
  panels.forEach(p=>observer.observe(p,{attributes:true,attributeFilter:['class']}));
  if(library)observer.observe(library,{childList:true});
  // Native popup dialogs are direct body children; watch their open state only.
  const dialogs=new win.MutationObserver(()=>{watchDialogs();controller.sync();});
  function watchDialogs(){for(const p of Popup.util.popups)observer.observe(p.dlg,{attributes:true,attributeFilter:['open','closing']});}
  dialogs.observe(doc.body,{childList:true});watchDialogs();
  win.addEventListener('resize',controller.sync);
  return()=>{observer.disconnect();dialogs.disconnect();win.removeEventListener('resize',controller.sync);controller.dispose();};
}
