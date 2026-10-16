/** Dock the native regex dialog without replacing its fields, validation or save. */
export function mountRegexEditor(doc,win,container,Popup){
    const original=Popup.prototype.show,abort=new win.AbortController();
    let active=true,pending=null,opened=null;
    const scroll=container.closest('.ce-scroll');
    function capture(event){
        const edit=event.target.closest('.edit_existing_regex');
        const create=event.target.closest('#open_regex_editor,#open_scoped_editor,#open_preset_editor');
        if(!edit&&!create)return;
        const row=edit?.closest('.regex-script-label');
        const list=row?.parentElement||doc.getElementById(create.id==='open_scoped_editor'?'saved_scoped_scripts':create.id==='open_preset_editor'?'saved_preset_scripts':'saved_regex_scripts');
        pending={row,list,at:Date.now()};
    }
    async function show(...args){
        if(!active||!pending||Date.now()-pending.at>5000||!this.content?.querySelector('#regex_editor_template'))return original.apply(this,args);
        const target=pending;pending=null;
        if(opened)await opened.completeCancelled();
        if(!active||!target.list?.isConnected||!container.closest('.ce-detail:not([hidden])'))return original.apply(this,args);
        const popup=this;opened=popup;
        const savedOpen=popup.dlg.showModal;
        popup.dlg.classList.add('ce-inline-regex-editor');
        popup.dlg.showModal=function(){
            const scope=target.list.closest('.ce-scope-list');if(scope){scope.hidden=false;scope.closest('.ce-scope').querySelector('.ce-fold').setAttribute('aria-expanded','true');}
            if(target.row?.isConnected)target.row.after(this);else target.list.prepend(this);
            this.show();
        };
        try{
            const result=original.apply(popup,args);
            popup.dlg.showModal=savedOpen;
            if(scroll){scroll.scrollTop+=popup.dlg.getBoundingClientRect().top-scroll.getBoundingClientRect().top-16;}
            return await result;
        }finally{popup.dlg.showModal=savedOpen;if(opened===popup)opened=null;}
    }
    Popup.prototype.show=show;
    container.addEventListener('click',capture,{capture:true,signal:abort.signal});
    container.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&!doc.querySelector('dialog[open]:not(.ce-inline-regex-editor)')){event.preventDefault();event.stopPropagation();void opened.completeCancelled();}},{signal:abort.signal});
    // A native redraw can detach the row; resolve its pending editor rather than leak it.
    const observer=new win.MutationObserver(()=>{if(opened&&!opened.dlg.hasAttribute('closing')&&!container.contains(opened.dlg))void opened.completeCancelled();});
    observer.observe(container,{childList:true,subtree:true});
    return()=>{active=false;abort.abort();observer.disconnect();if(opened)void opened.completeCancelled();if(Popup.prototype.show===show)Popup.prototype.show=original;};
}
