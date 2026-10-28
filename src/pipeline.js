import { translate } from './translate.js';
export class Pipeline {
  constructor({ publish = () => {}, reply = async () => {}, translator = translate, ignoreUser, summarizer } = {}) {
    this.publish = publish; this.reply = reply; this.translator = translator;
    this.lines = []; this.paused = new Set(); this.optedOut = new Set(); this.deleted = new Set(); this.epoch = 0; this.userEpoch = new Map();
    this.recent = new Set(); this.commandTimes = new Map();
    this.ignoreUser = ignoreUser;
    this.summarizer = summarizer; this.moderationVersion = 0;
  }
  snapshot() { return { lines: this.lines, paused: [...this.paused] }; }
  async message(event) {
    if (this.ignoreUser && event.chatter_user_id === this.ignoreUser) return;
    if (this.recent.has(event.message_id)) return;
    this.recent.add(event.message_id);
    if (this.recent.size > 5000) this.recent.delete(this.recent.values().next().value);
    const user = event.chatter_user_id, text = event.message.text;
    const command = text.trim().toLowerCase();
    if (/^!ponte(?: (?:on|off))?$/.test(command)) {
      if (command.endsWith(' off')) this.optedOut.add(user);
      if (command.endsWith(' on')) this.optedOut.delete(user);
      this.userEpoch.set(user, (this.userEpoch.get(user) || 0) + 1);
      if (Date.now() - (this.commandTimes.get(user) || 0) > 10000) {
        this.commandTimes.set(user, Date.now());
        await this.reply(`@${event.chatter_user_login} Ponte: ${this.optedOut.has(user) ? 'OFF' : 'ON'} — PT ↔ EN`);
      }
      return;
    }
    if (this.paused.has(user) || this.optedOut.has(user)) return;
    const epoch = this.epoch, userEpoch = this.userEpoch.get(user) || 0;
    const result = await this.translator(text, event.message.fragments);
    if (epoch !== this.epoch || userEpoch !== (this.userEpoch.get(user) || 0) || this.deleted.has(event.message_id) || this.paused.has(user) || this.optedOut.has(user)) return;
    this.lines.push({ id: event.message_id, user, name: event.chatter_user_name, fragments: event.message.fragments || [], ...result });
    this.lines = this.lines.slice(-100); this.publish('state', this.snapshot());
  }
  hide(id) { this.moderationVersion++; this.deleted.add(id); this.lines = this.lines.filter(l => l.id !== id); this.publish('recap', { pt: '', en: '' }); this.publish('state', this.snapshot()); }
  clearUser(user) { this.moderationVersion++; this.userEpoch.set(user, (this.userEpoch.get(user) || 0) + 1); this.lines = this.lines.filter(l => l.user !== user); this.publish('recap', { pt: '', en: '' }); this.publish('state', this.snapshot()); }
  clear() { this.moderationVersion++; this.epoch++; this.lines = []; this.deleted.clear(); this.publish('recap', { pt: '', en: '' }); this.publish('state', this.snapshot()); }
  pause(user, paused) { if (paused) { this.paused.add(user); this.clearUser(user); } else this.paused.delete(user); this.publish('state', this.snapshot()); }
  async recap() {
    if (this.summarizing) return;
    const version = this.moderationVersion;
    const pt = this.lines.filter(l => l.direction === 'pt-en').slice(-3);
    const en = this.lines.filter(l => l.direction === 'en-pt').slice(-3);
    // Extractive recap: quotes only visible lines, so removed messages cannot leak.
    let result = { pt: `Trechos recentes do chat EN: ${en.map(l => l.translated).join(' • ') || '—'}`, en: `Recent PT chat excerpts: ${pt.map(l => l.translated).join(' • ') || '—'}` };
    if (this.summarizer && this.lines.length) {
      this.summarizing = true;
      try { result = await this.summarizer(this.lines.slice(-30)); } catch { /* Offline extractive recap remains visibly labeled. */ }
      finally { this.summarizing = false; }
    }
    if (version !== this.moderationVersion) return;
    this.publish('recap', result); return result;
  }
}
