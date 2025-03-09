require('dotenv').config();
const express = require('express');

//express app declared within app constant 
const app = express(); 

//middlewares (between request and response )
app.use(express.json()); // allows for the request to send attachments (json objects)

app.use((req, res, next) => { // prints to console every request sent (for debugging / testing purposes)
    console.log(req.path, req.method);
    next();
});



// export app constant 
module.exports = app;