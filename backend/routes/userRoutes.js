const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

//imports
const { 
    loginUser, 
    createUser,
    updateUser,
    getMe
} = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.post('/login' , loginUser);

// these are to be moved to protected route
router.post('/createUser', createUser);

router.put('/updateUser', updateUser);

// get current user information
router.get('/me', getMe);

module.exports = router;