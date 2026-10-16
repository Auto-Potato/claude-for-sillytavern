import { mountPresetEntryEditor } from './preset-entry-editor.js';

const paths = {
    back: 'm15 5-7 7 7 7', plus: 'M12 5v14M5 12h14',
    save: 'm5 12 4 4L19 6', more: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'm4 16 12-12 4 4-12 12H4zM14 6l4 4',
    copy: 'M9 9h11v11H9zM15 5V3H3v12h2',
    export: 'M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6',
    trash: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const button = (action, label, symbol, cls = '') => `<button type="button" class="cp-button ${cls}" data-cp-action="${action}" aria-label="${label}" title="${label}">${icon(symbol)}<span>${label}</span></button>`;

/** Reuse host elements, including their listeners and values; never clone settings. */
export function mountPresetPanel(doc, win) {
    const panel = doc.getElementById('left-nav-panel');
    const mainApi = doc.getElementById('main_api');
    if (!panel || !mainApi) return () => {};
    let unmount;
    let disposed = false;

    function mount() {
        const presets = doc.getElementById('openai_api-presets');
        const ranges = doc.getElementById('range_block_openai');
        const settings = doc.getElementById('openai_settings');
        const manager = doc.getElementById('completion_prompt_manager');
        const select = doc.getElementById('settings_preset_openai');
        if (!presets || !ranges || !settings || !manager || !select) return;
        const restore = [];
        const move = (node, target) => {
            if (!node || !target) return;
            const marker = doc.createComment('cwn-preset-position');
            node.before(marker);
            target.append(node);
            restore.push(() => { marker.replaceWith(node); });
        };
        const root = doc.createElement('div');
        root.id = 'cwn-preset-panel';
        root.innerHTML = `<nav class="cp-mobile-nav">${button('back', '返回侧边栏', 'back', 'cp-icon')}</nav>
            <div class="cp-scroll">
                <header class="cp-heading"><h1 class="cwn-type-title">预设</h1><div class="cp-heading-actions">
                    ${button('import', '导入', 'plus', 'cp-outline')}
                    <div class="cp-more-wrap">${button('more', '更多操作', 'more', 'cp-icon')}
                        <div class="cp-menu" hidden>
                            ${button('rename', '重命名', 'edit')}${button('save-as', '另存为', 'copy')}
                            ${button('export', '导出', 'export')}${button('delete', '删除预设', 'trash', 'cp-danger')}
                        </div>
                    </div>
                </div></header>
                <section class="cp-current"><label class="cwn-type-caption" for="settings_preset_openai">当前预设</label>
                    <div class="cp-select-row"><div class="cp-select-slot"></div>${button('save', '保存', 'save', 'cp-solid')}</div>
                </section>
                <div class="cp-native-storage" hidden></div>
            </div>`;
        panel.append(root);
        const scroll = root.querySelector('.cp-scroll');
        const sourceOptions = settings.firstElementChild;
        const managerBlock = manager.parentElement;
        const biasBlock = Array.from(settings.children).find(node => node.querySelector('#openai_logit_bias_preset'));
        move(presets, root.querySelector('.cp-native-storage'));
        move(select, root.querySelector('.cp-select-slot'));
        // Keep the native input/listener, but persist the user's choice to retain
        // their connection when changing presets. The control stays in storage.
        const bindConnection = presets.querySelector('#bind_preset_to_connection');
        const keepConnection = () => { if (bindConnection) bindConnection.checked = false; };
        bindConnection?.addEventListener('input', keepConnection, true);
        if (bindConnection?.checked) {
            keepConnection();
            bindConnection.dispatchEvent(new win.Event('input', {bubbles:true}));
        }
        move(settings, scroll);

        const promptSection = doc.createElement('section');
        promptSection.className = 'cp-section cp-prompts';
        promptSection.innerHTML = `<div class="cp-prompt-heading"><h2 class="cwn-type-section">提示词条目</h2>${button('prompt-more', '条目操作', 'more', 'cp-icon')}</div><p class="cp-guide">拖动调整顺序，点击条目展开编辑。</p>`;
        settings.append(promptSection);
        move(managerBlock, promptSection);
        const common = doc.createElement('section');
        common.className = 'cp-section cp-common';
        common.innerHTML = '<h2 class="cwn-type-section">生成设置</h2><div class="cp-fields"></div>';
        settings.append(common);
        const commonFields = common.querySelector('.cp-fields');
        const commonIds = ['openai_max_context', 'openai_max_tokens', 'temp_openai', 'stream_toggle'];
        for (const id of commonIds) {
            const node = Array.from(ranges.children).find(child => child.querySelector(`#${id}`));
            move(node, commonFields);
        }
        const effort = Array.from(sourceOptions.children).find(node => node.querySelector('#openai_reasoning_effort'));
        move(effort, commonFields);
        const advanced = doc.createElement('details');
        advanced.className = 'cp-advanced';
        advanced.innerHTML = '<summary><span class="cwn-type-section">高级设置</span><span class="cp-chevron" aria-hidden="true">⌄</span></summary><p class="cp-guide">采样、模型能力与提示词格式</p><div class="cp-advanced-content"></div>';
        settings.append(advanced);
        const detailGroup = (title, node) => {
            if (!node) return;
            const details = doc.createElement('details');
            details.className = 'cp-subsection';
            const summary = doc.createElement('summary');
            summary.textContent = title;
            details.append(summary);
            advanced.querySelector('.cp-advanced-content').append(details);
            move(node, details);
        };
        detailGroup('采样与格式', ranges);
        detailGroup('模型能力与消息处理', sourceOptions);
        detailGroup('词元偏置', biasBlock);
        panel.classList.add('cwn-preset-mounted');

        const menu = root.querySelector('.cp-menu');
        const menuButton = root.querySelector('[data-cp-action="more"]');
        menuButton.setAttribute('aria-expanded', 'false');
        const closeMenu = () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); };
        const promptMenuButton = root.querySelector('[data-cp-action="prompt-more"]');
        promptMenuButton.setAttribute('aria-expanded', 'false');
        const closePromptMenu = () => {
            root.classList.remove('cp-prompt-menu-open');
            promptMenuButton.setAttribute('aria-expanded', 'false');
        };
        const targets = {
            import: '#import_oai_preset', save: '#update_oai_preset',
            rename: '[data-preset-manager-rename="openai"]', 'save-as': '#new_oai_preset',
            export: '#export_oai_preset', delete: '#delete_oai_preset', back: '.cwn-panel-back',
        };
        const onClick = event => {
            if (event.target.closest('.completion_prompt_manager_footer a')) closePromptMenu();
            const action = event.target.closest('[data-cp-action]')?.dataset.cpAction;
            if (!action) return;
            if (action === 'prompt-more') {
                closeMenu();
                const open = root.classList.toggle('cp-prompt-menu-open');
                promptMenuButton.setAttribute('aria-expanded', String(open));
            } else if (action === 'more') {
                closePromptMenu();
                menu.hidden = !menu.hidden;
                menuButton.setAttribute('aria-expanded', String(!menu.hidden));
            } else {
                closeMenu();
                if (targets[action]) panel.querySelector(targets[action])?.click();
            }
        };
        const outside = event => {
            if (!event.target.closest('#cwn-preset-panel .cp-more-wrap')) closeMenu();
            if (!event.target.closest('#cwn-preset-panel .completion_prompt_manager_footer, [data-cp-action="prompt-more"]')) closePromptMenu();
        };

        // Native prompt rows are replaced on every render. Keep their click handlers,
        // while making the icon actions accessible to keyboards and touch readers.
        const decorated = new Map();
        function decorate() {
            const footer = manager.querySelector('.completion_prompt_manager_footer');
            if (footer && !footer.querySelector('.cp-append-label')) {
                const label = doc.createElement('label');
                label.className = 'cp-append-label';
                label.htmlFor = 'completion_prompt_manager_footer_append_prompt';
                label.textContent = '选择条目后，可插入或删除';
                footer.prepend(label);
            }
            const labels = [
                ['.prompt-manager-edit-action', '编辑条目'], ['.prompt-manager-detach-action', '移出列表'],
                ['.prompt-manager-toggle-action.fa-toggle-on', '停用条目'], ['.prompt-manager-toggle-action.fa-toggle-off', '启用条目'],
                ['.completion_prompt_manager_footer .fa-chain', '插入条目'],
                ['.completion_prompt_manager_footer .fa-x', '删除条目'],
                ['#prompt-manager-import', '导入条目'], ['#prompt-manager-export', '导出条目'],
                ['#prompt-manager-reset-character', '恢复默认顺序'], ['.completion_prompt_manager_footer .fa-plus-square', '新建条目'],
            ];
            for (const [selector, label] of labels) for (const el of manager.querySelectorAll(selector)) {
                if (!decorated.has(el)) decorated.set(el, ['role', 'tabindex', 'aria-label'].map(key => el.getAttribute(key)));
                el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', label);
            }
            for (const el of decorated.keys()) if (!manager.contains(el)) decorated.delete(el);
        }
        const observer = new win.MutationObserver(decorate);
        observer.observe(manager, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
        decorate();
        const disposeEntryEditor = mountPresetEntryEditor(doc, win, root, manager, promptSection);
        const keydown = event => {
            if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); event.stopPropagation(); }
            else if (event.key === 'Escape' && root.classList.contains('cp-prompt-menu-open')) { closePromptMenu(); promptMenuButton.focus(); event.stopPropagation(); }
            else if ((event.key === 'Enter' || event.key === ' ') && decorated.has(event.target)) {
                event.preventDefault(); event.target.click();
            }
        };
        root.addEventListener('click', onClick);
        root.addEventListener('keydown', keydown);
        doc.addEventListener('click', outside, true);
        unmount = () => {
            disposeEntryEditor();
            observer.disconnect();
            root.removeEventListener('click', onClick); root.removeEventListener('keydown', keydown);
            doc.removeEventListener('click', outside, true);
            for (const [el, values] of decorated) ['role', 'tabindex', 'aria-label'].forEach((key, i) => {
                if (values[i] === null) el.removeAttribute(key); else el.setAttribute(key, values[i]);
            });
            manager.querySelectorAll('.cp-append-label').forEach(el => el.remove());
            for (const undo of restore.reverse()) undo();
            bindConnection?.removeEventListener('input', keepConnection, true);
            promptSection.remove(); common.remove(); advanced.remove(); root.remove();
            panel.classList.remove('cwn-preset-mounted');
            unmount = undefined;
        };
    }
    const sync = () => {
        if (disposed) return;
        if (mainApi.value === 'openai') { if (!unmount) mount(); }
        else unmount?.();
    };
    const onApiChange = () => win.queueMicrotask(sync);
    mainApi.addEventListener('change', onApiChange);
    // Host API switching can use jQuery's synthetic change events.
    win.jQuery?.(mainApi).on('change.cwnPresetPanel', onApiChange);
    sync();
    return () => {
        disposed = true;
        mainApi.removeEventListener('change', onApiChange);
        win.jQuery?.(mainApi).off('change.cwnPresetPanel', onApiChange);
        unmount?.();
    };
}
