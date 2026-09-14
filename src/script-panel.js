// Keep the host's quick-reply nodes in place; popover only changes presentation.
export function mountScriptPanel(doc,win){
  const form=doc.getElementById('send_form');if(!form)return()=>{};
  const abort=new win.AbortController();
  const button=doc.createElement('button');button.id='cwn-script-crab';button.type='button';button.hidden=true;
  button.setAttribute('aria-label','脚本操作');button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');
  button.innerHTML='<span class="cwn-crab-body"></span><span class="cwn-crab-legs"></span>';
  form.append(button);
  let bar=null,saved=null,motion=null,leaveTimer=null,wasOpen=false;
  function cancelLeave(){win.clearTimeout(leaveTimer);}
  function leave(event){if(event.pointerType==='mouse'&&win.matchMedia('(min-width:701px)').matches){cancelLeave();leaveTimer=win.setTimeout(close,220);}}
  function close(){cancelLeave();if(bar?.classList.contains('cwn-panel-open'))bar.classList.remove('cwn-panel-open');button.setAttribute('aria-expanded','false');}
  function position(){
    if(!bar)return;const r=button.getBoundingClientRect(),width=Math.min(340,win.innerWidth-24);
    bar.style.width='max-content';bar.style.maxWidth=width+'px';bar.style.left='auto';bar.style.right='70px';bar.style.maxWidth=Math.min(width,Math.max(80,r.left-16))+'px';
    bar.style.top='auto';bar.style.bottom='calc(100% + 31px)';
    bar.style.maxHeight=Math.max(80,Math.min(180,r.top-24))+'px';
  }
  function restore(){if(!bar)return;close();bar.removeEventListener('toggle',toggle);bar.removeEventListener('pointerenter',cancelLeave);bar.removeEventListener('pointerleave',leave);bar.classList.remove('cwn-script-panel','cwn-panel-open');for(const [key,value]of Object.entries(saved)){if(value===null)bar.removeAttribute(key);else bar.setAttribute(key,value);}bar=null;}
  function toggle(){button.setAttribute('aria-expanded',String(bar?.classList.contains('cwn-panel-open')||false));}
  function content(){const available=!!bar?.querySelector('.qr--button,button,[role="button"]');button.hidden=!available;if(!available)close();}
  const contents=new win.MutationObserver(content);
  function bind(){const next=form.querySelector('#qr--bar');if(next===bar)return;contents.disconnect();restore();bar=next;if(!bar){button.hidden=true;return;}
    saved=Object.fromEntries(['popover','role','aria-label','style'].map(k=>[k,bar.getAttribute(k)]));
    bar.removeAttribute('popover');bar.setAttribute('role','dialog');bar.setAttribute('aria-label','脚本操作');bar.classList.add('cwn-script-panel');bar.addEventListener('toggle',toggle);bar.addEventListener('pointerenter',cancelLeave);bar.addEventListener('pointerleave',leave);
    contents.observe(bar,{childList:true,subtree:true});content();
  }
  button.addEventListener('pointerenter',cancelLeave,{signal:abort.signal});
  button.addEventListener('pointerleave',leave,{signal:abort.signal});
  button.addEventListener('pointerdown',()=>{button.dataset.pointerFocus='true';wasOpen=!!bar?.classList.contains('cwn-panel-open');},{signal:abort.signal});
  button.addEventListener('click',()=>{button.classList.remove('cwn-crab-squat');win.clearTimeout(motion);void button.offsetWidth;button.classList.add('cwn-crab-squat');motion=win.setTimeout(()=>button.classList.remove('cwn-crab-squat'),260);position();if(wasOpen){close();}else{bar?.classList.toggle('cwn-panel-open');toggle();}wasOpen=false;},{signal:abort.signal});
  doc.addEventListener('keydown',event=>{if(event.key==='Tab')delete button.dataset.pointerFocus;},{signal:abort.signal});
  doc.addEventListener('click',event=>{if(!bar?.contains(event.target)&&!button.contains(event.target))close();},{signal:abort.signal});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape')close();},{signal:abort.signal});
  win.addEventListener('resize',close,{signal:abort.signal});
  const observer=new win.MutationObserver(bind);observer.observe(form,{childList:true});bind();
  return()=>{observer.disconnect();contents.disconnect();cancelLeave();win.clearTimeout(motion);abort.abort();restore();button.remove();};
}









