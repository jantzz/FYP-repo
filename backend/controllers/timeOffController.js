const db = require('../database/db');

//function to request for time off
const requestTimeOff = async (req, res) => {
    const { employeeId, type, startDate, endDate, reason } = req.body;

    if (!employeeId || !type || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const timeOffReason = reason ? reason : "";

    let connection;
    try {
        connection = await db.getConnection();

        // Check if employee has existing shifts during the requested period
        const [existingShifts] = await connection.execute(
            `SELECT *, DATE_FORMAT(startDate, '%Y-%m-%d') as formattedStartDate, 
                     DATE_FORMAT(endDate, '%Y-%m-%d') as formattedEndDate 
             FROM shift 
             WHERE employeeId = ? 
             AND ((startDate <= ? AND endDate >= ?) OR 
                  (startDate <= ? AND endDate >= ?) OR
                  (startDate >= ? AND endDate <= ?))`,
            [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        // Check for pending shifts
        const [pendingShifts] = await connection.execute(
            `SELECT ps.*, u.name as employeeName,
                     DATE_FORMAT(ps.startDate, '%Y-%m-%d') as formattedStartDate, 
                     DATE_FORMAT(ps.endDate, '%Y-%m-%d') as formattedEndDate
             FROM pendingShift ps
             JOIN user u ON ps.employeeId = u.userId
             WHERE ps.employeeId = ? 
             AND ((ps.startDate <= ? AND ps.endDate >= ?) OR 
                  (ps.startDate <= ? AND ps.endDate >= ?) OR
                  (ps.startDate >= ? AND ps.endDate <= ?))`,
            [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        // Format conflicts for notification purposes
        let hasConflicts = existingShifts.length > 0 || pendingShifts.length > 0;
        let conflictDetails = [];
        
        if (existingShifts.length > 0) {
            existingShifts.forEach(shift => {
                conflictDetails.push({
                    date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    title: shift.title || 'Assigned Shift',
                    status: shift.status
            });
            });
        }

        if (pendingShifts.length > 0) {
            pendingShifts.forEach(shift => {
                conflictDetails.push({
                    date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    title: shift.title || 'Pending Assignment',
                    status: 'Pending'
            });
            });
        }

        const q = `INSERT INTO timeoff (employeeId, type, startDate, endDate, reason)
                   VALUES (?, ?, ?, ?, ?)`;
        const data = [employeeId, type, startDate, endDate, timeOffReason];

        const [result] = await connection.execute(q, data);

        let response = {
            message: "Your time off request has been successfully submitted",
            requestId: result.insertId,
            requestDetails: {
                type,
                period: `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
                status: "Pending approval"
            }
        };

        // Add conflict information if there are any
        if (hasConflicts) {
            response.note = "Your request has been submitted, but you have scheduled shifts during this period. Your manager will be notified about these conflicts.";
            response.conflicts = conflictDetails;
        }

        return res.status(201).json(response);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};


//function to approve or decline time off request
const updateTimeOffStatus = async (req, res) => {
    const { timeOffId } = req.params;
    const { status, approvedBy } = req.body;

    if (!timeOffId || !status || !approvedBy) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Get time off details first
        const [[timeOff]] = await connection.execute(
            `SELECT t.*, u.name as employeeName, u.department
             FROM timeoff t
             LEFT JOIN user u ON t.employeeId = u.userId
             WHERE t.timeOffId = ?`,
            [timeOffId]
        );

        if (!timeOff) {
            return res.status(404).json({ error: "Time off request not found" });
        }

        const { employeeId, startDate, endDate, type, employeeName, department } = timeOff;

            // Check for existing shifts
            const [existingShifts] = await connection.execute(
                `SELECT s.*, u.name as employeeName,
                         DATE_FORMAT(s.startDate, '%Y-%m-%d') as formattedStartDate, 
                         DATE_FORMAT(s.endDate, '%Y-%m-%d') as formattedEndDate
                 FROM shift s
                 JOIN user u ON s.employeeId = u.userId
                 WHERE s.employeeId = ? 
                 AND ((s.startDate <= ? AND s.endDate >= ?) OR 
                      (s.startDate <= ? AND s.endDate >= ?) OR
                      (s.startDate >= ? AND s.endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );

            // Check for pending shifts
            const [pendingShifts] = await connection.execute(
                `SELECT ps.*, u.name as employeeName,
                         DATE_FORMAT(ps.startDate, '%Y-%m-%d') as formattedStartDate, 
                         DATE_FORMAT(ps.endDate, '%Y-%m-%d') as formattedEndDate
                 FROM pendingShift ps
                 JOIN user u ON ps.employeeId = u.userId
                 WHERE ps.employeeId = ? 
                 AND ((ps.startDate <= ? AND ps.endDate >= ?) OR 
                      (ps.startDate <= ? AND ps.endDate >= ?) OR
                      (ps.startDate >= ? AND ps.endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );

            // Format conflicts for better readability
            const formatShiftConflicts = (shifts, type) => {
                return shifts.map(shift => {
                    return {
                    id: type === 'Existing' ? shift.shiftId : shift.pendingShiftId,
                        date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                        title: shift.title || `${type} Shift`,
                    status: shift.status,
                    shiftType: type
                    };
                });
            };

            const existingShiftConflicts = formatShiftConflicts(existingShifts, 'Existing');
            const pendingShiftConflicts = formatShiftConflicts(pendingShifts, 'Pending');

            // Combine both types of conflicts
            const hasConflicts = existingShifts.length > 0 || pendingShifts.length > 0;
            
        // Find available staff for each shift if there are conflicts
        let availableStaffSuggestions = [];
        
            if (hasConflicts) {
            // Get all shift dates to check availability
            const allConflictingShifts = [...existingShifts, ...pendingShifts];
            
            for (const shift of allConflictingShifts) {
                // Find available staff for this shift period
                const [availableStaff] = await connection.execute(
                    `SELECT u.userId, u.name, u.department, u.role
                     FROM user u
                     WHERE u.userId != ? 
                     AND u.department = ?
                     AND NOT EXISTS (
                         SELECT 1 FROM shift s
                         WHERE s.employeeId = u.userId
                         AND ((s.startDate <= ? AND s.endDate >= ?) OR 
                              (s.startDate <= ? AND s.endDate >= ?) OR
                              (s.startDate >= ? AND s.endDate <= ?))
                     )
                     AND NOT EXISTS (
                         SELECT 1 FROM pendingShift ps
                         WHERE ps.employeeId = u.userId
                         AND ((ps.startDate <= ? AND ps.endDate >= ?) OR 
                              (ps.startDate <= ? AND ps.endDate >= ?) OR
                              (ps.startDate >= ? AND ps.endDate <= ?))
                     )
                     AND NOT EXISTS (
                         SELECT 1 FROM timeoff t
                         WHERE t.employeeId = u.userId
                         AND t.status = 'Approved'
                         AND ((t.startDate <= ? AND t.endDate >= ?) OR 
                              (t.startDate <= ? AND t.endDate >= ?) OR
                              (t.startDate >= ? AND t.endDate <= ?))
                     )`,
                    [
                        employeeId, department,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate
                    ]
                );
                
                const shiftId = shift.shiftId || shift.pendingShiftId;
                const shiftType = shift.shiftId ? 'Existing' : 'Pending';
                
                availableStaffSuggestions.push({
                    shiftId,
                    shiftType,
                    shiftPeriod: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    availableStaff: availableStaff.map(staff => ({
                        id: staff.userId,
                        name: staff.name,
                        department: staff.department,
                        role: staff.role
                    }))
                });
            }
        }

        //updates the status and who approved 
        const updateQuery = `UPDATE timeoff SET status = ?, approvedBy = ? WHERE timeOffId = ?`;
        await connection.execute(updateQuery, [status, approvedBy, timeOffId]);

        if (status === 'Approved') {
            //checks leave balance first
            const [[leaveBalance]] = await connection.execute(
            `SELECT ${type} FROM leave_balance WHERE employeeId = ?`,
            [employeeId]
        );

        //calculate number of days between start and end dates (inclusive)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const timeDiff = Math.abs(end.getTime() - start.getTime());
        const numberOfDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

        if (leaveBalance[type] < numberOfDays) {
            return res.status(400).json({
                error: `Insufficient ${type.toLowerCase()} leave balance. Only ${leaveBalance[type]} day(s) available.`,
                requestedDays: numberOfDays
            });
        }

        //deduct leave days from balance
        await connection.execute(
            `UPDATE leave_balance
             SET ${type} = GREATEST(${type} - ?, 0)
             WHERE employeeId = ?`,
            [numberOfDays, employeeId]
        );

            //adds the timeoff period into shift table
            const shiftQuery = `INSERT INTO shift (employeeId, startDate, endDate, title, status)
                                VALUES (?, ?, ?, ?, ?)`;
            const shiftData = [employeeId, startDate, endDate, `${type} Leave`, `${type} Leave`];

            await connection.execute(shiftQuery, shiftData);
            
            // If shifts exist, return them with a warning but don't block the approval
            if (hasConflicts) {
                return res.status(200).json({ 
                    message: `Time off request for ${employeeName} has been approved`,
                    warning: {
                        title: "Schedule Conflicts Detected",
                        message: "This employee has existing or pending shifts during the approved time-off period."
                    },
                    timeOffPeriod: {
                        start: new Date(startDate).toLocaleDateString(),
                        end: new Date(endDate).toLocaleDateString(),
                        type
                    },
                    conflicts: {
                        existing: existingShiftConflicts,
                        pending: pendingShiftConflicts
                    },
                    availableStaffSuggestions,
                    recommendations: [
                        "Reassign the shifts to one of the suggested available staff members",
                        "Consider canceling or rescheduling the conflicting shifts",
                        "If no available staff, consider creating an open shift for others to claim"
                    ]
                });
            }
            
            return res.status(200).json({ 
                message: `Time off request for ${employeeName || 'employee'} has been approved`,
                timeOffPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString(),
                    type
                }
            });
        } else {
            return res.status(200).json({ 
                message: `Time off request for ${employeeName || 'employee'} has been ${status.toLowerCase()}`,
                timeOffPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString(),
                    type
                }
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Get all time off requests (for admins/managers)
const getAllTimeOff = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        const query = `
            SELECT t.*, u.name as employeeName, u.department,
                   a.name as approverName
            FROM timeoff t
            LEFT JOIN user u ON t.employeeId = u.userId
            LEFT JOIN user a ON t.approvedBy = a.userId
            ORDER BY t.requestedAt DESC
        `;
        
        const [timeOffRequests] = await connection.execute(query);
        
        // Check for shift conflicts for each time off request
        const enrichedRequests = await Promise.all(timeOffRequests.map(async (request) => {
            const { employeeId, startDate, endDate } = request;
            
            // Check for existing shifts
            const [existingShifts] = await connection.execute(
                `SELECT COUNT(*) as count
                 FROM shift
                 WHERE employeeId = ? 
                 AND ((startDate <= ? AND endDate >= ?) OR 
                      (startDate <= ? AND endDate >= ?) OR
                      (startDate >= ? AND endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );
            
            // Check for pending shifts
            const [pendingShifts] = await connection.execute(
                `SELECT COUNT(*) as count
                 FROM pendingShift
                 WHERE employeeId = ? 
                 AND ((startDate <= ? AND endDate >= ?) OR 
                      (startDate <= ? AND endDate >= ?) OR
                      (startDate >= ? AND endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );
            
            const hasConflicts = existingShifts[0].count > 0 || pendingShifts[0].count > 0;
            
            return {
                ...request,
                hasScheduleConflicts: hasConflicts,
                timeOffPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString()
                }
            };
        }));
        
        return res.status(200).json(enrichedRequests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Get time off requests for a specific employee
const getEmployeeTimeOff = async (req, res) => {
    const { employeeId } = req.params;
    
    if (!employeeId) {
        return res.status(400).json({ error: "Missing employee ID" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        const query = `
            SELECT t.*, u.name as employeeName, u.department,
                   a.name as approverName
            FROM timeoff t
            LEFT JOIN user u ON t.employeeId = u.userId
            LEFT JOIN user a ON t.approvedBy = a.userId
            WHERE t.employeeId = ?
            ORDER BY t.requestedAt DESC
        `;
        
        const [timeOffRequests] = await connection.execute(query, [employeeId]);
        
        // Check for shift conflicts for each time off request
        const enrichedRequests = await Promise.all(timeOffRequests.map(async (request) => {
            const { startDate, endDate } = request;
            
            // Check for existing shifts
            const [existingShifts] = await connection.execute(
                `SELECT COUNT(*) as count
                 FROM shift
                 WHERE employeeId = ? 
                 AND ((startDate <= ? AND endDate >= ?) OR 
                      (startDate <= ? AND endDate >= ?) OR
                      (startDate >= ? AND endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );
            
            // Check for pending shifts
            const [pendingShifts] = await connection.execute(
                `SELECT COUNT(*) as count
                 FROM pendingShift
                 WHERE employeeId = ? 
                 AND ((startDate <= ? AND endDate >= ?) OR 
                      (startDate <= ? AND endDate >= ?) OR
                      (startDate >= ? AND endDate <= ?))`,
                [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
            );
            
            const hasConflicts = existingShifts[0].count > 0 || pendingShifts[0].count > 0;
            
            return {
                ...request,
                hasScheduleConflicts: hasConflicts,
                timeOffPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString()
                }
            };
        }));
        
        return res.status(200).json(enrichedRequests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Get a specific time off request by ID
const getTimeOffById = async (req, res) => {
    const { timeOffId } = req.params;
    
    if (!timeOffId) {
        return res.status(400).json({ error: "Missing time off ID" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        const query = `
            SELECT t.*, u.name as employeeName, u.department,
                   a.name as approverName
            FROM timeoff t
            LEFT JOIN user u ON t.employeeId = u.userId
            LEFT JOIN user a ON t.approvedBy = a.userId
            WHERE t.timeOffId = ?
        `;
        
        const [timeOffRequests] = await connection.execute(query, [timeOffId]);
        
        if (timeOffRequests.length === 0) {
            return res.status(404).json({ error: "Time off request not found" });
        }
        
        const timeOff = timeOffRequests[0];
        const { employeeId, startDate, endDate, department } = timeOff;
        
        // Check for existing shifts during the time off period
        const [existingShifts] = await connection.execute(
            `SELECT s.*, u.name as employeeName,
                     DATE_FORMAT(s.startDate, '%Y-%m-%d') as formattedStartDate, 
                     DATE_FORMAT(s.endDate, '%Y-%m-%d') as formattedEndDate
             FROM shift s
             JOIN user u ON s.employeeId = u.userId
             WHERE s.employeeId = ? 
             AND ((s.startDate <= ? AND s.endDate >= ?) OR 
                  (s.startDate <= ? AND s.endDate >= ?) OR
                  (s.startDate >= ? AND s.endDate <= ?))`,
            [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        // Check for pending shifts
        const [pendingShifts] = await connection.execute(
            `SELECT ps.*, u.name as employeeName,
                     DATE_FORMAT(ps.startDate, '%Y-%m-%d') as formattedStartDate, 
                     DATE_FORMAT(ps.endDate, '%Y-%m-%d') as formattedEndDate
             FROM pendingShift ps
             JOIN user u ON ps.employeeId = u.userId
             WHERE ps.employeeId = ? 
             AND ((ps.startDate <= ? AND ps.endDate >= ?) OR 
                  (ps.startDate <= ? AND ps.endDate >= ?) OR
                  (ps.startDate >= ? AND ps.endDate <= ?))`,
            [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        // Format conflicts for better readability
        const formatShiftConflicts = (shifts, type) => {
            return shifts.map(shift => {
                return {
                    id: type === 'Existing' ? shift.shiftId : shift.pendingShiftId,
                    date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    title: shift.title || `${type} Shift`,
                    status: shift.status,
                    shiftType: type
                };
            });
        };

        const existingShiftConflicts = formatShiftConflicts(existingShifts, 'Existing');
        const pendingShiftConflicts = formatShiftConflicts(pendingShifts, 'Pending');

        // Combine both types of conflicts
        const hasConflicts = existingShifts.length > 0 || pendingShifts.length > 0;
        
        // Find available staff for each shift if there are conflicts
        let availableStaffSuggestions = [];
        
        if (hasConflicts) {
            // Get all shift dates to check availability
            const allConflictingShifts = [...existingShifts, ...pendingShifts];
            
            for (const shift of allConflictingShifts) {
                // Find available staff for this shift period
                const [availableStaff] = await connection.execute(
                    `SELECT u.userId, u.name, u.department, u.role
                     FROM user u
                     WHERE u.userId != ? 
                     AND u.department = ?
                     AND NOT EXISTS (
                         SELECT 1 FROM shift s
                         WHERE s.employeeId = u.userId
                         AND ((s.startDate <= ? AND s.endDate >= ?) OR 
                              (s.startDate <= ? AND s.endDate >= ?) OR
                              (s.startDate >= ? AND s.endDate <= ?))
                     )
                     AND NOT EXISTS (
                         SELECT 1 FROM pendingShift ps
                         WHERE ps.employeeId = u.userId
                         AND ((ps.startDate <= ? AND ps.endDate >= ?) OR 
                              (ps.startDate <= ? AND ps.endDate >= ?) OR
                              (ps.startDate >= ? AND ps.endDate <= ?))
                     )
                     AND NOT EXISTS (
                         SELECT 1 FROM timeoff t
                         WHERE t.employeeId = u.userId
                         AND t.status = 'Approved'
                         AND ((t.startDate <= ? AND t.endDate >= ?) OR 
                              (t.startDate <= ? AND t.endDate >= ?) OR
                              (t.startDate >= ? AND t.endDate <= ?))
                     )`,
                    [
                        employeeId, department,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate,
                        shift.startDate, shift.startDate,
                        shift.endDate, shift.endDate,
                        shift.startDate, shift.endDate
                    ]
                );
                
                const shiftId = shift.shiftId || shift.pendingShiftId;
                const shiftType = shift.shiftId ? 'Existing' : 'Pending';
                
                availableStaffSuggestions.push({
                    shiftId,
                    shiftType,
                    shiftPeriod: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    availableStaff: availableStaff.map(staff => ({
                        id: staff.userId,
                        name: staff.name,
                        department: staff.department,
                        role: staff.role
                    }))
                });
            }
        }
        
        // Add conflict information to the response if conflicts exist
        const response = {
            ...timeOff,
            timeOffPeriod: {
                start: new Date(startDate).toLocaleDateString(),
                end: new Date(endDate).toLocaleDateString()
            }
        };
        
        if (hasConflicts) {
            response.hasScheduleConflicts = true;
            response.conflicts = {
                existing: existingShiftConflicts,
                pending: pendingShiftConflicts
            };
            response.availableStaffSuggestions = availableStaffSuggestions;
            response.recommendations = [
                "Reassign the shifts to one of the suggested available staff members",
                "Consider canceling or rescheduling the conflicting shifts",
                "If no available staff, consider creating an open shift for others to claim"
            ];
        }
        
        return res.status(200).json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Delete a time off request
const deleteTimeOff = async (req, res) => {
    const { timeOffId } = req.params;
    
    if (!timeOffId) {
        return res.status(400).json({ error: "Missing time off ID" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if the request exists
        const [existingRequest] = await connection.execute(
            "SELECT * FROM timeoff WHERE timeOffId = ?",
            [timeOffId]
        );
        
        if (existingRequest.length === 0) {
            return res.status(404).json({ error: "Time off request not found" });
        }
        
        // Only allow deletion if the request is pending
        if (existingRequest[0].status !== 'Pending') {
            return res.status(400).json({ 
                error: "Cannot delete a time off request that has already been approved or declined" 
            });
        }
        
        // Delete the request
        await connection.execute(
            "DELETE FROM timeoff WHERE timeOffId = ?",
            [timeOffId]
        );
        
        return res.status(200).json({ message: "Time off request deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

const getLeaveBalances = async (req, res) => {
    const { employeeId } = req.query;

    let connection;
    try {
        connection = await db.getConnection();

        let query = `
            SELECT 
                lb.employeeId,
                u.name AS employeeName,
                u.department,
                lb.Paid,
                lb.Unpaid,
                lb.Medical
            FROM leave_balance lb
            JOIN user u ON lb.employeeId = u.userId
        `;
        const params = [];

        if (employeeId) {
            query += ` WHERE lb.employeeId = ?`;
            params.push(employeeId);
        }

        const [results] = await connection.execute(query, params);

        if (results.length === 0) {
            return res.status(404).json({ error: "No leave balance data found" });
        }

        res.status(200).json({
            message: employeeId
                ? `Leave balance for employee ID ${employeeId}`
                : "Leave balances for all employees",
            count: results.length,
            data: results
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    requestTimeOff,
    updateTimeOffStatus,
    getAllTimeOff,
    getEmployeeTimeOff,
    getTimeOffById,
    deleteTimeOff,
    getLeaveBalances
};