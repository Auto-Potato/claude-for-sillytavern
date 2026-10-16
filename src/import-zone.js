// Shared presentation for the three desktop import targets.
export function importZoneContent(label, hint = '或点击选择 JSON 文件导入') {
    return `<span class="cwn-import-heading"><span class="cwn-import-symbol" aria-hidden="true"><svg class="cwn-import-idle" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><svg class="cwn-import-active" viewBox="0 0 24 24"><path d="M12 4v16m-6-6 6 6 6-6"/></svg></span><span><span class="cwn-import-idle">将${label}拖到这里</span><span class="cwn-import-active">松开即可导入</span></span></span><span class="cwn-import-hint">${hint}</span>`;
}

export function mountPresetDrop(doc, win, zone, importFile) {
    const abort = new win.AbortController();
    let busy = false;
    const clear = () => zone.classList.remove('cwn-drag-over');
    const handle = async event => {
        if (!zone.contains(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'dragleave') {
            if (!zone.contains(event.relatedTarget)) clear();
            return;
        }
        const hasFiles = event.type === 'drop' ? event.dataTransfer?.files?.length > 0 : Array.from(event.dataTransfer?.types || []).includes('Files');
        const allowed = win.innerWidth > 700 && !busy && hasFiles;
        zone.classList.toggle('cwn-drag-over', allowed && event.type !== 'drop');
        if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
        if (event.type !== 'drop' || !allowed) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length !== 1 || !/\.json$/i.test(files[0].name)) {
            win.toastr?.warning('请一次拖入一个预设 JSON 文件');
            return;
        }
        busy = true; zone.disabled = true;
        try { await importFile(files[0]); }
        catch { win.toastr?.error('预设导入失败，请检查文件后重试'); }
        finally { busy = false; zone.disabled = false; }
    };
    for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) doc.addEventListener(type, handle, {capture:true, signal:abort.signal});
    win.addEventListener('dragend', clear, {signal:abort.signal});
    return () => { abort.abort(); clear(); };
}
