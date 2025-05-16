DROP TABLE IF EXISTS availability;
DROP VIEW IF EXISTS employee_availability_view;

CREATE TABLE availability (
    availabilityId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    preferredDates VARCHAR(15) NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approvedBy INT UNSIGNED NULL,
    FOREIGN KEY (employeeId) REFERENCES user(userId) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES user(userId) ON DELETE SET NULL
);

-- Test availabilities
INSERT IGNORE INTO availability (employeeId, preferredDates, status, approvedBy) VALUES 
(7, 'M,W,F', 'Approved', 3),
(8, 'T,TH', 'Approved', 3),
(9, 'S,SN', 'Approved', 3),
(13, 'M,W,F', 'Approved', 3),
(14, 'T,TH', 'Approved', 3),
(15, 'S,SN', 'Approved', 3),
(16, 'M,W,F', 'Approved', 3),
(17, 'T,TH', 'Approved', 3),
(18, 'S,SN', 'Approved', 3);

CREATE VIEW employee_availability_view AS
SELECT 
    a.availabilityId,
    a.employeeId,
    u.name AS employeeName,
    a.preferredDates,
    a.status,
    a.submittedAt,
    a.approvedBy
FROM availability a
JOIN user u ON a.employeeId = u.userId;
