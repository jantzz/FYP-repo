const express = require('express');
const { submitAvailability, updateAvailabilityStatus, getPendingRequests, getEmployeeAvailability } = require('../controllers/availabilityController');

const router = express.Router();
//employee submits availability
router.post('/submit', submitAvailability);  
//manager approves/declines submission
//router.put('/update', updateAvailabilityStatus);  
//manager views pending requests
router.get('/pending', getPendingRequests);  

// get availability for a specific employee
router.get('/employee/:employeeId', getEmployeeAvailability);

module.exports = router;
