import test from 'node:test';
import assert from 'node:assert/strict';
import {mountComposerMenuDismiss} from '../src/composer-menu-dismiss.js';

function fixture(){
  const listeners={},nodes={};
  const doc={getElementById:id=>nodes[id],addEventListener(type,fn,options){
    assert.equal(options.capture,true);listeners[type]=fn;
    options.signal.addEventListener('abort',()=>delete listeners[type]);
  }};
  for(const [m,b] of [['options','options_button'],['extensionsMenu','extensionsMenuButton']]){
    nodes[m]={display:'none'};
    nodes[b]={clicks:0,click(){this.clicks++;listeners.click?.({composedPath:()=>[this]});nodes[m].display=nodes[m].display==='none'?'block':'none';}};
  }
  const dispose=mountComposerMenuDismiss(doc,{AbortController,getComputedStyle:n=>n});
  return {nodes,dispose,click:path=>listeners.click?.({composedPath:()=>path}),escape:()=>listeners.keydown?.({key:'Escape'})};
}
test('outside click closes both native menus without reopening on repeated clicks',()=>{
  const f=fixture();f.nodes.options.display=f.nodes.extensionsMenu.display='block';
  f.click([]);f.click([]);
  assert.equal(f.nodes.options.display,'none');assert.equal(f.nodes.extensionsMenu.display,'none');
  assert.equal(f.nodes.options_button.clicks,1);assert.equal(f.nodes.extensionsMenuButton.clicks,1);
});
test('inside clicks leave their menu interactive and close the other menu',()=>{
  const f=fixture();f.nodes.options.display=f.nodes.extensionsMenu.display='block';
  f.click([{},f.nodes.options]);assert.equal(f.nodes.options.display,'block');assert.equal(f.nodes.extensionsMenu.display,'none');
  f.click([f.nodes.options_button]);assert.equal(f.nodes.options_button.clicks,0);
});
test('Escape closes menus and disabling theme removes handlers',()=>{
  const f=fixture();f.nodes.options.display='block';f.escape();assert.equal(f.nodes.options.display,'none');
  f.dispose();f.nodes.options.display='block';f.click([]);assert.equal(f.nodes.options.display,'block');
});
