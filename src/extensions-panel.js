import { extensionNames, extensionTypes, getExtensionManifest, extension_settings, enableExtension, disableExtension } from '../../../../extensions.js';
import { getRequestHeaders, saveSettingsDebounced, isGenerating, isChatSaving, saveChatConditional, getCurrentChatId, chat } from '../../../../../script.js';
import { isAdmin, getCurrentUserHandle } from '../../../../user.js';
import { Popup } from '../../../../popup.js';
import { mountRegexPanel } from './regex-panel.js';
import { eligibleUpdates, createExtensionUpdater } from './extension-updates.js';
import { createExtensionRefresh } from './extension-refresh.js';

const paths = {
    back:'m15 5-7 7 7 7',plus:'M12 5v14M5 12h14',right:'m9 6 6 6-6 6',more:'M5 12h.01M12 12h.01M19 12h.01',
    settings:'M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 7h6',helper:'M8 3h8M12 3v3M4 7h16v12H4zM8 11v2M16 11v2M9 16h6',
    regex:'m7 7-4 5 4 5m10-10 4 5-4 5M14 4l-4 16',extension:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    refresh:'M3 4v6h6M3 10a9 9 0 1 1 1 8',move:'M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4',
    copy:'M9 9h11v11H9zM15 5V3H3v12h2',
};
export const exIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.extension}"/></svg>`;
export const exButton = (action,label,icon,cls='') => `<button type="button" class="ce-button ${cls}" data-ce-action="${action}" aria-label="${label}" title="${label}">${exIcon(icon)}<span>${label}</span></button>`;
const names = {assets_container:'下载扩展和资源',typing_indicator_container:'输入提示器',expressions_container:'角色表情',sd_container:'图像生成',tts_container:'语音朗读',qr_container:'快速回复',translation_container:'聊天翻译',caption_container:'图片描述',summarize_container:'总结',vectors_container:'向量存储'};
const hints = {tavern_helper:'前端渲染、脚本与角色卡工具',regex_container:'文本替换、显示处理与规则管理'};

/** ST 1.19 / Helper 4.9.5: retain live native nodes and their event ownership. */
export function mountExtensionsPanel(doc,win) {
    const panel=doc.getElementById('rm_extensions_block');
    const sources=['extensions_settings','extensions_settings2'].map(id=>doc.getElementById(id));
    if(!panel || sources.some(node=>!node)) return ()=>{};
    const abort=new win.AbortController(),restores=[],entries=new Map();
    let disposed=false,current='home',regexDispose=()=>{},busy=false;
    const root=doc.createElement('div');root.id='cwn-extensions-panel';root.dataset.depth='0';
    root.innerHTML=`<nav class="ce-nav">${exButton('back','返回侧边栏','back','ce-icon')}</nav><div class="ce-scroll">
      <section class="ce-home"><header class="ce-heading"><h1>扩展</h1><div>${exButton('install','安装','plus','ce-outline')}${exButton('manage','管理','settings')}</div></header>
      <div class="ce-theme"><svg class="ce-crab" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 8h18v4h4v5h-4v7h-3v-5h-4v5h-4v-5h-4v5H7v-7H3v-5h4z"/><path class="ce-crab-eyes" d="M11 10h3v3h-3zm8 0h3v3h-3z"/></svg><div class="ce-grow"><h3>Claude for SillyTavern</h3><p>界面主题</p></div><label class="ce-switch ce-theme-switch"><span class="ce-sr">启用 Claude for SillyTavern</span></label></div>
      <p class="ce-label">常用扩展</p><div class="ce-common"></div><section class="ce-section"><h2>其他扩展</h2><div class="ce-others"></div></section>
      </section>
      <section class="ce-detail" hidden><header class="ce-heading"><h1></h1><div class="ce-detail-actions"></div></header><div class="ce-detail-slot"></div></section>
      <section class="ce-management" hidden></section><div class="ce-parking" hidden></div></div>`;
    panel.append(root);panel.classList.add('cwn-extensions-mounted');
    const scroll=root.querySelector('.ce-scroll'),parking=root.querySelector('.ce-parking');
    const move=(node,target)=>{if(!node)return;const marker=doc.createComment('cwn-extension-home');node.before(marker);target.append(node);restores.push(()=>marker.replaceWith(node));};
    const enabled=doc.getElementById('cwn-enabled');move(enabled,root.querySelector('.ce-theme-switch'));
    root.querySelector('.ce-theme-switch').insertAdjacentHTML('beforeend','<i aria-hidden="true"></i>');
    // Deprecated Extras API controls stay in the hidden native panel.
    // Keep native nodes intact so disabling the theme restores the host UI.
    function discover(){
        if(disposed)return;
        for(const source of sources)for(const node of [...source.children]){
            if(node.id==='cwn-extension-settings'||entries.has(node)||!node.id||!node.children.length)continue;
            const header=node.querySelector('.inline-drawer-header b,.inline-drawer-header strong,.inline-drawer-header');
            const label=node.id==='tavern_helper'?'酒馆助手':node.id==='regex_container'?'正则':names[node.id]||header?.textContent.trim();
            if(!label)continue;
            const entry={node,label};entries.set(node,entry);move(node,parking);
            if(!hints[node.id])node.classList.add('ce-generic-extension');
            const row=doc.createElement('button');row.type='button';row.className='ce-feature';row.dataset.ceEntry=node.id;
            row.innerHTML=`<span class="ce-feature-icon">${exIcon(node.id==='tavern_helper'?'helper':node.id==='regex_container'?'regex':'extension')}</span><span class="ce-grow"><span class="ce-item-title"></span><small></small></span>${exIcon('right')}`;
            row.querySelector('.ce-item-title').textContent=label;row.querySelector('small').textContent=hints[node.id]||'';
            root.querySelector(hints[node.id]?'.ce-common':'.ce-others').append(row);entry.row=row;
            if(node.id==='regex_container')regexDispose=mountRegexPanel(doc,win,node,{button:exButton,icon:exIcon});
        }
    }
    const observer=new win.MutationObserver(discover);for(const source of sources)observer.observe(source,{childList:true,subtree:true});discover();
    function park(){for(const {node} of entries.values())if(node.parentNode!==parking)parking.append(node);}
    function show(page,entry){
        for(const popup of Popup.util.popups)if(popup.dlg.classList.contains('ce-inline-regex-editor')&&popup.dlg.open&&!popup.dlg.hasAttribute('closing'))void popup.completeCancelled();
        park();current=page;root.dataset.depth=page==='home'?'0':'1';root.dataset.page=page;
        root.querySelector('.ce-home').hidden=page!=='home';root.querySelector('.ce-detail').hidden=page!=='detail';root.querySelector('.ce-management').hidden=page!=='manage';
        root.querySelector('.ce-nav').classList.toggle('ce-home-nav',page==='home');
        root.querySelector('[data-ce-action="back"]').setAttribute('aria-label',page==='home'?'返回侧边栏':'返回扩展');
        if(entry){
            root.querySelector('.ce-detail h1').textContent=entry.label;
            root.querySelector('.ce-detail-slot').append(entry.node);entry.node.classList.add('ce-native-open');
            // Opening the original top drawer preserves third-party lazy setup.
            const content=entry.node.querySelector('.inline-drawer-content');
            if(content && win.getComputedStyle(content).display==='none')entry.node.querySelector('.inline-drawer-toggle')?.click();
            // Flatten only the outer wrapper, never a nested settings group.
            let drawer=entry.node;
            while(!drawer.matches('.inline-drawer')&&drawer.children.length===1)drawer=drawer.firstElementChild;
            const header=drawer.matches('.inline-drawer')?drawer.querySelector(':scope > .inline-drawer-header'):null;
            if(header&&!header.querySelector('input,select,textarea,button,a[href],[role=switch]'))drawer.classList.add('ce-root-drawer');
        }
        if(page==='manage')renderManagement();scroll.scrollTop=0;
    }
    const settings=extension_settings.claude_for_sillytavern??={};
    const preferences=settings.extensionAutoUpdates??={};
    // Updates from other entry points may have their own asynchronous hooks.
    // If observed, leave refreshing to the user instead of guessing completion.
    const originalFetch=win.fetch;
    let externalUpdate=false, checkingChatSave=false, chatSaveSucceeded=false;
    const observedFetch=function(input,...args){
        let chatSave=false;
        try {
            const url=new URL(typeof input==='string'?input:input.url || String(input),win.location.href);
            if(url.origin===win.location.origin && /^\/api\/extensions\/(update|install|delete)$/.test(url.pathname))externalUpdate=true;
            chatSave=checkingChatSave&&url.origin===win.location.origin&&/^\/api\/chats\/(group\/)?save$/.test(url.pathname);
        } catch {/* Preserve native fetch validation. */}
        const result=originalFetch.call(this,input,...args);
        return chatSave?result.then(response=>{chatSaveSucceeded=response.ok;return response;}):result;
    };
    win.fetch=observedFetch;
    const refresh=createExtensionRefresh({
        canReload:()=>!disposed&&!externalUpdate&&!isGenerating()&&!isChatSaving
            &&!doc.getElementById('send_textarea')?.value.trim()
            &&!doc.getElementById('file_form_input')?.files?.length
            &&!doc.getElementById('embed_file_input')?.files?.length
            &&!doc.querySelector('#chat .edit_textarea,dialog[open],#form_sheld.isExecutingCommandsFromChatInput')
            &&root.dataset.page==='manage',
        prepare:async()=>{
            if(!getCurrentChatId()||!chat.length)return;
            checkingChatSave=true;chatSaveSucceeded=false;
            try{await saveChatConditional();if(!chatSaveSucceeded)throw new Error('Chat save not confirmed');}
            finally{checkingChatSave=false;}
        },
        reload:()=>win.location.reload(),
        notify:message=>{if(!disposed)win.toastr.info(message);},
        schedule:(fn,delay)=>win.setTimeout(fn,delay),cancel:id=>win.clearTimeout(id),
    });
    const inventory=()=>extensionNames.map(id=>({id,manifest:getExtensionManifest(id),type:extensionTypes[id],enabled:!extension_settings.disabledExtensions.includes(id)})).filter(x=>x.manifest).sort((a,b)=>(b.id.endsWith('/claude-theme-next')?1:0)-(a.id.endsWith('/claude-theme-next')?1:0)||a.manifest.display_name.localeCompare(b.manifest.display_name));
    const updater=createExtensionUpdater({
        request:async(url,body)=>{const response=await originalFetch.call(win,url,{method:'POST',headers:getRequestHeaders(),body:JSON.stringify(body),signal:win.AbortSignal.timeout(60000)});if(!response.ok)throw new Error('扩展更新失败，请检查网络或本地改动。');return response.json();},
        runHook:async item=>{
            const hook=item.manifest.hooks?.update;if(!hook||!item.manifest.js)return;
            // Same module path and five-second hook limit as ST extensions.js.
            const mod=await import(`/scripts/extensions/${item.id}/${item.manifest.js}`);
            if(typeof mod[hook]!=='function')return;
            let timer;try{await Promise.race([Promise.resolve(mod[hook]()),new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(new Error('扩展更新后处理尚未完成，请稍后手动刷新。')),5000);})]);}finally{win.clearTimeout(timer);}
        },
        onUpdated:item=>{if(!disposed){win.toastr.success('扩展已更新，刷新页面后生效。');if(item.id.endsWith('/claude-theme-next'))refresh.updated();}},
    });
    async function update(item,quiet=false){
        if(item.type==='global'&&!isAdmin())throw new Error('当前账号不能更新全局安装的扩展。');
        const data=await updater(item);if(!quiet&&!disposed&&data.isUpToDate)win.toastr.success('已是最新版本');return data;
    }
    function renderManagement(){
        const view=root.querySelector('.ce-management');view.innerHTML=`<header class="ce-heading"><h1>管理扩展</h1>${exButton('install','安装','plus','ce-outline')}</header>
        <div class="ce-setting"><div class="ce-grow"><h3>更新通知</h3><p>发现扩展更新时提醒。</p></div><label class="ce-switch"><input type="checkbox" data-ce-notify aria-label="更新通知"><i></i></label></div>
        <section class="ce-section"><div class="ce-heading"><h2>已安装</h2>${exButton('update-all','更新全部','refresh','ce-outline')}</div><p class="ce-guide">自动更新：打开酒馆时检查，每天最多一次。酒馆升级时原有的更新机制保持不变。</p><div class="ce-installed"></div></section>
        <section class="ce-section"><h2>内置扩展</h2><p class="ce-guide">随酒馆版本更新</p><div class="ce-builtin"></div></section>
        <div class="ce-end">${exButton('native-manage','更多管理','more','ce-outline')}</div>`;
        view.querySelector('[data-ce-notify]').checked=extension_settings.notifyUpdates;
        for(const item of inventory()){
            const third=item.id.startsWith('third-party/'),row=doc.createElement('article');row.className='ce-managed-item';row.dataset.extensionId=item.id;
            row.innerHTML=`<div class="ce-setting"><div class="ce-grow"><h3></h3><p></p></div><label class="ce-switch"><input type="checkbox" data-ce-enabled><i></i></label></div>${third?`<div class="ce-manage-options"><label class="ce-auto-label"><input type="checkbox" data-ce-auto><span>自动更新</span></label>${exButton('update','检查更新','refresh')}</div>`:''}`;
            const label=item.manifest.display_name;row.querySelector('h3').textContent=label;row.querySelector('p').textContent=item.manifest.version?`v${item.manifest.version}`:'';
            const check=row.querySelector('[data-ce-enabled]');check.checked=item.enabled;check.setAttribute('aria-label',`启用 ${label}`);
            if(third){const auto=row.querySelector('[data-ce-auto]');auto.checked=preferences[item.id]?.enabled===true;auto.setAttribute('aria-label',`${label} 自动更新`);if(item.type==='global'&&!isAdmin()){auto.disabled=true;row.querySelector('[data-ce-action="update"]').disabled=true;}}
            view.querySelector(third?'.ce-installed':'.ce-builtin').append(row);
        }
    }
    root.addEventListener('change',async event=>{
        const input=event.target,item=inventory().find(x=>x.id===input.closest('[data-extension-id]')?.dataset.extensionId);
        if(input.matches('[data-ce-notify]')){const original=doc.getElementById('extensions_notify_updates');original.checked=input.checked;original.dispatchEvent(new win.Event('input',{bubbles:true}));}
        if(input.matches('[data-ce-auto]')&&item){preferences[item.id]={...preferences[item.id],enabled:input.checked};saveSettingsDebounced();}
        if(input.matches('[data-ce-enabled]')&&item){
            const requested=input.checked;input.checked=item.enabled;input.disabled=true;
            try{if(await Popup.show.confirm(requested?'启用此扩展？':'关闭此扩展？','页面将刷新以应用更改。'))await(requested?enableExtension:disableExtension)(item.id);}catch{win.toastr.error('扩展状态修改失败，请重试。');}finally{input.disabled=false;}
        }
    },{signal:abort.signal});
    root.addEventListener('click',async event=>{
        const row=event.target.closest('[data-ce-entry]');if(row){const entry=[...entries.values()].find(x=>x.node.id===row.dataset.ceEntry);if(entry)show('detail',entry);return;}
        const target=event.target.closest('[data-ce-action]'),action=target?.dataset.ceAction;if(!action)return;
        if(action==='back'){if(current==='home')panel.querySelector('.cwn-panel-back')?.click();else show('home');}
        if(action==='manage')show('manage');
        if(action==='install')doc.getElementById('third_party_extension_button')?.click();
        if(action==='native-manage')doc.getElementById('extensions_details')?.click();
        if(action==='update'||action==='update-all'){
            if(busy)return;
            const items=inventory().filter(x=>x.id.startsWith('third-party/')&&(action==='update-all'||x.id===target.closest('[data-extension-id]')?.dataset.extensionId));
            if(action==='update-all'&&!await Popup.show.confirm('更新全部扩展？','更新完成后需刷新页面。'))return;
            busy=true;target.disabled=true;
            try{await refresh.run(async()=>{for(const item of items)await update(item);});}catch(error){win.toastr.error(error.message);}finally{busy=false;target.disabled=false;}
        }
    },{signal:abort.signal});
    root.cwnNavigation={depth:()=>current==='home'?0:1,back:()=>{show('home');return true;}};
    show('home');
    const timer=win.setTimeout(async()=>{
        const account=getCurrentUserHandle()||'default';
        const run=async()=>{for(const item of eligibleUpdates(inventory(),preferences,Date.now(),isAdmin())){
            if(disposed)break;
            // Cross-tab daily throttle. This stores only account-scoped extension IDs and dates.
            const key=`cwn-extension-update:${account}:${item.id}`;
            try{const last=Number(win.localStorage.getItem(key))||0;if(Date.now()-last<86400000)continue;win.localStorage.setItem(key,String(Date.now()));}catch{/* Settings still provide a per-session fallback. */}
            preferences[item.id].lastAttempt=Date.now();saveSettingsDebounced();
            try{await update(item,true);}catch{refresh.failed();if(!disposed)win.toastr.warning(`${item.manifest.display_name} 自动更新失败，可在管理扩展中重试。`);}
        }};
        if(win.navigator.locks)await win.navigator.locks.request(`cwn-extension-auto-update:${account}`,{ifAvailable:true},lock=>lock?refresh.run(run):undefined);else await refresh.run(run);
    },3000);
    return()=>{disposed=true;refresh.dispose();if(win.fetch===observedFetch)win.fetch=originalFetch;win.clearTimeout(timer);abort.abort();observer.disconnect();regexDispose();for(const {node} of entries.values()){node.classList.remove('ce-native-open','ce-generic-extension','ce-root-drawer');node.querySelectorAll('.ce-root-drawer').forEach(drawer=>drawer.classList.remove('ce-root-drawer'));}for(const restore of restores.reverse())restore();root.remove();panel.classList.remove('cwn-extensions-mounted');};
}
