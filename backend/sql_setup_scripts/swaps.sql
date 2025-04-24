-- Create swap table for storing swap requests 
CREATE TABLE swaps (
    swapId INT UNSIGNED AUTO_INCREMENT,
    currentShift INT UNSIGNED NOT NULL,
    swapWith INT UNSIGNED NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'pending',
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (swapId),
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