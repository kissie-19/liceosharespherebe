import mysql from 'mysql2/promise';
const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'liceosharesphere',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0, // fixed typo: queveLimit → queueLimit
};
const pool = mysql.createPool(dbConfig);
export default pool;
