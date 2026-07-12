"""
One-off repair for unfollower records corrupted by GitHub username changes.

Before this fix the sync diffed followers by `login`, so a follower who renamed
produced two phantom events at the same instant: an `unfollowed` under the old
name and a `followed` under the new one. This script backfills the immutable
`github_id` on every stored record, then removes those phantom pairs.

A record is only treated as a false positive when ALL of these hold:
  * its resolved github_id belongs to someone who is following you right now
  * a `followed` event exists at the exact same timestamp as the `unfollowed`
  * the two events carry different logins

Dry run (default):
    python -m scripts.repair_rename_false_positives
Apply:
    python -m scripts.repair_rename_false_positives --apply
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import get_db
from app.services.github_service import fetch_all_followers
from app.services.follower_service import resolve_github_id, _ensure_indexes


def backfill_ids(db, by_login: dict) -> tuple[int, list[str]]:
    """Populate github_id on snapshots and events. Returns (filled, unresolved logins)."""
    filled, unresolved = 0, []
    cache: dict[str, int | None] = {}

    for col_name in ("follower_snapshots", "follower_events"):
        col = db[col_name]
        for doc in list(col.find({"github_id": {"$exists": False}})):
            login = doc.get("login", "")
            avatar = doc.get("avatar_url", "")
            key = f"{login}|{avatar}"
            if key not in cache:
                cache[key] = resolve_github_id(login, avatar, by_login)
            gid = cache[key]
            if gid:
                col.update_one({"_id": doc["_id"]}, {"$set": {"github_id": gid}})
                filled += 1
            elif login not in unresolved:
                unresolved.append(login)

    return filled, unresolved


def find_false_positives(db, current_ids: set[int], by_id: dict) -> list[dict]:
    events = db["follower_events"]
    findings = []

    for uf in events.find({"event_type": "unfollowed", "github_id": {"$in": list(current_ids)}}):
        gid = uf["github_id"]
        paired = events.find_one({
            "github_id": gid,
            "event_type": "followed",
            "event_at": uf["event_at"],
        })
        if not paired or paired.get("login") == uf.get("login"):
            # they really did unfollow and later came back — legitimate churn
            continue
        findings.append({
            "github_id": gid,
            "old_login": uf.get("login"),
            "new_login": by_id[gid]["login"],
            "renamed_at": uf["event_at"],
            "unfollow_event_id": uf["_id"],
            "follow_event_id": paired["_id"],
        })

    return findings


def repair(db, findings: list[dict]) -> None:
    events = db["follower_events"]
    snapshots = db["follower_snapshots"]

    for f in findings:
        gid = f["github_id"]
        events.delete_one({"_id": f["unfollow_event_id"]})
        events.delete_one({"_id": f["follow_event_id"]})

        # the snapshot was deleted and re-created at rename time, so its
        # captured_at is the rename date — restore the real follow date
        first_follow = events.find_one(
            {"github_id": gid, "event_type": "followed"},
            sort=[("event_at", 1)],
        )
        update: dict = {"$addToSet": {"previous_logins": f["old_login"]}}
        if first_follow:
            update["$set"] = {"captured_at": first_follow["event_at"]}
        snapshots.update_one({"github_id": gid}, update)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args()

    db = get_db()
    _ensure_indexes()

    raw = fetch_all_followers()
    if not raw:
        sys.exit("GitHub returned 0 followers — aborting rather than touching stored data.")

    by_id = {u["id"]: u for u in raw}
    by_login = {u["login"]: u for u in raw}
    current_ids = set(by_id)
    print(f"Live followers on GitHub: {len(current_ids)}")

    filled, unresolved = backfill_ids(db, by_login)
    print(f"Backfilled github_id on {filled} record(s)")
    if unresolved:
        print(f"  could not resolve {len(unresolved)}: {', '.join(unresolved[:10])}"
              + (" ..." if len(unresolved) > 10 else ""))

    findings = find_false_positives(db, current_ids, by_id)

    if not findings:
        print("\nNo rename-induced false positives found. Unfollower list is clean.")
        return

    print(f"\n{len(findings)} false positive(s) - these people never unfollowed, they renamed:\n")
    for f in findings:
        print(f"  {f['old_login']} -> {f['new_login']}"
              f"  (id {f['github_id']}, flagged {f['renamed_at']:%Y-%m-%d})")

    if not args.apply:
        print("\nDry run. Re-run with --apply to remove these phantom events.")
        return

    repair(db, findings)
    print(f"\nRemoved {len(findings) * 2} phantom event(s) and restored original follow dates.")


if __name__ == "__main__":
    main()
