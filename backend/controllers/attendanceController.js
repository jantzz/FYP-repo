const db = require('../database/db');

/**
 * Function to extract shift start time from a shift object
 */
function extractShiftTime(shift) {
    // All shifts should have their own start time
    let startHour = null;
    let startMinute = null;
    
    // Parse the time from the shift title
    if (shift.title) {
        try {
            // Try to find a time pattern in the title
            let timeMatch = null;
            let isPM = false;
            
            // Check for 12-hour format with AM/PM
            const ampmPattern = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
            const ampmMatch = shift.title.match(ampmPattern);
            
            if (ampmMatch) {
                timeMatch = ampmMatch;
                isPM = ampmMatch[3].toUpperCase() === 'PM';
                console.log(`Found 12-hour format: ${timeMatch[1]}:${timeMatch[2]} ${isPM ? 'PM' : 'AM'}`);
            } else {
                // Try standard 24-hour format
                const timePattern = /(\d{1,2}):(\d{2})/;
                timeMatch = shift.title.match(timePattern);
                
                if (timeMatch) {
                    console.log(`Found 24-hour format: ${timeMatch[1]}:${timeMatch[2]}`);
                }
            }
            
            if (timeMatch) {
                startHour = parseInt(timeMatch[1], 10);
                startMinute = parseInt(timeMatch[2], 10);
                
                // Adjust for 12-hour format with PM
                if (isPM && startHour !== 12) {
                    startHour += 12; // Convert to 24-hour format (e.g., 1 PM → 13)
                }
                // Adjust for 12-hour format with AM and 12 AM (midnight)
                else if (!isPM && startHour === 12) {
                    startHour = 0; // 12 AM is actually 0 in 24-hour format
                }
            } else {
                console.error('No time pattern found in shift title:', shift.title);
                throw new Error('Could not determine shift start time');
            }
        } catch (error) {
            console.error('Error parsing shift time:', error);
            throw new Error('Could not determine shift start time');
        }
    } else {
        console.error('Shift has no title with time information:', shift);
        throw new Error('Shift missing time information');
    }
    
    if (startHour === null || startMinute === null) {
        console.error('Failed to extract time from shift:', shift);
        throw new Error('Could not determine shift start time');
    }
    
    return { startHour, startMinute };
}

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
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Check if it's actually the day of the shift
        if (today < shift.startDate || today > shift.endDate) {
            return res.status(400).json({ error: "Cannot clock in: today is not within the shift dates." });
        }

        // Check if already clocked in today
        const [existingAttendance] = await connection.execute(
            "SELECT * FROM attendance WHERE employeeId = ? AND shiftId = ? AND date = ?",
            [employeeId, shiftId, today]
        );
        
        // Determine attendance status and prepare notes
        const status = determineStatus(now, shift);
        let notes = null;
        
        // If late, add a note about how many minutes late
        if (status === 'Late') {
            try {
                // Get the shift start time using the helper function
                const { startHour, startMinute } = extractShiftTime(shift);
                
                // Set the expected start time
                const shiftStartDate = new Date(shift.startDate);
                const expectedStartTime = new Date(shiftStartDate);
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
                [employeeId, shiftId, today, now, status, notes]
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
        
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
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
                [employeeId, shiftId, today]
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
    const { startDate, endDate, department } = req.query;
    
    let connection;
    try {
        connection = await db.getConnection();
        
        let query = `
            SELECT a.*, s.startDate as shiftStartDate, s.endDate as shiftEndDate, s.title as shiftTitle, 
                   u.name as employeeName, u.department
            FROM attendance a
            LEFT JOIN shift s ON a.shiftId = s.shiftId
            JOIN user u ON a.employeeId = u.userId
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
        
        query += " ORDER BY a.date DESC, u.name ASC";
        
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
    // Parse the shift dates
    const shiftStartDate = new Date(shift.startDate);
    
    try {
        // Get shift start time using the helper function
        const { startHour, startMinute } = extractShiftTime(shift);
        
        // Set the expected start time
        const expectedStartTime = new Date(shiftStartDate);
        expectedStartTime.setHours(startHour, startMinute, 0, 0);
        
        console.log('Determining status:', {
            clockInTime: clockInTime.toISOString(),
            expectedStartTime: expectedStartTime.toISOString(),
            shift: shift.title,
            parsedTime: `${startHour}:${startMinute.toString().padStart(2, '0')}`
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
                    "SELECT * FROM shift WHERE employeeId = ? AND startDate <= ? AND endDate >= ? LIMIT 1",
                    [employeeId, date, date]
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