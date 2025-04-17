const express = require('express');
const router = express.Router();
const { 
    clockIn, 
    clockOut, 
    getEmployeeAttendance, 
    getAllAttendance, 
    getAttendanceStats 
} = require('../controllers/attendanceController');

// Clock in/out endpoints
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// Get attendance records
router.get('/employee/:employeeId', getEmployeeAttendance);
router.get('/all', getAllAttendance);

// Get attendance statistics
router.get('/stats', getAttendanceStats);

module.exports = router; 