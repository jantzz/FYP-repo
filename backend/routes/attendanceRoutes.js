const express = require('express');
const router = express.Router();
const { 
    clockIn, 
    clockOut, 
    getEmployeeAttendance, 
    getAllAttendance, 
    getAttendanceStats,
    syncTimeOffWithAttendance,
    getEmployeeWorkingHours
} = require('../controllers/attendanceController');

// Clock in/out endpoints
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// Get attendance records
router.get('/employee/:employeeId', getEmployeeAttendance);
router.get('/all', getAllAttendance);

// Get attendance statistics
router.get('/stats', getAttendanceStats);

// Get working hours for all employees (admin/manager only)
router.get('/working-hours', getEmployeeWorkingHours);

// Sync time off with attendance records
router.post('/sync-timeoff', syncTimeOffWithAttendance);

module.exports = router; 