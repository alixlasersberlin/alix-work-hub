import hashlib
import unittest
from model import (coverage, page, digest, verify, Checkpoint, version_target,
                   immutable_put, sign, valid_signature, allowed, restore_plan,
                   run_status, retryable, check_v4)


class SyntheticBackupTests(unittest.TestCase):
    def test_942_table_coverage_catches_670_missing(self):
        discovered = [f"table_{i}" for i in range(942)]
        self.assertEqual(len(coverage(discovered, discovered[:272])), 670)
        self.assertEqual(coverage(discovered, discovered), [])

    def test_new_table_is_not_silently_excluded(self):
        self.assertEqual(coverage(["a", "new"], ["a"]), ["new"])

    def test_all_31_buckets_include_13_empty(self):
        buckets = [f"bucket_{i}" for i in range(31)]
        populated = buckets[:18]
        self.assertEqual(len(coverage(buckets, populated)), 13)
        self.assertEqual(coverage(buckets, buckets), [])

    def test_pagination_passes_1000_boundary(self):
        items = [{"key": f"{i:05}"} for i in range(1007)]
        found, cursor = [], None
        while True:
            rows, cursor = page(items, cursor)
            if not rows:
                break
            found.extend(rows)
        self.assertEqual(found, items)

    def test_page_limit_is_bounded(self):
        with self.assertRaises(ValueError):
            page([], limit=1000)

    def test_checkpoint_resumes_after_verified_commit(self):
        state = Checkpoint()
        state.commit("001", True)
        resumed = Checkpoint.restore(state.serialize())
        rows, _ = page([{"key": "001"}, {"key": "002"}], resumed.cursor)
        self.assertEqual(rows, [{"key": "002"}])

    def test_failed_verification_does_not_advance(self):
        state = Checkpoint("001", 1)
        with self.assertRaises(ValueError):
            state.commit("002", False)
        self.assertEqual(state.cursor, "001")

    def test_streaming_sha256_known_vector(self):
        checksum, size = digest(iter([b"a", b"b", b"c"]))
        self.assertEqual(checksum, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        self.assertTrue(verify(iter([b"abc"]), checksum, size))
        self.assertFalse(verify(iter([b"abd"]), checksum, size))

    def test_existing_name_is_not_integrity_evidence(self):
        self.assertFalse(verify([b"old"], hashlib.sha256(b"new").hexdigest(), 3))

    def test_changed_version_has_separate_target(self):
        self.assertNotEqual(version_target("bucket", "key", "v1"), version_target("bucket", "key", "v2"))

    def test_version_conflict_cannot_overwrite(self):
        store = {}
        immutable_put(store, "v1", b"first")
        with self.assertRaises(ValueError):
            immutable_put(store, "v1", b"changed")
        self.assertEqual(store["v1"], b"first")

    def test_signed_manifest_rejects_tampering(self):
        manifest = {"version": 2, "objects": 31}
        key = b"synthetic-test-only-not-a-production-key"
        signature = sign(manifest, key)
        self.assertTrue(valid_signature(manifest, signature, key))
        self.assertFalse(valid_signature({**manifest, "objects": 30}, signature, key))

    def test_admin_does_not_inherit_backup_privileges(self):
        self.assertFalse(allowed("Admin", "plan", mfa=True))
        self.assertFalse(allowed("Super Admin", "plan", mfa=True))

    def test_operator_cannot_restore_or_delete(self):
        self.assertTrue(allowed("Backup Operator", "plan", mfa=True))
        self.assertFalse(allowed("Backup Operator", "restore", mfa=True))
        self.assertFalse(allowed("Backup Operator", "delete", mfa=True))

    def test_mfa_required(self):
        self.assertFalse(allowed("Backup Auditor", "inspect", mfa=False))

    def test_four_eyes_and_isolation_required(self):
        with self.assertRaises(PermissionError):
            restore_plan("a", "a", True, True, True)
        with self.assertRaises(PermissionError):
            restore_plan("a", "b", False, True, True)
        with self.assertRaises(PermissionError):
            restore_plan("a", "b", True, False, True)
        with self.assertRaises(PermissionError):
            restore_plan("a", "b", True, True, False)

    def test_phase_9b_never_executes_restore(self):
        self.assertFalse(restore_plan("a", "b", True, True, True)["execution_allowed"])

    def test_monitoring_never_calls_incomplete_successful(self):
        self.assertEqual(run_status(31, 30, 0), "incomplete")
        self.assertEqual(run_status(31, 31, 1), "failed")
        self.assertEqual(run_status(31, 31, 0), "integrity-verified")

    def test_retries_are_bounded_and_auth_errors_terminal(self):
        self.assertTrue(retryable(503, 4))
        self.assertFalse(retryable(503, 5))
        self.assertFalse(retryable(403, 0))

    def test_v4_ndjson_is_not_old_tables_array(self):
        payload = b'{"id":1}\n{"id":2}\n'
        manifest = {"version": 4, "counts": {"synthetic": 2}, "files": [
            {"table": "synthetic", "path": "tables/synthetic/part-00000.ndjson", "rows": 2, "size_bytes": len(payload)}]}
        result = check_v4(manifest, {manifest["files"][0]["path"]: payload})
        self.assertTrue(result["format_valid"])
        self.assertFalse(result["restore_proven"])
        self.assertFalse(result["cryptographic_integrity_proven"])
        with self.assertRaises(ValueError):
            check_v4(manifest, {})

    def test_v4_rejects_traversal(self):
        with self.assertRaises(ValueError):
            check_v4({"version": 4, "files": [{"path": "../secret"}], "counts": {}}, {})


if __name__ == "__main__":
    unittest.main()