// Keep the previous surface painted until the replacement fully covers it.
// Rapid navigation keeps only the latest requested destination in the queue.
export function createPanelTransition({initial=null, paint, animate, reduced=()=>false}) {
  let shown=initial, wanted=initial, running=null, disposed=false, revision=0;
  paint(shown,null,false);
  function settle(){
    revision++;
    running?.cancel();running=null;shown=wanted;
    paint(shown,null,false);
  }
  function pump(){
    if(disposed||running||shown===wanted)return;
    if(reduced()){settle();return;}
    const from=shown,to=wanted,stamp=++revision;
    paint(from,to,true);
    const motion=animate(to||from,!!to);running=motion;
    motion.finished.catch(()=>{}).then(()=>{
      if(disposed||stamp!==revision)return;
      // Set final visibility before cancelling the animation's filled frame.
      shown=to;paint(shown,null,false);running=null;motion.cancel();pump();
    });
  }
  return {
    select(panel){wanted=panel;pump();},
    settle,
    dispose(){disposed=true;revision++;running?.cancel();running=null;},
  };
}
