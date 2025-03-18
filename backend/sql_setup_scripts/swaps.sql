-- Create swap table for storing swap requests 
CREATE TABLE swaps (
    swapId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    currentShift INT UNSIGNED NOT NULL,
    swapWith INT UNSIGNED NOT NULL,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currentShift) REFERENCES shift(shiftId) ON DELETE CASCADE,
    FOREIGN KEY (swapWith) REFERENCES shift(shiftId) ON DELETE CASCADE
);

-- insert test swaps
INSERT INTO swaps (currentShift, swapWith)
VALUES (1, 2),
       (2, 3),
       (3, 1);
