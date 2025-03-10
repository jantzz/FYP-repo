require('dotenv').config();
//imports 
const mysql = require('mysql2/promise');
const app = require('./app');
const db = require('./database/db');

// get values from .env file 
const port = process.env.PORT || 8800;

//start server function 
async function start() { 
    try{
        const connection = await db.getConnection();
        console.log("Connected to the database");

        app.listen(port, ()=> {
            console.log("server now running on port:", port);
        })

    }catch(err) {
        console.error("Database connection failed:", err);
        //process.exit(1);
    }
}

start();