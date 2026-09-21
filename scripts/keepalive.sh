#!/bin/bash
# LUBNÉL dev-server keepalive: restarts `bun run dev` if port 3000 goes down.
cd /home/z/my-project
while true; do
  if ! curl -s --connect-timeout 2 --max-time 4 -o /dev/null http://127.0.0.1:3000/; then
    echo "[keepalive $(date '+%F %T')] port 3000 down — starting dev server" >> /tmp/lubnel-keepalive.log
    # fresh log slice; keep dev.log as the tee target like the original boot command
    setsid bash -c 'cd /home/z/my-project && exec bun run dev >> /home/z/my-project/dev.log 2>&1' < /dev/null >> /tmp/lubnel-keepalive.log 2>&1 &
    sleep 20
  fi
  sleep 5
done
