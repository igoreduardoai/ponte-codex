const types = ['channel.chat.message', 'channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear'];
export function allowedSocket(url) {
  const u = new URL(url);
  if (u.protocol !== 'wss:' || u.hostname !== 'eventsub.wss.twitch.tv' || u.port || u.username || u.password) throw new Error('Unexpected EventSub reconnect host');
  return u.href;
}
export class TwitchReader {
  constructor(api, pipeline, { broadcaster = process.env.TWITCH_BROADCASTER_ID, user = process.env.TWITCH_USER_ID, Socket = WebSocket, onStatus = () => {} } = {}) {
    this.api = api; this.pipeline = pipeline; this.broadcaster = broadcaster; this.user = user; this.Socket = Socket; this.stopped = false;
    this.sockets = new Set();
    this.onStatus = onStatus;
  }
  start() {
    this.connect('wss://eventsub.wss.twitch.tv/ws');
    this.validation = setInterval(() => this.api.validate().catch(e => { console.error(e.message); this.stop(); }), 3600000);
  }
  connect(url, transfer = false) {
    if (this.stopped) return;
    this.onStatus({ state: 'connecting' });
    const ws = new this.Socket(allowedSocket(url));
    this.sockets.add(ws);
    if (!transfer) this.socket = ws;
    let watchdog, keepalive = 15;
    const reset = (seconds = keepalive) => { keepalive = seconds; clearTimeout(watchdog); watchdog = setTimeout(() => ws.close(), (seconds + 5) * 1000); };
    reset();
    ws.addEventListener('message', async ({ data }) => {
      try {
        const packet = JSON.parse(data), { metadata, payload } = packet;
        reset(payload.session?.keepalive_timeout_seconds || keepalive);
        if (metadata.message_type === 'session_welcome') {
          const old = this.socket; this.socket = ws; if (transfer) old?.close();
          if (!transfer) for (const type of types) await this.api.request('eventsub/subscriptions', { type, version: '1', condition: { broadcaster_user_id: this.broadcaster, user_id: this.user }, transport: { method: 'websocket', session_id: payload.session.id } });
          this.onStatus({ state: 'ready', subscriptions: [...types], transfer });
          console.log('Twitch EventSub connected.');
        } else if (metadata.message_type === 'session_reconnect') {
          this.connect(payload.session.reconnect_url, true);
        } else if (metadata.message_type === 'notification') {
          const type = payload.subscription.type, event = payload.event;
          if (type === 'channel.chat.message') await this.pipeline.message(event);
          else if (type === 'channel.chat.message_delete') this.pipeline.hide(event.message_id);
          else if (type === 'channel.chat.clear_user_messages') this.pipeline.clearUser(event.target_user_id);
          else if (type === 'channel.chat.clear') this.pipeline.clear();
        } else if (metadata.message_type === 'revocation') { console.error('EventSub authorization revoked.'); this.stop(); }
      } catch (error) { console.error(error.message); this.onStatus({ state: 'error', error: error.message }); ws.close(); }
    });
    ws.addEventListener('error', () => console.error('EventSub socket error.'));
    ws.addEventListener('close', () => {
      clearTimeout(watchdog);
      this.sockets.delete(ws);
      if (!this.stopped && (!this.socket || this.socket === ws)) { this.onStatus({ state: 'disconnected' }); this.retry = setTimeout(() => this.connect('wss://eventsub.wss.twitch.tv/ws'), 3000); }
    });
    if (!this.socket) this.socket = ws;
  }
  stop() { this.stopped = true; clearInterval(this.validation); clearTimeout(this.retry); for (const socket of this.sockets) socket.close(); this.onStatus({ state: 'stopped' }); }
}
