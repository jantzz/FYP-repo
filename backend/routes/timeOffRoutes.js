const express = require('express');
const router = express.Router();
const timeOffController = require('../controllers/timeOffController');

// gets leave balances
router.get('/balances', timeOffController.getLeaveBalances);
// Get all time off requests (for admins/managers)
router.get('/', timeOffController.getAllTimeOff);

// Get time off requests for a specific employee
router.get('/employee/:employeeId', timeOffController.getEmployeeTimeOff);

// Get a specific time off request by ID
router.get('/:timeOffId', timeOffController.getTimeOffById);

// Create a new time off request
router.post('/request', timeOffController.requestTimeOff);

// Update a time off request status
router.put('/update/:timeOffId', timeOffController.updateTimeOffStatus);

// Delete a time off request
router.delete('/:timeOffId', timeOffController.deleteTimeOff);

module.exports = router;
