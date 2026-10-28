export async function sendChat(api, message, { broadcaster = process.env.TWITCH_BROADCASTER_ID, sender = process.env.TWITCH_USER_ID } = {}) {
  const result = await api.request('chat/messages', { broadcaster_id: broadcaster, sender_id: sender, message });
  const sent = result.data?.[0];
  if (sent?.is_sent !== true || !sent.message_id) throw new Error(`Chat message rejected: ${sent?.drop_reason?.code || 'missing acknowledgement'}`);
  return sent.message_id;
}
