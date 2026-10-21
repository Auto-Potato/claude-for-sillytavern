/** Refresh only after every managed batch finishes, and recheck after saving. */
export function createExtensionRefresh({canReload, prepare, reload, notify, schedule, cancel}) {
    let active=0, needed=false, failed=false, disposed=false, timer=null;
    function queue() {
        if(disposed || active || !needed)return;
        if(timer!==null)cancel(timer);
        timer=schedule(async()=>{
            timer=null;
            if(disposed || active || !needed)return;
            if(failed || !canReload()) {
                needed=false;
                notify('主题已更新。当前有未完成操作或草稿，请稍后手动刷新。');
                return;
            }
            try { await prepare(); }
            catch { needed=false;notify('主题已更新，但保存未完成，请确认聊天已保存后手动刷新。');return; }
            if(disposed)return;
            if(active){queue();return;}
            if(failed || !canReload()){needed=false;notify('主题已更新，请稍后手动刷新。');return;}
            needed=false;
            reload();
        },750);
    }
    return {
        updated(){needed=true;queue();},
        failed(){failed=true;},
        async run(task){
            active++;
            if(timer!==null){cancel(timer);timer=null;}
            try{return await task();}
            catch(error){failed=true;throw error;}
            finally{active--;queue();}
        },
        dispose(){disposed=true;if(timer!==null)cancel(timer);},
    };
}
