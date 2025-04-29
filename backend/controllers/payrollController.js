const db = require('../database/db');

//base salary by department
const BASE_SALARIES = {
    'Nurse': 3000,
    'Receptionist': 2000,
    'Doctor': 6000
};

//CPF rates - 20% from the employee, 17% from the employer
const EMPLOYEE_CPF_RATE = 0.20; 
const EMPLOYER_CPF_RATE = 0.17; 

//minimum required hours per month
const MINIMUM_HOURS = 176;

//calculate working days in a month
const calculateWorkingDaysInMonth = (month, year) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        // 0 is sunday, 6 is saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
    }
    
    return workingDays;
};

//calculate hours worked from attendance records
const calculateHoursWorked = async (connection, employeeId, month, year) => {
    const [attendanceRecords] = await connection.execute(
        `SELECT DISTINCT
            date,
            clockInTime,
            clockOutTime
        FROM attendance 
        WHERE employeeId = ? 
        AND MONTH(date) = ? 
        AND YEAR(date) = ?
        AND clockInTime IS NOT NULL 
        AND clockOutTime IS NOT NULL
        AND status = 'Present'`,
        [employeeId, month, year]
    );

    let totalHours = 0;
    attendanceRecords.forEach(record => {
        const clockIn = new Date(record.clockInTime);
        const clockOut = new Date(record.clockOutTime);
        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60); 
        totalHours += hoursWorked;
    });

    return totalHours;
};

//calculate leave days and their impact on salary
const calculateLeaves = async (connection, employeeId, month, year) => {
    const [leaves] = await connection.execute(
        `SELECT DISTINCT
            type,
            startDate,
            endDate
        FROM timeoff 
        WHERE employeeId = ? 
        AND MONTH(startDate) = ? 
        AND YEAR(startDate) = ?
        AND status = 'Approved'`,
        [employeeId, month, year]
    );

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let medicalLeaveDays = 0;

    leaves.forEach(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        switch(leave.type) {
            case 'Paid':
                paidLeaveDays += days;
                break;
            case 'Unpaid':
                unpaidLeaveDays += days;
                break;
            case 'Medical':
                medicalLeaveDays += days;
                break;
        }
    });

    return {
        paidLeaveDays,
        unpaidLeaveDays,
        medicalLeaveDays
    };
};

//calculates monthly payroll for an employee
const calculateMonthlyPayroll = async (req, res) => {
    const { employeeId, month, year } = req.body;

    if (!employeeId || !month || !year) {
        return res.status(400).json({ error: "Employee ID, month, and year are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        //get employee details
        const [employees] = await connection.execute(
            "SELECT u.*, d.departmentName FROM user u JOIN department d ON u.department = d.departmentName WHERE u.userId = ?",
            [employeeId]
        );

        if (employees.length === 0) {
            return res.status(404).json({ error: "Employee not found." });
        }

        const employee = employees[0];
        const baseSalary = BASE_SALARIES[employee.departmentName] || 0;

        if (baseSalary === 0) {
            return res.status(400).json({ error: "Invalid department for salary calculation." });
        }

        //calculate hours worked
        const hoursWorked = await calculateHoursWorked(connection, employeeId, month, year);
        
        //calculate leaves 
        const { paidLeaveDays, unpaidLeaveDays, medicalLeaveDays } = await calculateLeaves(connection, employeeId, month, year);
        
        //calculate rates
        const workingDaysInMonth = calculateWorkingDaysInMonth(month, year);
        const dailyRate = baseSalary / workingDaysInMonth;
        const hoursPerDay = MINIMUM_HOURS / workingDaysInMonth;
        
        //calculate total paid days (including paid and medical leaves)
        const totalPaidDays = paidLeaveDays + medicalLeaveDays;
        const paidHours = totalPaidDays * hoursPerDay;
        
        //adjust minimum hours by adding paid leave hours
        const adjustedMinimumHours = MINIMUM_HOURS + paidHours;
        
        //calculate deductions
        let deductions = [];
        
        //1. unpaid leave deduction
        const unpaidLeaveDeduction = unpaidLeaveDays * dailyRate;
        deductions.push({
            type: 'Unpaid Leave',
            amount: unpaidLeaveDeduction,
            details: `${unpaidLeaveDays} days × $${dailyRate.toFixed(2)}`
        });
        
        //2. hours short deduction
        if (hoursWorked < adjustedMinimumHours) {
            const hoursShort = adjustedMinimumHours - hoursWorked;
            const hourlyRate = baseSalary / MINIMUM_HOURS;
            const hoursDeduction = hoursShort * hourlyRate;
            deductions.push({
                type: 'Hours Short',
                amount: hoursDeduction,
                details: `${hoursShort.toFixed(2)} hours × $${hourlyRate.toFixed(2)}`
            });
        }
        
        //calculates total deductions
        const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
        
        //calculate final salary
        const actualSalary = baseSalary - totalDeductions;
        
        //calculate CPF contributions based on original base salary
        const employeeCPF = baseSalary * EMPLOYEE_CPF_RATE;
        const employerCPF = baseSalary * EMPLOYER_CPF_RATE;
        const netSalary = actualSalary - employeeCPF;

        //check if payroll already exists for this month
        const [existingPayroll] = await connection.execute(
            "SELECT * FROM payroll WHERE employeeId = ? AND month = ? AND year = ?",
            [employeeId, month, year]
        );

        if (existingPayroll.length > 0) {
            return res.status(400).json({ error: "Payroll already exists for this month." });
        }

        //creates new payroll record
        const [result] = await connection.execute(
            "INSERT INTO payroll (employeeId, month, year, baseSalary, employeeCPF, employerCPF, netSalary) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [employeeId, month, year, actualSalary, employeeCPF, employerCPF, netSalary]
        );

        return res.status(201).json({
            message: "Payroll calculated successfully",
            payrollId: result.insertId,
            details: {
                employeeName: employee.name,
                department: employee.departmentName,
                originalBaseSalary: baseSalary,
                actualSalary: actualSalary,
                hoursWorked: hoursWorked.toFixed(2),
                minimumHours: MINIMUM_HOURS,
                adjustedMinimumHours: adjustedMinimumHours.toFixed(2),
                hourlyRate: (baseSalary / MINIMUM_HOURS).toFixed(2),
                workingDaysInMonth,
                dailyRate: dailyRate.toFixed(2),
                leaves: {
                    paid: paidLeaveDays,
                    unpaid: unpaidLeaveDays,
                    medical: medicalLeaveDays,
                    totalPaidDays
                },
                deductions: deductions,
                totalDeductions: totalDeductions.toFixed(2),
                employeeCPF,
                employerCPF,
                netSalary
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//get payroll details for an employee
const getEmployeePayroll = async (req, res) => {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        let query = `
            SELECT p.*, u.name as employeeName, d.departmentName
            FROM payroll p
            JOIN user u ON p.employeeId = u.userId
            JOIN department d ON u.department = d.departmentName
            WHERE p.employeeId = ?
        `;
        
        const params = [employeeId];

        if (month && year) {
            query += " AND p.month = ? AND p.year = ?";
            params.push(month, year);
        }

        query += " ORDER BY p.year DESC, p.month DESC";

        const [payrollRecords] = await connection.execute(query, params);

        return res.status(200).json(payrollRecords);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//get all payroll records (for admin/managers)
const getAllPayroll = async (req, res) => {
    const { month, year, department } = req.query;

    let connection;
    try {
        connection = await db.getConnection();

        let query = `
            SELECT p.*, u.name as employeeName, d.departmentName
            FROM payroll p
            JOIN user u ON p.employeeId = u.userId
            JOIN department d ON u.department = d.departmentName
            WHERE 1=1
        `;
        
        const params = [];

        if (month && year) {
            query += " AND p.month = ? AND p.year = ?";
            params.push(month, year);
        }

        if (department) {
            query += " AND d.departmentName = ?";
            params.push(department);
        }

        query += " ORDER BY p.year DESC, p.month DESC, u.name ASC";

        const [payrollRecords] = await connection.execute(query, params);

        return res.status(200).json(payrollRecords);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//updates payroll status (mark as paid)
const updatePayrollStatus = async (req, res) => {
    const { payrollId } = req.params;
    const { status } = req.body;

    if (!payrollId || !status) {
        return res.status(400).json({ error: "Payroll ID and status are required." });
    }

    if (status !== 'Pending' && status !== 'Paid') {
        return res.status(400).json({ error: "Invalid status. Must be either 'Pending' or 'Paid'." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        const [result] = await connection.execute(
            "UPDATE payroll SET status = ? WHERE payrollId = ?",
            [status, payrollId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Payroll record not found." });
        }

        return res.status(200).json({ message: "Payroll status updated successfully." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//get payroll statistics
const getPayrollStats = async (req, res) => {
    const { month, year, department } = req.query;

    let connection;
    try {
        connection = await db.getConnection();

        let query = `
            SELECT 
                d.departmentName,
                COUNT(*) as totalEmployees,
                SUM(p.baseSalary) as totalBaseSalary,
                SUM(p.employeeCPF) as totalEmployeeCPF,
                SUM(p.employerCPF) as totalEmployerCPF,
                SUM(p.netSalary) as totalNetSalary
            FROM payroll p
            JOIN user u ON p.employeeId = u.userId
            JOIN department d ON u.department = d.departmentName
            WHERE 1=1
        `;
        
        const params = [];

        if (month && year) {
            query += " AND p.month = ? AND p.year = ?";
            params.push(month, year);
        }

        if (department) {
            query += " AND d.departmentName = ?";
            params.push(department);
        }

        query += " GROUP BY d.departmentName";

        const [stats] = await connection.execute(query, params);

        return res.status(200).json(stats);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    calculateMonthlyPayroll,
    getEmployeePayroll,
    getAllPayroll,
    updatePayrollStatus,
    getPayrollStats
}; 