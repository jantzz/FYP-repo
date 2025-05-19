require('dotenv').config();
const mysql = require('mysql2/promise');

const pass = process.env.password;
const dbname = process.env.dbname;
const hostName = process.env.host || "localhost";
const userName = process.env.user || 'admin';

const db = mysql.createPool({
    host: hostName,
    user: userName,
    password: pass,
    database: dbname,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;