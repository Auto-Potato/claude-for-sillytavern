// One same-document entry per visible navigation layer. Closing UI consumes the
// same entries as browser Back, so it never leaves invisible extra Back steps.
export function createMenuHistory({history, read, closeOne, dismissPopup, listen, onError}) {
  const key='cwnMenuDepth';
  let depth=Number.isInteger(history.state?.[key])?history.state[key]:0;
  let moving=false, applying=false, disposed=false;
  const state=n=>({...history.state,[key]:n});
  if(!Number.isInteger(history.state?.[key]))history.replaceState(state(0),'');
  function grow(target){while(depth<target)history.pushState(state(++depth),'');}
  function sync(){
    if(disposed||moving||applying)return;
    const target=read();
    if(target<depth){moving=true;history.go(target-depth);}
    else grow(target);
  }
  const unlisten=listen(async event=>{
    if(disposed)return;
    const target=Number.isInteger(event.state?.[key])?event.state[key]:0;
    depth=target;
    if(moving){moving=false;sync();return;}
    if(applying){await dismissPopup?.();return;}
    applying=true;
    try {
      while(read()>target){
        const previous=read();
        if(!await closeOne()||read()>=previous)break;
      }
    } catch(error){onError(error);}
    finally {
      applying=false;
      // A cancelled discard dialog restores the entries, retaining the draft.
      if(read()>depth)grow(read());
      // Forward never resurrects a panel the user explicitly dismissed.
      else if(read()<depth){depth=read();history.replaceState(state(depth),'');}
    }
  });
  sync();
  return {sync,dispose(){disposed=true;unlisten();}};
}
