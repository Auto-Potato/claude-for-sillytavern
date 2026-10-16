import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportUrl, downloadImportFile } from '../src/import-link.js';

test('only web links are accepted; GitHub file links resolve to raw files',()=>{
    for(const url of ['', 'not a link','javascript:alert(1)','file:///card.json','https://user:secret@example.test/card.json'])assert.throws(()=>normalizeImportUrl(url));
    assert.equal(normalizeImportUrl(' https://github.com/owner/repo/blob/main/preset.json '),'https://raw.githubusercontent.com/owner/repo/main/preset.json');
});
test('direct import omits credentials and keeps decoded filenames and complete data',async()=>{
    const data={prompts:[],temperature:1,extra:{keep:true}};let options;
    const file=await downloadImportFile('https://example.test/preset.json','preset',{headers:()=>{throw Error('must not send Tavern headers');},fetch:async(url,opts)=>{options=opts;return new Response(JSON.stringify(data),{headers:{'content-disposition':"attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.json"}});}});
    assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);assert.equal(file.name,'测试.json');assert.deepEqual(JSON.parse(await file.text()),data);
});
test('CORS failure falls back to the host downloader without changing its allowlist',async()=>{
    const calls=[];
    const file=await downloadImportFile('https://example.test/world.json','worldbook',{headers:()=>({'X-Test-CSRF':'test'}),fetch:async(url,options)=>{calls.push({url,options});if(calls.length===1)throw new TypeError('CORS');return new Response('{"entries":{}}');}});
    assert.equal(file.name,'world.json');assert.equal(calls[1].url,'/api/content/importURL');assert.deepEqual(JSON.parse(calls[1].options.body),{url:'https://example.test/world.json'});assert.equal(calls[0].options.headers,undefined);
});
test('catalog links use the native converter; wrong resources and HTML do not reach import',async()=>{
    const requests=[];
    const env={headers:()=>({}),fetch:async url=>{requests.push(url);return new Response('{"entries":{}}');}};
    await downloadImportFile('https://chub.ai/lorebooks/author/book','worldbook',env);assert.deepEqual(requests,['/api/content/importURL']);
    for(const value of ['<html>download page</html>','{"entries":{}}','null','{"data":"invalid"}']) {
        await assert.rejects(downloadImportFile('https://example.test/file.json','preset',{...env,fetch:async()=>new Response(value)}));
    }
    const png=new Uint8Array([137,80,78,71,13,10,26,10]);
    const file=await downloadImportFile('https://example.test/card','character',{...env,fetch:async()=>new Response(png)});assert.equal(file.name,'card.png');
    await assert.rejects(downloadImportFile('https://example.test/card','worldbook',{...env,fetch:async()=>new Response(png)}));
});
