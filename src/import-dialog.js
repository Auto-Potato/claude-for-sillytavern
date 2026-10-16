import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../popup.js';
import { getRequestHeaders } from '../../../../../script.js';
import { downloadImportFile, normalizeImportUrl } from './import-link.js';

export function createImportDialog(doc, win, {kind, label, chooseFile, importFile}) {
    let active, controller, disposed = false;
    async function open() {
        if (active || disposed) return;
        const content = doc.createElement('div');
        content.className = 'cwn-import-dialog-content';
        content.innerHTML = `<div class="cwn-import-dialog-heading"><h3></h3><button type="button" aria-label="关闭导入窗口"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><label>文件链接<input type="url" aria-label="文件链接" autocomplete="off" autocapitalize="off" spellcheck="false"></label><p class="cwn-import-error" role="status" hidden></p>`;
        content.querySelector('h3').textContent = `导入${label}`;
        const input = content.querySelector('input'), error = content.querySelector('.cwn-import-error');
        let downloading = false, file;
        const popup = new Popup(content, POPUP_TYPE.CONFIRM, '', {
            okButton:'从链接导入',cancelButton:'从文件导入',animation:'fast',
            onClosing: async current => {
                if (current.result === POPUP_RESULT.CANCELLED) {controller?.abort();return true;}
                if (downloading) return false;
                if (current.result === POPUP_RESULT.NEGATIVE) {chooseFile();return true;}
                error.hidden = true;
                try { normalizeImportUrl(input.value); }
                catch (e) {error.textContent=e.message;error.hidden=false;input.focus();return false;}
                downloading = true;
                controller = new win.AbortController();
                const timeout = win.setTimeout(()=>controller?.abort(),30000);
                popup.okButton.textContent='正在下载…';
                popup.okButton.setAttribute('aria-disabled','true');
                popup.cancelButton.setAttribute('aria-disabled','true');
                input.readOnly=true;
                try {
                    file=await downloadImportFile(input.value,kind,{fetch:win.fetch.bind(win),headers:getRequestHeaders,signal:controller.signal});
                    return !disposed && active === popup;
                } catch (e) {
                    if (active === popup) {error.textContent=controller.signal.aborted?'下载已取消或超时，请重试':e.message;error.hidden=false;}
                    return false;
                } finally {
                    win.clearTimeout(timeout);downloading=false;input.readOnly=false;
                    popup.okButton.textContent='从链接导入';
                    popup.okButton.removeAttribute('aria-disabled');popup.cancelButton.removeAttribute('aria-disabled');
                }
            },
        });
        popup.dlg.classList.add('cwn-character-dialog','cwn-import-dialog');
        content.querySelector('button').addEventListener('click',()=>popup.completeCancelled());
        active=popup;
        try {
            const result=await popup.show();
            if (result===POPUP_RESULT.AFFIRMATIVE && file && !disposed) await importFile(file);
        } catch (e) {win.toastr?.error(e.message || '导入失败，请重试');}
        finally {if(active===popup)active=undefined;}
    }
    return {open, dispose(){disposed=true;controller?.abort();void active?.completeCancelled();}};
}
