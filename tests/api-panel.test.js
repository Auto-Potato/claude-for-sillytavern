import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionState, featuredSources } from '../src/api-panel.js';

const indicator=success=>({classList:{contains:name=>success&&name==='success'}});

test('connection badge requires a success indicator and a real status text',()=>{
  assert.deepEqual(connectionState(indicator(true),'有效的','无连接...'),{on:true,label:'已连接'});
  assert.deepEqual(connectionState(indicator(false),'有效的','无连接...'),{on:false,label:'未连接'});
  // The host template can keep its success class while saying "no connection".
  assert.deepEqual(connectionState(indicator(true),'无连接...','无连接...'),{on:false,label:'未连接'});
  assert.deepEqual(connectionState(undefined,'','无连接...'),{on:false,label:'未连接'});
});

test('featured providers are the two Google sources in the host source list',()=>{
  assert.deepEqual(featuredSources.map(source=>source.value),['makersuite','vertexai']);
  assert.ok(featuredSources.every(source=>source.name&&source.note));
});

test('featured sources use the cards; every other source uses the full list',async()=>{
  const { providerMode }=await import('../src/api-panel.js');
  assert.equal(providerMode('makersuite'),'featured');
  assert.equal(providerMode('vertexai'),'featured');
  for(const value of ['openai','claude','openrouter','custom',''])assert.equal(providerMode(value),'all');
});
