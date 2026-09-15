CREATE INDEX IF NOT EXISTS fp_table_row_idx ON gobd_restore.__fp (table_name, row_id);
ANALYZE gobd_restore.__fp;