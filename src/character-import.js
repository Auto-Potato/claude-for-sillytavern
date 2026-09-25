import { MOBILE_BREAKPOINT } from './viewport.js';

// Capture before the host's body-wide drop handler; retain its import pipeline.
export function mountCharacterImport(doc, win, importFiles) {
  const abort = new win.AbortController();
  const panel = doc.getElementById('rm_characters_block');
  const zone = doc.createElement('button');
  zone.type = 'button';
  zone.id = 'cwn-character-import-zone';
  zone.className = 'cwn-import-zone';
  zone.innerHTML = '<span class="cwn-import-heading"><span class="cwn-import-symbol" aria-hidden="true"><span class="cwn-import-idle">＋</span><span class="cwn-import-active">↓</span></span><span><span class="cwn-import-idle">将角色卡拖到这里</span><span class="cwn-import-active">松开即可导入</span></span></span><span class="cwn-import-hint">或点击选择文件导入</span>';
  panel?.prepend(zone);
  let busy = false;
  const desktop = () => win.innerWidth > MOBILE_BREAKPOINT;
  zone.addEventListener('click', () => {
    if (!busy) doc.getElementById('character_import_file')?.click();
  }, { signal: abort.signal });
  const clear = () => zone.classList.remove('cwn-drag-over');
  async function handle(event) {
    // Even URL/image drags must not reach the host's global URL importer.
    event.preventDefault();
    event.stopImmediatePropagation();
    const hasFiles = event.type === 'drop' ? event.dataTransfer?.files?.length > 0 : Array.from(event.dataTransfer?.types || []).includes('Files');
    const inside = desktop() && zone.contains(event.target) && !busy && hasFiles;
    if (event.type === 'dragleave') {
      if (!zone.contains(event.relatedTarget)) clear();
      return;
    }
    zone.classList.toggle('cwn-drag-over', inside && event.type !== 'drop');
    if (event.type !== 'drop') {
      if (event.dataTransfer) event.dataTransfer.dropEffect = inside ? 'copy' : 'none';
      return;
    }
    clear();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!inside || !files.length) return;
    busy = true; zone.disabled = true;
    try { await importFiles(files); }
    catch (error) {
      console.error('[Claude theme] Character import failed', error);
      win.toastr?.error('角色卡导入失败，请检查文件后重试');
    } finally { busy = false; zone.disabled = false; }
  }
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
    doc.addEventListener(type, handle, { capture: true, signal: abort.signal });
  }
  win.addEventListener('dragend', clear, { signal: abort.signal });
  return () => { abort.abort(); zone.remove(); };
}
