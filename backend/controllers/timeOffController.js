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

module.exports = {
    requestTimeOff,
    updateTimeOffStatus
};
