// TEAM-2 in-process verification — calls the actual route handlers directly
// (no HTTP server needed; immune to the sandbox boundary reaper).
// Run: bun scripts/tmp-team2-direct.ts
import { db } from '../src/lib/db';
import { hashSecret, tokenDigest } from '../src/lib/admin-auth';
import fs from 'node:fs';

const USERNAME = 'tmp_direct_team2';

// @ts-expect-error - next/server works standalone in bun
import { NextRequest } from 'next/server';
// @ts-expect-error dynamic route import
import { POST as loginPOST } from '../src/app/api/admin/login/route';
// @ts-expect-error dynamic route import
import { GET as mediaGET, POST as mediaPOST } from '../src/app/api/admin/media/route';
// @ts-expect-error dynamic route import
import { GET as sessionsGET, DELETE as sessionsDELETE } from '../src/app/api/admin/sessions/route';
// @ts-expect-error dynamic route import
import { GET as auditGET } from '../src/app/api/admin/audit/route';
// @ts-expect-error dynamic route import
import { POST as logoutPOST } from '../src/app/api/admin/logout/route';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

function req(url: string, init?: { method?: string; token?: string; body?: BodyInit; ua?: string; ct?: string }) {
  return new NextRequest('http://localhost:3000' + url, {
    method: init?.method || 'GET',
    headers: {
      ...(init?.token ? { 'x-admin-token': init.token } : {}),
      ...(init?.ua ? { 'user-agent': init.ua } : { 'user-agent': MOBILE_UA }),
      ...(init?.ct ? { 'content-type': init.ct } : {}),
    },
    body: init?.body as never,
  });
}

async function j(res: Response) {
  try { return await res.json(); } catch { return null; }
}

async function main() {
  console.log('── TEAM-2 direct verification ──');
  await db.adminUser.deleteMany({ where: { username: USERNAME } });

  const code = 'VCODE-7777';
  const owner = await db.adminUser.create({
    data: {
      username: USERNAME,
      displayName: 'اختبار مباشر',
      passwordHash: hashSecret('TestPass1234'),
      verificationCodeHash: hashSecret(code),
      role: 'owner',
    },
  });

  // 1) LOGIN (real handler — creates session with device)
  const loginRes = await loginPOST(req('/api/admin/login', {
    method: 'POST',
    ct: 'application/json',
    body: JSON.stringify({ username: USERNAME, password: 'TestPass1234', verificationCode: code }),
  }));
  const login = await j(loginRes);
  const token: string | undefined = login?.token;
  console.log('1) LOGIN:', loginRes.status, 'ok=', login?.ok, 'token=', token ? 'yes' : 'no');

  // 1b) session row parsed device?
  const sessRow = await db.adminSession.findUnique({ where: { tokenHash: tokenDigest(token!) } });
  console.log('   SESSION ROW: device=', sessRow?.device, 'label=', sessRow?.deviceLabel, 'lastSeenAt=', !!sessRow?.lastSeenAt, 'ip=', sessRow?.ip);

  // 2) MEDIA GET → ok:true + array
  const mGet = await j(await mediaGET(req('/api/admin/media', { token })));
  console.log('2) MEDIA GET: ok=', mGet?.ok, 'isArray=', Array.isArray(mGet?.media), 'count=', mGet?.media?.length);

  // 3) MEDIA POST upload real PNG → ok:true + url
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'direct-test.png');
  const mPost = await j(await mediaPOST(req('/api/admin/media', { token, method: 'POST', body: form })));
  console.log('3) MEDIA POST: ok=', mPost?.ok, 'url=', mPost?.url, 'onDisk=', mPost?.url ? fs.existsSync('public' + mPost.url) : false);

  // 4) SESSIONS GET → our active visit with device + actionCount
  const sGet = await j(await sessionsGET(req('/api/admin/sessions', { token })));
  const mine = sGet?.sessions?.find((x: { active: boolean }) => x.active);
  console.log('4) SESSIONS GET: ok=', sGet?.ok, 'count=', sGet?.sessions?.length, '| mine:', mine ? `active device=${mine.device} label=${mine.deviceLabel} actions=${mine.actionCount} ip=${mine.ip}` : 'NOT FOUND');

  // 5) AUDIT filtered by session → auth.login row tied to this visit, with device
  const aGet = await j(await auditGET(req(`/api/admin/audit?session=${encodeURIComponent(mine.id)}`, { token })));
  const actions = aGet?.logs?.map((l: { action: string }) => l.action).join(',');
  const anyDevice = aGet?.logs?.some((l: { device: string | null }) => !!l.device);
  const anyLinked = aGet?.logs?.every((l: { sessionId: string | null }) => l.sessionId === mine.id);
  console.log('5) AUDIT BY SESSION: ok=', aGet?.ok, 'rows=', aGet?.logs?.length, 'actions=', actions, 'deviceSet=', anyDevice, 'allLinked=', anyLinked);

  // 6) REVOKE via DELETE → ok, then token dead, row kept with reason
  const rv = await j(await sessionsDELETE(req(`/api/admin/sessions?id=${encodeURIComponent(mine.id)}`, { token, method: 'DELETE' })));
  console.log('6) REVOKE: ok=', rv?.ok);
  const dead = await db.adminSession.findUnique({ where: { tokenHash: tokenDigest(token!) } });
  console.log('   ROW KEPT: endedAt=', !!dead?.endedAt, 'reason=', dead?.endedReason);

  // 6b) revoked token must fail auth (media GET → 401)
  const afterRes = await mediaGET(req('/api/admin/media', { token }));
  console.log('   AFTER REVOKE media GET:', afterRes.status, '(expect 401)');

  // 7) LOGOUT marks ended (second visit)
  const login2 = await j(await loginPOST(req('/api/admin/login', {
    method: 'POST', ct: 'application/json',
    body: JSON.stringify({ username: USERNAME, password: 'TestPass1234', verificationCode: code }),
  })));
  const token2 = login2?.token as string;
  await logoutPOST(req('/api/admin/logout', { token: token2, method: 'POST' }));
  const row2 = await db.adminSession.findUnique({ where: { tokenHash: tokenDigest(token2) } });
  console.log('7) LOGOUT: row kept=', !!row2, 'reason=', row2?.endedReason);

  // 8) parseDevice sanity (desktop UA)
  const { parseDevice } = await import('../src/lib/admin-auth');
  const d = parseDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
  console.log('8) parseDevice desktop:', d.device, '/', d.deviceLabel);

  // 9) cleanup
  if (mPost?.url && fs.existsSync('public' + mPost.url)) fs.unlinkSync('public' + mPost.url);
  if (mPost?.asset?.id) await db.mediaAsset.delete({ where: { id: mPost.asset.id } }).catch(() => undefined);
  await db.adminAudit.deleteMany({ where: { actor: USERNAME } });
  await db.adminSession.deleteMany({ where: { adminUserId: owner.id } });
  await db.adminUser.delete({ where: { id: owner.id } }).catch(() => undefined);
  console.log('── CLEANUP DONE ──');
  process.exit(0);
}

main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
