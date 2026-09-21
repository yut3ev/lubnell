# lubnel-live — LUBNÉL real-time admin notifications

Socket.io (admin studio) + internal HTTP emit API (Next.js server-to-server).

## Run

```bash
cd /home/z/my-project && (setsid bun run live >> mini-services/lubnel-live/live.log 2>&1 < /dev/null &)
```

- **Port 3010** — socket.io, path `/` (MUST stay `/` — Caddy gateway forwarding), browser connects via `io("/?XTransformPort=3010")`.
- **Port 3011** — Bun HTTP API, localhost only. Next.js routes call `POST http://127.0.0.1:3011/emit` with header `x-lubnel-live-secret` (default `lubnel-live-internal`).

## Events (broadcast to the `admins` room)

| event | payload |
|---|---|
| `order:new` | `{ orderNumber, customerName, total, itemCount, phone? }` |
| `order:cancel_requested` | `{ orderNumber, customerName }` |
| `order:status_changed` | `{ orderNumber, status, by }` |
| `order:cancel_resolved` | `{ orderNumber, resolution, by }` |
| `review:new` | `{ productTitle, rating, name }` |
| `review:moderated` | `{ action: approved\|unpublished\|featured\|unfeatured\|deleted, by }` |
| `review:helpful` | `{ productId, helpfulCount, name }` |

Every broadcast payload also carries `at` (ISO time) and a monotonic `seq`.

## Replay (since round 9)

The service keeps the last **60 events** in an in-memory ring buffer. When an
admin joins with `admin:join { lastSeq }`, any events with `seq > lastSeq`
(max 20, newest last) are replayed once via:

```json
{ "event": "live:replay", "data": { "events": [{ "seq", "event", "data", "at" }], "current": 10 } }
```

The studio persists `lastSeq` in `localStorage["lubnel-live-seq"]`, renders
replayed entries with an amber "↺ أثناء غيابكِ" chip, no chime, and one summary
toast. Caught-up joins receive no replay. Events live only in memory — a
service restart resets the ring (DB audit log remains the durable record).

## Health

`GET http://127.0.0.1:3011/health` → `{ ok, admins, uptime }`

This project was created using `bun init` in bun v1.3.14.
