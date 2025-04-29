const express = require('express');
const db = require('../database/db');
const { createClinic, getClinics, updateClinic, deleteClinic } = require('../controllers/clinicController');

const router = express.Router();

router.post('/createClinic', createClinic);

router.get('/getClinics', getClinics);

router.put('/updateClinic', updateClinic);

router.delete('/deleteClinic/:id', deleteClinic);

module.exports = router;