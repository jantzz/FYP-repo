require('dotenv').config();
const express = require('express');

//imports 
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');

//express app declared within app constant 
const app = express(); 

//middlewares (between request and response )
app.use(express.json()); // allows for the request to send attachments (json objects)

app.use((req, res, next) => { // prints to console every request sent (for debugging / testing purposes)
    console.log(req.method, req.path);
    next();
});

//routes
app.use('/api/user', userRoutes);
app.use('/api/role', roleRoutes);
// export app constant 
module.exports = app;