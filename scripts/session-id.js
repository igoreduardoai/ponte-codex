import { pathToFileURL } from 'node:url';

export function sessionEvidence(env = process.env) {
  const session = env.CODEX_SESSION_ID, thread = env.CODEX_THREAD_ID;
  if (!session && !thread) throw new Error('No active Codex session ID in this process; run /status in the active Codex session.');
  if (session && thread && session !== thread) throw new Error('Conflicting Codex session/thread IDs; verify /status manually.');
  const id = session || thread;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw new Error('Unexpected session ID format; verify /status manually.');
  return { session_id: id, sources: ['CODEX_SESSION_ID','CODEX_THREAD_ID'].filter(key=>env[key]), observed_at: new Date().toISOString(), method: 'Read actual process environment; no ID generated and no mock payload used.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(sessionEvidence(),null,2)); }
  catch(error) { console.error(error.message); process.exitCode = 1; }
}
