import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function livePreflight(env = process.env) {
  const keys = ['TWITCH_CLIENT_ID','TWITCH_BROADCASTER_ID','TWITCH_USER_ID','GROQ_API_KEY'];
  const missing = keys.filter(key=>!env[key]?.trim());
  let tokenFile = true;
  try { await access(new URL('../.ponte-token.json',import.meta.url)); } catch { tokenFile = false; }
  return { ready: missing.length===0 && tokenFile, missingEnvironmentKeys: missing, twitchTokenFilePresent: tokenFile, networkRequestsMade: 0, note: 'Configuration check only. This does not validate tokens or count as a real provider test.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await livePreflight();
  console.log(JSON.stringify(result,null,2));
  if (!result.ready) process.exitCode = 2;
}
