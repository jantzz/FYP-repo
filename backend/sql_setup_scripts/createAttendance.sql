CREATE TABLE attendance (
    attendanceId INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    shiftId INT UNSIGNED NOT NULL,
    employeeId INT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    clockInTime DATETIME,
    clockOutTime DATETIME,
    status ENUM('Present', 'Absent', 'Late', 'Leave') NOT NULL DEFAULT 'Absent',
    notes VARCHAR(255),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT attendanceFK1 FOREIGN KEY (employeeId)
        REFERENCES user(userId)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT attendanceFK2 FOREIGN KEY (shiftId)
        REFERENCES shift(shiftId)
        ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_status (status)
) AUTO_INCREMENT = 1; 