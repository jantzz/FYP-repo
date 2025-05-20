const db = require('../database/db');
// TODO: other availability functions for User Story 8
//function to let an employee submit availability details
const submitAvailability = async (req, res) => {
    const { employeeId, preferredDates, preferredShiftTimes } = req.body;

    if (!employeeId || !preferredDates) {
        return res.status(400).json({ error: "Employee ID and preferred dates are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Insert availability record - automatically set to Approved (no manager approval needed)
        const query = `
            INSERT INTO availability (employeeId, preferredDates, preferredShiftTimes, status) 
            VALUES (?, ?, ?, 'Approved')
        `;

        await connection.execute(query, [
            employeeId,
            preferredDates,
            preferredShiftTimes || null
        ]);

        // Send notification if socket.io is available
        const io = req.app.get('io');
        if (io && employeeId) {
            io.to(`user_${employeeId}`).emit('availability_updated', {
                message: `Your availability preference has been saved successfully.`,
                preferredDates,
                preferredShiftTimes
            });
        }

        return res.status(201).json({
            message: "Availability submitted successfully."
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
   // console.log('Updating availability status:', { availabilityId, managerId, status });

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
        //console.log('Found manager:', managers[0]);

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
        //console.log('Found availability:', availabilityCheck[0]);

        if (availabilityCheck.length === 0) {
            console.error('Availability request not found:', availabilityId);
            connection.release();
            return res.status(404).json({ error: "Availability request not found." });
        }

        const { employeeId, preferredDates, preferredShiftTimes } = availabilityCheck[0];

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
        const availabilityDetails = preferredDates + (preferredShiftTimes ? ` (${preferredShiftTimes})` : '');

        // Create notification based on the new schema
        const availabilityMessage = `${employeeName}, your availability request for ${availabilityDetails || 'your preferred days'} has been ${status.toLowerCase()}.`;

        //insert the notification into the database
        const insertNotificationQuery = "INSERT INTO notifications (userId, message) VALUES (?, ?)";
        try {
            const [result] = await connection.execute(insertNotificationQuery, [employeeId, availabilityMessage]);
            //console.log('Notification inserted:', result);
        } catch (err) {
            console.error('Error inserting notification:', err);
        }

        //send via socket.io (if available)
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${employeeId}`).emit("availability_updated", {
                message: availabilityMessage,
                status,
                preferredDates,
                preferredShiftTimes
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
    //console.log('Getting availability for employee:', employeeId);

    if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required." });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Get all availability records for the employee without date filtering
        const [availability] = await connection.execute(
            `SELECT 
                availabilityId,
                preferredDates,
                preferredShiftTimes,
                status,
                submittedAt,
                approvedBy
            FROM availability 
            WHERE employeeId = ? 
            ORDER BY submittedAt DESC`,
            [employeeId]
        );

        // Return availability records
        return res.status(200).json({
            availability: availability || []
        });
    } catch (err) {
        console.error('Error getting employee availability:', err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

const deleteAvailabilityPreference = async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['user-id']; // Get the user ID from request headers

    let connection;
    try {
        connection = await db.getConnection();

        // First, get the availability info to have employeeId for notification
        const [availabilityInfo] = await connection.execute(
            'SELECT employeeId, preferredDates, preferredShiftTimes FROM availability WHERE availabilityId = ?',
            [id]
        );

        if (availabilityInfo.length === 0) {
            return res.status(404).json({ message: 'Availability preference not found' });
        }

        const { employeeId, preferredDates, preferredShiftTimes } = availabilityInfo[0];
        const availabilityDetails = preferredDates + (preferredShiftTimes ? ` (${preferredShiftTimes})` : '');

        // Now delete the availability preference
        const [result] = await connection.execute(
            'DELETE FROM availability WHERE availabilityId = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Availability preference not found' });
        }

        // Send socket notification about the deleted availability
        const io = req.app.get('io');
        if (io && employeeId) {
            io.to(`user_${employeeId}`).emit('availability_deleted', {
                message: `Your availability preference for ${availabilityDetails} has been deleted.`,
                deletedId: id
            });
        }

        // Return success response
        res.status(200).json({ 
            message: 'Availability preference deleted successfully',
            deletedId: id
        });
    } catch (err) {
        console.error('Error deleting availability preference:', err);
        res.status(500).json({ message: 'Failed to delete availability preference' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    submitAvailability,
    updateAvailabilityStatus,
    getEmployeeAvailability,
    deleteAvailabilityPreference
};
