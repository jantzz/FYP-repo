const db = require('../database/db');

//base salary by department (used as fallback if employee doesn't have a baseSalary)
const BASE_SALARIES = {
    'Nurse': 3000,
    'Receptionist': 2000,
    'Doctor': 6000,
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
        
        // Print the employee data including baseSalary for debugging
        console.log('Employee data for payroll:', JSON.stringify({
            userId: employee.userId,
            name: employee.name,
            department: employee.departmentName,
            baseSalary: employee.baseSalary
        }));
        
        // Use employee's baseSalary directly if available, otherwise fall back to BASE_SALARIES
        const baseSalary = employee.baseSalary ? parseFloat(employee.baseSalary) : BASE_SALARIES[employee.departmentName] || 0;

        if (baseSalary === 0) {
            return res.status(400).json({ error: "No salary defined for this employee. Please set a base salary first." });
        }
        
        console.log(`Using base salary: ${baseSalary} for employee ${employee.name}`);

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
        
        //calculate CPF contributions based on actual salary
        const employeeCPF = parseFloat((actualSalary * EMPLOYEE_CPF_RATE).toFixed(2));
        const employerCPF = parseFloat((actualSalary * EMPLOYER_CPF_RATE).toFixed(2));
        const netSalary = actualSalary - employeeCPF;

        // Debug CPF calculation
        console.log(`CPF calculation for ${employee.name}:
            Actual Salary: ${actualSalary}
            Employee CPF Rate: ${EMPLOYEE_CPF_RATE}
            Employer CPF Rate: ${EMPLOYER_CPF_RATE}
            Raw Employee CPF: ${actualSalary * EMPLOYEE_CPF_RATE}
            Raw Employer CPF: ${actualSalary * EMPLOYER_CPF_RATE}
            Formatted Employee CPF: ${employeeCPF}
            Formatted Employer CPF: ${employerCPF}
            Net Salary: ${netSalary}`);

        //check if payroll already exists for this month
        const [existingPayroll] = await connection.execute(
            "SELECT * FROM payroll WHERE employeeId = ? AND month = ? AND year = ?",
            [employeeId, month, year]
        );

        if (existingPayroll.length > 0) {
            return res.status(400).json({ error: "Payroll already exists for this month." });
        }

        // Log the exact values being inserted
        console.log("Inserting payroll with values:", {
            employeeId,
            month,
            year,
            baseSalary,
            employeeCPF,
            employerCPF,
            netSalary
        });

        //creates new payroll record
        const [result] = await connection.execute(
            "INSERT INTO payroll (employeeId, month, year, baseSalary, employeeCPF, employerCPF, netSalary) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [employeeId, month, year, baseSalary, employeeCPF, employerCPF, netSalary]
        );

        // Verify the saved data
        const [savedPayroll] = await connection.execute(
            "SELECT * FROM payroll WHERE payrollId = ?",
            [result.insertId]
        );
        
        console.log("Saved payroll record:", JSON.stringify(savedPayroll[0]));

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

        // First check for records with zero CPF and fix them
        let fixQuery = `
            SELECT p.*, u.name as employeeName, u.department
            FROM payroll p
            JOIN user u ON p.employeeId = u.userId
            WHERE p.employeeId = ? AND (p.employeeCPF = 0 OR p.employerCPF = 0)
        `;
        
        if (month && year) {
            fixQuery += " AND p.month = ? AND p.year = ?";
        }
        
        // Execute the query with appropriate parameters
        const fixParams = [employeeId];
        if (month && year) {
            fixParams.push(month, year);
        }
        
        const [recordsToFix] = await connection.execute(fixQuery, fixParams);
        
        if (recordsToFix.length > 0) {
            console.log(`Auto-calculating CPF for ${recordsToFix.length} records before retrieving payroll details`);
            
            // Fix each record with zero CPF
            for (const record of recordsToFix) {
                const baseSalary = parseFloat(record.baseSalary);
                const employeeCPF = parseFloat((baseSalary * EMPLOYEE_CPF_RATE).toFixed(2));
                const employerCPF = parseFloat((baseSalary * EMPLOYER_CPF_RATE).toFixed(2));
                const netSalary = baseSalary - employeeCPF;
                
                console.log(`Calculating CPF for payroll ID ${record.payrollId} - ${record.employeeName}:
                    Base Salary: ${baseSalary}
                    Employee CPF: ${employeeCPF}
                    Employer CPF: ${employerCPF}`);
                
                // Update the database
                await connection.execute(
                    "UPDATE payroll SET employeeCPF = ?, employerCPF = ?, netSalary = ? WHERE payrollId = ?",
                    [employeeCPF, employerCPF, netSalary, record.payrollId]
                );
            }
        }

        let query = `
            SELECT 
                p.*, 
                u.name as employeeName, 
                d.departmentName,
                CAST(p.employeeCPF AS DECIMAL(10,2)) as employeeCPF,
                CAST(p.employerCPF AS DECIMAL(10,2)) as employerCPF
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
        
        // Ensure numeric values are properly parsed
        const formattedRecords = payrollRecords.map(record => ({
            ...record,
            baseSalary: parseFloat(record.baseSalary) || 0,
            employeeCPF: parseFloat(record.employeeCPF) || 0,
            employerCPF: parseFloat(record.employerCPF) || 0,
            netSalary: parseFloat(record.netSalary) || 0
        }));
        
        console.log('Employee payroll records:', JSON.stringify(formattedRecords.slice(0, 1)));

        return res.status(200).json(formattedRecords);
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
            SELECT 
                p.*, 
                u.name as employeeName, 
                d.departmentName,
                CAST(p.employeeCPF AS DECIMAL(10,2)) as employeeCPF,
                CAST(p.employerCPF AS DECIMAL(10,2)) as employerCPF
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
        
        // Log the raw data from database
        console.log('Raw payroll records from database (first 2):', 
            JSON.stringify(payrollRecords.slice(0, 2)));
        
        // Auto-fix: Check for records with zero CPF values and fix them
        const recordsWithZeroCPF = payrollRecords.filter(record => 
            !record.employeeCPF || parseFloat(record.employeeCPF) === 0 || 
            !record.employerCPF || parseFloat(record.employerCPF) === 0
        );
        
        if (recordsWithZeroCPF.length > 0) {
            console.log(`Auto-calculating CPF for ${recordsWithZeroCPF.length} records`);
            
            // Fix each record with zero CPF
            for (const record of recordsWithZeroCPF) {
                const baseSalary = parseFloat(record.baseSalary);
                const employeeCPF = parseFloat((baseSalary * EMPLOYEE_CPF_RATE).toFixed(2));
                const employerCPF = parseFloat((baseSalary * EMPLOYER_CPF_RATE).toFixed(2));
                const netSalary = baseSalary - employeeCPF;
                
                console.log(`Calculating CPF for payroll ID ${record.payrollId} - ${record.employeeName}:
                    Base Salary: ${baseSalary}
                    Employee CPF: ${employeeCPF}
                    Employer CPF: ${employerCPF}`);
                
                // Update the database
                await connection.execute(
                    "UPDATE payroll SET employeeCPF = ?, employerCPF = ?, netSalary = ? WHERE payrollId = ?",
                    [employeeCPF, employerCPF, netSalary, record.payrollId]
                );
                
                // Update the record in the array to reflect fixed values
                record.employeeCPF = employeeCPF;
                record.employerCPF = employerCPF;
                record.netSalary = netSalary;
            }
        }
        
        // Ensure numeric values are properly parsed
        const formattedRecords = payrollRecords.map(record => ({
            ...record,
            baseSalary: parseFloat(record.baseSalary) || 0,
            employeeCPF: parseFloat(record.employeeCPF) || 0,
            employerCPF: parseFloat(record.employerCPF) || 0,
            netSalary: parseFloat(record.netSalary) || 0
        }));
        
        console.log('Sample payroll record:', JSON.stringify(formattedRecords.length > 0 ? formattedRecords[0] : {}));

        return res.status(200).json(formattedRecords);
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

        // First let's find and fix any payroll records with zero CPF values
        let fixQuery = `
            SELECT p.*, u.name as employeeName, u.department
            FROM payroll p
            JOIN user u ON p.employeeId = u.userId
            WHERE (p.employeeCPF = 0 OR p.employerCPF = 0)
        `;
        
        if (month && year) {
            fixQuery += " AND p.month = ? AND p.year = ?";
        }
        
        if (department) {
            fixQuery += " AND u.department = ?";
        }

        // Execute the query with appropriate parameters
        const fixParams = [];
        if (month && year) {
            fixParams.push(month, year);
        }
        if (department) {
            fixParams.push(department);
        }
        
        const [recordsToFix] = await connection.execute(fixQuery, fixParams);
        
        if (recordsToFix.length > 0) {
            console.log(`Auto-calculating CPF for ${recordsToFix.length} records before retrieving statistics`);
            
            // Fix each record with zero CPF
            for (const record of recordsToFix) {
                const baseSalary = parseFloat(record.baseSalary);
                const employeeCPF = parseFloat((baseSalary * EMPLOYEE_CPF_RATE).toFixed(2));
                const employerCPF = parseFloat((baseSalary * EMPLOYER_CPF_RATE).toFixed(2));
                const netSalary = baseSalary - employeeCPF;
                
                console.log(`Calculating CPF for payroll ID ${record.payrollId} - ${record.employeeName}:
                    Base Salary: ${baseSalary}
                    Employee CPF: ${employeeCPF}
                    Employer CPF: ${employerCPF}`);
                
                // Update the database
                await connection.execute(
                    "UPDATE payroll SET employeeCPF = ?, employerCPF = ?, netSalary = ? WHERE payrollId = ?",
                    [employeeCPF, employerCPF, netSalary, record.payrollId]
                );
            }
        }

        // Now get the statistics with fixed data
        let query = `
            SELECT 
                d.departmentName,
                COUNT(*) as totalEmployees,
                SUM(p.baseSalary) as totalBaseSalary,
                CAST(SUM(p.employeeCPF) AS DECIMAL(10,2)) as totalEmployeeCPF,
                CAST(SUM(p.employerCPF) AS DECIMAL(10,2)) as totalEmployerCPF,
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
        
        // Log the raw data from database
        console.log('Raw payroll stats from database:', JSON.stringify(stats));
        
        // Ensure values are numbers before sending response
        const formattedStats = stats.map(dept => ({
            departmentName: dept.departmentName,
            totalEmployees: Number(dept.totalEmployees),
            totalBaseSalary: parseFloat(dept.totalBaseSalary) || 0,
            totalEmployeeCPF: parseFloat(dept.totalEmployeeCPF) || 0,
            totalEmployerCPF: parseFloat(dept.totalEmployerCPF) || 0,
            totalNetSalary: parseFloat(dept.totalNetSalary) || 0
        }));
        
        console.log('Payroll stats being returned:', JSON.stringify(formattedStats));

        return res.status(200).json(formattedStats);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//recalculate payroll for an employee - used when needing to update an existing record
const recalculateMonthlyPayroll = async (req, res) => {
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
        
        // Print the employee data including baseSalary for debugging
        console.log('Employee data for payroll recalculation:', JSON.stringify({
            userId: employee.userId,
            name: employee.name,
            department: employee.departmentName,
            baseSalary: employee.baseSalary
        }));
        
        // Use employee's baseSalary directly if available, otherwise fall back to BASE_SALARIES
        const baseSalary = employee.baseSalary ? parseFloat(employee.baseSalary) : BASE_SALARIES[employee.departmentName] || 0;

        if (baseSalary === 0) {
            return res.status(400).json({ error: "No salary defined for this employee. Please set a base salary first." });
        }
        
        console.log(`Using base salary: ${baseSalary} for employee ${employee.name}`);

        //check if payroll exists for this month
        const [existingPayroll] = await connection.execute(
            "SELECT * FROM payroll WHERE employeeId = ? AND month = ? AND year = ?",
            [employeeId, month, year]
        );

        if (existingPayroll.length === 0) {
            return res.status(404).json({ error: "No payroll record found for this month." });
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
        
        //calculate CPF contributions based on actual salary
        const employeeCPF = parseFloat((actualSalary * EMPLOYEE_CPF_RATE).toFixed(2));
        const employerCPF = parseFloat((actualSalary * EMPLOYER_CPF_RATE).toFixed(2));
        const netSalary = actualSalary - employeeCPF;

        // Debug CPF calculation for recalculation
        console.log(`CPF recalculation for ${employee.name}:
            Actual Salary: ${actualSalary}
            Employee CPF Rate: ${EMPLOYEE_CPF_RATE}
            Employer CPF Rate: ${EMPLOYER_CPF_RATE}
            Raw Employee CPF: ${actualSalary * EMPLOYEE_CPF_RATE}
            Raw Employer CPF: ${actualSalary * EMPLOYER_CPF_RATE}
            Formatted Employee CPF: ${employeeCPF}
            Formatted Employer CPF: ${employerCPF}
            Net Salary: ${netSalary}`);

        // Log the exact values being updated
        console.log("Updating payroll with values:", {
            employeeId,
            month,
            year,
            baseSalary,
            employeeCPF,
            employerCPF,
            netSalary
        });

        //update payroll record
        await connection.execute(
            "UPDATE payroll SET baseSalary = ?, employeeCPF = ?, employerCPF = ?, netSalary = ? WHERE employeeId = ? AND month = ? AND year = ?",
            [baseSalary, employeeCPF, employerCPF, netSalary, employeeId, month, year]
        );

        // Verify the updated data
        const [updatedPayroll] = await connection.execute(
            "SELECT * FROM payroll WHERE employeeId = ? AND month = ? AND year = ?",
            [employeeId, month, year]
        );
        
        console.log("Updated payroll record:", JSON.stringify(updatedPayroll[0]));

        return res.status(200).json({
            message: "Payroll recalculated successfully",
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

// Get detailed payslip information by ID
const getPayslipById = async (req, res) => {
    const { payrollId } = req.params;
    
    if (!payrollId) {
        return res.status(400).json({ error: "Payroll ID is required." });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Get payroll details
        const [payrolls] = await connection.execute(
            `SELECT p.*, 
              u.name as employeeName, 
              u.department as departmentName,
              u.email as employeeEmail 
            FROM payroll p 
            JOIN user u ON p.employeeId = u.userId 
            WHERE p.payrollId = ?`,
            [payrollId]
        );
        
        if (payrolls.length === 0) {
            return res.status(404).json({ error: "Payslip not found." });
        }
        
        const payroll = payrolls[0];
        console.log("Found payroll record:", JSON.stringify(payroll));
        
        // Get deductions for this payroll - safely handle if table doesn't exist
        let deductions = [];
        try {
            const [deductionRows] = await connection.execute(
                "SELECT * FROM payroll_deduction WHERE payrollId = ?",
                [payrollId]
            );
            deductions = deductionRows;
        } catch (deductionError) {
            console.error("Error fetching deductions (table may not exist):", deductionError);
            // Continue without deductions
        }
        
        // Get attendance details for this payroll period - safely handle errors
        let attendance = [];
        try {
            const [attendanceRows] = await connection.execute(
                `SELECT 
                  DATE_FORMAT(a.date, '%Y-%m-%d') as date,
                  TIME_FORMAT(a.clockIn, '%H:%i') as clockIn,
                  TIME_FORMAT(a.clockOut, '%H:%i') as clockOut,
                  a.status,
                  TIMESTAMPDIFF(MINUTE, a.clockIn, a.clockOut) / 60 as hoursWorked
                FROM attendance a
                WHERE a.employeeId = ? 
                AND MONTH(a.date) = ? 
                AND YEAR(a.date) = ?
                ORDER BY a.date ASC`,
                [payroll.employeeId, payroll.month, payroll.year]
            );
            attendance = attendanceRows;
        } catch (attendanceError) {
            console.error("Error fetching attendance records:", attendanceError);
            // Continue without attendance records
        }
        
        // Get time off details for this payroll period - safely handle errors
        let timeOff = [];
        try {
            const [timeOffRows] = await connection.execute(
                `SELECT 
                  t.timeOffId,
                  t.type,
                  DATE_FORMAT(t.startDate, '%Y-%m-%d') as startDate,
                  DATE_FORMAT(t.endDate, '%Y-%m-%d') as endDate,
                  t.status,
                  t.notes,
                  DATEDIFF(t.endDate, t.startDate) + 1 as days
                FROM timeoff t
                WHERE t.employeeId = ? 
                AND MONTH(t.startDate) = ? 
                AND YEAR(t.startDate) = ?
                AND t.status = 'Approved'
                ORDER BY t.startDate ASC`,
                [payroll.employeeId, payroll.month, payroll.year]
            );
            timeOff = timeOffRows;
        } catch (timeOffError) {
            console.error("Error fetching time off records:", timeOffError);
            // Continue without time off records
        }
        
        // Calculate summary statistics with fallbacks for missing data
        const totalHoursWorked = attendance.length > 0 
            ? attendance.reduce((sum, record) => sum + (parseFloat(record.hoursWorked) || 0), 0).toFixed(2)
            : "0.00";
            
        const attendanceSummary = {
            totalDays: attendance.length,
            totalHoursWorked,
            onTime: attendance.filter(a => a.status === 'On Time').length,
            late: attendance.filter(a => a.status === 'Late').length,
            absent: attendance.filter(a => a.status === 'Absent').length
        };
        
        // Format the payroll object for response
        const payslip = {
            payrollId: payroll.payrollId,
            employeeId: payroll.employeeId,
            employeeName: payroll.employeeName || "Unknown Employee",
            employeeEmail: payroll.employeeEmail || "",
            department: payroll.departmentName || "Unknown Department",
            payPeriod: `${payroll.month}/${payroll.year}`,
            paymentDate: payroll.paymentDate || null,
            baseSalary: parseFloat(payroll.baseSalary) || 0,
            employeeCPF: parseFloat(payroll.employeeCPF) || 0,
            employerCPF: parseFloat(payroll.employerCPF) || 0,
            totalDeductions: deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0),
            netSalary: parseFloat(payroll.netSalary) || 0,
            status: payroll.status || "Pending",
            deductions,
            attendance,
            attendanceSummary,
            timeOff,
            generatedAt: new Date()
        };
        
        console.log("Returning payslip data:", JSON.stringify(payslip));
        return res.status(200).json(payslip);
    } catch (error) {
        console.error("Error fetching payslip details:", error);
        return res.status(500).json({ error: "Failed to fetch payslip details." });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    calculateMonthlyPayroll,
    recalculateMonthlyPayroll,
    getEmployeePayroll,
    getAllPayroll,
    updatePayrollStatus,
    getPayrollStats,
    getPayslipById
}; 