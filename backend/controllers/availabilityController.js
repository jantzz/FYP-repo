const db = require('../database/db');
// TODO: other availability functions for User Story 8
//function to let an employee submit availability details
const submitAvailability = async (req, res) => {
    const { employeeId, preferredDates, hours } = req.body;

    if (!employeeId || !preferredDates || !hours) {
        return res.status(400).json({ error: "Employee ID, preferred dates, and hours are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Validate hours
        const requestedHours = parseFloat(hours);
        if (isNaN(requestedHours) || requestedHours <= 0) {
            return res.status(400).json({ error: "Hours must be a positive number." });
        }

        // Get current week's dates
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        weekEnd.setHours(23, 59, 59, 999);

        // Get current used hours for this week
        const [currentHours] = await connection.execute(
            `SELECT 
                COALESCE(SUM(hours), 0) as usedHours
            FROM availability 
            WHERE employeeId = ? 
            AND status != 'Declined'
            AND submittedAt BETWEEN ? AND ?`,
            [
                employeeId, 
                weekStart.toISOString().split('T')[0], 
                weekEnd.toISOString().split('T')[0]
            ]
        );

        const usedHours = parseFloat(currentHours[0].usedHours);
        const maxHoursPerWeek = 40;
        const remainingHours = Math.max(0, maxHoursPerWeek - usedHours);

        // Check if employee has enough remaining hours for this week
        if (requestedHours > remainingHours) {
            return res.status(400).json({ 
                error: "Not enough remaining hours for this week",
                requestedHours: parseFloat(requestedHours.toFixed(2)),
                remainingHours: parseFloat(remainingHours.toFixed(2)),
                weekInfo: {
                    weekStart: weekStart.toISOString().split('T')[0],
                    weekEnd: weekEnd.toISOString().split('T')[0]
                }
            });
        }

        // Insert availability record - automatically set to Approved (no manager approval needed)
        const query = `
            INSERT INTO availability (employeeId, preferredDates, hours, status) 
            VALUES (?, ?, ?, 'Approved')
        `;

        await connection.execute(query, [
            employeeId, 
            preferredDates,
            requestedHours
        ]);

        // Create a pending shift that requires manager approval
        const daysString = preferredDates || 'No specific days';
        
        // Get current date for the start date and add hours to end date
        const start = new Date(now);
        const end = new Date(now);
        end.setHours(end.getHours() + Math.floor(requestedHours));
        
        // Format dates for MySQL
        const formattedStartDate = start.toISOString().slice(0, 19).replace('T', ' ');
        const formattedEndDate = end.toISOString().slice(0, 19).replace('T', ' ');

        // Insert into pendingShift table
        const shiftQuery = `
            INSERT INTO pendingShift (employeeId, startDate, endDate, title, status)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await connection.execute(shiftQuery, [
            employeeId,
            formattedStartDate,
            formattedEndDate,
            `Availability for ${daysString}`,
            "Pending"
        ]);
        
        console.log('Created pending shift with data:', {
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            employeeId,
            daysString
        });

        // Calculate new remaining hours
        const newRemainingHours = remainingHours - requestedHours;

        // Send notification about pending shift if socket.io is available
        const io = req.app.get('io');
        if (io && employeeId) {
            io.to(`user_${employeeId}`).emit('pending_shift_created', {
                message: `Your availability has been submitted and a shift is pending manager approval.`,
                type: 'shift',
                shiftDetails: {
                    start: formattedStartDate,
                    end: formattedEndDate,
                    title: `Availability for ${daysString}`,
                }       
            });
        }

        return res.status(201).json({ 
            message: "Availability submitted successfully and pending shift created.",
            requestedHours: parseFloat(requestedHours.toFixed(2)),
            remainingHours: parseFloat(newRemainingHours.toFixed(2))
        });
    } catch (err) {
        console.error('Error submitting availability:', err);
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

    if (!["Pending", "Approved", "Declined"].includes(status)) {
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

        // First, check if the availability request exists
        const [availabilityCheck] = await connection.execute(
            "SELECT * FROM availability WHERE availabilityId = ?",
            [availabilityId]
        );
        console.log('Found availability:', availabilityCheck[0]);

        if (availabilityCheck.length === 0) {
            console.error('Availability request not found:', availabilityId);
            connection.release();
            return res.status(404).json({ error: "Availability request not found." });
        }

        const { employeeId, preferredDates, hours } = availabilityCheck[0];
        
        //if the availability is approved, adds it to shift table
        if (status === "Approved") {
            // For shift table, we need to create a generic entry using the preferredDates
            // This is a simplified version where we just store the days in the title
            const daysString = preferredDates || 'No specific days';
            
            // Get current date for the start date
            const now = new Date();
            const start = new Date(now);
            const end = new Date(now);
            end.setHours(end.getHours() + Math.floor(hours));
            
            // Format dates for MySQL
            const formattedStartDate = start.toISOString().slice(0, 19).replace('T', ' ');
            const formattedEndDate = end.toISOString().slice(0, 19).replace('T', ' ');

            // Insert into shift table with available information
            const shiftQuery = `
                INSERT INTO shift (employeeId, startDate, endDate, title, status)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.execute(shiftQuery, [
                employeeId,
                formattedStartDate,
                formattedEndDate,
                `Availability for ${daysString}`,
                "Scheduled"
            ]);
            
            console.log('Created shift with data:', {
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                employeeId,
                daysString
            });

            //send socket notification for new shift
            const io = req.app.get('io');
            if (io && employeeId) {
                io.to(`user_${employeeId}`).emit('shift_added', {
                    message: `You have a new shift approved for days: ${daysString}.`,
                    type: 'shift',
                    shiftDetails: {
                        start: formattedStartDate,
                        end: formattedEndDate,
                        title: `Availability for ${daysString}`,
                    }       
                });
            }
        }

        //updates availability status
        const query = `
            UPDATE availability 
            SET status = ?, approvedBy = ?
            WHERE availabilityId = ?
        `;
        await connection.execute(query, [status, managerId, availabilityId]);

        //get the employee's name 
        const employeeQuery = "SELECT name FROM user WHERE userId = ?";
        const [employee] = await connection.execute(employeeQuery, [employeeId]);

        //if no employee found, handle the error
       if (employee.length === 0) {
           return res.status(404).json({ error: "Employee not found." });
       }

        const employeeName = employee[0].name;
        
        // Create notification based on the new schema
        const availabilityMessage = `${employeeName}, your availability request for ${preferredDates || 'your preferred days'} has been ${status.toLowerCase()}.`;
        
        //insert the notification into the database
        const insertNotificationQuery = "INSERT INTO notifications (userId, message) VALUES (?, ?)";
        try {
            const [result] = await connection.execute(insertNotificationQuery, [employeeId, availabilityMessage]);
            console.log('Notification inserted:', result);
        } catch (err) {
            console.error('Error inserting notification:', err);
        }

        //send via socket.io (if available)
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${employeeId}`).emit("availability_updated", {
                message: availabilityMessage,
                status,
                preferredDates
            });
        }

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
    console.log('Getting availability for employee:', req.params.id);
    const employeeId = req.params.id;
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // query to get employee's availability records (all records, no status filtering)
        const query = `
            SELECT * FROM availability 
            WHERE employeeId = ? 
            ORDER BY submittedAt DESC
        `;
        
        const [availabilityRecords] = await connection.execute(query, [employeeId]);
        
        console.log(`Found ${availabilityRecords.length} availability records for employee ${employeeId}`);
        
        // Get the current week's start and end dates
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // End of week (Saturday)
        currentWeekEnd.setHours(23, 59, 59, 999);

        console.log('Calculating hours for week:', {
            weekStart: currentWeekStart.toISOString(),
            weekEnd: currentWeekEnd.toISOString()
        });

        // calculate remaining hours
        const maxHoursPerWeek = 40; // Maximum hours per week
        let usedHours = 0;
        
        // Only count approved or pending records
        availabilityRecords.forEach(record => {
            // If the record is from the current week and the status is not 'Declined'
            if (
                new Date(record.submittedAt) >= currentWeekStart && 
                new Date(record.submittedAt) <= currentWeekEnd && 
                record.status !== 'Declined'
            ) {
                usedHours += parseFloat(record.hours || 0);
            }
        });
        
        // Calculate remaining hours
        const remainingHours = Math.max(0, maxHoursPerWeek - usedHours);
        
        // Week info for display
        const weekInfo = {
            weekStart: currentWeekStart.toISOString().split('T')[0],
            weekEnd: currentWeekEnd.toISOString().split('T')[0],
            currentDate: new Date().toISOString().split('T')[0]
        };
        
        // Return the data with calculated remaining hours and week info
        return res.status(200).json({
            remainingHours: parseFloat(remainingHours.toFixed(2)),
            weekInfo: weekInfo,
            usedHours: parseFloat(usedHours.toFixed(2)),
            availability: availabilityRecords.map(record => ({
                ...record,
                submittedAt: record.submittedAt instanceof Date ? record.submittedAt.toISOString() : record.submittedAt,
                isCurrentWeek: new Date(record.submittedAt) >= currentWeekStart && new Date(record.submittedAt) <= currentWeekEnd
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
        
        // Base query using the correct columns that exist in the table
        let query = `
            SELECT a.*, u.name AS employeeName, u.department 
            FROM availability a
            JOIN user u ON a.employeeId = u.userId
            WHERE a.status = 'Pending'
        `;

        const params = [];

        // Add date filter if days parameter is provided
        if (days && days !== 'all') {
            query += ` AND a.submittedAt <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`;
            params.push(days);
        }

        // Add department filter if provided
        if (department) {
            query += ` AND u.department = ?`;
            params.push(department);
        }

        // Order by submitted date
        query += ` ORDER BY a.submittedAt DESC`;

        console.log('Executing query:', query);
        console.log('With params:', params);

        const [pendingRequests] = await connection.execute(query, params);
        console.log('Raw pending requests:', pendingRequests);
        
        // Format for frontend - using correct fields
        const formattedRequests = pendingRequests.map(request => ({
            ...request,
            submittedAt: request.submittedAt instanceof Date ? request.submittedAt.toISOString() : request.submittedAt,
            preferredDates: request.preferredDates || ''
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