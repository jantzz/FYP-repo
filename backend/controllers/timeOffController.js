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

        if (existingShifts.length > 0) {
            // Format the conflict information for better readability
            const conflictDetails = existingShifts.map(shift => {
                return {
                    date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    title: shift.title || 'Assigned Shift',
                    status: shift.status
                };
            });
            
            return res.status(400).json({ 
                error: "Unable to request time off due to schedule conflicts",
                message: "You have existing shifts scheduled during this period. Please contact your manager to discuss alternative arrangements.",
                conflicts: conflictDetails,
                requestedPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString()
                }
            });
        }

        // Also check for pending shifts
        const [pendingShifts] = await connection.execute(
            `SELECT *, DATE_FORMAT(startDate, '%Y-%m-%d') as formattedStartDate, 
                     DATE_FORMAT(endDate, '%Y-%m-%d') as formattedEndDate 
             FROM pendingShift 
             WHERE employeeId = ? 
             AND ((startDate <= ? AND endDate >= ?) OR 
                  (startDate <= ? AND endDate >= ?) OR
                  (startDate >= ? AND endDate <= ?))`,
            [employeeId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        if (pendingShifts.length > 0) {
            // Format the conflict information for better readability
            const conflictDetails = pendingShifts.map(shift => {
                return {
                    date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                    title: shift.title || 'Pending Assignment',
                    status: 'Pending'
                };
            });
            
            return res.status(400).json({ 
                error: "Unable to request time off due to pending assignments",
                message: "You have pending shift assignments during this period. Please contact your manager to discuss your availability.",
                conflicts: conflictDetails,
                requestedPeriod: {
                    start: new Date(startDate).toLocaleDateString(),
                    end: new Date(endDate).toLocaleDateString()
                }
            });
        }

        const q = `INSERT INTO timeoff (employeeId, type, startDate, endDate, reason)
                   VALUES (?, ?, ?, ?, ?)`;
        const data = [employeeId, type, startDate, endDate, timeOffReason];

        const [result] = await connection.execute(q, data);

        return res.status(201).json({
            message: "Your time off request has been successfully submitted",
            requestId: result.insertId,
            requestDetails: {
                type,
                period: `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
                status: "Pending approval"
            }
        });

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
            `SELECT t.*, u.name as employeeName
             FROM timeoff t
             LEFT JOIN user u ON t.employeeId = u.userId
             WHERE t.timeOffId = ?`,
            [timeOffId]
        );

        if (!timeOff) {
            return res.status(404).json({ error: "Time off request not found" });
        }

        const { employeeId, startDate, endDate, type, employeeName } = timeOff;

        // If approving, check for existing shifts during the time-off period
        if (status === 'Approved') {
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
                        date: `${new Date(shift.startDate).toLocaleDateString()} to ${new Date(shift.endDate).toLocaleDateString()}`,
                        title: shift.title || `${type} Shift`,
                        status: shift.status
                    };
                });
            };

            const existingShiftConflicts = formatShiftConflicts(existingShifts, 'Existing');
            const pendingShiftConflicts = formatShiftConflicts(pendingShifts, 'Pending');

            // Combine both types of conflicts
            const hasConflicts = existingShifts.length > 0 || pendingShifts.length > 0;
            
            // If shifts exist, return them with a warning but don't block the approval
            if (hasConflicts) {
                // Update the status anyway
                const updateQuery = `UPDATE timeoff SET status = ?, approvedBy = ? WHERE timeOffId = ?`;
                await connection.execute(updateQuery, [status, approvedBy, timeOffId]);

                // Add the time off to shift table
                const shiftQuery = `INSERT INTO shift (employeeId, startDate, endDate, title, status)
                                    VALUES (?, ?, ?, ?, ?)`;
                const shiftData = [employeeId, startDate, endDate, `${type} Leave`, `${type} Leave`];
                await connection.execute(shiftQuery, shiftData);

                // Return success with detailed warning about existing shifts
                return res.status(200).json({ 
                    message: `Time off request for ${employeeName} has been approved`,
                    warning: {
                        title: "Schedule Conflicts Detected",
                        message: "This employee has existing or pending shifts during the approved time-off period. You may want to resolve these conflicts."
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
                    recommendations: [
                        "Consider rescheduling the conflicting shifts",
                        "Assign the shifts to another employee",
                        "Discuss with the employee about their availability"
                    ]
                });
            }
        }

        //updates the status and who approved 
        const updateQuery = `UPDATE timeoff SET status = ?, approvedBy = ? WHERE timeOffId = ?`;
        await connection.execute(updateQuery, [status, approvedBy, timeOffId]);

        if (status === 'Approved') {
            //adds the timeoff period into shift table
            const shiftQuery = `INSERT INTO shift (employeeId, startDate, endDate, title, status)
                                VALUES (?, ?, ?, ?, ?)`;
            const shiftData = [employeeId, startDate, endDate, `${type} Leave`, `${type} Leave`];

            await connection.execute(shiftQuery, shiftData);
            
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
            SELECT t.*, u.name as employeeName,
                   a.name as approverName
            FROM timeoff t
            LEFT JOIN user u ON t.employeeId = u.userId
            LEFT JOIN user a ON t.approvedBy = a.userId
            ORDER BY t.requestedAt DESC
        `;
        
        const [timeOffRequests] = await connection.execute(query);
        
        return res.status(200).json(timeOffRequests);
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
            SELECT t.*, u.name as employeeName,
                   a.name as approverName
            FROM timeoff t
            LEFT JOIN user u ON t.employeeId = u.userId
            LEFT JOIN user a ON t.approvedBy = a.userId
            WHERE t.employeeId = ?
            ORDER BY t.requestedAt DESC
        `;
        
        const [timeOffRequests] = await connection.execute(query, [employeeId]);
        
        return res.status(200).json(timeOffRequests);
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
            SELECT t.*, u.name as employeeName,
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
        
        return res.status(200).json(timeOffRequests[0]);
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

module.exports = {
    requestTimeOff,
    updateTimeOffStatus,
    getAllTimeOff,
    getEmployeeTimeOff,
    getTimeOffById,
    deleteTimeOff
};