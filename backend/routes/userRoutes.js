const express = require('express');

//imports
const { loginUser, createUser } = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.post('/login' , loginUser);

// to be moved to protected route
router.post('/createUser', createUser);

module.exports = router;