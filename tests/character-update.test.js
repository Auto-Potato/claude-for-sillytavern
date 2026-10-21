import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceCharacterCard} from '../src/character-update.js';

test('replacement keeps the original avatar identity even when the new file is renamed',async()=>{
  const file=new File(['{}'],'新版不同名称.json',{type:'application/json'});
  await replaceCharacterCard({file,avatar:'原角色.png',userName:'User',isBusy:()=>false,request:async form=>{
    assert.equal(form.get('preserved_name'),'原角色.png');
    assert.equal(form.get('file_type'),'json');
    assert.equal(form.get('avatar').name,file.name);
    assert.equal(form.has('delete_chats'),false);
    return {ok:true,json:async()=>({file_name:'原角色'})};
  }});
});
test('busy state and invalid files never reach the replacement endpoint',async()=>{
  const options={avatar:'old.png',userName:'User',request:()=>assert.fail('unexpected request')};
  await assert.rejects(replaceCharacterCard({...options,file:new File(['{}'],'card.json'),isBusy:()=>true}),/等待/);
  await assert.rejects(replaceCharacterCard({...options,file:new File(['x'],'card.txt'),isBusy:()=>false}),/角色卡文件/);
});
test('replacement errors and unexpected identities are not reported as success',async()=>{
  const options={file:new File(['{}'],'card.json'),avatar:'old.png',userName:'User',isBusy:()=>false};
  await assert.rejects(replaceCharacterCard({...options,request:async()=>({ok:false})}),/更新角色卡失败/);
  await assert.rejects(replaceCharacterCard({...options,request:async()=>({ok:true,json:async()=>({file_name:'duplicate'})})}),/结果异常/);
});
