const panel = document.body.classList.contains('panel');
const lines = document.querySelector('#lines');
const events = new EventSource('/events');
let fixture = true;
const el = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
async function action(path, data) {
  try { const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!response.ok) throw new Error(); }
  catch { alert('Ação não aplicada. Verifique a conexão.'); }
}
function button(text, callback) { const b = el('button', text); b.onclick = callback; return b; }
events.addEventListener('config', event => { const config = JSON.parse(event.data); fixture = config.fixture; document.querySelector('#badge').textContent = fixture ? 'FIXTURE / TEST CHAT · SYNTHETIC' : config.liveTest ? 'LIVE TWITCH TEST · SYNTHETIC' : 'LIVE'; });
events.addEventListener('state', event => {
  const state = JSON.parse(event.data); lines.replaceChildren();
  for (const line of state.lines.slice(panel ? -100 : -6)) {
    const card = el('article', '', `line ${line.direction}`);
    card.append(el('div', `${line.name} · ${line.direction} · ${line.engine}`, 'meta'), el('div', line.translated, 'translated'));
    const original = el('div', '', 'original');
    if (line.fragments.length && line.fragments.map(f => f.text).join('') === line.original) {
      for (const f of line.fragments) {
        if (!fixture && f.type === 'emote' && /^[a-zA-Z0-9_-]+$/.test(f.emote?.id)) { const img = el('img', '', 'emote'); img.alt = f.text; img.src = `https://static-cdn.jtvnw.net/emoticons/v2/${f.emote.id}/default/dark/2.0`; original.append(img); }
        else original.append(document.createTextNode(f.text));
      }
    } else original.textContent = line.original;
    card.append(original);
    if (panel) card.append(button('Hide', () => action('/hide', { id: line.id })), button('Pause', () => action('/pause', { user: line.user, paused: true })));
    lines.append(card);
  }
  if (panel) document.querySelector('#paused').replaceChildren(...state.paused.map(user => button(`Retomar ${user}`, () => action('/pause', { user, paused: false }))));
});
events.addEventListener('recap', event => { const recap = JSON.parse(event.data); document.querySelector('#recap').textContent = `${recap.pt}\n${recap.en}`; });
events.onopen = () => { if (panel) document.querySelector('#connection').textContent = 'Conectado · controle local'; };
events.onerror = () => { if (panel) document.querySelector('#connection').textContent = 'Reconectando…'; };

events.addEventListener('transport', event => { if (panel) document.querySelector('#connection').textContent = `Controle local · Twitch EventSub: ${JSON.parse(event.data).state}`; });
