
CREATE TABLE availability (
    availabilityId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId INT UNSIGNED NOT NULL,
    startDate DATE NOT NULL,
    startTime TIME NOT NULL,
    endDate DATE NOT NULL,
    endTime TIME NOT NULL,
    preferredShift ENUM('Day Shift', 'Afternoon Shift', 'Night Shift') NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approvedBy INT UNSIGNED NULL,
    FOREIGN KEY (employeeId) REFERENCES user(userId) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES user(userId) ON DELETE SET NULL
);

CREATE VIEW employee_availability_view AS
SELECT 
    a.availabilityId,
    a.employeeId,
    u.name AS employeeName,
    a.startDate,
    a.startTime,
    a.endDate,
    a.endTime,
    a.preferredShift,
    a.status,
    a.submittedAt,
    a.approvedBy
FROM availability a
JOIN user u ON a.employeeId = u.userId;
