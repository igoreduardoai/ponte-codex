import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { protect, offline, groq, glossary, detect } from './translate.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const round = value => Number(value.toFixed(2));
const occurrences = (text, token) => text.split(token).length - 1;
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slangOccurrences = (text, token) => [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(token)}(?![\\p{L}\\p{N}_])`, 'giu'))].length;

function grams(s, n) {
  const result = new Map(), chars = [...s.replace(/\s/gu, '')];
  for (let i = 0; i <= chars.length - n; i++) {
    const key = chars.slice(i, i+n).join('');
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}
export function chrF(hypothesis, reference) {
  let precision = 0, recall = 0, orders = 0;
  for (let n = 1; n <= 6; n++) {
    const h = grams(hypothesis, n), r = grams(reference, n);
    const hc = [...h.values()].reduce((a,b) => a+b,0), rc = [...r.values()].reduce((a,b) => a+b,0);
    if (!hc || !rc) continue;
    let match = 0;
    for (const [key,count] of h) match += Math.min(count, r.get(key) || 0);
    precision += match/hc; recall += match/rc; orders++;
  }
  if (!orders) return hypothesis === reference ? 100 : 0;
  precision /= orders; recall /= orders;
  return precision + recall ? 100 * 5 * precision * recall / (4 * precision + recall) : 0;
}
function parseRows(raw) {
  const rows = raw.trim().split(/\r?\n/).map((line,index) => {
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`Invalid JSON on dataset line ${index+1}`); }
    for (const key of ['text','reference']) if (typeof row[key] !== 'string' || !row[key].trim()) throw new Error(`Missing ${key} on dataset line ${index+1}`);
    for (const key of ['emotes','slang']) {
      if (!Array.isArray(row[key]) || row[key].some(token => typeof token !== 'string' || !token || !row.text.includes(token)) || new Set(row[key]).size !== row[key].length) throw new Error(`Invalid ${key} annotations on dataset line ${index+1}`);
    }
    if (row.fragments && (!Array.isArray(row.fragments) || row.fragments.some(f => typeof f.text !== 'string') || row.fragments.map(f=>f.text).join('') !== row.text)) throw new Error(`Invalid fragments on dataset line ${index+1}`);
    if (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) throw new Error(`Invalid id on dataset line ${index+1}`);
    return { ...row, id: row.id || `row-${index+1}` };
  });
  if (new Set(rows.map(r => r.id)).size !== rows.length || new Set(rows.map(r=>r.text)).size !== rows.length) throw new Error('Duplicate dataset id or input');
  return rows;
}
export async function evaluate(path = new URL('../data/eval-50.jsonl', import.meta.url), { apiKey = process.env.GROQ_API_KEY, fetcher = fetch, minIntervalMs = 0, maxRateLimitRetries = 0, wait = ms => new Promise(resolve=>setTimeout(resolve,ms)), onProgress = () => {} } = {}) {
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0 || !Number.isInteger(maxRateLimitRetries) || maxRateLimitRetries < 0 || maxRateLimitRetries > 3) throw new Error('Invalid evaluation pacing options');
  const raw = await readFile(path, 'utf8'), rows = parseRows(raw), reports = [];
  let lastProviderStart = 0;
  for (const mode of ['literal','no-glossary','full','offline']) {
    if (mode !== 'offline' && !apiKey) { reports.push({ mode, status: 'NOT RUN: no GROQ_API_KEY', samples: 0 }); continue; }
    const timings = [], details = [];
    let score = 0, kept = 0, emotes = 0, slang = 0, untranslated = 0, failures = 0, protectedCount = 0, protectedKept = 0;
    for (const [index,row] of rows.entries()) {
      const p = protect(row.text, row.fragments);
      if (mode !== 'offline' && minIntervalMs) await wait(Math.max(0,minIntervalMs-(Date.now()-lastProviderStart)));
      const start = performance.now();
      let output, retries = 0;
      try {
        if (mode === 'offline') output = p.restore(offline(p.text,'pt'));
        else while (true) {
          let retryAfterMs = 31000;
          lastProviderStart = Date.now();
          const observedFetch = async (...args) => {
            const response = await fetcher(...args);
            if (response.status === 429) {
              const seconds = Number(response.headers.get('retry-after'));
              if (Number.isFinite(seconds) && seconds > 0) retryAfterMs = Math.max(retryAfterMs, Math.ceil(seconds*1000));
            }
            return response;
          };
          try { output = p.restore(await groq(p.text,'pt',{apiKey,mode,fetcher:observedFetch})); break; }
          catch(error) {
            if (error.message !== 'Groq HTTP 429' || retries >= maxRateLimitRetries) throw error;
            retries++; onProgress({mode,index:index+1,total:rows.length,status:'RATE_LIMIT_WAIT',retries,waitMs:retryAfterMs});
            await wait(retryAfterMs);
          }
        }
      } catch (error) { failures++; details.push({ id: row.id, status: 'FAILED', error: error.message, retries, latencyMs: round(performance.now()-start) }); onProgress({mode,index:index+1,total:rows.length,status:'FAILED'}); continue; }
      const latency = performance.now()-start, rowScore = chrF(output, row.reference);
      timings.push(latency); score += rowScore;
      for (const token of row.emotes) {
        const expected = occurrences(row.text, token);
        emotes += expected; kept += Math.min(expected, occurrences(output, token));
      }
      for (const token of new Set(p.values.map(([,value])=>value))) {
        const expected = occurrences(row.text, token);
        protectedCount += expected; protectedKept += Math.min(expected, occurrences(output, token));
      }
      for (const token of row.slang) {
        const expected = slangOccurrences(row.text,token);
        slang += expected; untranslated += Math.min(expected, slangOccurrences(output,token));
      }
      details.push({ id: row.id, category: row.category || 'unspecified', input: row.text, reference: row.reference, output, detectedLanguage: detect(row.text), status: 'OK', retries, chrF: round(rowScore), latencyMs: round(latency) });
      onProgress({mode,index:index+1,total:rows.length,status:'OK'});
    }
    timings.sort((a,b)=>a-b);
    const percentile = q => timings.length ? round(timings[Math.ceil(q*timings.length)-1]) : null;
    reports.push({ mode, status: failures ? 'INCOMPLETE' : 'OK', samples: timings.length, failures,
      chrF: timings.length ? round(score/timings.length) : null,
      emotesKept: emotes ? kept/emotes : null, emoteOccurrences: emotes,
      protectedTokensKept: protectedCount ? protectedKept/protectedCount : null, protectedTokenOccurrences: protectedCount,
      slangUntranslated: slang ? untranslated/slang : null, slangOccurrences: slang,
      p50ms: percentile(.5), p95ms: percentile(.95), latencyScope: 'successful samples including retries/backoff, excluding initial scheduled pacing', preservationScope: 'successful translations only; failed rows are excluded and reported separately', details });
  }
  return {
    dataset: String(path), datasetSHA256: sha256(raw), rows: rows.length,
    translatorSourceSHA256: sha256(await readFile(new URL('./translate.js', import.meta.url))),
    glossarySHA256: sha256(JSON.stringify(glossary)),
    pacing: { minIntervalMs, maxRateLimitRetries },
    ptDetectionRate: rows.filter(r=>detect(r.text)==='pt').length/rows.length,
    warning: `${rows.length} PT→EN synthetic/reference examples. Authored by the implementation author, not a blind independent benchmark. No held-out EN→PT coverage. chrF is sentence-macro, character orders 1–6, beta=2, whitespace removed. Slang retention is a diagnostic, not semantic accuracy.`,
    reports
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  evaluate(process.argv[2], { minIntervalMs: Number(process.env.PONTE_EVAL_INTERVAL_MS || 3000), maxRateLimitRetries: 3, onProgress: info => {
    if (info.index%10===0 || info.index===info.total || info.status!=='OK') console.error(`${info.mode} ${info.index}/${info.total}: ${info.status}${info.waitMs ? ` (${info.waitMs}ms)` : ''}`);
  } }).then(async report => {
    const output = process.argv[3] ? resolve(process.argv[3]) : new URL('../eval-report.json',import.meta.url);
    await writeFile(output, JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ ...report, reports: report.reports.map(({ details, ...summary }) => summary), output: String(output) },null,2));
    if (report.reports.some(r=>r.status==='INCOMPLETE')) process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
