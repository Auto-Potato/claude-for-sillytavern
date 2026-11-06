// API connection panel. Native controls (and their listeners, values and
// secrets handling) are moved into a theme layout, never cloned or replaced.
const paths = {
    back: 'm15 5-7 7 7 7',
    check: 'm5 12 4 4L19 6',
    plug: 'M9 7V3m6 4V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5',
    send: 'M4 12 20 4l-6 16-3-7z',
    studio: 'M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z',
    chevron: 'm6 9 6 6 6-6',
    cloud: 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;

/** Common sources shown as cards; everything else stays in the full list. */
export const featuredSources = [
    { value: 'makersuite', name: 'Google AI Studio', note: '填入 API 密钥即可使用 Gemini', symbol: 'studio' },
    { value: 'vertexai', name: 'Google Vertex AI', note: 'Service Account JSON 或快速模式密钥', symbol: 'cloud' },
];

/** Which provider view shows a source: the featured cards or the full list. */
export function providerMode(value) {
    return featuredSources.some(source => source.value === value) ? 'featured' : 'all';
}

/** Short connection state for the heading badge. The host can leave the
 *  indicator's success class from its template while showing "no connection". */
export function connectionState(indicator, text, noConnectionText) {
    const on = !!indicator?.classList.contains('success') && !!text && text !== noConnectionText;
    return on ? { on: true, label: '已连接' } : { on: false, label: '未连接' };
}

export function mountApiPanel(doc, win) {
    const block = doc.getElementById('rm_api_block');
    const mainApi = doc.getElementById('main_api');
    const source = doc.getElementById('chat_completion_source');
    const openai = doc.getElementById('openai_api');
    if (!block || !mainApi || !source || !openai) return () => {};
    const $ = win.jQuery;
    const restore = [];
    const move = (node, target, where = 'append') => {
        if (!node || !target) return;
        const marker = doc.createComment('cwn-api-position');
        node.before(marker);
        target[where](node);
        restore.push(() => marker.replaceWith(node));
    };
    const root = doc.createElement('div');
    root.id = 'cwn-api-panel';
    root.innerHTML = `<nav class="ca-mobile-nav"><button type="button" class="ca-button ca-icon" data-ca-action="back" aria-label="返回侧边栏">${icon('back')}</button></nav>
        <div class="ca-scroll">
            <header class="ca-heading"><h1 class="cwn-type-title">API 连接</h1><span class="ca-status" role="status"><span class="ca-dot"></span><span class="ca-status-text"></span></span></header>
            <section class="ca-section ca-providers-section" data-openai-only>
                <h2 class="cwn-type-section">服务商</h2>
                <p class="ca-guide">选择用于聊天补全的模型服务。</p>
                <div class="ca-providers" role="radiogroup" aria-label="常用服务商">${featuredSources.map(s => `<button type="button" class="ca-provider" role="radio" aria-checked="false" data-ca-source="${s.value}"><span class="ca-provider-icon">${icon(s.symbol)}</span><span class="ca-provider-text"><strong>${s.name}</strong><small>${s.note}</small></span><span class="ca-provider-check">${icon('check')}</span></button>`).join('')}</div>
                <button type="button" class="ca-more" data-ca-action="all-sources" aria-expanded="false" aria-controls="cwn-api-all-sources"><span>其他服务商</span>${icon('chevron')}</button>
                <div class="ca-all" id="cwn-api-all-sources">
                    <div class="ca-all-head"><label class="ca-label" for="chat_completion_source">全部服务商</label><button type="button" class="ca-link" data-ca-action="featured-sources">返回常用服务商</button></div>
                    <div class="ca-select-slot ca-source-slot"></div>
                </div>
            </section>
            <section class="ca-section ca-credentials">
                <h2 class="cwn-type-section ca-credentials-title">连接设置</h2>
                <div class="ca-native"></div>
            </section>
            <section class="ca-section ca-connect" data-openai-only>
                <div class="ca-connect-row"></div>
                <div class="ca-connect-status"></div>
            </section>
            <details class="ca-advanced">
                <summary><span class="cwn-type-section">高级设置</span><span class="ca-chevron" aria-hidden="true">${icon('chevron')}</span></summary>
                <p class="ca-guide">API 类型、反向代理与提示词后处理。</p>
                <div class="ca-advanced-content">
                    <div class="ca-field ca-api-type"><label class="ca-label" for="main_api">API 类型</label><div class="ca-select-slot ca-type-slot"></div></div>
                    <div class="ca-openai-advanced" data-openai-only></div>
                    <div class="ca-options"></div>
                </div>
            </details>
            <div class="ca-storage" hidden></div>
        </div>`;
    block.append(root);
    const storage = root.querySelector('.ca-storage');

    // Connection profiles are not used by this layout; keep them for the host.
    move(block.querySelector(':scope > .wide100p:has(#connection_profiles)'), storage);
    move(doc.getElementById('title_api'), storage);
    const column = doc.getElementById('main-API-selector-block')?.parentElement;
    move(column, root.querySelector('.ca-native'));
    move(doc.getElementById('main-API-selector-block'), root.querySelector('.ca-type-slot'));
    move(openai.querySelector(':scope > h4'), storage);
    move(source, root.querySelector('.ca-source-slot'));
    move(openai.querySelector(':scope > .inline-drawer'), root.querySelector('.ca-openai-advanced'));
    move(doc.getElementById('prompt_post_processing_form'), root.querySelector('.ca-openai-advanced'));
    const connectRow = doc.getElementById('api_button_openai')?.parentElement;
    move(connectRow, root.querySelector('.ca-connect-row'));
    const status = openai.querySelector(':scope > .online_status');
    move(status, root.querySelector('.ca-connect-status'));
    move(block.querySelector(':scope > .flex-container:has(#auto-connect-checkbox)'), root.querySelector('.ca-options'));
    block.classList.add('cwn-api-mounted');

    // Vertex AI: the authentication mode becomes a segmented control.
    const authMode = doc.getElementById('vertexai_auth_mode');
    const vertexForm = doc.getElementById('vertexai_form');
    let segment = null;
    if (authMode && vertexForm) {
        segment = doc.createElement('div');
        segment.className = 'ca-segment';
        segment.setAttribute('role', 'radiogroup');
        segment.setAttribute('aria-label', '验证方式');
        segment.innerHTML = [['full', 'Service Account'], ['express', '快速模式 · API 密钥']]
            .map(([value, label]) => `<button type="button" role="radio" data-ca-auth="${value}">${label}</button>`).join('');
        const label = doc.createElement('p');
        label.className = 'ca-label ca-segment-label';
        label.textContent = '验证方式';
        vertexForm.prepend(label, segment);
        restore.push(() => { label.remove(); segment.remove(); });
    }

    const setValue = (select, value) => {
        if (select.value === value) return;
        if ($) $(select).val(value).trigger('change');
        else { select.value = value; select.dispatchEvent(new win.Event('change', { bubbles: true })); }
    };
    const statusText = root.querySelector('.ca-status-text');
    const badge = root.querySelector('.ca-status');
    const title = root.querySelector('.ca-credentials-title');
    const moreButton = root.querySelector('.ca-more');
    // Featured cards and the full list are mutually exclusive views.
    let mode = providerMode(source.value);
    function setMode(next) {
        mode = next;
        root.dataset.providerMode = mode;
        moreButton.setAttribute('aria-expanded', String(mode === 'all'));
    }
    function sync() {
        const isOpenai = mainApi.value === 'openai';
        root.dataset.api = mainApi.value;
        // Never use data-source here: the host toggles every [data-source] node.
        root.dataset.chatSource = source.value;
        // A source outside the cards can only be shown by the full list.
        if (providerMode(source.value) === 'all' && mode !== 'all') setMode('all');
        else root.dataset.providerMode = mode;
        for (const card of root.querySelectorAll('[data-ca-source]')) card.setAttribute('aria-checked', String(isOpenai && card.dataset.caSource === source.value));
        const option = isOpenai ? source.selectedOptions[0] : mainApi.selectedOptions[0];
        title.textContent = option?.textContent.trim() || '连接设置';
        if (segment) for (const button of segment.querySelectorAll('[data-ca-auth]')) button.setAttribute('aria-checked', String(button.dataset.caAuth === authMode.value));
        // Each API block owns its status; the badge reads the current API's.
        const blockId = { textgenerationwebui: 'textgenerationwebui_api', novel: 'novel_api', kobold: 'kobold_api', koboldhorde: 'kobold_horde' }[mainApi.value];
        const current = isOpenai || !blockId ? status : doc.getElementById(blockId)?.querySelector('.online_status');
        const noConnection = doc.getElementById('API-status-top')?.getAttribute('no_connection_text');
        const state = connectionState(current?.querySelector('.online_status_indicator'), current?.querySelector('.online_status_text')?.textContent.trim(), noConnection);
        root.dataset.connected = String(state.on);
        badge.classList.toggle('ca-on', state.on);
        statusText.textContent = state.label;
    }
    const queue = () => win.queueMicrotask(sync);
    const watched = [mainApi, source, authMode].filter(Boolean);
    for (const select of watched) {
        select.addEventListener('change', queue);
        $?.(select).on('change.cwnApiPanel', queue);
    }
    const observer = new win.MutationObserver(queue);
    for (const node of block.querySelectorAll('.online_status')) observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    const onClick = event => {
        const card = event.target.closest('[data-ca-source]');
        if (card) { if (mainApi.value !== 'openai') setValue(mainApi, 'openai'); setValue(source, card.dataset.caSource); queue(); return; }
        const auth = event.target.closest('[data-ca-auth]');
        if (auth && authMode) { setValue(authMode, auth.dataset.caAuth); queue(); return; }
        const action = event.target.closest('[data-ca-action]')?.dataset.caAction;
        if (action === 'all-sources') { setMode('all'); source.focus({ preventScroll: true }); return; }
        if (action === 'featured-sources') { setMode('featured'); root.querySelector('.ca-provider[aria-checked="true"], .ca-provider')?.focus({ preventScroll: true }); return; }
        if (action === 'back') block.querySelector('.cwn-panel-back')?.click();
    };
    root.addEventListener('click', onClick);
    // Arrow keys move within the provider and auth radio groups.
    const onKey = event => {
        const group = event.target.closest('[role=radiogroup]');
        if (!group || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        const items = [...group.querySelectorAll('[role=radio]')];
        const index = items.indexOf(event.target.closest('[role=radio]'));
        if (index < 0) return;
        event.preventDefault();
        const next = items[(index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + items.length) % items.length];
        next.focus(); next.click();
    };
    root.addEventListener('keydown', onKey);
    setMode(mode);
    sync();
    return () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        observer.disconnect();
        for (const select of watched) {
            select.removeEventListener('change', queue);
            $?.(select).off('change.cwnApiPanel', queue);
        }
        for (const undo of restore.reverse()) undo();
        root.remove();
        block.classList.remove('cwn-api-mounted');
    };
}
