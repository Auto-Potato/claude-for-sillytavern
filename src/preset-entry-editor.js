/** Dock the host's single editor below a row; keep its original save handlers. */
export function mountPresetEntryEditor(doc, win, root, manager, section) {
    const editor = doc.getElementById('completion_prompt_manager_popup');
    if (!editor) return () => {};
    const home = doc.createComment('cwn-prompt-editor-home');
    const wasDrawer = editor.classList.contains('drawer-content');
    editor.before(home);
    const parking = doc.createElement('div');
    parking.hidden = true;
    root.append(parking);
    const newEntry = doc.createElement('div');
    newEntry.className = 'cp-new-entry';
    newEntry.hidden = true;
    section.append(newEntry);
    let activeId = null;
    let activeRow;
    let opening = false;
    let disposed = false;
    const scroll = root.querySelector('.cp-scroll');
    const headers = new Map();
    const headerAttrs = ['role', 'tabindex', 'aria-expanded', 'aria-controls'];
    const decorateHeaders = () => {
        for (const row of manager.querySelectorAll('[data-pm-identifier]')) {
            const header = row.querySelector('.completion_prompt_manager_prompt_name');
            if (!header || !row.querySelector('.prompt-manager-edit-action')) continue;
            if (!headers.has(header)) headers.set(header, headerAttrs.map(key => header.getAttribute(key)));
            header.setAttribute('role', 'button');
            header.setAttribute('tabindex', '0');
            header.setAttribute('aria-controls', editor.id);
            header.setAttribute('aria-expanded', String(row === activeRow && !editor.hidden));
        }
        for (const header of headers.keys()) if (!manager.contains(header)) headers.delete(header);
    };
    const clearRow = () => {
        activeRow?.classList.remove('cp-entry-expanded');
        activeRow?.querySelector('.prompt-manager-edit-action')?.removeAttribute('aria-expanded');
        activeRow?.querySelector('.completion_prompt_manager_prompt_name')?.setAttribute('aria-expanded', 'false');
        activeRow = undefined;
    };
    const restore = () => {
        if (!editor.classList.contains('openDrawer')) win.jQuery?.(editor).stop(true, true);
        clearRow();
        activeId = null;
        opening = false;
        editor.hidden = false;
        editor.classList.remove('cp-inline-editor');
        if (wasDrawer) editor.classList.add('drawer-content');
        home.after(editor);
        newEntry.hidden = true;
        root.classList.remove('cp-editor-open');
    };
    const place = () => {
        if (activeId === null) return;
        const row = activeId === '' ? newEntry : Array.from(manager.querySelectorAll('[data-pm-identifier]')).find(el => el.dataset.pmIdentifier === activeId);
        // A host re-render empties the list before asynchronously rebuilding it.
        // Park the retained form in the document so its IDs/listeners stay usable.
        if (!row) {
            if (editor.parentNode !== parking) parking.append(editor);
            clearRow();
            return;
        }
        if (activeRow !== row) { clearRow(); activeRow = row; }
        row.classList.toggle('cp-entry-expanded', !editor.hidden);
        row.querySelector('.completion_prompt_manager_prompt_name')?.setAttribute('aria-expanded', String(!editor.hidden));
        row.querySelector('.prompt-manager-edit-action')?.setAttribute('aria-expanded', 'true');
        if (editor.parentNode !== row) row.append(editor);
        if (row === newEntry) newEntry.hidden = false;
    };
    const onClick = event => {
        if (editor.contains(event.target)) return;
        const clickedRow = event.target.closest('[data-pm-identifier]');
        if (clickedRow && manager.contains(clickedRow) && !event.target.closest('.prompt_manager_prompt_controls, .prompt-manager-edit-action, .prompt-manager-toggle-action, .prompt-manager-detach-action, .drag-handle')) {
            // Replace the native name's read-only inspection with the same editor.
            event.preventDefault();
            event.stopImmediatePropagation();
            if (pointerStart && event.detail > 0 && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) return;
            const editAction = clickedRow.querySelector('.prompt-manager-edit-action');
            if (!editAction) return; // Host markers such as chat history are not editable.
            if (activeId === clickedRow.dataset.pmIdentifier && editor.classList.contains('openDrawer')) {
                editor.hidden = !editor.hidden;
                root.classList.toggle('cp-editor-open', !editor.hidden);
                place();
                return;
            }
            editAction.click();
            return;
        }
        const edit = event.target.closest('.prompt-manager-edit-action');
        const create = event.target.closest('.completion_prompt_manager_footer .fa-plus-square');
        if (!(edit || create) || !manager.contains(event.target)) return;
        const row = event.target.closest('[data-pm-identifier]');
        if (!create && !row) return;
        const oldTop = row?.getBoundingClientRect().top;
        // Finish a previous native slide before docking the same form elsewhere.
        win.jQuery?.(editor).stop(true, true);
        activeId = create ? '' : row.dataset.pmIdentifier;
        editor.hidden = false;
        opening = true;
        editor.classList.add('cp-inline-editor');
        editor.classList.remove('drawer-content');
        root.classList.add('cp-editor-open');
        place();
        if (row) scroll.scrollTop += row.getBoundingClientRect().top - oldTop;
    };
    // Finish after the host's target listener, rather than a microtask between
    // capture and target listeners (which can run before showPopup()).
    const afterClick = () => {
        if (!opening || disposed) return;
        opening = false;
        if (!editor.classList.contains('openDrawer')) restore();
        else if (activeId === '') scroll.scrollTop += newEntry.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16;
    };
    const onManagerRender = () => { if (activeId !== null) place(); decorateHeaders(); };
    const rows = new win.MutationObserver(onManagerRender);
    rows.observe(manager, {childList:true, subtree:true});
    decorateHeaders();
    const visibility = new win.MutationObserver(() => {
        if (activeId !== null && !opening && !editor.classList.contains('openDrawer')) restore();
    });
    visibility.observe(editor, {attributes:true, attributeFilter:['class']});
    root.addEventListener('click', onClick, true);
    root.addEventListener('click', afterClick);
    let pointerStart;
    const pointerDown = event => { pointerStart = {x:event.clientX, y:event.clientY}; };
    const onKey = event => {
        if ((event.key === 'Enter' || event.key === ' ') && headers.has(event.target)) {
            event.preventDefault(); event.target.click();
        }
    };
    root.addEventListener('pointerdown', pointerDown, true);
    root.addEventListener('keydown', onKey);
    // Keep drag sorting on the row header; form selections/resizing are not drags.
    const stopDrag = event => event.stopPropagation();
    editor.addEventListener('mousedown', stopDrag);
    editor.addEventListener('touchstart', stopDrag, {passive:true});
    return () => {
        disposed = true;
        rows.disconnect(); visibility.disconnect();
        root.removeEventListener('click', onClick, true);
        root.removeEventListener('click', afterClick);
        root.removeEventListener('pointerdown', pointerDown, true);
        root.removeEventListener('keydown', onKey);
        editor.removeEventListener('mousedown', stopDrag);
        editor.removeEventListener('touchstart', stopDrag);
        win.jQuery?.(editor).stop(true, true);
        restore(); home.remove(); parking.remove(); newEntry.remove();
        for (const [header, values] of headers) headerAttrs.forEach((key, i) => {
            if (values[i] === null) header.removeAttribute(key); else header.setAttribute(key, values[i]);
        });
    };
}
