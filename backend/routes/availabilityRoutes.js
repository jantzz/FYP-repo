const express = require('express');
const { submitAvailability, updateAvailabilityStatus, getPendingRequests } = require('../controllers/availabilityController');

const router = express.Router();
//employee submits availability
router.post('/submit', submitAvailability);  
//manager approves/declines submission
router.put('/update', updateAvailabilityStatus);  
//manager views pending requests
router.get('/pending', getPendingRequests);  

module.exports = router;