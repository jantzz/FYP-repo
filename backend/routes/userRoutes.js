const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

//imports
const { 
    loginUser,
    getUser,
    getUsers,
    createUser,
    updateUser,
    getMe
} = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.post('/login' , loginUser);

// these are to be moved to protected route
router.get('/getUser/:email', getUser);

router.get('/getUsers', getUsers);

router.post('/createUser', createUser);

router.route('/updateUser')
    .put(updateUser)
    .post(updateUser);  // Allow both PUT and POST

// get current user information
router.get('/me', getMe);

module.exports = router;