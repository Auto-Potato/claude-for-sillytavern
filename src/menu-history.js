// One same-document entry per visible navigation layer. Closing UI consumes the
// same entries as browser Back, so it never leaves invisible extra Back steps.
export function createMenuHistory({history, read, closeOne, dismissPopup, listen, onError, protectRoot=()=>false}) {
  const key='cwnMenuDepth';
  const guardKey='cwnMenuRootGuard';
  const guardValue='layered-v1';
  let depth=Number.isInteger(history.state?.[key])?history.state[key]:0;
  let moving=false, applying=false, disposed=false, restoring=false, rooted=false;
  let requested=0;
  const hadRootGuard=history.state?.[guardKey]===guardValue&&depth===0;
  const state=n=>({...history.state,[key]:n,...(protectRoot()?{[guardKey]:guardValue}:{})});
  if(!Number.isInteger(history.state?.[key]))history.replaceState(state(0),'');
  function grow(target){while(depth<target)history.pushState(state(++depth),'');}
  function ensureRoot(){
    if(!protectRoot())return;
    if(rooted&&history.state?.[guardKey]===guardValue&&depth>=0)return;
    rooted=true;
    // Reuse an existing root guard when reloading at the welcome layer.
    if(hadRootGuard)return;
    // Keep one anchor below depth 0 so Back at welcome stays in-app, while
    // every open layer above 0 still gets its own entry and back preview.
    history.replaceState(state(-1),'');
    depth=-1;
    grow(0);
  }
  function sync(){
    if(disposed||moving||applying||restoring)return;
    ensureRoot();
    const target=read();
    if(target<depth){moving=true;history.go(target-depth);}
    else grow(target);
  }
  function reconcileAfterBack(){
    if(disposed||applying||restoring)return;
    // A cancelled discard dialog restores the entries, retaining the draft.
    // On mobile, step forward onto existing entries rather than calling
    // pushState in popstate (which triggers crbug.com/1248529).
    if(read()>depth){
      if(protectRoot()){moving=true;history.go(read()-depth);}
      else grow(read());
    }
    // Forward never resurrects a panel the user explicitly dismissed.
    else if(read()<depth){moving=true;history.go(read()-depth);}
  }
  const unlisten=listen(async event=>{
    if(disposed)return;
    const target=Number.isInteger(event.state?.[key])?event.state[key]:0;
    if(protectRoot()&&restoring&&target>=0){
      depth=target;restoring=false;
      reconcileAfterBack();
      return;
    }
    if(protectRoot()&&target<0){
      const steps=Math.max(1,depth-target);
      depth=0;
      if(!restoring){restoring=true;history.go(1);}
      if(applying){
        requested=Math.max(0,requested-steps);
        try{await dismissPopup?.();}catch(error){onError(error);}
        return;
      }
      if(read()<=0)return;
      applying=true;requested=Math.max(0,read()-steps);
      try{
        while(!disposed&&read()>requested){
          const previous=read();
          if(!await closeOne()||read()>=previous)break;
        }
      }catch(error){onError(error);}
      finally{
        applying=false;
        reconcileAfterBack();
      }
      return;
    }
    const steps=Math.max(0,depth-target);
    depth=target;
    if(moving){moving=false;sync();return;}
    if(applying){
      requested=Math.max(0,requested-steps);
      // Keep local history available while an async close or discard prompt
      // is pending. Extra gestures are queued, not lost or time-throttled.
      if(!protectRoot())grow(read());
      try{await dismissPopup?.();}catch(error){onError(error);}
      return;
    }
    applying=true;
    requested=Math.max(0,target);
    if(!protectRoot())grow(read());
    try {
      while(!disposed&&read()>requested){
        const previous=read();
        if(!await closeOne()||read()>=previous)break;
      }
    } catch(error){onError(error);}
    finally {
      applying=false;
      reconcileAfterBack();
    }
  });
  sync();
  return {sync,dispose(){disposed=true;unlisten();}};
}
