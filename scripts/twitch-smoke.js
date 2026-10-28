import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createApp} from '../src/server.js';
import {TwitchAPI} from '../src/auth.js';
import {sendChat} from '../src/chat.js';

const channel=process.argv[process.argv.indexOf('--channel')+1];
if(!process.argv.includes('--channel') || !/^[a-zA-Z0-9_]+$/.test(channel)) throw new Error('Explicit --channel LOGIN is required: this test sends public synthetic chat messages.');
const api=new TwitchAPI();await api.load();
const userResponse=await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(process.env.TWITCH_BROADCASTER_ID)}`,{headers:{Authorization:`Bearer ${api.token.access_token}`,'Client-Id':api.clientId},signal:AbortSignal.timeout(10000)});
if(!userResponse.ok)throw new Error(`Channel lookup HTTP ${userResponse.status}`);
assert.equal((await userResponse.json()).data?.[0]?.login,channel.toLowerCase(),'Configured broadcaster must match explicitly authorized test channel');
const prefix=`[PONTE TEST / SYNTHETIC ${Date.now()}]`;
const ownUser=process.env.TWITCH_USER_ID;
const acceptMessage=event=>event.chatter_user_id===ownUser && (event.message.text.startsWith(prefix) || /^!ponte(?: (?:off|on))?$/.test(event.message.text) || event.message.text.startsWith(`@${channel} Ponte:`));
const report={startedAt:new Date().toISOString(),channel,publicInputs:[],checks:[],transport:[],scope:'Real Twitch and Groq, synthetic messages only. Unrelated chat is filtered before provider calls. No broadcast is started.'};
let app,sseReader,sseTask;
const seen=new Map(),sseStates=[],sseRecaps=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label,ms=30000){const deadline=Date.now()+ms;while(Date.now()<deadline){if(predicate())return;await sleep(100);}throw new Error(`Timeout: ${label}`);}
function pass(name,details={}){report.checks.push({name,status:'PASS',...details});console.log(`PASS ${name}`);}
async function post(path,body){const r=await fetch(app.address+path,{method:'POST',headers:{Origin:app.address,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,204,`Local action ${path}`);}
async function send(text){const id=await sendChat(app.api,text);report.publicInputs.push({id,text});await until(()=>seen.has(id),'EventSub delivery');return id;}
async function translated(text){const id=await send(text);await until(()=>app.pipeline.lines.some(line=>line.id===id),'Groq translation reaching overlay');const line=app.pipeline.lines.find(line=>line.id===id);assert.equal(line.engine,'groq','Offline fallback is not a successful real-provider test');return line;}
async function consumeSSE(){let buffer='';const decoder=new TextDecoder();while(true){const {value,done}=await sseReader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const type=block.match(/^event: (.+)$/m)?.[1],json=block.match(/^data: (.+)$/m)?.[1];if(!json)continue;const data=JSON.parse(json);if(type==='state')sseStates.push(data);if(type==='recap')sseRecaps.push(data);}}}
try{
 app=await createApp({port:8788,liveTest:true,acceptMessage,onTwitchStatus:status=>report.transport.push({...status,at:new Date().toISOString()})});
 report.address=app.address;
 const handle=app.pipeline.message.bind(app.pipeline);
 app.pipeline.message=async event=>{if(acceptMessage(event))seen.set(event.message_id,{id:event.message_id,text:event.message.text});return handle(event);};
 const sse=await fetch(app.address+'/events');assert.equal(sse.status,200);sseReader=sse.body.getReader();sseTask=consumeSSE();
 await until(()=>report.transport.some(s=>s.state==='ready'),'four EventSub subscriptions');
 pass('Four real EventSub subscriptions',{types:report.transport.find(s=>s.state==='ready').subscriptions});
 const pt=await translated(`${prefix} pt salve @${channel}, bom jogo Kappa`);
 assert.equal(pt.direction,'pt-en');assert.ok(pt.translated.includes('Kappa'));
 pass('PT→EN through Helix → EventSub → Groq → pipeline',{id:pt.id,original:pt.original,translated:pt.translated,engine:pt.engine});
 const en=await translated(`${prefix} en hello, good game LUL 🎮`);
 assert.equal(en.direction,'en-pt');assert.ok(en.translated.includes('LUL') && en.translated.includes('🎮'));
 pass('EN→PT through real services',{id:en.id,original:en.original,translated:en.translated,engine:en.engine});
 await until(()=>sseStates.some(state=>state.lines.some(line=>line.id===pt.id)) && sseStates.some(state=>state.lines.some(line=>line.id===en.id)),'translations in HTTP SSE');
 pass('Translated messages delivered over HTTP SSE to overlay');
 const emote=en.fragments.find(f=>f.type==='emote');assert.ok(emote?.emote?.id,'Twitch emote fragment required');
 pass('Real Twitch emote fragments preserved',{emote:emote.text,emoteId:emote.emote.id});
 await send('!ponte');await until(()=>app.pipeline.botReplyIds.size>0,'Helix status reply');
 const replyId=[...app.pipeline.botReplyIds][0];await until(()=>seen.has(replyId),'EventSub delivery of bot reply');
 assert.ok(!app.pipeline.lines.some(line=>line.id===replyId));
 pass('!ponte reply sent via Helix, received and filtered',{replyId,text:seen.get(replyId).text});
 await post('/hide',{id:pt.id});assert.ok(!app.pipeline.lines.some(line=>line.id===pt.id));pass('Hide removes a real translated line through local HTTP panel action');
 await post('/pause',{user:ownUser,paused:true});
 const paused=await send(`${prefix} paused oi bom jogo`);await sleep(1000);assert.ok(!app.pipeline.lines.some(line=>line.id===paused));
 await post('/pause',{user:ownUser,paused:false});
 const resumed=await translated(`${prefix} resumed oi bom jogo`);
 pass('Pause blocks received real chat, resume restores translation',{pausedId:paused,resumedId:resumed.id});
 await send('!ponte off');await until(()=>app.pipeline.optedOut.has(ownUser),'viewer opt-out');
 const off=await send(`${prefix} opted-out oi bom jogo`);await sleep(1000);assert.ok(!app.pipeline.lines.some(line=>line.id===off));
 await send('!ponte on');await until(()=>!app.pipeline.optedOut.has(ownUser),'viewer opt-in');
 const on=await translated(`${prefix} opted-in oi bom jogo`);
 pass('!ponte off/on operates on real EventSub messages',{optedOutMessageId:off,optedInMessageId:on.id});
 const recap=await app.pipeline.recap();assert.ok(recap?.pt && recap?.en);assert.equal(recap.engine,'groq','Provider recap required, not extractive fallback');assert.equal(recap.pt,'Sem mensagens recentes em inglês.');
 await until(()=>sseRecaps.some(value=>value.pt===recap.pt),'bilingual recap over SSE');pass('Groq bilingual recap delivered to overlay',{...recap});
 const readyBefore=report.transport.filter(s=>s.state==='ready').length;
 app.reader.socket.close();await until(()=>report.transport.filter(s=>s.state==='ready').length>readyBefore,'real socket reconnect and subscriptions',45000);
 const afterReconnect=await translated(`${prefix} reconnect bom jogo Kappa`);
 pass('Client disconnect reconnects, re-subscribes and receives new chat',{messageId:afterReconnect.id});
 const oldAccess=app.api.token.access_token,oldRefresh=app.api.token.refresh_token;
 await app.api.refresh();const validated=await app.api.validate();assert.equal(validated.user_id,ownUser);assert.ok(app.api.token.access_token!==oldAccess);
 pass('Real Twitch token refresh persisted and validated',{accessTokenChanged:app.api.token.access_token!==oldAccess,refreshTokenChanged:app.api.token.refresh_token!==oldRefresh,tokenValuesRecorded:false});
 report.status='PASS';
 report.visibleLines=app.pipeline.lines;
 report.unexercised=['Twitch moderator deletion/timeout/clear notifications (subscription creation only; no moderation action triggered)','Twitch server-directed session_reconnect handoff','OBS Browser Source','15-minute broadcast'];
}catch(error){report.status='FAIL';report.error=error.message;console.error(error.message);process.exitCode=1;}
finally{
 report.completedAt=new Date().toISOString();
 report.translatorSourceSHA256=createHash('sha256').update(await readFile(new URL('../src/translate.js',import.meta.url))).digest('hex');
 await writeFile(new URL('../docs/twitch-live-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,publicInputs:report.publicInputs.length,report:'docs/twitch-live-report.json',address:app?.address},null,2));
 if(report.status==='PASS' && process.argv.includes('--preview')){
   console.log('Synthetic live-test preview available for 90 seconds; Ctrl+C closes it.');
   await new Promise(resolve=>{const timer=setTimeout(resolve,90000);process.once('SIGINT',()=>{clearTimeout(timer);resolve();});});
 }
 if(sseReader)await sseReader.cancel();
 if(sseTask)await sseTask.catch(()=>{});
 if(app)await app.close();
}
