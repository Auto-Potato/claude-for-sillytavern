// Reject conflicting actions rather than queueing stale user intent.
export function createOperationLock() {
  let busy=false;
  return async function run(operation) {
    if(busy)throw new Error('正在切换或处理聊天，请稍后再试。');
    busy=true;
    try{return await operation();}finally{busy=false;}
  };
}