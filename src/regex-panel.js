import { Popup, POPUP_TYPE } from '../../../../popup.js';
import { mountRegexEditor } from './regex-editor.js';

const groups=[
    {key:'global',block:'global_scripts_block',list:'saved_regex_scripts',title:'全局正则',hint:'所有角色可用',create:'open_regex_editor',move:'.move_to_global'},
    {key:'scoped',block:'scoped_scripts_block',list:'saved_scoped_scripts',title:'角色正则',hint:'跟随当前角色卡',create:'open_scoped_editor',move:'.move_to_scoped'},
    {key:'preset',block:'preset_scripts_block',list:'saved_preset_scripts',title:'预设正则',hint:'跟随当前预设',create:'open_preset_editor',move:'.move_to_preset'},
];

/** Keep native row listeners, scope checks, confirmation and persistence together. */
export function mountRegexPanel(doc,win,container,{button,icon}){
    const content=container.querySelector('.inline-drawer-content');
    if(!content||groups.some(g=>!doc.getElementById(g.list)))return ()=>{};
    const abort=new win.AbortController(),restore=[],added=new Set(),decorated=new Map();
    let query='',dragCleanup=()=>{},disposed=false,copying=false;
    const layout=doc.createElement('div');layout.className='ce-regex';
    layout.innerHTML=`<div class="ce-regex-toolbar">${button('regex-new','新建','plus','ce-outline')}${button('regex-import','导入','plus')}${button('regex-tools','更多操作','more','ce-icon')}</div><p class="ce-guide">拖动左侧把手，排序或移到其他分组。</p><input type="search" class="ce-search" placeholder="搜索正则" aria-label="搜索正则"><div class="ce-regex-summary"><span class="ce-guide ce-rule-total"></span><button type="button" class="ce-button" data-ce-action="regex-edit-mode" aria-pressed="false">编辑模式</button></div><div class="ce-regex-groups"></div><section class="ce-section ce-combinations"><h2>启用组合</h2></section>`;
    content.prepend(layout);container.classList.add('ce-regex-mounted');
    const disposeEditor=mountRegexEditor(doc,win,container,Popup);
    const relocate=(node,target)=>{const marker=doc.createComment('cwn-regex-home');node.before(marker);target.append(node);restore.push(()=>marker.replaceWith(node));};
    for(const group of groups){
        const block=doc.getElementById(group.block),list=doc.getElementById(group.list);
        const section=doc.createElement('section');section.className='ce-scope';section.dataset.ceScope=group.key;
        section.innerHTML=`<div class="ce-scope-heading"><button type="button" class="ce-fold" aria-expanded="true">${icon('right')}<span><strong>${group.title} <small class="ce-scope-count"></small></strong><small>${group.hint}</small></span></button><div class="ce-scope-permission"></div>${button('regex-new-'+group.key,'新建'+group.title,'plus','ce-icon')}</div><div class="ce-scope-list"></div>`;
        layout.querySelector('.ce-regex-groups').append(section);relocate(list,section.querySelector('.ce-scope-list'));
        const permission=block.querySelector('#toggle_scoped_regex,#toggle_preset_regex');
        if(permission){relocate(permission,section.querySelector('.ce-scope-permission'));permission.title='允许使用此范围的正则';}
        const empty=doc.createElement('p');empty.className='ce-empty';empty.textContent='暂无规则，可拖入或点击加号新建';section.querySelector('.ce-scope-list').append(empty);
        section.querySelector('.ce-fold').addEventListener('click',event=>{const control=event.currentTarget,open=control.getAttribute('aria-expanded')!=='true';control.setAttribute('aria-expanded',String(open));section.querySelector('.ce-scope-list').hidden=!open;},{signal:abort.signal});
    }
    const presets=doc.getElementById('regex_presets_block');if(presets)relocate(presets,layout.querySelector('.ce-combinations'));
    function refresh(){
        if(disposed)return;
        let total=0;
        for(const group of groups){
            const section=layout.querySelector(`[data-ce-scope="${group.key}"]`),list=doc.getElementById(group.list),rows=[...list.querySelectorAll(':scope > .regex-script-label')];total+=rows.length;
            const count=section.querySelector('.ce-scope-count');if(count.textContent!==String(rows.length))count.textContent=String(rows.length);
            for(const row of rows){
                if(!decorated.has(row)){
                    const name=row.querySelector('.regex_script_name');decorated.set(row,{name,role:name?.getAttribute('role'),tabindex:name?.getAttribute('tabindex')});
                    const handle=doc.createElement('button');handle.type='button';handle.className='ce-regex-drag';handle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12M6 12h12M6 16h12"/></svg>';handle.setAttribute('aria-label','拖动规则');row.prepend(handle);added.add(handle);
                    const move=doc.createElement('button');move.type='button';move.className='ce-button ce-icon ce-regex-move';move.innerHTML=icon('move');move.title='移动到其他范围';move.setAttribute('aria-label','移动规则');row.querySelector('.regex_script_name')?.after(move);added.add(move);
                    const copy=doc.createElement('button');copy.type='button';copy.className='ce-button ce-icon ce-regex-copy';copy.innerHTML=icon('copy');copy.title='复制规则';copy.setAttribute('aria-label','复制规则');move.after(copy);added.add(copy);
                    if(name){name.setAttribute('role','button');name.setAttribute('tabindex','0');}
                }
                row.hidden=!!query&&!row.querySelector('.regex_script_name')?.textContent.toLocaleLowerCase().includes(query);
            }
            section.querySelector('.ce-empty').hidden=rows.some(row=>!row.hidden);
        }
        for(const row of decorated.keys())if(!container.contains(row))decorated.delete(row);
        for(const node of added)if(!container.contains(node))added.delete(node);
        const summary=`${total} 条规则 · 3 个范围`,label=layout.querySelector('.ce-rule-total');if(label.textContent!==summary)label.textContent=summary;
    }
    const observer=new win.MutationObserver(refresh);
    for(const group of groups)observer.observe(doc.getElementById(group.list),{childList:true,subtree:true});refresh();
    const groupOf=row=>groups.find(g=>doc.getElementById(g.list)?.contains(row));
    async function moveTo(row,group){
        if(!row.isConnected||disposed||groupOf(row)===group)return;
        const native=row.querySelector(group.move);
        if(!native){win.toastr.warning('此范围暂不可用。');return;}
        // The host validates selected character / group chat and asks for confirmation.
        native.click();
    }
    async function chooseMove(row){
        const from=groupOf(row),body=doc.createElement('div');body.className='ce-move-picker';
        const title=doc.createElement('h3');title.textContent='移动规则';body.append(title);
        const name=doc.createElement('p');name.textContent=row.querySelector('.regex_script_name').textContent;body.append(name);
        const popup=new Popup(body,POPUP_TYPE.TEXT,'',{okButton:'取消'});
        for(const group of groups){const btn=doc.createElement('button');btn.type='button';btn.className='ce-move-choice';btn.textContent=group.title+(group===from?' · 当前位置':'');btn.disabled=group===from;
            btn.addEventListener('click',async()=>{await popup.completeCancelled();await moveTo(row,group);});body.append(btn);}
        const exportButton=doc.createElement('button');exportButton.type='button';exportButton.className='ce-move-choice';exportButton.textContent='导出此规则';exportButton.addEventListener('click',async()=>{await popup.completeCancelled();row.querySelector('.export_regex')?.click();});body.append(exportButton);
        await popup.show();
    }
    layout.addEventListener('input',event=>{if(event.target.matches('.ce-search')){query=event.target.value.trim().toLocaleLowerCase();refresh();}},{signal:abort.signal});
    layout.addEventListener('click',async event=>{
        if(event.target.closest('.ce-regex-copy')){
            if(copying)return;copying=true;
            try{
                const row=event.target.closest('.regex-script-label'),group=groupOf(row);
                const engine=await import('../../../../extensions/regex/engine.js');
                if(!row.isConnected||disposed)return;
                const type={global:engine.SCRIPT_TYPES.GLOBAL,scoped:engine.SCRIPT_TYPES.SCOPED,preset:engine.SCRIPT_TYPES.PRESET}[group.key];
                const scripts=engine.getScriptsByType(type),source=scripts.find(s=>s.id===row.id);if(!source)return;
                await engine.saveScriptsByType([...scripts,{...structuredClone(source),id:win.crypto.randomUUID(),scriptName:source.scriptName+' · 副本'}],type);
                // Reuse native save/reload with the original unchanged toggle value.
                if(row.isConnected)row.querySelector('.disable_regex').dispatchEvent(new win.Event('input',{bubbles:true}));
            }catch{win.toastr.error('复制未完成，请检查后重试。');}finally{copying=false;}return;
        }
        if(event.target.closest('.regex_script_name')){event.target.closest('.regex-script-label')?.querySelector('.edit_existing_regex')?.click();return;}
        if(event.target.closest('.ce-regex-move')){await chooseMove(event.target.closest('.regex-script-label'));return;}
        const action=event.target.closest('[data-ce-action]')?.dataset.ceAction;
        if(action==='regex-edit-mode'){const on=layout.classList.toggle('ce-edit-mode');event.target.closest('button').setAttribute('aria-pressed',String(on));event.target.closest('button').textContent=on?'完成':'编辑模式';}
        if(action==='regex-import')doc.getElementById('import_regex')?.click();
        if(action==='regex-new')doc.getElementById('open_regex_editor')?.click();
        const group=groups.find(g=>action==='regex-new-'+g.key);if(group)doc.getElementById(group.create)?.click();
        if(action==='regex-tools'){
            const body=doc.createElement('div');body.className='ce-move-picker';body.innerHTML='<h3>正则操作</h3>';
            const popup=new Popup(body,POPUP_TYPE.TEXT,'',{okButton:'关闭'});
            for(const [label,id] of [['调试器','open_regex_debugger'],['批量操作','regex_bulk_edit']]){const b=doc.createElement('button');b.className='ce-move-choice';b.textContent=label;b.onclick=async()=>{await popup.completeCancelled();doc.getElementById(id)?.click();};body.append(b);}await popup.show();
        }
    },{signal:abort.signal});
    layout.addEventListener('keydown',event=>{if(event.target.matches('.regex_script_name')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}},{signal:abort.signal});
    layout.addEventListener('pointerdown',event=>{
        const handle=event.target.closest('.ce-regex-drag');if(!handle||event.button!==0)return;
        event.stopPropagation();const row=handle.closest('.regex-script-label'),source=groupOf(row),list=row.parentElement;
        const scroll=container.closest('.ce-scroll'),panel=container.closest('#cwn-extensions-panel'),start={x:event.clientX,y:event.clientY};
        let active=false,point=start,ghost,bar,target,before,frame;
        handle.setPointerCapture(event.pointerId);
        function locate(){
            layout.querySelectorAll('.ce-drop-active,.ce-insert-before').forEach(n=>n.classList.remove('ce-drop-active','ce-insert-before'));bar?.querySelectorAll('.ce-drop-active').forEach(n=>n.classList.remove('ce-drop-active'));
            const hit=doc.elementFromPoint(point.x,point.y),zone=hit?.closest('[data-ce-drop],[data-ce-scope]');target=null;before=null;
            if(!zone||!panel.contains(zone))return;target=groups.find(g=>g.key===(zone.dataset.ceDrop||zone.dataset.ceScope));zone.classList.add('ce-drop-active');
            const over=hit.closest('.regex-script-label');if(over&&over!==row){const rect=over.getBoundingClientRect();before=point.y<rect.top+rect.height/2?over:over.nextElementSibling;if(before?.matches('.regex-script-label'))before.classList.add('ce-insert-before');else before=null;}
        }
        function tick(){const rect=scroll.getBoundingClientRect();if(point.x>rect.left&&point.x<rect.right){if(point.y>rect.bottom-48&&point.y<rect.bottom)scroll.scrollTop+=9;else if(point.y<rect.top+80&&point.y>rect.top+48)scroll.scrollTop-=9;}locate();frame=win.requestAnimationFrame(tick);}
        function moving(e){point={x:e.clientX,y:e.clientY};if(!active&&Math.hypot(point.x-start.x,point.y-start.y)<6)return;
            if(!active){active=true;row.classList.add('ce-drag-source');ghost=doc.createElement('div');ghost.className='ce-drag-ghost';ghost.textContent=row.querySelector('.regex_script_name').textContent;doc.body.append(ghost);
                bar=doc.createElement('div');bar.className='ce-dropbar';for(const g of groups){const b=doc.createElement('div');b.dataset.ceDrop=g.key;b.textContent=g.title;bar.append(b);}panel.append(bar);frame=win.requestAnimationFrame(tick);}
            ghost.style.left=`${point.x+12}px`;ghost.style.top=`${point.y+12}px`;locate();e.preventDefault();}
        async function finish(e){const destination=target,insertion=before;cleanup();if(!active||e.type!=='pointerup'||!destination||!row.isConnected)return;
            if(destination!==source){await moveTo(row,destination);return;}
            if(insertion===row)return;list.insertBefore(row,insertion);
            // Preserve ST's sortable stop callback: it persists this scope and reloads rows/chat.
            const stop=win.jQuery(list).sortable('option','stop');if(typeof stop==='function')try{await stop.call(list);}catch{win.toastr.error('排序保存失败，请刷新后重试。');}
        }
        function escape(e){if(e.key==='Escape')finish(e);}
        function cleanup(){win.cancelAnimationFrame(frame);ghost?.remove();bar?.remove();row.classList.remove('ce-drag-source');layout.querySelectorAll('.ce-drop-active,.ce-insert-before').forEach(n=>n.classList.remove('ce-drop-active','ce-insert-before'));handle.removeEventListener('pointermove',moving);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);doc.removeEventListener('keydown',escape);if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);dragCleanup=()=>{};}
        dragCleanup=cleanup;handle.addEventListener('pointermove',moving);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);doc.addEventListener('keydown',escape);
    },{signal:abort.signal});
    return()=>{disposed=true;disposeEditor();dragCleanup();abort.abort();observer.disconnect();for(const {name,role,tabindex} of decorated.values()){if(!name)continue;for(const [attr,value] of [['role',role],['tabindex',tabindex]])if(value===null)name.removeAttribute(attr);else name.setAttribute(attr,value);}added.forEach(n=>n.remove());for(const group of groups)doc.getElementById(group.list)?.querySelectorAll('.regex-script-label').forEach(row=>row.hidden=false);for(const undo of restore.reverse())undo();layout.remove();container.classList.remove('ce-regex-mounted');};
}
