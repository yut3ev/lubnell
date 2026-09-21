// R192 forensics: direct upstream provider health check (bypasses the app)
import ZAI from 'z-ai-web-dev-sdk';
const t0 = Date.now();
try {
  const zai = await ZAI.create();
  const r = await zai.chat.completions.create({
    messages: [{ role: 'user', content: 'Reply with the single word: healthy' }],
  });
  const ms = Date.now() - t0;
  const text = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : JSON.stringify(r).slice(0, 120);
  console.log(`UPSTREAM OK in ${ms}ms — reply: ${String(text).slice(0, 80)}`);
} catch (e) {
  console.log(`UPSTREAM FAIL after ${Date.now() - t0}ms — ${e && e.message ? e.message : String(e).slice(0, 160)}`);
  process.exit(1);
}
