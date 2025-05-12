const express = require('express');
const { 
    addShift, 
    getShifts, 
    swapRequest, 
    updateSwap, 
    generateShift, 
    getPendingShifts, 
    getAllShifts,
    approvePendingShift,
    approvePendingShifts,
    logAttendance,
    addPendingShift,
    getSwaps,
    recommendEmployee
} = require('../controllers/shiftController');
const router = express.Router();

// to add a shift 
router.post('/add', addShift);

//get pending shifts
router.get('/pending', getPendingShifts);

//get all shifts (for managers/admins)
router.get('/all', getAllShifts);

// Get all swap requests with detailed information
router.get('/swaps', getSwaps);

// to get shifts of an employee (using employeeId from url)
router.get('/:employeeId', getShifts);

//swap requests 
router.post('/swap', swapRequest);
//update swap information
router.post('/update-swap/:id', updateSwap);
//generate shifts
router.post('/generate', generateShift);

//approve a single pending shift
router.post('/approve-pending', approvePendingShift);
//approve all pending shifts
router.post('/approve-all-pending', approvePendingShifts);
//log attendance
router.post('/log-attendance', logAttendance);

//add a pending shift
router.post('/add-pending', addPendingShift);

// 推荐员工
router.post('/recommend-employee', recommendEmployee);
module.exports = router;