import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, protect, translate, summarize } from '../src/translate.js';
import { Pipeline } from '../src/pipeline.js';
import { TwitchAPI, authenticate } from '../src/auth.js';
import { allowedSocket, TwitchReader } from '../src/twitch.js';
import { eventFor } from '../src/fixture.js';
import { createApp } from '../src/server.js';
import { chrF, evaluate } from '../src/eval.js';
test('detects both languages, abstains on ambiguous chat', () => { assert.equal(detect('oi bom jogo'), 'pt'); assert.equal(detect('hello good game'), 'en'); assert.equal(detect('Kappa'), null); });
test('preserves custom fragments, URLs, mentions and joined emoji', async () => {
  const text = 'oi Custom @ana https://example.com 👩‍💻';
  const fragments = [{type:'text',text:'oi '},{type:'emote',text:'Custom',emote:{id:'123'}},{type:'text',text:' @ana https://example.com 👩‍💻'}];
  const result = await translate(text, fragments, {apiKey:''});
  assert.equal(result.translated, 'hi Custom @ana https://example.com 👩‍💻');
});
test('placeholder collision is escaped and missing protected tokens reject', () => { const p = protect('oi __PONTE_0__ Kappa'); assert.equal(p.restore(p.text), 'oi __PONTE_0__ Kappa'); assert.throws(() => p.restore('oops')); });
test('API success uses translation, corrupted placeholders fall back safely', async () => {
  const response = content => async () => new Response(JSON.stringify({choices:[{message:{content}}]}));
  assert.equal((await translate('oi Kappa', [], {apiKey:'synthetic',fetcher:response('hello __PONTE_0__')})).engine,'groq');
  const result = await translate('oi Kappa', [], {apiKey:'synthetic',fetcher:response('hello')});
  assert.equal(result.engine,'offline'); assert.equal(result.translated,'hi Kappa');
});
test('provider errors fall back without losing emotes', async () => { const r = await translate('oi Kappa',[],{apiKey:'synthetic',fetcher:async()=>new Response('',{status:429})}); assert.equal(r.translated,'hi Kappa'); });
test('deduplicates messages and supports opt-out and opt-in', async () => {
  const replies = [], p = new Pipeline({reply:async text=>replies.push(text),translator:async text=>({original:text,translated:text,direction:'pt-en',engine:'offline'})});
  const e = eventFor(0); await p.message(e); await p.message(e); assert.equal(p.lines.length,1);
  await p.message({...e,message_id:'cmd1',message:{text:'!ponte off'}});
  await p.message({...e,message_id:'hidden'}); assert.equal(p.lines.length,1);
  await p.message({...e,message_id:'cmd2',message:{text:'!ponte on'}});
  await p.message({...e,message_id:'shown'}); assert.equal(p.lines.length,2); assert.equal(replies.length,1);
});
test('moderation wins against translations already in flight', async () => {
  for (const action of ['hide','clearUser','clear','pause']) {
    let resolve;
    const p = new Pipeline({translator:()=>new Promise(r=>resolve=r)}), e=eventFor(0), pending=p.message(e);
    if (action==='hide') p.hide(e.message_id);
    if (action==='clearUser') p.clearUser(e.chatter_user_id);
    if (action==='clear') p.clear();
    if (action==='pause') { p.pause(e.chatter_user_id,true); p.pause(e.chatter_user_id,false); }
    resolve({original:e.message.text,translated:'hi',direction:'pt-en'}); await pending; assert.equal(p.lines.length,0,action);
  }
});
test('recap reflects only currently visible messages', async () => { const p = new Pipeline({translator:async()=>({translated:'secret',direction:'pt-en'})}); await p.message(eventFor(0)); assert.match((await p.recap()).en,/secret/); p.hide('synthetic-0'); assert.doesNotMatch((await p.recap()).en,/secret/); });
test('refreshes once on 401 and retries request with new token', async () => {
  const calls=[]; let saved;
  const api = new TwitchAPI({clientId:'mock',token:{access_token:'old',refresh_token:'r'},persist:async t=>saved=t,fetcher:async (url,options)=>{
    calls.push([url,options]); if(url.endsWith('/token')) return Response.json({access_token:'new',refresh_token:'r2'});
    return options.headers.Authorization==='Bearer old' ? new Response('',{status:401}) : Response.json({data:[]});
  }});
  await api.request('chat/messages',{}); assert.equal(calls.length,3); assert.equal(saved.access_token,'new'); assert.equal(calls[2][1].headers.Authorization,'Bearer new');
});
test('refreshes token nearing validation expiry', async () => {
  let validations=0;
  const api=new TwitchAPI({clientId:'mock',token:{access_token:'old',refresh_token:'r'},persist:async()=>{},fetcher:async url=>url.endsWith('/token')?Response.json({access_token:'new'}):Response.json({client_id:'mock',expires_in:++validations===1?10:3600})});
  await api.validate(); assert.equal(validations,2); assert.equal(api.token.access_token,'new');
});
test('rejects reconnect endpoints outside Twitch', () => { assert.match(allowedSocket('wss://eventsub.wss.twitch.tv/ws?x=1'),/^wss:/); for(const url of ['ws://eventsub.wss.twitch.tv','wss://evil.example','wss://user@eventsub.wss.twitch.tv']) assert.throws(()=>allowedSocket(url)); });
test('EventSub subscribes all events and dispatches moderation', async () => {
  let socket; class MockSocket { constructor(){socket=this;this.listeners={};} addEventListener(name,cb){this.listeners[name]=cb;} close(){this.listeners.close?.();} }
  const subscriptions=[], events=[];
  const p={message:async e=>events.push(e.message_id),hide:id=>events.push(id),clearUser:id=>events.push(id),clear:()=>events.push('clear')};
  const reader=new TwitchReader({request:async(path,body)=>subscriptions.push(body)},p,{Socket:MockSocket,broadcaster:'b',user:'u'});
  reader.connect('wss://eventsub.wss.twitch.tv/ws');
  await socket.listeners.message({data:JSON.stringify({metadata:{message_type:'session_welcome'},payload:{session:{id:'session',keepalive_timeout_seconds:30}}})});
  assert.equal(subscriptions.length,4);
  for(const [type,event] of [['channel.chat.message',{message_id:'m'}],['channel.chat.message_delete',{message_id:'d'}],['channel.chat.clear_user_messages',{target_user_id:'u'}],['channel.chat.clear',{}]]) await socket.listeners.message({data:JSON.stringify({metadata:{message_type:'notification'},payload:{subscription:{type},event}})});
  assert.deepEqual(events,['m','d','u','clear']);reader.stop();
});
test('local fixture serves overlay, SSE and protected moderation controls', async t => {
  const app=await createApp({fixture:true,port:0}); t.after(()=>app.close());
  const overlay=await fetch(`${app.address}/overlay`);assert.equal(overlay.status,200);assert.match(await overlay.text(),/Overlay/);
  const sse=await fetch(`${app.address}/events`);const stream=sse.body.getReader(); const chunk=new TextDecoder().decode((await stream.read()).value);assert.match(chunk,/"fixture":true/);assert.match(chunk,/synthetic-0/);await stream.cancel();
  const blocked=await fetch(`${app.address}/hide`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"id":"synthetic-0"}'}); assert.equal(blocked.status,403);
  const hidden=await fetch(`${app.address}/hide`,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.address},body:'{"id":"synthetic-0"}'}); assert.equal(hidden.status,204);assert.equal(app.pipeline.lines.length,0);
  assert.equal((await fetch(`${app.address}/.ponte-token.json`)).status,404);
});
test('evaluation reports absent providers honestly', async () => { assert.equal(chrF('hello','hello'),100);assert.equal(chrF('abc','xyz'),0);const r=await evaluate(undefined,{apiKey:''});assert.equal(r.rows,50);assert.match(r.reports[0].status,/NOT RUN/);assert.equal(r.reports[3].samples,50);assert.equal(r.reports[3].emotesKept,1); });
test('device authorization polls pending, slows down and saves successful token', async () => {
  const delays=[]; let polls=0,saved;
  await authenticate({clientId:'mock',wait:async ms=>delays.push(ms),log:()=>{},persist:async token=>saved=token,fetcher:async url=>{
    if(url.endsWith('/device')) return Response.json({device_code:'synthetic',user_code:'TEST',verification_uri:'https://example.com',expires_in:600,interval:5});
    polls++; return polls===1?Response.json({message:'authorization_pending'},{status:400}):polls===2?Response.json({message:'slow_down'},{status:400}):Response.json({access_token:'synthetic'});
  }});
  assert.deepEqual(delays,[5000,5000,10000]);assert.equal(saved.access_token,'synthetic');
});
test('broadcaster messages translate even when broadcaster and bot are the same account', async () => { const p=new Pipeline({botUser:'pt1',translator:async text=>({original:text,translated:'hey',direction:'pt-en',engine:'offline'})});await p.message(eventFor(0));assert.equal(p.lines.length,1); });
test('bilingual topic summary parses provider JSON', async () => { const result=await summarize([],{apiKey:'synthetic',fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify({pt:'Falam do jogo.',en:'Discussing the game.'})}}]})});assert.equal(result.en,'Discussing the game.'); });
test('deletion cancels an in-flight provider recap', async () => { let resolve;const published=[];const p=new Pipeline({translator:async()=>({original:'secret',translated:'secret',direction:'pt-en'}),publish:(type,data)=>published.push([type,data]),summarizer:()=>new Promise(r=>resolve=r)});await p.message(eventFor(0));const pending=p.recap();p.hide('synthetic-0');resolve({pt:'secret',en:'secret'});await pending;assert.equal(published.filter(([type,data])=>type==='recap'&&data.en==='secret').length,0); });
