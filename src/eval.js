import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { protect, offline, groq } from './translate.js';
function grams(s, n) { const result = new Map(), chars = [...s.replace(/\s/gu, '')]; for (let i = 0; i <= chars.length - n; i++) { const key = chars.slice(i, i+n).join(''); result.set(key, (result.get(key) || 0) + 1); } return result; }
export function chrF(hypothesis, reference) {
  let precision = 0, recall = 0, orders = 0;
  for (let n = 1; n <= 6; n++) {
    const h = grams(hypothesis, n), r = grams(reference, n);
    const hc = [...h.values()].reduce((a,b) => a+b,0), rc = [...r.values()].reduce((a,b) => a+b,0);
    if (!hc || !rc) continue;
    let match = 0; for (const [key,count] of h) match += Math.min(count, r.get(key) || 0);
    precision += match/hc; recall += match/rc; orders++;
  }
  if (!orders) return hypothesis === reference ? 100 : 0;
  precision /= orders; recall /= orders;
  return precision + recall ? 100 * 5 * precision * recall / (4 * precision + recall) : 0;
}
export async function evaluate(path = new URL('../data/eval.jsonl', import.meta.url), { apiKey = process.env.GROQ_API_KEY, fetcher = fetch } = {}) {
  const rows = (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse);
  if (rows.some(r => typeof r.text !== 'string' || typeof r.reference !== 'string' || !Array.isArray(r.emotes) || !Array.isArray(r.slang))) throw new Error('Invalid evaluation rows');
  const reports = [];
  for (const mode of ['literal','no-glossary','full','offline']) {
    if (mode !== 'offline' && !apiKey) { reports.push({ mode, status: 'NOT RUN: no GROQ_API_KEY' }); continue; }
    const timings = []; let score = 0, kept = 0, emotes = 0, slang = 0, untranslated = 0, failures = 0;
    for (const row of rows) {
      const p = protect(row.text), start = performance.now(); let output;
      try { output = p.restore(mode === 'offline' ? offline(p.text, 'pt') : await groq(p.text, 'pt', { apiKey, mode, fetcher })); }
      catch { failures++; continue; }
      timings.push(performance.now() - start); score += chrF(output, row.reference);
      for (const token of row.emotes) { emotes++; kept += output.includes(token) ? 1 : 0; }
      for (const token of row.slang) { slang++; untranslated += output.toLocaleLowerCase().includes(token.toLocaleLowerCase()) ? 1 : 0; }
    }
    timings.sort((a,b) => a-b);
    const percentile = q => timings.length ? Number(timings[Math.ceil(q * timings.length)-1].toFixed(2)) : null;
    reports.push({ mode, status: failures ? 'INCOMPLETE' : 'OK', samples: timings.length, failures, chrF: timings.length ? Number((score/timings.length).toFixed(2)) : null, emotesKept: emotes ? kept/emotes : null, slangUntranslated: slang ? untranslated/slang : null, p50ms: percentile(.5), p95ms: percentile(.95) });
  }
  return { dataset: String(path), rows: rows.length, warning: 'Five synthetic starter rows are a smoke test, not a quality benchmark. chrF is sentence-macro, character orders 1–6, beta=2, whitespace removed. Slang coverage may be absent. Do not tune glossary on held-out data.', reports };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) evaluate(process.argv[2]).then(async report => { await writeFile(new URL('../eval-report.json', import.meta.url), JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2)); }).catch(e => { console.error(e.message); process.exitCode = 1; });
