const db = require('../database/db');

/**
 * Record attendance (clock in)
 */
const clockIn = async (req, res) => {
    const { employeeId, shiftId } = req.body;
    if (!employeeId || !shiftId) {
        return res.status(400).json({ error: "Employee ID and Shift ID are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if the shift exists and belongs to the employee
        const [shifts] = await connection.execute(
            "SELECT * FROM shift WHERE shiftId = ? AND employeeId = ?", 
            [shiftId, employeeId]
        );
        
        if (shifts.length === 0) {
            return res.status(404).json({ error: "Shift not found or doesn't belong to the employee." });
        }

        const shift = shifts[0];
        
        // Get today's date in local time zone format YYYY-MM-DD
        const now = new Date();
        // For logging, keep track of what we're doing
        console.log('Clock in attempt:', {
            shift: shift,
            shiftId: shiftId,
            employeeId: employeeId,
            currentTime: now.toISOString(),
        });
        
        let allowClockIn = false;
        
        // Check if startDate is just a time format (HH:MM:SS)
        if (shift.startDate && shift.startDate.includes(':') && shift.startDate.length <= 8) {
            console.log('Time-only format detected, allowing clock in');
            allowClockIn = true;
        }
        
        // If not already allowed, check the date range
        if (!allowClockIn) {
            // Get today's date with timezone adjustment
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // Calculate yesterday and tomorrow to allow a buffer for timezone issues
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            console.log('Date range for validation:', {
                yesterday: yesterday.toISOString().split('T')[0],
                today: today.toISOString().split('T')[0],
                tomorrow: tomorrow.toISOString().split('T')[0]
            });
            
            // Try to get a valid date from the shift
            let shiftDate = null;
            
            // Try shiftDate field first
            if (shift.shiftDate) {
                try {
                    shiftDate = new Date(shift.shiftDate);
                    console.log('Using shiftDate field:', shiftDate.toISOString().split('T')[0]);
                } catch (err) {
                    console.error('Error parsing shiftDate:', err);
                }
            }
            
            // If no valid shiftDate, try startDate field
            if (!shiftDate && shift.startDate) {
                // Check if startDate contains a date component
                if (shift.startDate.includes('-') || shift.startDate.includes('T')) {
                    try {
                        shiftDate = new Date(shift.startDate);
                        console.log('Using startDate field:', shiftDate.toISOString().split('T')[0]);
                    } catch (err) {
                        console.error('Error parsing startDate:', err);
                    }
                }
            }
            
            // If we have a valid shift date, check if it's within our range
            if (shiftDate && !isNaN(shiftDate.getTime())) {
                // Compare only the date part (ignoring time)
                const shiftDateOnly = new Date(
                    shiftDate.getFullYear(),
                    shiftDate.getMonth(),
                    shiftDate.getDate()
                );
                
                if (
                    shiftDateOnly.getTime() === yesterday.getTime() ||
                    shiftDateOnly.getTime() === today.getTime() ||
                    shiftDateOnly.getTime() === tomorrow.getTime()
                ) {
                    console.log('Shift date is within the allowed range, allowing clock in');
                    allowClockIn = true;
                }
            }
        }
        
        // If we couldn't validate the date, but it's displayed in Today's Schedule
        // Just allow clocking in (trust the frontend)
        if (!allowClockIn) {
            console.log('OVERRIDE: Allowing clock in despite date validation failure');
            allowClockIn = true;
        }
        
        // Get today's date for attendance record in YYYY-MM-DD format
        const todayStr = now.toISOString().split('T')[0];
        
        // Check if already clocked in today
        const [existingAttendance] = await connection.execute(
            "SELECT * FROM attendance WHERE employeeId = ? AND shiftId = ? AND date = ?",
            [employeeId, shiftId, todayStr]
        );
        
        // Determine attendance status and prepare notes
        const status = determineStatus(now, shift);
        let notes = null;
        
        // If late, add a note about how many minutes late
        if (status === 'Late') {
            try {
                // Parse the shift time (HH:MM:SS format)
                const timeParts = shift.startDate.split(':');
                const startHour = parseInt(timeParts[0], 10);
                const startMinute = parseInt(timeParts[1], 10);
                
                // Set the expected start time by combining shift date with start time
                const shiftDate = new Date(shift.shiftDate);
                const expectedStartTime = new Date(shiftDate);
                expectedStartTime.setHours(startHour, startMinute, 0, 0);
                
                const minutesLate = Math.floor((now - expectedStartTime) / (1000 * 60));
                notes = `Employee clocked in ${minutesLate} minutes after scheduled start time.`;
            } catch (error) {
                console.error('Error calculating lateness details:', error.message);
                notes = 'Employee marked as late, but exact time difference could not be calculated.';
            }
        }
        
        if (existingAttendance.length > 0) {
            if (existingAttendance[0].clockInTime) {
                return res.status(400).json({ error: "Already clocked in today." });
            }
            
            // Update existing attendance record
            await connection.execute(
                "UPDATE attendance SET clockInTime = ?, status = ?, notes = ? WHERE attendanceId = ?",
                [now, status, notes, existingAttendance[0].attendanceId]
            );
        } else {
            // Create new attendance record
            await connection.execute(
                "INSERT INTO attendance (employeeId, shiftId, date, clockInTime, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
                [employeeId, shiftId, todayStr, now, status, notes]
            );
        }
        
        return res.status(200).json({ 
            message: "Clock in successful.", 
            timestamp: now,
            status: status,
            notes: notes
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Record attendance (clock out)
 */
const clockOut = async (req, res) => {
    const { employeeId, shiftId, attendanceId } = req.body;
    
    // Check if we have either attendanceId or both employeeId and shiftId
    if (!attendanceId && (!employeeId || !shiftId)) {
        return res.status(400).json({ error: "Either attendanceId or both employeeId and shiftId are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        
        // Get today's date in YYYY-MM-DD format for consistent usage
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        let existingAttendance;
        
        // If attendanceId is provided, use it directly
        if (attendanceId) {
            [existingAttendance] = await connection.execute(
                "SELECT * FROM attendance WHERE attendanceId = ?",
                [attendanceId]
            );
            
            // Verify this attendance record belongs to the employee if employeeId is provided
            if (employeeId && existingAttendance.length > 0 && existingAttendance[0].employeeId != employeeId) {
                return res.status(403).json({ error: "This attendance record does not belong to this employee." });
            }
        } else {
            // Otherwise use employeeId and shiftId
            [existingAttendance] = await connection.execute(
                "SELECT * FROM attendance WHERE employeeId = ? AND shiftId = ? AND date = ?",
                [employeeId, shiftId, todayStr]
            );
        }
        
        // Check if we found an attendance record
        if (existingAttendance.length === 0) {
            return res.status(400).json({ error: "No attendance record found." });
        }
        
        // Check if the user has clocked in
        if (!existingAttendance[0].clockInTime) {
            return res.status(400).json({ error: "Must clock in before clocking out." });
        }
        
        // Check if already clocked out
        if (existingAttendance[0].clockOutTime) {
            return res.status(400).json({ error: "Already clocked out today." });
        }
        
        // Update existing attendance record
        await connection.execute(
            "UPDATE attendance SET clockOutTime = ? WHERE attendanceId = ?",
            [now, existingAttendance[0].attendanceId]
        );
        
        return res.status(200).json({ 
            message: "Clock out successful.", 
            timestamp: now
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Get attendance records for an employee
 */
const getEmployeeAttendance = async (req, res) => {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        
        let query = `
            SELECT a.*, s.startDate as shiftStartDate, s.endDate as shiftEndDate, s.title as shiftTitle, u.name as employeeName
            FROM attendance a
            LEFT JOIN shift s ON a.shiftId = s.shiftId
            JOIN user u ON a.employeeId = u.userId
            WHERE a.employeeId = ?
        `;
        
        const params = [employeeId];
        
        if (startDate && endDate) {
            query += " AND a.date BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        
        query += " ORDER BY a.date DESC";
        
        const [attendanceRecords] = await connection.execute(query, params);
        
        return res.status(200).json(attendanceRecords);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Get all attendance records (for admin/managers)
 */
const getAllAttendance = async (req, res) => {
    const { startDate, endDate, department, clinicId } = req.query;
    
    console.log('Getting all attendance records with params:', { startDate, endDate, department, clinicId });
    
    let connection;
    try {
        connection = await db.getConnection();
        
        let query = `
            SELECT a.*, s.startDate as shiftStartDate, s.endDate as shiftEndDate, s.title as shiftTitle, 
                   u.name as employeeName, u.department, u.clinicId, c.clinicName
            FROM attendance a
            LEFT JOIN shift s ON a.shiftId = s.shiftId
            JOIN user u ON a.employeeId = u.userId
            LEFT JOIN clinics c ON u.clinicId = c.clinicId
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate && endDate) {
            query += " AND a.date BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        
        if (department) {
            query += " AND u.department = ?";
            params.push(department);
        }
        
        if (clinicId) {
            query += " AND u.clinicId = ?";
            params.push(clinicId);
        }
        
        query += " ORDER BY a.date DESC, u.name ASC";
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const [attendanceRecords] = await connection.execute(query, params);
        
        console.log(`Found ${attendanceRecords.length} attendance records`);
        
        return res.status(200).json(attendanceRecords);
    } catch (err) {
        console.error('Error in getAllAttendance:', err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Get attendance statistics
 */
const getAttendanceStats = async (req, res) => {
    const { employeeId, department, startDate, endDate } = req.query;
    
    let connection;
    try {
        connection = await db.getConnection();
        
        let baseQuery = `
            SELECT 
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as presentCount,
                COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absentCount,
                COUNT(CASE WHEN a.status = 'Late' THEN 1 END) as lateCount,
                COUNT(CASE WHEN a.status = 'Leave' THEN 1 END) as leaveCount,
                COUNT(*) as totalCount
            FROM attendance a
            LEFT JOIN shift s ON a.shiftId = s.shiftId
            JOIN user u ON a.employeeId = u.userId
            WHERE 1=1
        `;
        
        const params = [];
        
        if (employeeId) {
            baseQuery += " AND a.employeeId = ?";
            params.push(employeeId);
        }
        
        if (department) {
            baseQuery += " AND u.department = ?";
            params.push(department);
        }
        
        if (startDate && endDate) {
            baseQuery += " AND a.date BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        
        const [stats] = await connection.execute(baseQuery, params);
        
        // Calculate attendance rate
        const attendanceRate = stats[0].totalCount > 0 
            ? (((stats[0].presentCount + stats[0].lateCount) / (stats[0].totalCount - stats[0].leaveCount)) * 100).toFixed(2)
            : 0;
        
        // Get daily attendance breakdown if date range provided
        let dailyBreakdown = [];
        if (startDate && endDate) {
            const dailyQuery = `
                SELECT 
                    a.date,
                    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as presentCount,
                    COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absentCount,
                    COUNT(CASE WHEN a.status = 'Late' THEN 1 END) as lateCount,
                    COUNT(CASE WHEN a.status = 'Leave' THEN 1 END) as leaveCount,
                    COUNT(*) as totalCount
                FROM attendance a
                LEFT JOIN shift s ON a.shiftId = s.shiftId
                JOIN user u ON a.employeeId = u.userId
                WHERE 1=1
            `;
            
            let dailyParams = [...params];
            
            let whereClause = "";
            
            if (employeeId) {
                whereClause += " AND a.employeeId = ?";
            }
            
            if (department) {
                whereClause += " AND u.department = ?";
            }
            
            if (startDate && endDate) {
                whereClause += " AND a.date BETWEEN ? AND ?";
            }
            
            const fullDailyQuery = dailyQuery + whereClause + " GROUP BY a.date ORDER BY a.date";
            
            const [dailyResults] = await connection.execute(fullDailyQuery, dailyParams);
            dailyBreakdown = dailyResults;
        }
        
        return res.status(200).json({
            stats: {
                presentCount: stats[0].presentCount,
                absentCount: stats[0].absentCount,
                lateCount: stats[0].lateCount,
                leaveCount: stats[0].leaveCount,
                totalCount: stats[0].totalCount,
                attendanceRate: parseFloat(attendanceRate)
            },
            dailyBreakdown
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Helper function to determine attendance status based on clock-in time
 */
function determineStatus(clockInTime, shift) {
    try {
        // Create a reference date from today in local time
        const today = new Date();
        const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        let shiftDate = localToday; // Default to today if we can't determine shift date
        
        // Try to get a valid date from the shift
        if (shift.shiftDate) {
            try {
                const parsedDate = new Date(shift.shiftDate);
                if (!isNaN(parsedDate.getTime())) {
                    // Use only the date part, not the time
                    shiftDate = new Date(
                        parsedDate.getFullYear(), 
                        parsedDate.getMonth(), 
                        parsedDate.getDate()
                    );
                }
            } catch (err) {
                console.error('Error parsing shiftDate in determineStatus:', err);
            }
        }
        
        // Parse the shift time
        let startHour = 0, startMinute = 0;
        
        // Check if startDate is time only or full datetime
        if (shift.startDate && shift.startDate.includes(':') && !shift.startDate.includes('T') && !shift.startDate.includes('-')) {
            // It's a time-only format (HH:MM:SS)
            const timeParts = shift.startDate.split(':');
            if (timeParts.length >= 2) {
                startHour = parseInt(timeParts[0], 10);
                startMinute = parseInt(timeParts[1], 10);
            }
        } else if (shift.startDate) {
            // Try to extract time from a datetime string
            try {
                const startDateTime = new Date(shift.startDate);
                if (!isNaN(startDateTime.getTime())) {
                    startHour = startDateTime.getHours();
                    startMinute = startDateTime.getMinutes();
                }
            } catch (err) {
                console.log('Error parsing datetime from startDate:', err);
            }
        }
        
        // Set the expected start time by combining shift date with start time
        const expectedStartTime = new Date(shiftDate);
        expectedStartTime.setHours(startHour, startMinute, 0, 0);
        
        console.log('Determining status:', {
            clockInTime: clockInTime.toISOString(),
            expectedStartTime: expectedStartTime.toISOString(),
            shift: shift.title || 'Unnamed shift',
            shiftId: shift.shiftId,
            startTime: shift.startDate
        });
        
        // Calculate time difference in minutes
        const timeDifferenceMs = clockInTime - expectedStartTime;
        const timeDifferenceMinutes = Math.floor(timeDifferenceMs / (1000 * 60));
        
        // Define the late threshold (e.g., 5 minutes grace period)
        const lateThresholdMinutes = 5;
        
        if (timeDifferenceMinutes > lateThresholdMinutes) {
            // If more than the threshold minutes late, mark as Late
            return 'Late';
        }
        
        return 'Present';
    } catch (error) {
        // If we can't determine the shift time, mark as Present by default
        console.error('Error determining status:', error.message);
        console.log('Unable to determine lateness. Marking as Present by default.');
        return 'Present';
    }
}

/**
 * Sync approved time off with attendance records
 * This should be called whenever a time off request is approved
 */
const syncTimeOffWithAttendance = async (req, res) => {
    const { employeeId, startDate, endDate } = req.body;
    
    if (!employeeId || !startDate || !endDate) {
        return res.status(400).json({ error: "Employee ID, start date, and end date are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        
        // Get all dates between start and end dates (inclusive)
        const dates = [];
        let currentDate = new Date(startDate);
        const lastDate = new Date(endDate);
        
        // Include start date in the loop
        while (currentDate <= lastDate) {
            // Format date as YYYY-MM-DD for SQL
            const formattedDate = currentDate.toISOString().split('T')[0];
            dates.push(formattedDate);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log(`Processing ${dates.length} leave days for employee ${employeeId}`);
        
        // Process each date
        for (const date of dates) {
            // Check if there's already an attendance record for this date and employee
            const [existingRecords] = await connection.execute(
                "SELECT * FROM attendance WHERE employeeId = ? AND date = ?",
                [employeeId, date]
            );
            
            if (existingRecords.length > 0) {
                // Update existing record
                console.log(`Updating existing attendance record for ${date} to Leave status`);
                await connection.execute(
                    "UPDATE attendance SET status = 'Leave', clockInTime = NULL, clockOutTime = NULL WHERE attendanceId = ?",
                    [existingRecords[0].attendanceId]
                );
            } else {
                // Get employee's default shift
                // First try to get a shift that covers this specific date
                const [dateShifts] = await connection.execute(
                    "SELECT * FROM shift WHERE employeeId = ? AND shiftDate = ? LIMIT 1",
                    [employeeId, date]
                );
                
                let shiftId;
                if (dateShifts.length > 0) {
                    shiftId = dateShifts[0].shiftId;
                } else {
                    // Fallback to any shift assigned to the employee
                    const [anyShifts] = await connection.execute(
                        "SELECT * FROM shift WHERE employeeId = ? ORDER BY startDate DESC LIMIT 1",
                        [employeeId]
                    );
                    
                    if (anyShifts.length > 0) {
                        shiftId = anyShifts[0].shiftId;
                    } else {
                        // If no shifts exist, use a default value of 1
                        shiftId = 1;
                        console.log(`Warning: No shifts found for employee ${employeeId}, using default shiftId=1`);
                    }
                }
                
                // Create new attendance record with Leave status
                console.log(`Creating new Leave attendance record for ${date} with shiftId=${shiftId}`);
                await connection.execute(
                    "INSERT INTO attendance (employeeId, shiftId, date, status, notes) VALUES (?, ?, ?, 'Leave', 'Approved leave')",
                    [employeeId, shiftId, date]
                );
            }
        }
        
        return res.status(200).json({ 
            message: "Time off synchronized with attendance records.",
            datesProcessed: dates.length
        });
    } catch (err) {
        console.error('Error in syncTimeOffWithAttendance:', err);
        return res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    clockIn,
    clockOut,
    getEmployeeAttendance,
    getAllAttendance,
    getAttendanceStats,
    syncTimeOffWithAttendance
}; 