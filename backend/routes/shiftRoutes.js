const express = require('express');
const { addShift, getShifts, swapRequest, updateSwap} = require('../controllers/shiftController');
const router = express.Router();
// to add a shift 
router.post('/add', addShift);
// to get shifts of an employee (using employeeId from url)
router.get('/:employeeId', getShifts);
//swap requests 
router.post('/swap', swapRequest);
//update swap infromation
router.put('/swap', updateSwap);

module.exports = router;