-- dummy leave records for employeeId 2 for March 2025
INSERT INTO timeoff (employeeId, type, startDate, endDate, reason, status, approvedBy)
VALUES 
-- 2 days of paid leave
(2, 'Paid', '2025-03-19', '2025-03-20', 'Family event', 'Approved', 1),
-- 1 day of unpaid leave
(2, 'Unpaid', '2025-03-27', '2025-03-27', 'Personal matters', 'Approved', 1),
-- 1 day of medical leave
(2, 'Medical', '2025-03-28', '2025-03-28', 'Doctor appointment', 'Approved', 1); 

-- delete existing leave records for employeeId 2 for March 2025
DELETE FROM timeoff 
WHERE employeeId = 2 
AND MONTH(startDate) = 3 
AND YEAR(startDate) = 2025;
-- or
TRUNCATE TABLE timeoff;