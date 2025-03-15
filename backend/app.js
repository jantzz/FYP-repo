require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

//imports 
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const shiftRoutes = require('./routes/shiftRoutes');

//express app declared within app constant 
const app = express(); 

// Allow requests from your frontend
app.use(cors({
    origin: "http://127.0.0.1:5500",  // Allow frontend origin
    methods: "GET,POST,PUT,DELETE",  // Allow HTTP methods
    credentials: true  // Allow auth headers
}));

//middlewares (between request and response )
app.use(express.json()); // allows for the request to send attachments (json objects)

app.use(express.static(path.join(__dirname, "../frontend")));

app.use((req, res, next) => { // prints to console every request sent (for debugging / testing purposes)
    console.log(req.method, req.path);
    next();
});

//normal routes
app.use('/', fileRoutes);
//api routes
app.use('/api/user', userRoutes);
app.use('/api/role', roleRoutes);
app.use('/api/shift', shiftRoutes);
// export app constant 
module.exports = app;