import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const rows = await db.$queryRaw`
  SELECT id, entityId, createdAt FROM AuditLog
  WHERE action = 'security:auth.lockout'
    AND entity = 'client_ip'
    AND entityId IN ('203.0.113.17','203.0.113.30')
  ORDER BY id ASC`;
for (const r of rows) console.log(`#${r.id}`, r.createdAt.toISOString(), r.entityId);
await db.$disconnect();
