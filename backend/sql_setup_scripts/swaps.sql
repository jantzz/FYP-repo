-- Create swap table for storing swap requests 
CREATE TABLE swap (
    swapId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    currentShift INT UNSIGNED NOT NULL,
    swapWith INT UNSIGNED NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currentShift) REFERENCES shift(shiftId) ON DELETE CASCADE,
    FOREIGN KEY (swapWith) REFERENCES shift(shiftId) ON DELETE CASCADE
);

-- insert test shifts 
INSERT INTO shift (employeeId, startDate, endDate, title, status)
VALUES (1, '2021-01-01', '2021-01-02', 'Test Shift 1', 'Active'),
       (2, '2021-01-01', '2021-01-02', 'Test Shift 2', 'Active'),
       (3, '2021-01-01', '2021-01-02', 'Test Shift 3', 'Active');

-- insert test swaps
INSERT INTO swap (currentShift, swapWith)
VALUES (1, 2),
       (2, 3),
       (3, 1); 