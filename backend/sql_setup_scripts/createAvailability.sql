DROP TABLE IF EXISTS availability;
DROP VIEW IF EXISTS employee_availability_view;

CREATE TABLE availability (
    availabilityId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    startDate DATE NOT NULL,
    startTime TIME NOT NULL,
    endDate DATE NOT NULL,
    endTime TIME NOT NULL,
    preferredShift ENUM('Morning Shift', 'Afternoon Shift', 'Night Shift') NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    hours DECIMAL(5,2) NOT NULL,
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approvedBy INT UNSIGNED NULL,
    FOREIGN KEY (employeeId) REFERENCES user(userId) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES user(userId) ON DELETE SET NULL
);

CREATE TABLE availability (
    availabilityId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    preferredDates VARCHAR(15) NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    hours DECIMAL(5,2) NOT NULL,
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approvedBy INT UNSIGNED NULL,
    FOREIGN KEY (employeeId) REFERENCES user(userId) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES user(userId) ON DELETE SET NULL
);

-- Test availabilities
INSERT IGNORE INTO availability (employeeId, preferredDates, status, hours, approvedBy) VALUES 
(1, 'M,W,F', 'Approved', 9.0, 11),
(2, 'T,TH', 'Approved', 9.0, 11),
(3, 'S,SN', 'Approved', 9.0, 11),
(4, 'M,W,F', 'Approved', 9.0, 11),
(5, 'T,TH', 'Approved', 9.0, 11),
(6, 'S,SN', 'Approved', 9.0, 11),
(7, 'M,W,F', 'Approved', 9.0, 11),
(9, 'T,TH', 'Approved', 9.0, 11),
(10, 'S,SN', 'Approved', 9.0, 11);

CREATE VIEW employee_availability_view AS
SELECT 
    a.availabilityId,
    a.employeeId,
    u.name AS employeeName,
    a.preferredDates,
    a.status,
    a.hours,
    a.submittedAt,
    a.approvedBy
FROM availability a
JOIN user u ON a.employeeId = u.userId;
