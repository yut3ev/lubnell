#!/usr/bin/env python3
"""R27 scale test: bulk-insert 600 QA orders, verify SQL aggregates see them,
measure endpoint latency, then clean up. Orders are identifiable by phone
0198765432 / name QA-R27-BULK and are inserted with Prisma-valid columns."""
import sqlite3, subprocess, time, json, sys

DB = "/home/z/my-project/db/custom.db"
PHONE = "0198765432"
NAME = "QA-R27-BULK"
N = 600

def insert():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    now = int(time.time() * 1000)
    day = 86_400_000
    rows = []
    # spread: 150 today, 250 yesterday, 200 three days ago; totals vary 100..500
    for i in range(N):
        if i < 150: off = 2 * 3600_000          # today
        elif i < 400: off = day + 3 * 3600_000  # yesterday
        else: off = 3 * day + 4 * 3600_000      # 3 days ago
        total = 100 + (i % 5) * 100
        created = now - off + i
        rows.append((f"QA-{now}-{i}", NAME, PHONE, "1 Test St, Nasr City, Cairo",
                     "[]", total, total, 0, None, total, "new", 0, None,
                     "127.0.0.1", "qa-scale-test", "qa", created, created))
    cur.executemany(
        """INSERT INTO StoreOrder (orderNumber, customerName, customerPhone, customerAddress,
           items, subtotal, total, discount, couponCode, shipping, status, cancelRequested,
           cancelRequestedAt, ip, userAgent, device, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    con.commit()
    cur.execute("SELECT COUNT(*) FROM StoreOrder WHERE customerPhone=?", (PHONE,))
    n = cur.fetchone()[0]
    con.close()
    print(f"inserted {n} QA orders")

def cleanup():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.execute("DELETE FROM StoreOrder WHERE customerPhone=?", (PHONE,))
    n = cur.rowcount
    con.commit()
    cur.execute("SELECT COUNT(*) FROM StoreOrder")
    rest = cur.fetchone()[0]
    con.close()
    print(f"deleted {n} QA orders, {rest} real orders remain")

def measure(label):
    t0 = time.time()
    out = subprocess.run(
        ["curl", "-s", "-b", "/tmp/adm-cookie.txt", "http://localhost:3000/api/admin/stats"],
        capture_output=True, text=True).stdout
    ms = (time.time() - t0) * 1000
    d = json.loads(out)
    t = d["totals"]
    print(f"{label}: {ms:.0f}ms | orders={t['orders']} revenue={t['revenue']} avg={t['average']} "
          f"new={t.get('pending')} cancelled={t.get('cancelled')}")
    print("  days:", [(x['count'], x['total']) for x in d['days'] if x['count']])
    top = d['topCustomers'][0]
    print(f"  top: {top['name']} x{top['count']} = {top['total']}")
    return d

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "insert": insert()
    elif cmd == "cleanup": cleanup()
    elif cmd == "measure": measure(sys.argv[2])
