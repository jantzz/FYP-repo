const express = require('express');

//imports 
const { createRole, getDepartments } = require('../controllers/roleController');

//declare the router
const router = express.Router(); 

router.post('/createRole', createRole);
router.get('/getDepartments', getDepartments);

module.exports = router;