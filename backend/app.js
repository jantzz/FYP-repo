require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
//import for socketio notification
const shiftController = require('./controllers/shiftController');

//imports 
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const fileRoutes = require('./routes/fileRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

//express app declared within app constant 
const app = express(); 

// Allow requests from your frontend
app.use(cors({
    origin: ["http://127.0.0.1:8800", "http://localhost:8800"],  // Allow both origins
    methods: "GET,POST,PUT,DELETE",  // Allow HTTP methods
    credentials: true  // Allow auth headers
}));

//middlewares (between request and response )
app.use(express.json()); // allows for the request to send attachments (json objects)

app.use(express.static(path.join(__dirname, "../docs")));

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
app.use('/api/availability', availabilityRoutes);
app.use('/api/attendance', attendanceRoutes);

//socket route
app.post('/api/shift/add', shiftController.addShift);
app.set("io", null);

// export app constant 
module.exports = app;