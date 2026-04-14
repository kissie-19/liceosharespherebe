const mysql = require('mysql2/promise');

(async () => {
  const db = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'liceosharesphere'
  });

  try {
    await db.query("ALTER TABLE posts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'available'");
  } catch (error) {
    if (!String(error.message).includes('Duplicate column name')) {
      throw error;
    }
  }

  await db.query("UPDATE posts SET status = 'available' WHERE status IS NULL OR status = ''");

  const [rows] = await db.query('SHOW COLUMNS FROM posts');
  console.log(JSON.stringify(rows, null, 2));
  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
