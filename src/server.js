import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Pipeline } from './pipeline.js';
import { TwitchAPI } from './auth.js';
import { TwitchReader } from './twitch.js';
import { eventFor } from './fixture.js';
import { translate, summarize } from './translate.js';
import { sendChat } from './chat.js';
export async function createApp({ fixture = false, port = 8787, acceptMessage, onTwitchStatus, liveTest = false } = {}) {
  const peers = new Set();
  const publish = (type, data) => { for (const peer of peers) peer.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); };
  let api, reader, ticker, recapTimer, heartbeat;
  const pipeline = new Pipeline({ publish, acceptMessage, summarizer: fixture || !process.env.GROQ_API_KEY ? undefined : summarize, botUser: fixture ? undefined : process.env.TWITCH_USER_ID, translator: (text, fragments) => translate(text, fragments, fixture ? { apiKey: '' } : {}), reply: async message => {
    if (fixture) { console.log(`[SYNTHETIC reply] ${message}`); return; }
    return sendChat(api, message);
  } });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const expectedHost = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== expectedHost) { res.writeHead(403); res.end('Use the loopback URL'); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://static-cdn.jtvnw.net; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
      if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
        peers.add(res); res.write(`event: config\ndata: ${JSON.stringify({ fixture, liveTest })}\n\nevent: state\ndata: ${JSON.stringify(pipeline.snapshot())}\n\n`);
        req.on('close', () => peers.delete(res)); return;
      }
      if (req.method === 'POST' && ['/hide','/pause'].includes(url.pathname)) {
        if (req.headers.origin !== `http://${expectedHost}` || req.headers['content-type'] !== 'application/json') { res.writeHead(403); res.end(); return; }
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413); res.end(); return; } }
        const data = JSON.parse(body);
        if (url.pathname === '/hide' && typeof data.id === 'string') pipeline.hide(data.id);
        else if (url.pathname === '/pause' && typeof data.user === 'string' && typeof data.paused === 'boolean') pipeline.pause(data.user, data.paused);
        else { res.writeHead(400); res.end(); return; }
        // Recompute after moderation so stale recap text is removed too.
        await pipeline.recap(); res.writeHead(204); res.end(); return;
      }
      const files = { '/': ['panel.html','text/html'], '/panel': ['panel.html','text/html'], '/overlay': ['overlay.html','text/html'], '/app.js': ['app.js','text/javascript'], '/style.css': ['style.css','text/css'] };
      if (req.method === 'GET' && files[url.pathname]) {
        const [file, mime] = files[url.pathname]; res.setHeader('Content-Type', `${mime}; charset=utf-8`); res.end(await readFile(new URL(`../public/${file}`, import.meta.url))); return;
      }
      res.writeHead(404); res.end('Not found');
    } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
  });
  if (!fixture) {
    for (const key of ['TWITCH_CLIENT_ID','TWITCH_BROADCASTER_ID','TWITCH_USER_ID']) if (!process.env[key]) throw new Error(`Missing ${key}; use npm run fixture for offline demo`);
    api = new TwitchAPI(); await api.load();
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  if (fixture) { let index = 0; await pipeline.message(eventFor(index++)); ticker = setInterval(() => pipeline.message(eventFor(index++)).catch(e => console.error(e.message)), 2500); }
  else { reader = new TwitchReader(api, pipeline, { onStatus: status => { publish('transport', status); onTwitchStatus?.(status); } }); reader.start(); }
  recapTimer = setInterval(() => pipeline.recap(), 60000);
  heartbeat = setInterval(() => { for (const peer of peers) peer.write(': heartbeat\n\n'); }, 15000);
  const address = `http://127.0.0.1:${server.address().port}`;
  console.log(`Ponte ${fixture ? 'FIXTURE / TEST CHAT (SYNTHETIC, offline)' : 'LIVE'}: ${address}/panel | ${address}/overlay`);
  return { server, pipeline, address, reader, api, async close() { clearInterval(ticker); clearInterval(recapTimer); clearInterval(heartbeat); reader?.stop(); for (const peer of peers) peer.end(); await new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) createApp({ fixture: process.argv.includes('--fixture'), port: Number(process.env.PORT || 8787) }).then(app => {
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => app.close().then(() => process.exit()));
}).catch(e => { console.error(e.message); process.exitCode = 1; });
