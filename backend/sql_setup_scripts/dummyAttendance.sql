-- dummy attendance records for employeeId 2 for March 2025
-- 8-hour shifts (9 AM to 5 PM)
-- Week 1
INSERT INTO attendance (employeeId, shiftId, date, clockInTime, clockOutTime, status, notes)
VALUES 
(2, 1, '2025-03-01', '2025-03-01 09:00:00', '2025-03-01 17:00:00', 'Present', NULL),
(2, 1, '2025-03-04', '2025-03-04 09:00:00', '2025-03-04 17:00:00', 'Present', NULL),
(2, 1, '2025-03-05', '2025-03-05 09:00:00', '2025-03-05 17:00:00', 'Present', NULL),
(2, 1, '2025-03-06', '2025-03-06 09:00:00', '2025-03-06 17:00:00', 'Present', NULL),
(2, 1, '2025-03-07', '2025-03-07 09:00:00', '2025-03-07 17:00:00', 'Present', NULL),
(2, 1, '2025-03-08', '2025-03-08 09:00:00', '2025-03-08 17:00:00', 'Present', NULL),

-- Week 2
(2, 1, '2025-03-11', '2025-03-11 09:00:00', '2025-03-11 17:00:00', 'Present', NULL),
(2, 1, '2025-03-12', '2025-03-12 09:00:00', '2025-03-12 17:00:00', 'Present', NULL),
(2, 1, '2025-03-13', '2025-03-13 09:00:00', '2025-03-13 17:00:00', 'Present', NULL),
(2, 1, '2025-03-14', '2025-03-14 09:00:00', '2025-03-14 17:00:00', 'Present', NULL),
(2, 1, '2025-03-15', '2025-03-15 09:00:00', '2025-03-15 17:00:00', 'Present', NULL),

-- Week 3
(2, 1, '2025-03-18', '2025-03-18 09:00:00', '2025-03-18 17:00:00', 'Present', NULL),
-- March 19-20: Paid Leave
(2, 1, '2025-03-21', '2025-03-21 09:00:00', '2025-03-21 17:00:00', 'Present', NULL),
(2, 1, '2025-03-22', '2025-03-22 09:00:00', '2025-03-22 17:00:00', 'Present', NULL),

-- Week 4
(2, 1, '2025-03-25', '2025-03-25 09:00:00', '2025-03-25 17:00:00', 'Present', NULL),
(2, 1, '2025-03-26', '2025-03-26 09:00:00', '2025-03-26 17:00:00', 'Present', NULL),
-- March 27: Unpaid Leave
-- March 28: Medical Leave
(2, 1, '2025-03-29', '2025-03-29 09:00:00', '2025-03-29 17:00:00', 'Present', NULL);

-- delete existing attendance records for employeeId 2 for March 2025
DELETE FROM attendance 
WHERE employeeId = 2 
AND MONTH(date) = 3 
AND YEAR(date) = 2025;
-- or
TRUNCATE TABLE attendance;