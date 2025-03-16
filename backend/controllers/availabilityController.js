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

module.exports = {
    submitAvailability
};