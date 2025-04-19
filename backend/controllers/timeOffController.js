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

        const q = `INSERT INTO timeoff (employeeId, type, startDate, endDate, reason)
                   VALUES (?, ?, ?, ?, ?)`;
        const data = [employeeId, type, startDate, endDate, timeOffReason];

        const [result] = await connection.execute(q, data);

        return res.status(201).json({
            message: "Time off request submitted",
            requestId: result.insertId
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

        //updates the status and who approved 
        const updateQuery = `UPDATE timeoff SET status = ?, approvedBy = ? WHERE timeOffId = ?`;
        await connection.execute(updateQuery, [status, approvedBy, timeOffId]);

        if (status === 'Approved') {
            //gets time off details
            const [[timeOff]] = await connection.execute(
                `SELECT employeeId, startDate, endDate, type FROM timeoff WHERE timeOffId = ?`,
                [timeOffId]
            );

            const { employeeId, startDate, endDate, type } = timeOff;
            //adds the timeoff period into shift tabke
            const shiftQuery = `INSERT INTO shift (employeeId, startDate, endDate, title, status)
                                VALUES (?, ?, ?, ?, ?)`;
            const shiftData = [employeeId, startDate, endDate, `${type} Leave`, `${type} Leave`];

            await connection.execute(shiftQuery, shiftData);
        }

        return res.status(200).json({ message: `Time off request ${status.toLowerCase()}` });

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