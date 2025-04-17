const express = require('express');
const { submitAvailability, updateAvailabilityStatus, getEmployeeAvailability } = require('../controllers/availabilityController');

const router = express.Router();
//employee submits availability
router.post('/submit', submitAvailability);

//manager updates availability status (approve/decline)
router.put('/update', updateAvailabilityStatus);
  
//manager views pending requests
//router.get('/pending', getPendingRequests);

//employee views their own availability
router.get('/employee/:employeeId', getEmployeeAvailability);

module.exports = router;
