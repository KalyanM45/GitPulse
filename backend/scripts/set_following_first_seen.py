"""Set the "First seen" date on Following rows by hand.

`sync_following` used to drop the collection and rebuild it on every run, so
`captured_at` was restamped with the sync time each time and the real dates for
anyone followed before the fix are gone. GitHub has no API that can recover them —
there is no "when did I start following X" anywhere. Where you remember the date,
this writes it back.

Dates are given as YYYY-MM-DD or DD-MM-YYYY and stored as midnight UTC. The UI
formats in IST (UTC+5:30), so midnight UTC lands at 05:30 the same morning and
renders as the calendar date you asked for — writing local midnight instead would
shift it to the previous day.

    python backend/scripts/set_following_first_seen.py karpathy=2024-08-10
    python backend/scripts/set_following_first_seen.py karpathy=2024-08-10 --apply

Only touches accounts you follow, and only the ones named.
"""

import argparse
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import get_db  # noqa: E402


def parse_date(text: str) -> datetime:
    """YYYY-MM-DD, or DD-MM-YYYY for a day-first value. Never MM-DD-YYYY.

    Ambiguity here silently writes a wrong date, so the two accepted layouts are
    told apart structurally — a four-digit leading group is a year — rather than
    by guessing at a locale.
    """
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(
        f"{text!r} is not a date I can read — use YYYY-MM-DD (or DD-MM-YYYY)"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "assignments", nargs="+", metavar="LOGIN=DATE",
        help="e.g. karpathy=2024-08-10",
    )
    ap.add_argument("--apply", action="store_true", help="perform the write")
    args = ap.parse_args()

    pairs = []
    for item in args.assignments:
        if "=" not in item:
            ap.error(f"expected LOGIN=DATE, got {item!r}")
        login, _, raw = item.partition("=")
        pairs.append((login.strip(), parse_date(raw.strip())))

    col = get_db()["following_snapshots"]

    planned = []
    for login, when in pairs:
        doc = col.find_one({"login": login})
        if not doc:
            print(f"  SKIP  {login} — not in your following list")
            continue
        planned.append((doc, when))
        before = doc.get("captured_at")
        print(f"  {login:<24} {before} -> {when.date().isoformat()}"
              f"   ({doc.get('name') or 'no display name'})")

    if not planned:
        print("\nNothing matched. Nothing written.")
        return

    if not args.apply:
        print(f"\nDry run — {len(planned)} row(s) would change. Re-run with --apply.")
        return

    for doc, when in planned:
        col.update_one({"_id": doc["_id"]}, {"$set": {"captured_at": when}})
    print(f"\nUpdated {len(planned)} row(s).")


if __name__ == "__main__":
    main()
