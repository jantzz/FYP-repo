const express = require('express');

//imports 
const { createRole } = require('../controllers/roleController');

//declare the router
const router = express.Router(); 

router.post('/createRole', createRole);

module.exports = router;