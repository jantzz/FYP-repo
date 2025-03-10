const express = require('express');

//imports
const { loginUser } = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.get('/login' , loginUser);

module.exports = router;