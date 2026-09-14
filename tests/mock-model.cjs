const http=require('node:http');
let counter=0;
http.createServer(async(req,res)=>{
 if(req.url.endsWith('/models')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({object:'list',data:[{id:'local-test',object:'model',owned_by:'local'}]}));return;}
 if(!req.url.endsWith('/chat/completions')) {res.writeHead(404);res.end();return;}
 let raw='';for await(const part of req) raw+=part;
 const body=JSON.parse(raw), id=++counter;
 const last=body.messages?.filter(m=>m.role==='user').at(-1)?.content || '';
 const slow=JSON.stringify(last).includes('SLOW');
 const fail=JSON.stringify(last).includes('FAIL');
 console.log(JSON.stringify({id,stream:body.stream,slow,fail}));
 if(fail){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'本地模拟服务错误',type:'test_error'}}));return;}
 const parts=slow ? Array.from({length:60},(_,i)=>`第${i+1}段测试输出。\n`) : ['本地测试回复：','发送链路正常。','\n\n**加粗文本** 与 `代码`。','\n测试完成。'];
 if(!body.stream){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:`test-${id}`,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:parts.join('')},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:10,total_tokens:11}}));console.log(JSON.stringify({id,completed:true}));return;}
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
 let index=0;const timer=setInterval(()=>{
   if(index<parts.length) res.write(`data: ${JSON.stringify({id:`test-${id}`,object:'chat.completion.chunk',choices:[{index:0,delta:{content:parts[index++]},finish_reason:null}]})}\n\n`);
   else {clearInterval(timer);res.end(`data: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);console.log(JSON.stringify({id,completed:true}));}
 },slow?800:150);
 res.on('close',()=>{clearInterval(timer);if(index<parts.length) console.log(JSON.stringify({id,cancelled:true,chunks:index}));});
}).listen(8012,'127.0.0.1',()=>console.log('Local mock model listening on 127.0.0.1:8012'));
