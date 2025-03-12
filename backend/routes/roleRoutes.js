const express = require('express');

const { createRole } = require('../controllers/roleController');

const router = express.Router(); 

router.post('/createRole', createRole);

module.exports = router;