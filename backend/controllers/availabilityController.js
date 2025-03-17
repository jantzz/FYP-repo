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
    console.log('Updating availability status:', { availabilityId, managerId, status });

    if (!availabilityId || !managerId || !status) {
        console.error('Missing required fields:', { availabilityId, managerId, status });
        return res.status(400).json({ error: "All fields are required." });
    }

    if (!["Approved", "Declined"].includes(status)) {
        console.error('Invalid status:', status);
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
        console.log('Found manager:', managers[0]);

        if (managers.length === 0 || !['Manager', 'Admin'].includes(managers[0].role)) {
            console.error('User is not authorized:', managers[0]?.role);
            connection.release();
            return res.status(403).json({ error: "Only managers and admins can approve or decline requests." });
        }

        // First check if the availability request exists
        const [availabilityCheck] = await connection.execute(
            "SELECT * FROM availability WHERE id = ?",
            [availabilityId]
        );
        console.log('Found availability:', availabilityCheck[0]);

        if (availabilityCheck.length === 0) {
            console.error('Availability request not found:', availabilityId);
            connection.release();
            return res.status(404).json({ error: "Availability request not found." });
        }

        //updates availability status only
        const query = `
            UPDATE availability 
            SET status = ?
            WHERE id = ?
        `;

        console.log('Executing update query:', query, [status, availabilityId]);
        await connection.execute(query, [status, availabilityId]);

        return res.status(200).json({ 
            message: `Availability ${status.toLowerCase()} successfully.`,
            updatedBy: managerId
        });
    } catch (err) {
        console.error('Error in updateAvailabilityStatus:', err);
        res.status(500).json({ error: "Internal Server Error: " + err.message });
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
        
        console.log(`Found ${availabilityRecords.length} availability records for employee ${employeeId}`);
        
        // calculate remaining hours
        const maxHoursPerWeek = 40; // Default maximum hours per week
        let usedHours = 0;
        
        // loop through each availability record to calculate hours used
        for (const record of availabilityRecords) {
            try {
                // calculate duration in hours for each availability slot
                const startDate = new Date(record.startDate);
                const endDate = new Date(record.endDate);
                
                // Validate dates before calculation
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.error('Invalid date found in record:', record);
                    continue; // Skip this record
                }
                
                // Ensure end date is after start date
                if (endDate <= startDate) {
                    console.error('End date is not after start date:', record);
                    continue; // Skip this record
                }
                
                const durationHours = (endDate - startDate) / (1000 * 60 * 60);
                
                // Validate the duration - ignore unreasonable values (more than 24 hours)
                if (durationHours <= 0 || durationHours > 24) {
                    console.error('Invalid duration calculated:', { 
                        record, 
                        startDate, 
                        endDate, 
                        durationHours 
                    });
                    continue; // Skip this record
                }
                
                // Only count approved or pending records
                if (record.status !== 'Declined') {
                    console.log(`Adding ${durationHours.toFixed(2)} hours for record:`, {
                        id: record.id,
                        status: record.status,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    });
                    usedHours += durationHours;
                }
            } catch (err) {
                console.error('Error processing availability record:', err, record);
                // Continue with next record
            }
        }
        
        console.log(`Total used hours calculated: ${usedHours.toFixed(2)}`);
        
        // calculate remaining hours (cap at 0 if negative)
        const remainingHours = Math.max(0, maxHoursPerWeek - usedHours);
        
        console.log(`Returning remainingHours: ${remainingHours.toFixed(2)}`);
        
        connection.release();
        
        // Return the data with calculated remaining hours
        return res.status(200).json({
            remainingHours: parseFloat(remainingHours.toFixed(2)),
            availability: availabilityRecords.map(record => ({
                ...record,
                startDate: record.startDate instanceof Date ? record.startDate.toISOString() : record.startDate,
                endDate: record.endDate instanceof Date ? record.endDate.toISOString() : record.endDate
            }))
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
        console.log('Starting getPendingRequests...');
        connection = await db.getConnection();

        // Get filter parameters
        const { days, department } = req.query;
        console.log('Filter params:', { days, department });
        
        // Base query
        let query = `
            SELECT a.*, u.name AS employeeName, u.department 
            FROM availability a
            JOIN user u ON a.employeeId = u.userId
            WHERE a.status = 'Pending'
        `;

        const params = [];

        // Add date filter if days parameter is provided
        if (days && days !== 'all') {
            query += ` AND a.startDate <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`;
            params.push(days);
        }

        // Add department filter if provided
        if (department) {
            query += ` AND u.department = ?`;
            params.push(department);
        }

        // Order by start date
        query += ` ORDER BY a.startDate ASC`;

        console.log('Executing query:', query);
        console.log('With params:', params);

        const [pendingRequests] = await connection.execute(query, params);
        console.log('Raw pending requests:', pendingRequests);
        
        // Format dates for frontend
        const formattedRequests = pendingRequests.map(request => ({
            ...request,
            startDate: request.startDate.toISOString(),
            endDate: request.endDate.toISOString()
        }));

        console.log('Formatted requests:', formattedRequests);
        return res.status(200).json(formattedRequests);
    } catch (err) {
        console.error('Error in getPendingRequests:', err);
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