import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleShellHeight} from '../src/viewport.js';
test('keyboard geometry is bounded and desktop/pinch zoom are untouched',()=>{
 const base={mobile:true,focused:true,innerHeight:852,viewportHeight:520,scale:1};
 assert.equal(visibleShellHeight(base),520);
 assert.equal(visibleShellHeight({...base,mobile:false}),null);
 assert.equal(visibleShellHeight({...base,focused:false}),null);
 assert.equal(visibleShellHeight({...base,scale:2}),null);
 assert.equal(visibleShellHeight({...base,viewportHeight:NaN}),null);
 assert.equal(visibleShellHeight({...base,viewportHeight:1000}),852);
});
