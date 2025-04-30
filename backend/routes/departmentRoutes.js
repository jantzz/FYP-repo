const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

// Get all departments with employee count and manager info (for the department management UI)
router.get('/getDepartments', departmentController.getDepartments);

// Get all departments (simple list)
router.get('/all', departmentController.getAllDepartments);

// Get department by name
router.get('/:departmentName', departmentController.getDepartmentByName);

// Create new department
router.post('/createDepartment', departmentController.createDepartment);

// Update department
router.put('/updateDepartment', departmentController.updateDepartment);

// Delete department
router.delete('/deleteDepartment/:name', departmentController.deleteDepartment);

module.exports = router; 