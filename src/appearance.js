const KEY='claude-theme-next.appearance';
const MODES=['light','dark','system'];

export function mountAppearance(doc,win) {
  const root=doc.documentElement,previous=root.getAttribute('data-cwn-theme');
  const abort=new win.AbortController(),media=win.matchMedia('(prefers-color-scheme: dark)');
  let mode='light';
  const metas=[...doc.head.querySelectorAll('meta[name="theme-color"]')];
  const saved=metas.map(node=>({node,content:node.getAttribute('content'),media:node.getAttribute('media')}));
  const created=!metas.length;
  if(created){const node=doc.createElement('meta');node.name='theme-color';doc.head.append(node);metas.push(node);}
  function syncBrowserColor(){
    // Use the same token as the mobile header, including explicit theme choice.
    const color=win.getComputedStyle(root).getPropertyValue('--cwn-bg').trim();
    if(!color)return;
    for(const node of metas){
      node.removeAttribute('media');
      if(node.getAttribute('content')!==color)node.setAttribute('content',color);
    }
  }
  // The native theme editor also writes this meta tag; keep our active palette.
  const observer=new win.MutationObserver(syncBrowserColor);
  for(const node of metas)observer.observe(node,{attributes:true,attributeFilter:['content','media']});
  try{const saved=win.localStorage.getItem(KEY);if(MODES.includes(saved))mode=saved;}catch{}
  function render(){root.setAttribute('data-cwn-theme',mode==='system'?(media.matches?'dark':'light'):mode);syncBrowserColor();}
  win.addEventListener('storage',event=>{if(event.key===KEY&&MODES.includes(event.newValue)){mode=event.newValue;render();}},{signal:abort.signal});
  doc.addEventListener('cwn-appearance-change',event=>{if(MODES.includes(event.detail)){mode=event.detail;try{win.localStorage.setItem(KEY,mode);}catch{}render();}},{signal:abort.signal});
  media.addEventListener('change',()=>{if(mode==='system')render();},{signal:abort.signal});
  render();
  return ()=>{
    abort.abort();observer.disconnect();
    if(created)metas[0].remove();
    else for(const {node,content,media} of saved){
      for(const [name,value] of [['content',content],['media',media]]){
        if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);
      }
    }
    if(previous===null)root.removeAttribute('data-cwn-theme');else root.setAttribute('data-cwn-theme',previous);
  };
}
