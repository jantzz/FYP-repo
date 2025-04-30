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
    getMe,
    deleteUser,
    updateUserBaseSalary
} = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.post('/login' , loginUser);

// these are to be moved to protected route
router.get('/getUser/:email', getUser);

router.get('/getUsers', getUsers);

// Add a route for /all that uses the same controller as /getUsers
router.get('/all', getUsers);

router.post('/createUser', createUser);

router.route('/updateUser')
    .put(updateUser)
    .post(updateUser);  // Allow both PUT and POST

// Route for updating user's base salary
router.post('/updateBaseSalary', updateUserBaseSalary);

// Delete user route
router.delete('/deleteUser/:userId', deleteUser);

// get current user information
router.get('/me', getMe);

// Alias for /me to support the frontend's /current endpoint
router.get('/current', getMe);

module.exports = router;