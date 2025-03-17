const db = require('../database/db');
// TODO: other availability functions for User Story 8
//function to let an employee submit availability details
const submitAvailability = async (req, res) => {
    const { employeeId, startDate, endDate, preferredShift } = req.body;

    if (!employeeId || !startDate || !endDate || !preferredShift) {
        return res.status(400).json({ error: "All fields are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        const query = `
            INSERT INTO availability (employeeId, startDate, endDate, preferredShift) 
            VALUES (?, ?, ?, ?)
        `;

        await connection.execute(query, [employeeId, startDate, endDate, preferredShift]);
        connection.release();

        return res.status(201).json({ message: "Availability submitted successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//function for managers to approve/decline availabilities 
const updateAvailabilityStatus = async (req, res) => {
    const { availabilityId, managerId, status } = req.body;

    if (!availabilityId || !managerId || !status) {
        return res.status(400).json({ error: "All fields are required." });
    }

    if (!["Approved", "Declined"].includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        //checks if the user is a manager
        const [managers] = await connection.execute(
            "SELECT role FROM user WHERE userId = ?",
            [managerId]
        );

        if (managers.length === 0 || managers[0].role !== "Manager") {
            connection.release();
            return res.status(403).json({ error: "Only managers can approve or decline requests." });
        }

        //updates availability status 
        const query = `
            UPDATE availability 
            SET status = ?, approvedBy = ? 
            WHERE availabilityId = ?
        `;

        await connection.execute(query, [status, managerId, availabilityId]);
        connection.release();

        return res.status(200).json({ message: `Availability ${status.toLowerCase()} successfully.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    submitAvailability,
    updateAvailabilityStatus
};