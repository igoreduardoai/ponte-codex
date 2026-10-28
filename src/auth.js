import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const tokenPath = new URL('../.ponte-token.json', import.meta.url);
export async function saveToken(token) {
  const temp = new URL('../.ponte-token.json.tmp', import.meta.url);
  await writeFile(temp, JSON.stringify(token), { mode: 0o600 });
  await chmod(temp, 0o600);
  await rename(temp, tokenPath);
}
export class TwitchAPI {
  constructor({ clientId = process.env.TWITCH_CLIENT_ID, fetcher = fetch, token, persist = saveToken } = {}) {
    this.clientId = clientId; this.fetcher = fetcher; this.token = token; this.persist = persist;
  }
  async load() { this.token = JSON.parse(await readFile(tokenPath, 'utf8')); await this.validate(); }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const response = await this.fetcher('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id: this.clientId, grant_type: 'refresh_token', refresh_token: this.token.refresh_token }) });
      if (!response.ok) throw new Error(`Token refresh failed (${response.status}); run npm run auth`);
      this.token = { ...this.token, ...await response.json() }; await this.persist(this.token);
    })();
    try { await this.refreshing; } finally { this.refreshing = null; }
  }
  async validate(retry = true) {
    const r = await this.fetcher('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${this.token.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (r.status === 401 && retry) { await this.refresh(); return this.validate(false); }
    if (!r.ok) throw new Error(`Token validation failed (${r.status})`);
    const info = await r.json();
    if (info.client_id !== this.clientId) throw new Error('Token belongs to a different client');
    if (process.env.TWITCH_USER_ID && info.user_id !== process.env.TWITCH_USER_ID) throw new Error('TWITCH_USER_ID does not match token owner');
    if (info.expires_in < 300 && retry) { await this.refresh(); return this.validate(false); }
    return info;
  }
  async request(path, body, retry = true) {
    const r = await this.fetcher(`https://api.twitch.tv/helix/${path}`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${this.token.access_token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401 && retry) { await this.refresh(); return this.request(path, body, false); }
    if (!r.ok) throw new Error(`Twitch HTTP ${r.status}: ${await r.text()}`);
    return r.status === 204 ? {} : r.json();
  }
}
export async function authenticate({ clientId = process.env.TWITCH_CLIENT_ID, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), persist = saveToken, log = console.log } = {}) {
  const client_id = clientId;
  if (!client_id) throw new Error('Set TWITCH_CLIENT_ID in .env first');
  const r = await fetcher('https://id.twitch.tv/oauth2/device', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id, scopes: 'user:read:chat user:write:chat' }) });
  if (!r.ok) throw new Error(`Device authorization HTTP ${r.status}`);
  const device = await r.json();
  log(`Open ${device.verification_uri} and enter ${device.user_code}`);
  let interval = Math.max(5, device.interval || 5);
  const deadline = Date.now() + device.expires_in * 1000;
  while (Date.now() < deadline) {
    await wait(interval * 1000);
    const result = await fetcher('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id, device_code: device.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }) });
    const data = await result.json();
    if (result.ok) { await persist(data); log('Token saved locally with mode 0600.'); return; }
    const reason = data.message || data.error;
    if (reason === 'slow_down') { interval += 5; continue; }
    if (reason !== 'authorization_pending') throw new Error(`Authorization failed: ${reason}`);
  }
  throw new Error('Device code expired; run npm run auth again');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) authenticate().catch(e => { console.error(e.message); process.exitCode = 1; });
