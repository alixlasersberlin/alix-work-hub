"""Phase 9B: pure synthetic planning model; no network or production adapter."""
import hashlib
import hmac
import json
from dataclasses import dataclass


def coverage(discovered, captured):
    return sorted(set(discovered) - set(captured))


def page(items, cursor=None, limit=250):
    if not 1 <= limit <= 250:
        raise ValueError("bounded pages required")
    keys = [x["key"] for x in items]
    if keys != sorted(set(keys)):
        raise ValueError("input must have unique sorted keys")
    selected = [x for x in items if cursor is None or x["key"] > cursor][:limit]
    return selected, selected[-1]["key"] if selected else cursor


def digest(chunks):
    hasher = hashlib.sha256()
    size = 0
    for chunk in chunks:
        hasher.update(chunk)
        size += len(chunk)
    return hasher.hexdigest(), size


def verify(chunks, expected_hash, expected_size):
    actual_hash, actual_size = digest(chunks)
    return hmac.compare_digest(actual_hash, expected_hash) and actual_size == expected_size


@dataclass
class Checkpoint:
    cursor: str | None = None
    verified: int = 0

    def commit(self, key, verified):
        if not verified:
            raise ValueError("cursor cannot pass an unverified object")
        if self.cursor is not None and key <= self.cursor:
            raise ValueError("non-monotonic commit")
        self.cursor = key
        self.verified += 1

    def serialize(self):
        return json.dumps(self.__dict__, sort_keys=True)

    @classmethod
    def restore(cls, payload):
        return cls(**json.loads(payload))


def version_target(bucket, key, version):
    # Never reuse a mutable source key as the destination identity.
    identity = json.dumps([bucket, key, version], ensure_ascii=False).encode()
    return "synthetic/" + hashlib.sha256(identity).hexdigest()


def immutable_put(store, target, content):
    if target in store and store[target] != content:
        raise ValueError("version conflict")
    store[target] = content


def canonical(manifest):
    # Synthetic format: only JSON primitives, no floats. Not a production JCS implementation.
    return json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sign(manifest, synthetic_key):
    return hmac.new(synthetic_key, canonical(manifest), hashlib.sha256).hexdigest()


def valid_signature(manifest, signature, synthetic_key):
    return hmac.compare_digest(sign(manifest, synthetic_key), signature)


def allowed(role, action, mfa=False):
    permissions = {
        "Backup Administrator": {"plan", "inspect"},
        "Backup Operator": {"plan", "inspect"},
        "Backup Auditor": {"inspect"},
        "Restore Approver": {"approve_plan", "inspect"},
        "Security Administrator": {"security_plan", "inspect"},
    }
    return mfa and action in permissions.get(role, set())


def restore_plan(requester, approver, isolated, outbound_disabled, manifest_verified):
    if requester == approver or not all([isolated, outbound_disabled, manifest_verified]):
        raise PermissionError("isolated four-eyes planning required")
    return {"status": "planned", "execution_allowed": False, "phase": "9B"}


def run_status(expected, verified, errors, restore_tested=False):
    if errors:
        return "failed"
    if expected != verified:
        return "incomplete"
    return "restore-tested" if restore_tested else "integrity-verified"


def retryable(status, attempt):
    return status in {429, 500, 502, 503, 504} and 0 <= attempt < 5


def check_v4(manifest, synthetic_parts):
    if manifest.get("version") != 4:
        raise ValueError("unsupported legacy format")
    counts = {}
    for entry in manifest.get("files", []):
        path = entry["path"]
        if path.startswith("/") or ".." in path.split("/"):
            raise ValueError("unsafe path")
        if path not in synthetic_parts:
            raise ValueError("missing part")
        payload = synthetic_parts[path]
        if len(payload) != entry["size_bytes"]:
            raise ValueError("size mismatch")
        rows = [json.loads(line) for line in payload.splitlines() if line.strip()]
        if len(rows) != entry["rows"]:
            raise ValueError("row mismatch")
        counts[entry["table"]] = counts.get(entry["table"], 0) + len(rows)
    if counts != manifest.get("counts"):
        raise ValueError("count mismatch")
    return {"format_valid": True, "cryptographic_integrity_proven": False, "restore_proven": False}