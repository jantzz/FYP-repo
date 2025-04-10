const express = require('express');
const { addShift, getShifts, swapRequest, updateSwap, generateShift, getPendingShifts, getAllShifts } = require('../controllers/shiftController');
const router = express.Router();

// to add a shift 
router.post('/add', addShift);
// to get shifts of an employee (using employeeId from url)
router.get('/:employeeId', getShifts);
//swap requests 
router.post('/swap', swapRequest);
//update swap information
router.post('/update-swap/:id', updateSwap);
//generate shifts
router.post('/generate', generateShift);

//get pending shifts
router.get('/pending', getPendingShifts);
//get all shifts (for managers/admins)
router.get('/all', getAllShifts);

module.exports = router;