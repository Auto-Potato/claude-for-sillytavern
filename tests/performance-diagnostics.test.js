import test from 'node:test';
import assert from 'node:assert/strict';
import {safeResource,diagnosticStep,diagnosticFrame} from '../src/performance-diagnostics.js';

test('diagnostics exports allowlisted route metrics without private URLs or payloads',()=>{
  const input={name:'http://localhost:8011/api/worldinfo/get?name=PRIVATE',startTime:123,duration:42,decodedBodySize:400,body:'PRIVATE',initiatorType:'fetch'};
  const result=safeResource(input,'http://localhost:8011');
  assert.deepEqual(result,{type:'request',route:'worldbook',start:123,ms:42,bytes:400});
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.equal(safeResource({...input,name:'https://provider.example/api/worldinfo/get'},'http://localhost:8011'),null);
  assert.equal(safeResource({...input,name:'http://localhost:8011/api/secrets/read'},'http://localhost:8011'),null);
  assert.equal(safeResource({...input,name:'not a URL'},'http://localhost:8011'),null);
});
test('disabled diagnostics needs no browser globals and does not alter operations',()=>{
  assert.doesNotThrow(()=>{diagnosticStep('worldbook.read')();diagnosticFrame('worldbook.next-frame');});
});
