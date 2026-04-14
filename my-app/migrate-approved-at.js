const { default: pool } = require('./dist/config/db.js');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query('SHOW COLUMNS FROM borrow_requests LIKE ?', ['approved_at']);
    if (cols.length > 0) {
      console.log('Column already exists, skipping ALTER');
    } else {
      await conn.query('ALTER TABLE borrow_requests ADD COLUMN approved_at DATETIME NULL DEFAULT NULL AFTER updated_at');
      console.log('Column added');
    }
    const [result] = await conn.query(
      "UPDATE borrow_requests SET approved_at = updated_at WHERE status = 'approved' AND approved_at IS NULL"
    );
    console.log('Migrated existing approved rows:', result.affectedRows);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
