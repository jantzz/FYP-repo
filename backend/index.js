require('dotenv').config();
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const db = require('./database/db');
require('./utils/shiftTask');

const port = process.env.PORT || 8800;

async function start() { 
    try {
        const connection = await db.getConnection();
        console.log("Connected to the database");

        const server = http.createServer(app);

        const io = new Server(server, {
            cors: {
                origin: ["http://127.0.0.1:8800", "http://localhost:8800", "https://emp-roster-backend.onrender.com"],
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            }
        });

        app.set('io', io);

        io.on('connection', (socket) => {
            console.log('A user connected');
        
            //listen for 'join' event from the frontend and join the room
            socket.on('join', ({ userId }) => {
                console.log(`User ${userId} joined room`);
                socket.join(`user_${userId}`); // This joins the user to a room with the name user_<employeeId>
            });
        
            //listen for 'shift_added' event from client
            socket.on('shift_added', (data) => {
                console.log('Received shift_added event from client:', data);
        
                //broadcast shift added event to the user room
                io.to(`user_${data.employeeId}`).emit('shift_added', { message: "New shift added!" });
            });
        
            socket.on('disconnect', () => {
                console.log('A user disconnected');
            });
        });
        

        server.listen(port, () => {
            console.log("Server now running on port:", port);
        });

    } catch (err) {
        console.error("Database connection failed:", err);
    }
}

start();
