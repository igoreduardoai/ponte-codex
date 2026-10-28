import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pipeline} from '../src/pipeline.js';
import {sendChat} from '../src/chat.js';
import {eventFor} from '../src/fixture.js';

test('bot reply arriving before Helix acknowledgement is filtered without excluding broadcaster chat',async()=>{
  let translated=0;let p;
  p=new Pipeline({botUser:'pt1',translator:async text=>{translated++;return {original:text,translated:text};},reply:async text=>{
    await p.message({...eventFor(0),message_id:'reply-race',message:{text}});
    return 'reply-race';
  }});
  await p.message({...eventFor(0),message_id:'command',message:{text:'!ponte'}});
  assert.equal(translated,0);assert.equal(p.lines.length,0);
  await p.message({...eventFor(0),message_id:'human'});
  assert.equal(translated,1);assert.equal(p.lines.length,1);
});
test('live-test event filter drops unrelated messages before provider calls',async()=>{
  const p=new Pipeline({acceptMessage:e=>e.message.text.startsWith('[TEST]'),translator:async text=>({original:text,translated:text})});
  await p.message(eventFor(0));assert.equal(p.lines.length,0);
  await p.message({...eventFor(1),message:{text:'[TEST] hello'}});assert.equal(p.lines.length,1);
});
test('Helix HTTP success with a dropped chat message is a failure, not a sent reply',async()=>{
  await assert.rejects(sendChat({request:async()=>({data:[{is_sent:false,drop_reason:{code:'automod_held'}}]})},'test'),/automod_held/);
  await assert.rejects(sendChat({request:async()=>({data:[]})},'test'),/missing acknowledgement/);
  assert.equal(await sendChat({request:async()=>({data:[{is_sent:true,message_id:'sent-id'}]})},'test'),'sent-id');
});
test('empty-side recap labels use the right language and fallback never claims Groq',async()=>{
  const p=new Pipeline({translator:async text=>({original:text,translated:'hello',direction:'pt-en'}),summarizer:async()=>({pt:'no recent messages',en:'Portuguese chat is greeting.'})});
  await p.message(eventFor(0));
  const live=await p.recap();assert.equal(live.pt,'Sem mensagens recentes em inglês.');assert.equal(live.engine,'groq');
  p.summarizer=async()=>{throw new Error('Provider unavailable');};
  const fallback=await p.recap();assert.equal(fallback.engine,'extractive');assert.match(fallback.en,/Recent PT chat excerpts/);
});
