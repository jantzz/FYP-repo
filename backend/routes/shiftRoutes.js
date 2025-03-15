const express = require('express');
const { addShift, getShifts } = require('../controllers/shiftController');
const router = express.Router();
// to add a shift 
router.post('/add', addShift);
// to get shifts of an employee (using employeeId from url)
router.get('/:employeeId', getShifts);

module.exports = router;