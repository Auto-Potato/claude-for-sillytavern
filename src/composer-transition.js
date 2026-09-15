// Animate the same composer; outgoing controls are inert visual snapshots only.
export function createComposerTransition(doc,win) {
  let previous, animations=[], ghosts=[];
  function clear(){for(const a of animations)a.cancel();animations=[];for(const g of ghosts)g.remove();ghosts=[];}
  const controls=()=>['options_button','cwn-regenerate','extensionsMenuButton','cwn-composer-context'].map(id=>doc.getElementById(id)).filter(e=>e&&e.getBoundingClientRect().width&&win.getComputedStyle(e).display!=='none');
  function snapshot(el){
    const clone=el.cloneNode(true),src=[el,...el.querySelectorAll('*')],dst=[clone,...clone.querySelectorAll('*')];
    src.forEach((node,i)=>{const style=win.getComputedStyle(node);dst[i].removeAttribute('id');for(const prop of ['display','align-items','justify-content','gap','padding','margin','width','height','font-family','font-size','font-weight','line-height','color','background','border','border-radius','opacity'])dst[i].style.setProperty(prop,style.getPropertyValue(prop));});
    const pseudo=win.getComputedStyle(el,'::before');
    if(pseudo.content && pseudo.content!=='none' && pseudo.content!=='normal'){
      const icon=doc.createElement('span');
      for(const prop of ['display','width','height','font-family','font-size','font-weight','line-height','color','background','mask'])icon.style.setProperty(prop,pseudo.getPropertyValue(prop));
      icon.textContent=pseudo.content.replace(/^['"]|['"]$/g,'');
      clone.className='';clone.prepend(icon);
    }
    clone.inert=true;clone.setAttribute('aria-hidden','true');return clone;
  }
  return {
    prepare(next){
      if(previous===undefined||previous===next){previous=next;return ()=>{};}
      previous=next;
      const form=doc.getElementById('send_form');
      if(!form||win.matchMedia('(prefers-reduced-motion: reduce)').matches){clear();return ()=>{};}
      const before=form.getBoundingClientRect();
      const old=controls().map(el=>({el:snapshot(el),rect:el.getBoundingClientRect()}));
      clear();
      return ()=>{
        const after=form.getBoundingClientRect();
        if(win.innerWidth>700){
          const dy=before.top-after.top,dx=before.left-after.left;
          animations.push(form.animate([{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],{duration:360,easing:'cubic-bezier(.22,.8,.3,1)'}));
        }
        for(const {el,rect} of old){
          Object.assign(el.style,{position:'absolute',left:`${rect.left-before.left}px`,top:`${rect.top-before.top}px`,margin:'0',pointerEvents:'none',zIndex:'5'});
          form.append(el);ghosts.push(el);
          const animation=el.animate([{translate:'0px 0px',opacity:1},{translate:'-28px 0px',opacity:0}],{duration:150,fill:'forwards',easing:'ease-in'});
          animation.onfinish=()=>el.remove();animations.push(animation);
        }
        for(const el of controls())animations.push(el.animate([{translate:'24px 0px',filter:'opacity(0)'},{translate:'0px 0px',filter:'opacity(1)'}],{duration:200,delay:120,fill:'backwards',easing:'ease-out'}));
      };
    },dispose:clear,
  };
}