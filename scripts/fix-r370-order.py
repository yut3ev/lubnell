#!/usr/bin/env python3
"""Fix R370 record placement: move the R370 block (heading..R371 contract)
from between the x85 note and '## R369' to the true file tail, restoring
chronological order: ...x82..x85 notes -> R369 record -> R370 contract ->
R370 record -> R371 contract."""
import sys

PATH = "/home/z/my-project/worklog.md"
R370_HEAD = "## R370 (2026-09-14, 14:15 +08 trigger, Job 372729)"
R369_HEAD = "## R369 (2026-09-14, 14:00 +08 trigger, Job 372729)"

with open(PATH, "r", encoding="utf-8") as f:
    text = f.read()

if text.count(R370_HEAD) != 1:
    sys.exit(f"FATAL: R370 heading count = {text.count(R370_HEAD)} (expected 1)")
if text.count(R369_HEAD) != 1:
    sys.exit(f"FATAL: R369 heading count = {text.count(R369_HEAD)} (expected 1)")

i = text.find(R370_HEAD)
j = text.find(R369_HEAD)
if j < i:
    sys.exit("FATAL: R369 heading already precedes R370 heading - nothing to fix?")

# Block = R370 heading .. up to (not including) the '## R369' heading.
block = text[i:j]
# Sanity: block must contain the R371 contract and end with the round-signature tail.
if "**R371 contract:**" not in block:
    sys.exit("FATAL: R371 contract not inside the extracted block")
if "52nd row-exact close" not in block:
    sys.exit("FATAL: R370 FINAL signature not inside the extracted block")

before = text[:i]
after = text[j:]
# Rejoin without the block: 'x85 note\n\n' + '## R369...' -> normalize to one blank line.
rejoined = before.rstrip("\n") + "\n\n" + after.lstrip("\n")
# Append the block at the true tail, one blank line before it.
result = rejoined.rstrip("\n") + "\n\n" + block.rstrip("\n") + "\n"

with open(PATH, "w", encoding="utf-8") as f:
    f.write(result)

# Report the restored order around the seam.
lines = result.splitlines()
for n, line in enumerate(lines, 1):
    if line.startswith("## R37") or line.startswith("**LUBNÉL RECOVERY REFIRE ×8"):
        print(f"{n}: {line[:90]}")
print("OK: R370 block moved to tail; chronological order restored.")
