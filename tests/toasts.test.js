import test from 'node:test';
import assert from 'node:assert/strict';
import {mountToasts} from '../src/toasts.js';
test('repeated notifications release detached containers and restore handlers',()=>{
 let current=null, listeners=new Set(), marked=0;
 const api={};const original=()=>{if(current)current.isConnected=false;let attr=false,open=false;
 current={isConnected:true,children:[{}],hasAttribute:()=>attr,setAttribute(){attr=true;marked++;},removeAttribute(){if(attr)marked--;attr=false;},matches:()=>open,showPopover(){open=true;},hidePopover(){open=false;}};return current;};
 for(const kind of ['success','info','warning','error'])api[kind]=original;
 const dispose=mountToasts({toastr:api,document:{getElementById:()=>current,addEventListener:(t,f)=>listeners.add(f),removeEventListener:(t,f)=>listeners.delete(f)}});
 for(let i=0;i<10000;i++){assert.equal(api.info('message','title'),current);assert.equal(marked,1);}
 dispose();assert.equal(marked,0);assert.equal(listeners.size,0);assert.equal(api.info,original);
});
test('all notification types keep callbacks and use compact one-second options',()=>{
 const api={};let received;
 for(const kind of ['success','info','warning','error'])api[kind]=(...args)=>{received=args;};
 const dispose=mountToasts({toastr:api,document:{getElementById:()=>null,addEventListener(){},removeEventListener(){}}});
 const callback=()=>{};
 for(const kind of ['success','info','warning','error']){api[kind]('detail','title',{timeOut:0,onHidden:callback});assert.equal(received[0],'');assert.equal(received[1],'title');assert.equal(received[2].timeOut,1000);assert.equal(received[2].onHidden,callback);}
 dispose();
});