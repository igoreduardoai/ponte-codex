import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { translate, summarize } from '../src/translate.js';

export async function runGroqSmoke({ apiKey = process.env.GROQ_API_KEY, translator = translate, summarizer = summarize, wait = ms=>new Promise(resolve=>setTimeout(resolve,ms)) } = {}) {
  if (!apiKey) throw new Error('GROQ_API_KEY is missing; no real Groq test executed');
  const cases = [
    { name: 'PT→EN + protected emote/mention/URL', lang: 'pt', text: 'salve @ponte_test Kappa https://example.com/teste', protected: ['@ponte_test','Kappa','https://example.com/teste'] },
    { name: 'EN→PT + protected emote/emoji', lang: 'en', text: 'hello, good game LUL 🎮', protected: ['LUL','🎮'] }
  ];
  const checks = [], outputs = [];
  for (const item of cases) {
    if (checks.length) await wait(3000);
    const started = performance.now();
    try {
      const result = await translator(item.text,[],{apiKey});
      assert.equal(result.engine,'groq','Offline fallback does not count as a real provider pass');
      assert.equal(result.direction,item.lang==='pt'?'pt-en':'en-pt');
      for (const token of item.protected) assert.ok(result.translated.includes(token),`Lost protected token ${token}`);
      assert.notEqual(result.translated,item.text,'Text was not translated');
      outputs.push(result);
      checks.push({ name:item.name,status:'PASS',...result,latencyMs:Math.round(performance.now()-started) });
    } catch(error) { checks.push({name:item.name,status:'FAIL',error:error.message}); }
  }
  await wait(3000);
  try {
    assert.equal(outputs.length,2,'Both directions must succeed before summary validation');
    const result=await summarizer(outputs,{apiKey});
    assert.ok(result.pt.trim() && result.en.trim());
    checks.push({name:'Bilingual topic summary',status:'PASS',...result});
  } catch(error) { checks.push({name:'Bilingual topic summary',status:'FAIL',error:error.message}); }
  return { observedAt:new Date().toISOString(), provider:'Groq', model:'openai/gpt-oss-20b', inputs:'Synthetic test messages only', status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL', checks };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const report=await runGroqSmoke();
    report.translatorSourceSHA256=createHash('sha256').update(await readFile(new URL('../src/translate.js',import.meta.url))).digest('hex');
    await writeFile(new URL('../docs/groq-smoke-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    if(report.status!=='PASS')process.exitCode=1;
  } catch(error) { console.error(error.message);process.exitCode=2; }
}
