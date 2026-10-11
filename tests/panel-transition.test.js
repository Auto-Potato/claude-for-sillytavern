import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelTransition } from '../src/panel-transition.js';

function fixture(initial='characters', reduced=()=>false) {
  const paints=[], motions=[];
  const controller=createPanelTransition({initial,reduced,
    paint:(...state)=>paints.push(state),
    animate:(panel,entering)=>{
      let finish;
      const motion={panel,entering,cancelled:false,finished:new Promise(resolve=>{finish=resolve;}),
        finish:()=>finish(),cancel(){this.cancelled=true;}};
      motions.push(motion);return motion;
    },
  });
  return {controller,paints,motions};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('switch retains the old panel until the new panel has fully entered',async()=>{
  const {controller,paints,motions}=fixture();
  controller.select('worldbook');
  assert.deepEqual(paints.at(-1),['characters','worldbook',true]);
  assert.deepEqual([motions[0].panel,motions[0].entering],['worldbook',true]);
  motions[0].finish();await flush();
  assert.deepEqual(paints.at(-1),['worldbook',null,false]);
  assert.equal(motions[0].cancelled,true);
});

test('rapid navigation finishes the visible transition then enters only the latest destination',async()=>{
  const {controller,paints,motions}=fixture();
  controller.select('worldbook');controller.select('preset');controller.select('api');
  assert.equal(motions.length,1);
  motions[0].finish();await flush();
  assert.deepEqual(paints.at(-1),['worldbook','api',true]);
  motions[1].finish();await flush();
  assert.deepEqual(paints.at(-1),['api',null,false]);
  assert.equal(motions.length,2);
});

test('close keeps the outgoing panel visible until it has retracted',async()=>{
  const {controller,paints,motions}=fixture();controller.select(null);
  assert.deepEqual(paints.at(-1),['characters',null,true]);
  assert.equal(motions[0].entering,false);
  motions[0].finish();await flush();
  assert.deepEqual(paints.at(-1),[null,null,false]);
});

test('resize settles at the latest destination and ignores stale animation completion',async()=>{
  const {controller,paints,motions}=fixture();controller.select('worldbook');controller.select('api');controller.settle();
  assert.deepEqual(paints.at(-1),['api',null,false]);
  const count=paints.length;motions[0].finish();await flush();assert.equal(paints.length,count);
});

test('reduced motion swaps immediately without a blank intermediate state',()=>{
  const {controller,paints,motions}=fixture('characters',()=>true);controller.select('worldbook');
  assert.deepEqual(paints,[['characters',null,false],['worldbook',null,false]]);assert.equal(motions.length,0);
});

test('disposal cancels motion and prevents subsequent completion callbacks',async()=>{
  const {controller,paints,motions}=fixture(null);controller.select('characters');controller.dispose();
  const count=paints.length;motions[0].finish();await flush();controller.select('worldbook');
  assert.equal(paints.length,count);assert.equal(motions[0].cancelled,true);
});
