CREATE TABLE timeoff (
    timeOffId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    type ENUM('Paid', 'Unpaid', 'Medical') NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    reason TEXT,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approvedBy INT UNSIGNED,
    FOREIGN KEY (employeeId) REFERENCES user(userId) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES user(userId) ON DELETE SET NULL
);
