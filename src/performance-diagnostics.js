// Opt-in, bounded diagnostics. Never record URLs, names, content or request bodies.
let active=null;
const routes=new Map([['/api/settings/get','settings'],['/api/worldinfo/get','worldbook'],['/api/characters/get','character']]);
export function safeResource(entry,origin){
  let url;try{url=new URL(entry.name);}catch{return null;}
  const route=url.origin===origin&&routes.get(url.pathname);
  if(!route)return null;
  return {type:'request',route,start:entry.startTime,ms:entry.duration,bytes:entry.decodedBodySize||0};
}
export function diagnosticStep(label,details={}){
  const session=active;if(!session)return()=>{};
  const start=session.win.performance.now();
  return()=>{if(active===session)session.add({type:'stage',label,start,ms:session.win.performance.now()-start,...details});};
}
export function diagnosticFrame(label){
  const session=active;if(!session)return;
  const end=diagnosticStep(label);
  // A scheduling estimate, not proof that pixels have reached the display.
  session.win.requestAnimationFrame(()=>session.win.requestAnimationFrame(end));
}
export function mountPerformanceDiagnostics(doc,win){
  const host=doc.querySelector('#cwn-extensions-panel .ce-theme');if(!host)return()=>{};
  const button=doc.createElement('button');button.type='button';button.className='ce-button';button.textContent='性能诊断';host.after(button);
  const bar=doc.createElement('div');bar.hidden=true;bar.className='cwn-diagnostic-bar';
  bar.innerHTML='<span role="status"></span><button type="button" data-export>停止并导出</button><button type="button" data-cancel>取消</button>';
  doc.body.append(bar);
  const status=bar.querySelector('span');
  let session=null,timer,observers=[],urls=new Set();
  function collect(list){
    if(!session||active!==session)return;
    for(const entry of list.getEntries()){
      if(entry.startTime<session.started)continue;
      if(entry.entryType==='resource'){const row=safeResource(entry,win.location.origin);if(row)session.add(row);}
      else session.add({type:'long-task',start:entry.startTime,ms:entry.duration});
    }
  }
  function stop(){
    for(const observer of observers){collect({getEntries:()=>observer.takeRecords()});observer.disconnect();}
    observers=[];win.clearTimeout(timer);if(active===session)active=null;
    if(session)session.elapsed=win.performance.now()-session.started;
    button.disabled=false;
  }
  button.onclick=()=>{
    stop();session={win,started:win.performance.now(),rows:[],dropped:0,supported:[],add(row){if(this.rows.length<600)this.rows.push(row);else this.dropped++;}};
    active=session;button.disabled=true;bar.hidden=false;status.textContent='记录中：请打开世界书或角色卡（最多 60 秒）';
    for(const type of ['resource','longtask']){
      if(!win.PerformanceObserver?.supportedEntryTypes?.includes(type))continue;
      try{const observer=new win.PerformanceObserver(collect);observer.observe({type,buffered:false});observers.push(observer);session.supported.push(type);}catch{}
    }
    timer=win.setTimeout(()=>{stop();status.textContent='记录已停止，可以导出';},60000);
  };
  bar.querySelector('[data-cancel]').onclick=()=>{stop();session=null;bar.hidden=true;};
  bar.querySelector('[data-export]').onclick=()=>{
    if(!session)return;if(active===session)stop();
    const report={schema:1,viewport:{width:win.innerWidth,height:win.innerHeight,dpr:win.devicePixelRatio},elapsedMs:session.elapsed,supported:session.supported,dropped:session.dropped,
      notes:['Times are milliseconds. Frame stages estimate scheduling, not actual paint. Resource bytes may be unavailable.'],
      events:session.rows.map(row=>({...row,start:Math.round((row.start-session.started)*100)/100,ms:Math.round(row.ms*100)/100}))};
    const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(report,null,2)],{type:'application/json'}));urls.add(url);
    const link=doc.createElement('a');link.href=url;link.download='claude-performance-diagnostic.json';doc.body.append(link);link.click();link.remove();
    win.setTimeout(()=>{win.URL.revokeObjectURL(url);urls.delete(url);},30000);
    status.textContent='记录已停止；若未下载，可再次点击导出';
  };
  return()=>{stop();session=null;button.remove();bar.remove();for(const url of urls)win.URL.revokeObjectURL(url);};
}
