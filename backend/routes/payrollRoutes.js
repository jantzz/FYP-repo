const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

//calculate monthly payroll for an employee
router.post('/calculate', payrollController.calculateMonthlyPayroll);

//get payroll details for a specific employee
router.get('/employee/:employeeId', payrollController.getEmployeePayroll);

//get all payroll records (for admin/managers)
router.get('/all', payrollController.getAllPayroll);

//update payroll status
router.put('/status/:payrollId', payrollController.updatePayrollStatus);

//get payroll statistics
router.get('/stats', payrollController.getPayrollStats);

module.exports = router; 