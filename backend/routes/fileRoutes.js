const express = require('express');
const path = require('path');

//declare absolute path to front end from current dirname
const fpath = "../../docs"

const router = express.Router(); 

//routes 
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, `${fpath}/index.html`));
});

router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, `${fpath}/dashboard.html`));
});

module.exports = router;