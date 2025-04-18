const express = require('express');
const router = express.Router();
const timeOffController = require('../controllers/timeOffController');

router.post('/request', timeOffController.requestTimeOff);
router.put('/update/:timeOffId', timeOffController.updateTimeOffStatus);

module.exports = router;
