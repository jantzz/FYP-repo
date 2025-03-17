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

// get availability for a specific employee
const getEmployeeAvailability = async (req, res) => {
    const { employeeId } = req.params;
    
    if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required." });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // query to get employee's availability records
        const query = `
            SELECT * FROM availability 
            WHERE employeeId = ? 
            ORDER BY startDate ASC
        `;
        
        const [availabilityRecords] = await connection.execute(query, [employeeId]);
        
        // calculate remaining hours
        const maxHoursPerWeek = 40; // Default maximum hours per week
        let usedHours = 0;
        
        // loop through each availability record to calculate hours used
        for (const record of availabilityRecords) {
            // calculate duration in hours for each availability slot
            const startDate = new Date(record.startDate);
            const endDate = new Date(record.endDate);
            const durationHours = (endDate - startDate) / (1000 * 60 * 60);
            
            // nnly count approved or pending records
            if (record.status !== 'Declined') {
                usedHours += durationHours;
            }
        }
        
        // calculate remaining hours (cap at 0 if negative)
        const remainingHours = Math.max(0, maxHoursPerWeek - usedHours);
        
        connection.release();
        
        // return the data with calculated remaining hours
        return res.status(200).json({
            remainingHours: remainingHours,
            availability: availabilityRecords
        });
    } catch (err) {
        console.error('Error fetching employee availability:', err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//function to retrieve all pending availability requests
const getPendingRequests = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        const query = `
            SELECT a.*, u.name AS employeeName 
            FROM availability a
            JOIN user u ON a.employeeId = u.userId
            WHERE a.status = 'Pending'
            ORDER BY a.submittedAt ASC
        `;

        const [pendingRequests] = await connection.execute(query);
        connection.release();

        return res.status(200).json(pendingRequests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    submitAvailability,
    updateAvailabilityStatus,
    getEmployeeAvailability,
    getPendingRequests
};