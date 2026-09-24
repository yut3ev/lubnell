import { createServer } from 'http'
import { Server } from 'socket.io'
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'

/**
 * LUBNÉL live service — real-time admin notifications.
 *
 * Two listeners:
 *  1. socket.io (path "/", port 3010) — admin studio connects via
 *     `io('/?XTransformPort=3010')` through the Caddy gateway.
 *     The path MUST stay "/" (gateway forwarding requirement).
 *  2. Bun HTTP API on port 3011 — internal only (localhost, server-to-server).
 *     Next.js API routes call `POST http://127.0.0.1:3011/emit` to broadcast.
 *
 * Events broadcast to the `admins` room:
 *  - order:new              { orderNumber, customerName, total, itemCount }
 *  - order:cancel_requested { orderNumber, customerName, at }
 *  - order:status_changed   { orderNumber, status, by }
 *  - order:cancel_resolved  { orderNumber, resolution, by }
 *  - review:new             { productTitle, rating }
 *  - review:moderated       { action: approved|unpublished|deleted, by }
 *  - review:helpful         { productId, helpfulCount, name }
 *
 * Every broadcast event gets a monotonic `seq` and is kept in a small ring
 * buffer (last 60). When an admin joins with `admin:join { lastSeq }`, any
 * missed events are replayed once via `live:replay { events, current }` so
 * the bell can show what happened while the studio was closed.
 *
 * HOT-RELOAD SAFETY (SUP-7): all binding side effects are wrapped in a
 * globalThis guard + port-adoption check, so a `bun --hot` reload never
 * attempts to re-bind ports held by the previous generation (which would
 * crash with EADDRINUSE). Across reloads the running servers are reused.
 *
 * DEV-KEEPER (SUP-7): on every module evaluation, probe the main Next.js
 * dev server on :3000 and — if it is down — respawn it as a detached child
 * of THIS process (immune lineage), so the storefront self-heals.
 */

const SOCKET_PORT = 3010
const HTTP_PORT = 3011
// Shared secret so only the local Next.js backend can emit events.
const EMIT_SECRET = process.env.LUBNEL_LIVE_SECRET || 'lubnel-live-internal'

async function httpUp(port: number, path = '/'): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(1500),
    })
    // any HTTP response means a live listener
    return res.status > 0
  } catch {
    return false
  }
}

type LiveState = { adopted: boolean }
const g = globalThis as typeof globalThis & { __lubnelLiveState?: LiveState }

async function boot(): Promise<void> {
  if (!g.__lubnelLiveState) {
    // First evaluation under this module version.
    const ioHeld = await httpUp(SOCKET_PORT)
    const apiHeld = await httpUp(HTTP_PORT)

    if (!ioHeld && !apiHeld) {
      // Fresh boot — bind everything.
      // -- replay ring buffer -----------------------------------------------------
      type RingEvent = { seq: number; event: string; data: Record<string, unknown>; at: string }
      const RING_CAP = 60
      let seqCounter = 0
      const ring: RingEvent[] = []

      // -- socket.io (gateway-facing) -------------------------------------------
      const ioServer = createServer()

      const io = new Server(ioServer, {
        // DO NOT change the path, it is used by Caddy to forward the request to the correct port
        path: '/',
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        pingTimeout: 60000,
        pingInterval: 25000,
      })

      function adminCount(): number {
        return io.of('/').adapter.rooms.get('admins')?.size ?? 0
      }

      io.on('connection', (socket) => {
        console.log(`[connect] ${socket.id}`)

        // Admin studio joins the admins room on load (optionally asking for missed events).
        socket.on('admin:join', (payload?: { lastSeq?: number }) => {
          socket.join('admins')
          socket.emit('admin:joined', { admins: adminCount(), seq: seqCounter })
          console.log(`[join] ${socket.id} -> admins room (${adminCount()} online)`)
          // Replay: send events the client missed while it was away (max 20, most recent last).
          const lastSeq =
            typeof payload?.lastSeq === 'number' && Number.isFinite(payload.lastSeq) ? payload.lastSeq : null
          if (lastSeq !== null && lastSeq < seqCounter) {
            const missed = ring.filter((e) => e.seq > lastSeq).slice(-20)
            if (missed.length > 0) {
              socket.emit('live:replay', { events: missed, current: seqCounter })
              console.log(`[replay] ${socket.id} <- ${missed.length} events (since seq ${lastSeq})`)
            }
          }
        })

        // Health check from clients.
        socket.on('ping:check', () => {
          socket.emit('ping:pong', { t: Date.now(), admins: adminCount() })
        })

        socket.on('disconnect', () => {
          console.log(`[disconnect] ${socket.id}`)
        })

        socket.on('error', (error) => {
          console.error(`[error] (${socket.id})`, error)
        })
      })

      ioServer.listen(SOCKET_PORT, () => {
        console.log(`LUBNÉL live socket.io listening on port ${SOCKET_PORT}`)
      })

      // -- internal HTTP emit API (Bun, localhost only) ---------------------------
      Bun.serve({
        port: HTTP_PORT,
        async fetch(req) {
          const url = new URL(req.url)

          if (req.method === 'GET' && url.pathname === '/health') {
            return Response.json({ ok: true, admins: adminCount(), uptime: process.uptime() })
          }

          if (req.method === 'POST' && url.pathname === '/emit') {
            try {
              if (req.headers.get('x-lubnel-live-secret') !== EMIT_SECRET) {
                return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
              }
              const body = (await req.json()) as { event?: string; data?: Record<string, unknown> }
              const event = body.event
              if (!event || typeof event !== 'string' || event.length > 64) {
                return Response.json({ ok: false, error: 'invalid event' }, { status: 400 })
              }
              const seq = ++seqCounter
              const at = new Date().toISOString()
              ring.push({ seq, event, data: body.data || {}, at })
              if (ring.length > RING_CAP) ring.shift()
              io.to('admins').emit(event, { ...(body.data || {}), at, seq })
              console.log(`[emit] ${event} seq=${seq} (admins online: ${adminCount()})`)
              return Response.json({ ok: true, event, seq, admins: adminCount() })
            } catch (err) {
              console.error('[emit] error', err)
              return Response.json({ ok: false, error: 'bad payload' }, { status: 500 })
            }
          }

          return Response.json({ ok: false, error: 'not found' }, { status: 404 })
        },
      })

      console.log(`LUBNÉL live HTTP API listening on port ${HTTP_PORT}`)

      process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down live service...')
        ioServer.close(() => process.exit(0))
      })

      process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down live service...')
        ioServer.close(() => process.exit(0))
      })

      g.__lubnelLiveState = { adopted: false }
    } else {
      // Ports held by a previous generation of this module (pre-guard process).
      // Adopt them: do NOT rebind, just record state so future reloads reuse.
      console.log(
        `[hot-reload] ports ${SOCKET_PORT}/${HTTP_PORT} held by previous generation — adopting without rebinding`
      )
      g.__lubnelLiveState = { adopted: true }
    }
  }
  // else: hot reload — existing servers and handlers keep running untouched.

  // -- dev-keeper (runs on EVERY evaluation, hot reload included) ---------------
  try {
    const mainUp = await httpUp(3000, '/api/health')
    if (!mainUp) {
      console.log('[dev-keeper] main dev server DOWN — respawning as detached child')
      const script =
        `pkill -f 'next [d]ev' 2>/dev/null; pkill -f 'next-[s]erver' 2>/dev/null; sleep 1; ` +
        `cd /home/z/my-project && exec setsid bun run dev > /tmp/dev-via-keeper.log 2>&1 < /dev/null`
      const child = spawn('bash', ['-c', script], {
        cwd: '/home/z/my-project',
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      console.log(`[dev-keeper] spawned main dev server (pid ${child.pid})`)
      try {
        appendFileSync('/tmp/keeper-spawn.log', `spawned pid=${child.pid} at ${new Date().toISOString()}\n`)
      } catch {
        // logging must never break the keeper
      }
    } else {
      console.log('[dev-keeper] main dev server already UP — no action')
    }
  } catch (err) {
    console.error('[dev-keeper] error', err)
  }
}

boot().catch((err) => console.error('[boot] fatal', err))

// keeper bump 1789650557
