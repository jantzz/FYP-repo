const db = require('../database/db');
// TODO: other availability functions for User Story 8
//function to let an employee submit availability details
const submitAvailability = async (req, res) => {
    const { employeeId, startDate, startTime, endDate, endTime, preferredShift } = req.body;

    if (!employeeId || !startDate || !startTime || !endDate || !endTime || !preferredShift) {
        return res.status(400).json({ error: "All fields are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // calculate requested hours
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        
        // if end time is earlier than start time, assume it spans to next day
        let requestedHours;
        if (endDateTime <= startDateTime) {
            const endNextDay = new Date(endDateTime);
            endNextDay.setDate(endNextDay.getDate() + 1);
            requestedHours = (endNextDay - startDateTime) / (1000 * 60 * 60);
        } else {
            requestedHours = (endDateTime - startDateTime) / (1000 * 60 * 60);
        }

        // get current remaining hours for the week of the requested date
        const requestDate = new Date(startDate);
        const weekStart = new Date(requestDate);
        weekStart.setDate(requestDate.getDate() - requestDate.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        weekEnd.setHours(23, 59, 59, 999);

        const [currentHours] = await connection.execute(
            `SELECT 
                GREATEST(0, 
                    LEAST(40, 
                        40 - COALESCE(
                            SUM(hours), 
                            0
                        )
                    )
                ) as remainingHours
            FROM availability 
            WHERE employeeId = ? 
            AND status != 'Declined'
            AND startDate BETWEEN ? AND ?`,
            [employeeId, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
        );

        const remainingHours = parseFloat(currentHours[0].remainingHours);

        // check if employee has enough remaining hours for this week
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

        const query = `
            INSERT INTO availability (employeeId, startDate, startTime, endDate, endTime, preferredShift, hours) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await connection.execute(query, [
            employeeId, 
            startDate, 
            startTime, 
            endDate, 
            endTime, 
            preferredShift,
            requestedHours
        ]);

        // calculate new remaining hours
        const newRemainingHours = remainingHours - requestedHours;

        return res.status(201).json({ 
            message: "Availability submitted successfully.",
            requestedHours: parseFloat(requestedHours.toFixed(2)),
            remainingHours: parseFloat(newRemainingHours.toFixed(2))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

//function for managers to approve/decline availabilities 
const updateAvailabilityStatus = async (req, res) => {
    //formatDateTime function 
    const formatDateTime = (date, time) => {
        //format date as YYYY-MM-DD
        const formattedDate = new Date(date).toISOString().split('T')[0]; 
        //ensures time is HH:MM:SS
        const formattedTime = time.length === 5 ? `${time}:00` : time; 
        return `${formattedDate} ${formattedTime}`;
    };

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

        //const { employeeId, startDate, endDate } = availabilityCheck[0];
        const { employeeId, startDate, startTime, endDate, endTime, preferredShift } = availabilityCheck[0];
        
        if (!startTime || !endTime) { 
            console.error('Missing startTime or endTime');
            return res.status(400).json({ error: "Missing start time or end time." });
        }
        
        //if the availability is approved, adds it to shift table
        if (status === "Approved") {
            //const { employeeId, startDate, startTime, endDate, endTime, preferredShift } = availabilityCheck[0];

            // Format the dates and times properly for MySQL
            const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
            const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
            
            // Format times to ensure they're in HH:MM:SS format
            const formattedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
            const formattedEndTime = endTime.length === 5 ? `${endTime}:00` : endTime;

            // Combine date and time in MySQL datetime format
            const formattedStartDateTime = `${formattedStartDate} ${formattedStartTime}`;
            const formattedEndDateTime = `${formattedEndDate} ${formattedEndTime}`;

            // Insert into shift table with properly formatted dates
            const shiftQuery = `
                INSERT INTO shift (employeeId, startDate, endDate, title, status)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.execute(shiftQuery, [
                employeeId,
                formattedStartDateTime,
                formattedEndDateTime,
                preferredShift,
                "Scheduled"
            ]);
            
            console.log('Created shift with dates:', {
                startDateTime: formattedStartDateTime,
                endDateTime: formattedEndDateTime,
                employeeId,
                preferredShift
            });

            //send socket notification for new shift
            const io = req.app.get('io');
            if (io && employeeId) {
                io.to(`user_${employeeId}`).emit('shift_added', {
                    message: `You have a new shift from ${formattedStartDateTime} to ${formattedEndDateTime}.`,
                    type: 'shift',
                    shiftDetails: {
                        start: formattedStartDateTime,
                        end: formattedEndDateTime,
                        title: preferredShift,
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
        //format start and end dates properly
        const notificationStart = formatDateTime(startDate, startTime);
        const notificationEnd = formatDateTime(endDate, endTime);

        //availability notification message
        const availabilityMessage = `${employeeName}, your availability request from ${notificationStart} to ${notificationEnd} has been ${status.toLowerCase()}.`;
        //insert the notification into the database
        const insertNotificationQuery = "INSERT INTO notifications (userId, message) VALUES (?, ?)";
        try {
            const [result] = await connection.execute(insertNotificationQuery, [employeeId, availabilityMessage]);
            console.log('Notification inserted:', result);
        } catch (err) {
            console.error('Error inserting notification:', err);
        }
        await connection.execute(insertNotificationQuery, [employeeId, availabilityMessage]);

        //send via socket.io (if available)
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${employeeId}`).emit("availability_updated", {
                message: availabilityMessage,
                status,
                startDate: notificationStart,
                endDate: notificationEnd,
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
            ORDER BY startDate ASC, startTime ASC
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
        
        // loop through each availability record to calculate hours used
        for (const record of availabilityRecords) {
            try {
                const recordDate = new Date(record.startDate);
                
                // Only count hours if they're in the current week
                if (recordDate >= currentWeekStart && recordDate <= currentWeekEnd) {
                    const hours = parseFloat(record.hours || 0);
                    
                    // Only count approved or pending records
                    if (record.status !== 'Declined' && !isNaN(hours)) {
                        console.log(`Adding ${hours.toFixed(2)} hours for record:`, {
                            id: record.availabilityId,
                            status: record.status,
                            date: recordDate.toISOString(),
                            hours: hours
                        });
                        usedHours += hours;
                    }
                }
            } catch (err) {
                console.error('Error processing availability record:', err, record);
                // Continue with next record
            }
        }
        
        console.log(`Total used hours for current week: ${usedHours.toFixed(2)}`);
        
        // calculate remaining hours (cap at 0 if negative)
        const remainingHours = Math.max(0, maxHoursPerWeek - usedHours);
        
        console.log(`Remaining hours for current week: ${remainingHours.toFixed(2)}`);
        
        // Get the week dates for the frontend
        const weekInfo = {
            weekStart: currentWeekStart.toISOString().split('T')[0],
            weekEnd: currentWeekEnd.toISOString().split('T')[0],
            currentDate: now.toISOString().split('T')[0]
        };
        
        // Return the data with calculated remaining hours and week info
        return res.status(200).json({
            remainingHours: parseFloat(remainingHours.toFixed(2)),
            weekInfo: weekInfo,
            usedHours: parseFloat(usedHours.toFixed(2)),
            availability: availabilityRecords.map(record => ({
                ...record,
                startDate: record.startDate instanceof Date ? record.startDate.toISOString() : record.startDate,
                endDate: record.endDate instanceof Date ? record.endDate.toISOString() : record.endDate,
                isCurrentWeek: new Date(record.startDate) >= currentWeekStart && new Date(record.startDate) <= currentWeekEnd
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
            startDate: request.startDate instanceof Date ? request.startDate.toISOString().split('T')[0] : request.startDate,
            startTime: request.startTime instanceof Date ? request.startTime.toISOString().split('T')[1].split('.')[0] : request.startTime,
            endDate: request.endDate instanceof Date ? request.endDate.toISOString().split('T')[0] : request.endDate,
            endTime: request.endTime instanceof Date ? request.endTime.toISOString().split('T')[1].split('.')[0] : request.endTime
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