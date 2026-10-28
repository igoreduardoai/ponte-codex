import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { evaluate } from '../src/eval.js';
import { sessionEvidence } from '../scripts/session-id.js';
import { runGroqSmoke } from '../scripts/groq-smoke.js';

async function dataset(t, rows) {
  const dir = await mkdtemp(join(tmpdir(),'ponte-eval-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const path = join(dir,'test.jsonl');
  await writeFile(path, rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  return path;
}
test('50-row dataset executes with per-example outputs, fragments, occurrence counts and source provenance', async () => {
  const path = new URL('../data/eval-50.jsonl',import.meta.url);
  const report = await evaluate(path,{apiKey:''});
  const rows = (await readFile(path,'utf8')).trim().split('\n').map(JSON.parse);
  const offline = report.reports.find(r=>r.mode==='offline');
  assert.equal(report.rows,50); assert.equal(offline.samples,50); assert.equal(offline.details.length,50);
  assert.equal(new Set(offline.details.map(r=>r.id)).size,50);
  assert.equal(offline.emoteOccurrences,rows.reduce((total,row)=>total+row.emotes.reduce((n,token)=>n+row.text.split(token).length-1,0),0));
  assert.equal(offline.emotesKept,1); assert.equal(offline.protectedTokensKept,1);
  assert.match(offline.details.find(r=>r.id==='pt-47').output,/SubHype/);
  assert.match(offline.details.find(r=>r.id==='pt-48').output,/DevDance/);
  assert.ok(offline.slangOccurrences>20);
  assert.equal(report.datasetSHA256,createHash('sha256').update(await readFile(path)).digest('hex'));
  assert.equal(report.reports.filter(r=>r.status.startsWith('NOT RUN')).length,3);
});
test('duplicate ids, duplicate text and nonexistent annotations reject evaluation', async t => {
  const row={id:'a',text:'oi Kappa',reference:'hi Kappa',emotes:['Kappa'],slang:[]};
  await assert.rejects(evaluate(await dataset(t,[row,{...row,text:'bom jogo'}]),{apiKey:''}),/Invalid emotes/);
  await assert.rejects(evaluate(await dataset(t,[row,{...row,text:'bom Kappa'}]),{apiKey:''}),/Duplicate/);
  await assert.rejects(evaluate(await dataset(t,[row,{...row,id:'b'}]),{apiKey:''}),/Duplicate/);
});
test('provider failures remain failures and never count as offline provider results', async t => {
  const path=await dataset(t,[{text:'oi Kappa',reference:'hi Kappa',emotes:['Kappa'],slang:[]}]);
  const report=await evaluate(path,{apiKey:'synthetic',fetcher:async()=>new Response('',{status:429})});
  for(const result of report.reports.slice(0,3)) { assert.equal(result.status,'INCOMPLETE');assert.equal(result.samples,0);assert.equal(result.failures,1);assert.equal(result.chrF,null);assert.equal(result.details[0].status,'FAILED'); }
  assert.equal(report.reports[3].status,'OK');
});
test('slang diagnostics match words rather than substrings', async t => {
  const path=await dataset(t,[{text:'pra',reference:'for',emotes:[],slang:['pra']}]);
  const report=await evaluate(path,{apiKey:'synthetic',fetcher:async()=>Response.json({choices:[{message:{content:'practice'}}]})});
  assert.equal(report.reports[0].slangUntranslated,0);
});
test('rate-limit retries honor provider wait and preserve results without translation fallback', async t => {
  const path=await dataset(t,[{text:'oi Kappa',reference:'hi Kappa',emotes:['Kappa'],slang:[]}]);
  let calls=0;const waits=[];
  const report=await evaluate(path,{apiKey:'synthetic',maxRateLimitRetries:1,wait:async ms=>waits.push(ms),fetcher:async()=>++calls%2===1?new Response('',{status:429,headers:{'Retry-After':'42'}}):Response.json({choices:[{message:{content:'hi __PONTE_0__'}}]})});
  assert.deepEqual(waits,[42000,42000,42000]);
  for(const result of report.reports.slice(0,3)) { assert.equal(result.status,'OK');assert.equal(result.samples,1);assert.equal(result.details[0].retries,1);assert.equal(result.details[0].output,'hi Kappa'); }
});
test('session extraction uses evidence, rejects absent or conflicting IDs', () => {
  assert.throws(()=>sessionEvidence({}),/No active/);
  assert.throws(()=>sessionEvidence({CODEX_SESSION_ID:'a',CODEX_THREAD_ID:'b'}),/Conflicting/);
  assert.throws(()=>sessionEvidence({CODEX_SESSION_ID:'example'}),/Unexpected/);
  const id='00000000-0000-4000-8000-000000000001';
  assert.equal(sessionEvidence({CODEX_SESSION_ID:id,CODEX_THREAD_ID:id}).session_id,id);
});
test('real-provider smoke cannot pass on offline fallbacks', async () => {
  const report=await runGroqSmoke({apiKey:'synthetic',wait:async()=>{},translator:async text=>({engine:'offline',translated:text})});
  assert.equal(report.status,'FAIL');
  assert.equal(report.checks.filter(c=>c.status==='PASS').length,0);
});
