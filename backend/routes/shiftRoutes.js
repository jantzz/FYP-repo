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
    addPendingShift
} = require('../controllers/shiftController');
const router = express.Router();

// to add a shift 
router.post('/add', addShift);

//get pending shifts
router.get('/pending', getPendingShifts);

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
//get all shifts (for managers/admins)
router.get('/all', getAllShifts);

//add a pending shift
router.post('/add-pending', addPendingShift);

module.exports = router;