const express = require('express');
const db = require('../database/db');
const { createClinic, getClinics } = require('../controllers/clinicController');

const router = express.Router();

router.post('/createClinic', createClinic);

router.get('/getClinics', getClinics);

module.exports = router;