import test from 'node:test';
import assert from 'node:assert/strict';
import { usesThemeDialog, mountDialogStyle } from '../src/dialog-style.js';

const TYPES={TEXT:1,CONFIRM:2,INPUT:3,DISPLAY:4,CROP:5};
const dialog=(...names)=>{const set=new Set(names);return {classList:{contains:n=>set.has(n),add:(...n)=>n.forEach(x=>set.add(x))},set};};

test('native confirm and input popups take the theme dialog style',()=>{
  assert.equal(usesThemeDialog({type:TYPES.CONFIRM,dlg:dialog('popup')},TYPES),true);
  assert.equal(usesThemeDialog({type:TYPES.INPUT,dlg:dialog('popup')},TYPES),true);
});

test('text, display, crop and wide or editor popups keep their own layout',()=>{
  for(const type of [TYPES.TEXT,TYPES.DISPLAY,TYPES.CROP])assert.equal(usesThemeDialog({type,dlg:dialog('popup')},TYPES),false);
  for(const name of ['wide_dialogue_popup','wider_dialogue_popup','large_dialogue_popup','transparent_dialogue_popup','ce-inline-regex-editor'])
    assert.equal(usesThemeDialog({type:TYPES.CONFIRM,dlg:dialog('popup',name)},TYPES),false);
});

test('mounting decorates matching popups at show time and restores on dispose',()=>{
  class Popup{constructor(type,dlg){this.type=type;this.dlg=dlg;}show(){return 'shown';}}
  const original=Popup.prototype.show;
  const dispose=mountDialogStyle({Popup,POPUP_TYPE:TYPES});
  const confirm=new Popup(TYPES.CONFIRM,dialog('popup')),text=new Popup(TYPES.TEXT,dialog('popup'));
  assert.equal(confirm.show(),'shown');text.show();
  assert.ok(confirm.dlg.set.has('cwn-character-dialog'));
  assert.ok(!text.dlg.set.has('cwn-character-dialog'));
  dispose();
  assert.equal(Popup.prototype.show,original);
});

test('a labelled native confirm gains a heading and cancel text once',async()=>{
  const { labelNextDialog, applyDialogLabel }=await import('../src/dialog-style.js');
  const make=()=>{const children=[];return {content:{querySelector:()=>children.find(c=>c.tag==='h3')||null,prepend:node=>children.unshift(node),children},cancelButton:{textContent:'否',dataset:{}}};};
  const doc={createElement:tag=>({tag,textContent:''})};
  labelNextDialog({title:'删除预设',cancel:'取消'});
  const popup=make();
  assert.equal(applyDialogLabel(popup,doc),true);
  assert.equal(popup.content.children[0].textContent,'删除预设');
  assert.equal(popup.cancelButton.textContent,'取消');
  const next=make();
  assert.equal(applyDialogLabel(next,doc),false);
  assert.equal(next.cancelButton.textContent,'否');
  labelNextDialog({title:'删除预设',within:10});
  assert.equal(applyDialogLabel(make(),doc,Date.now()+1000),false);
});
