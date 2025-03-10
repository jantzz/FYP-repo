require('dotenv').config();
const mysql = require('mysql2/promise');

const pass = process.env.password;
const dbname = process.env.dbname;

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: pass,
    database: dbname,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;