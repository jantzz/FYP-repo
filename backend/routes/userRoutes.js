const express = require('express');

//imports
const { 
    loginUser, 
    createUser,
    updateUser 
} = require('../controllers/userController');

//router object from express 
const router = express.Router(); 

router.post('/login' , loginUser);

// these are to be moved to protected route
router.post('/createUser', createUser);

router.post('/updateUser', updateUser);

module.exports = router;