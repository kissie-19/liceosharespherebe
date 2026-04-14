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
    await db.query("ALTER TABLE register ADD COLUMN profile_picture LONGTEXT NULL");
  } catch (error) {
    if (!String(error.message).includes('Duplicate column name')) {
      throw error;
    }
  }

  const [rows] = await db.query('SHOW COLUMNS FROM register');
  console.log(JSON.stringify(rows, null, 2));
  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
