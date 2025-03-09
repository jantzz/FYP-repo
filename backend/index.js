require('dotenv').config();
//imports 
const mysql = require('mysql2/promise');
const app = require('./app');

// get values from .env file 
const pass = process.env.password;
const dbname = process.env.dbname;
const port = process.env.PORT || 8800;

//db connection
mysql.createConnection({ //returns promise because mysql2/promise was imported
    host: "localhost",
    user: "root",
    password: pass,
    database: dbname
}).then((db) => {
        console.log("Connected to mysql database");

        //start the server only after the connection with database is established 
        app.listen(port, () => {
            console.log("App listening on port", port);
        })
    }).catch((err) => {
        console.error("Database connection failed: ", err);
    });

