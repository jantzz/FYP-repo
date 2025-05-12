-- dummy attendance records for employeeId 7 for May 2025
-- 8-hour shifts (9 AM to 5 PM) with some longer days
-- Week 1
INSERT INTO attendance (employeeId, shiftId, date, clockInTime, clockOutTime, status, notes)
VALUES 
-- May 1: Extended hours (10 hours)
(7, 1, '2025-05-01', '2025-05-01 08:00:00', '2025-05-01 18:00:00', 'Present', 'Extended hours'),
-- May 2: Absent (No show)
(7, 1, '2025-05-02', NULL, NULL, 'Absent', 'No show'),
-- May 3: Absent (Sick, no note)
(7, 1, '2025-05-03', NULL, NULL, 'Absent', 'Called in sick'),
(7, 1, '2025-05-04', '2025-05-04 09:00:00', '2025-05-04 17:00:00', 'Present', NULL),
-- May 5: Late (Traffic)
(7, 1, '2025-05-05', '2025-05-05 09:23:00', '2025-05-05 17:10:00', 'Late', 'Delayed due to traffic'),
-- May 6: Extended hours (11 hours)
(7, 1, '2025-05-06', '2025-05-06 08:00:00', '2025-05-06 19:00:00', 'Present', 'Extended hours for project deadline'),
(7, 1, '2025-05-07', '2025-05-07 09:00:00', '2025-05-07 17:00:00', 'Present', NULL),
-- May 8: Late (Overslept)
(7, 1, '2025-05-08', '2025-05-08 09:45:00', '2025-05-08 17:45:00', 'Late', 'Overslept'),

-- Week 2
(7, 1, '2025-05-11', '2025-05-11 09:00:00', '2025-05-11 17:00:00', 'Present', NULL),
-- May 12: Extended hours (12 hours)
(7, 1, '2025-05-12', '2025-05-12 08:00:00', '2025-05-12 20:00:00', 'Present', 'Extended hours for quarterly report'),
-- May 13: Late (Public transport delay)
(7, 1, '2025-05-13', '2025-05-13 09:15:00', '2025-05-13 17:05:00', 'Late', 'Public transport delay'),
-- May 14: Extended hours (10 hours)
(7, 1, '2025-05-14', '2025-05-14 08:30:00', '2025-05-14 18:30:00', 'Present', 'Extended hours for client meeting'),
(7, 1, '2025-05-15', '2025-05-15 09:00:00', '2025-05-15 17:00:00', 'Present', NULL),
-- May 16: Absent (Family emergency)
(7, 1, '2025-05-16', NULL, NULL, 'Absent', 'Family emergency'),

-- Week 3
-- May 18: Late (Car wouldn't start)
(7, 1, '2025-05-18', '2025-05-18 09:30:00', '2025-05-18 17:30:00', 'Late', 'Car wouldn\'t start'),
-- May 19-20: Paid Leave
(7, 1, '2025-05-19', NULL, NULL, 'Leave', 'Paid leave'),
(7, 1, '2025-05-20', NULL, NULL, 'Leave', 'Paid leave'),
-- May 21: Extended hours (9 hours)
(7, 1, '2025-05-21', '2025-05-21 09:00:00', '2025-05-21 18:00:00', 'Present', 'Extra hour to complete tasks'),
(7, 1, '2025-05-22', '2025-05-22 09:00:00', '2025-05-22 17:00:00', 'Present', NULL),
-- May 23: Absent (Weather conditions)
(7, 1, '2025-05-23', NULL, NULL, 'Absent', 'Severe weather conditions'),

-- Week 4
-- May 25: Extended hours (10 hours)
(7, 1, '2025-05-25', '2025-05-25 08:00:00', '2025-05-25 18:00:00', 'Present', 'Extended hours for end-of-month reports'),
-- May 26: Late (Forgot to set alarm)
(7, 1, '2025-05-26', '2025-05-26 09:50:00', '2025-05-26 17:50:00', 'Late', 'Forgot to set alarm'),
-- May 27: Unpaid Leave
(7, 1, '2025-05-27', NULL, NULL, 'Leave', 'Unpaid leave'),
-- May 28: Medical Leave
(7, 1, '2025-05-28', NULL, NULL, 'Leave', 'Medical leave'),
-- May 29: Extended hours (9.5 hours)
(7, 1, '2025-05-29', '2025-05-29 08:30:00', '2025-05-29 18:00:00', 'Present', 'Extended hours for month-end closing'),
-- May 30: Absent (No call, no show)
(7, 1, '2025-05-30', NULL, NULL, 'Absent', 'No call, no show');

-- delete existing attendance records for employeeId 7 for May 2025
DELETE FROM attendance 
WHERE employeeId = 7 
AND MONTH(date) = 5 
AND YEAR(date) = 2025;
-- or
TRUNCATE TABLE attendance;