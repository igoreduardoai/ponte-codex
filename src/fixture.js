export const fixtureLines = [
  ['pt1', 'Ana', 'salve @chat Kappa https://example.com 😀'],
  ['en1', 'Sam', 'hello good game Kappa'],
  ['pt2', 'Bia', 'bora jogo muito legal LUL'],
  ['en2', 'Alex', 'thanks @Ana cool game 🎮'],
  ['pt3', 'Leo', 'valeu mano boa noite PogChamp']
];
export function eventFor(index) {
  const [user, name, text] = fixtureLines[index % fixtureLines.length];
  return { message_id: `synthetic-${index}`, chatter_user_id: user, chatter_user_name: name, chatter_user_login: name.toLowerCase(), message: { text, fragments: text.split(/(Kappa|LUL|PogChamp)/).filter(Boolean).map(text => ['Kappa','LUL','PogChamp'].includes(text) ? { type: 'emote', text, emote: { id: { Kappa: '25', LUL: '425618', PogChamp: '305954156' }[text] } } : { type: 'text', text }) } };
}
