CREATE TABLE payroll (
    payrollId INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    baseSalary DECIMAL(10,2) NOT NULL,
    employeeCPF DECIMAL(10,2) NOT NULL,
    employerCPF DECIMAL(10,2) NOT NULL,
    netSalary DECIMAL(10,2) NOT NULL,
    status ENUM('Pending', 'Paid') NOT NULL DEFAULT 'Pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT payrollFK1 FOREIGN KEY (employeeId)
        REFERENCES user(userId)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE KEY unique_payroll (employeeId, month, year),
    INDEX idx_payroll_status (status)
) AUTO_INCREMENT = 1; 


-- delete existing payroll record for employeeId 2
DELETE FROM payroll
WHERE employeeId = 2
AND month = 3
AND year = 2025; 

