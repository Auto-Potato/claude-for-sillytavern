// One same-document entry per visible navigation layer. Closing UI consumes the
// same entries as browser Back, so it never leaves invisible extra Back steps.
export function createMenuHistory({history, read, closeOne, dismissPopup, listen, onError, protectRoot=()=>false}) {
  const key='cwnMenuDepth';
  const guardKey='cwnMenuRootGuard';
  let depth=Number.isInteger(history.state?.[key])?history.state[key]:0;
  let moving=false, applying=false, disposed=false;
  let requested=0;
  const state=n=>({...history.state,[key]:n});
  if(!Number.isInteger(history.state?.[key]))history.replaceState(state(0),'');
  function grow(target){while(depth<target)history.pushState(state(++depth),'');}
  function ensureRoot(){
    if(!protectRoot()||depth!==0||history.state?.[guardKey])return;
    // One anchor below welcome. Reuse it on reload rather than stacking guards.
    history.replaceState({...state(-1),[guardKey]:true},'');
    history.pushState({...state(0),[guardKey]:true},'');
  }
  function sync(){
    if(disposed||moving||applying)return;
    ensureRoot();
    const target=read();
    if(target<depth){moving=true;history.go(target-depth);}
    else grow(target);
  }
  const unlisten=listen(async event=>{
    if(disposed)return;
    const target=Number.isInteger(event.state?.[key])?event.state[key]:0;
    const steps=Math.max(0,depth-target);
    depth=target;
    if(moving){moving=false;sync();return;}
    if(applying){
      requested=Math.max(0,requested-steps);
      // Keep local history available while an async close or discard prompt
      // is pending. Extra gestures are queued, not lost or time-throttled.
      grow(read());
      try{await dismissPopup?.();}catch(error){onError(error);}
      return;
    }
    applying=true;
    requested=Math.max(0,target);
    grow(read());
    try {
      while(!disposed&&read()>requested){
        const previous=read();
        if(!await closeOne()||read()>=previous)break;
      }
    } catch(error){onError(error);}
    finally {
      applying=false;
      if(disposed)return;
      // A cancelled discard dialog restores the entries, retaining the draft.
      if(read()>depth)grow(read());
      // Forward never resurrects a panel the user explicitly dismissed.
      else if(read()<depth){moving=true;history.go(read()-depth);}
    }
  });
  sync();
  return {sync,dispose(){disposed=true;unlisten();}};
}
