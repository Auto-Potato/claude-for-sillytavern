// Leaving a panel with an open second level: unsaved edits must be resolved
// (save / discard / stay) before the panel may close or be covered.

/** Map a native popup result onto the three leave choices. */
export function unsavedChoice(result, results) {
  if (result === results.AFFIRMATIVE) return 'save';
  if (result === results.CUSTOM1) return 'discard';
  return 'cancel';
}

/** Ask whether to save pending edits. Resolves to 'save', 'discard' or 'cancel'. */
export async function confirmUnsaved({ Popup, POPUP_TYPE, POPUP_RESULT, doc, title = '保存修改？', body = '' }) {
  const content = doc.createElement('div');
  const heading = doc.createElement('h3');
  heading.textContent = title;
  content.append(heading);
  if (body) { const p = doc.createElement('p'); p.textContent = body; content.append(p); }
  const popup = new Popup(content, POPUP_TYPE.CONFIRM, '', {
    okButton: '保存', cancelButton: '取消',
    customButtons: [{ text: '不保存', result: POPUP_RESULT.CUSTOM1, classes: ['cwn-dialog-discard'] }],
  });
  popup.dlg.classList.add('cwn-character-dialog');
  return unsavedChoice(await popup.show(), POPUP_RESULT);
}

/**
 * Run a panel's leave guard. Clean panels answer synchronously so ordinary
 * navigation keeps its same-task timing; only a pending dialog is awaited.
 * @returns {boolean|Promise<boolean>}
 */
export function runLeaveGuard(guard) {
  if (typeof guard?.prepareLeave !== 'function') return true;
  const answer = guard.prepareLeave();
  if (typeof answer?.then !== 'function') return answer !== false;
  return Promise.resolve(answer).then(ok => ok !== false, () => false);
}
