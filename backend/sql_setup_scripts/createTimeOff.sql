drop table if exists timeoff;
drop table if exists leave_balance;

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

CREATE TABLE leave_balance (
    employeeId INT UNSIGNED ZEROFILL PRIMARY KEY,
    Paid INT UNSIGNED DEFAULT 0,
    Unpaid INT UNSIGNED DEFAULT 0,
    Medical INT UNSIGNED DEFAULT 0,
    FOREIGN KEY (employeeId) REFERENCES user(userId)
        ON UPDATE CASCADE ON DELETE CASCADE
);
-- adds 10 paid leaves, 5 unpaid leaves and 14 medical leaves for each user
INSERT INTO leave_balance (employeeId, Paid, Unpaid, Medical)
SELECT userId, 10, 5, 14 FROM user
WHERE userId NOT IN (SELECT employeeId FROM leave_balance);
