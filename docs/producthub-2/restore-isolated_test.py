import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('restore_runner', Path(__file__).with_name('restore-isolated.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

class IsolationTests(unittest.TestCase):
    def test_production_supabase_target_rejected(self):
        self.assertFalse(runner.safe_target('postgresql://test@db.xmrmkgfgpoundfwhnxfs.supabase.co/postgres'))
    def test_only_named_local_restore_database_allowed(self):
        self.assertTrue(runner.safe_target('postgresql://test@127.0.0.1/alixwork_restore_test'))
        self.assertFalse(runner.safe_target('postgresql://test@127.0.0.1/postgres'))
    def test_connection_query_override_rejected(self):
        self.assertFalse(runner.safe_target('postgresql://test@localhost/alixwork_restore_test?host=remote.example'))
    def test_backup_path_cannot_escape(self):
        with self.assertRaises(ValueError):
            runner.contained(Path('/tmp/restore-fixture'), '../outside')
    def test_comparison_is_independent_of_row_order(self):
        self.assertEqual(runner.canonical([{'id': 2}, {'id': 1}]), runner.canonical([{'id': 1}, {'id': 2}]))

if __name__ == '__main__':
    unittest.main()