const db = require('../database/db');


const getShifts = async (req, res) => {
    //extract employeeId from request url
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ error: "Employee ID is required." });

    let connection;
    try {
        connection = await db.getConnection();
        //query to fetch shifts for an employee with their name from 'user' table
        const query = `
            SELECT shift.*, user.name AS employeeName
            FROM shift
            JOIN user ON shift.employeeId = user.userId
            WHERE shift.employeeId = ?
            ORDER BY shift.startDate ASC
        `;

        const [shifts] = await connection.execute(query, [employeeId]);
        
        connection.release();
        //send retrieved data as response
        return res.status(200).json(shifts);
    } catch (err) {
        //errorr logs/response
        console.error(err);
        res.status(500).json({error: "Internal Server Error."});
    } finally {
        if (connection) connection.release();
    }
};

const addShift = async (req, res, io) => {
    const { employeeId, startDate, endDate, status } = req.body;
    //to validate required fields are provided
    if (!employeeId || !startDate || !endDate || !status) {
        return res.status(400).json({ error: "All fields are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        //query to insert a new shift into DB 
        const q = "INSERT INTO shift (employeeId, startDate, endDate, status) VALUES (?, ?, ?, ?)";
        const data = [employeeId, startDate, endDate, status];

        await connection.execute(q, data);
        //connection.release();
         //get the employee's name 
         const employeeQuery = "SELECT name FROM user WHERE userId = ?";
         const [employee] = await connection.execute(employeeQuery, [employeeId]);

         //if no employee found, handle the error
        if (employee.length === 0) {
            return res.status(404).json({ error: "Employee not found." });
        }

        const employeeName = employee[0].name;
        //notification message
        const notificationMessage = `New shift added for ${employeeName} from ${startDate} to ${endDate}. Status: ${status}`;

         //insert the notification into the database
         const insertNotificationQuery = "INSERT INTO notifications (userId, message) VALUES (?, ?)";
         await connection.execute(insertNotificationQuery, [employeeId, notificationMessage]);
         
        //notification for a new shift
        const io = req.app.get('io');
        if (io) {
            //emit notification to the specific user's room
            io.to(`user_${employeeId}`).emit("shift_added", { message: "New shift added!" });
        } else {
            console.error("Socket.io not initialized");
        }

        return res.status(201).json({ message: "Shift added successfully." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally { //close the connection after executing sql scripts
        if (connection) connection.release(); //if connection is not released no response will be given
    }
};

const getShiftsinRange = async (req, res) => {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) return res.status(400).json({ error: "Both start and end dates are required." });

    let connection;

    try{
        connnection = await db.getConnection();
        const query = `
            SELECT shift.*, user.name
            FROM shift
            JOIN user ON shift.employeeId = user.userId
            WHERE shift.startDate >= ? AND shift.endDate <= ?
            ORDER BY shift.startDate ASC
        `;

        const [shifts] = await connection.execute(query, [startDate, endDate]);
        connection.release();

        return res.status(200).json(shifts);

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }

}

const swapRequest = async (req, res) => {
    const { shiftId, swapId } = req.body;
    if (!shiftId || !swapId) return res.status(400).json({ error: "Current Shift and Preferred shift must be filled" });

    let connection;
    try{
        connection = await db.getConnection();

        const query = `
            INSERT INTO swap (currentShift, swapWith) VALUES (?, ?)
        `;

        await connection.execute(query, [shiftId, swapId]);
        connection.release();

        return res.status(200).json({ message: "Swap request sent" });

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }
}

const updateSwap = async (req, res) => {
    const { swapId, status } = req.body;
    if (!swapId || !status) return res.status(400).json({ error: "Swap ID and status are required." });

    if(status !== "Approved" && status !== "Declined") return res.status(400).json({ error: "Invalid status" });
    
    let connection;

    try{
        connection = await db.getConnection();
        //begin transaction so that all queries are ran before commiting the changes
        connection.beginTransaction();
        if (status === "Approved") { //if the swap is accepted then update the shifts
            // grab the coreesponding shifts from the swap request 
            const getShiftQuery = `SELECT currentShift, swapWith FROM swap WHERE swapId = ?`;
            const [shifts] = await connection.execute(getShiftQuery, [swapId]);
            console.log(shifts);

            //grab the employees assigned to each shift 
            const [emp1] = await connection.execute("SELECT employeeId FROM shift WHERE shiftId = ?", [shifts[0].currentShift]);
            const [emp2] = await connection.execute("SELECT employeeId FROM shift WHERE shiftId = ?", [shifts[0].swapWith]);

            console.log (emp1, emp2);
            //update the shifts with the new assigned employees
            await connection.execute(`UPDATE shift SET employeeId = ? WHERE shiftId = ?`, [emp2[0].employeeId, shifts[0].currentShift]);
            await connection.execute(`UPDATE shift SET employeeId = ? WHERE shiftId = ?`, [emp1[0].employeeId, shifts[0].swapWith]);
        }

        const query = `UPDATE swap SET status = ? WHERE swapId = ?`;
        await connection.execute(query, [status, swapId]);

        //after all queries are completed commit the changes 
        await connection.commit();
        return res.status(200).json({ message: "Swap request updated." });

    }catch(err) {
        //if any of the queries fail, rollback all the changes to prevent sever damage to data 
        await connection.rollback();
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    } finally{
        if(connection) connection.release();
    }
}

const getAllShifts = async(req, res) => {
    let connection; 

    try{ 
        connection = await db.getConnection(); 

        // Enhanced query to include employee name and department information
        const query = `
            SELECT s.*, u.name as employeeName, u.department 
            FROM shift s
            JOIN user u ON s.employeeId = u.userId
            ORDER BY s.startDate ASC
        `;

        const [shifts] = await connection.execute(query);
        
        // Format dates for better compatibility
        const formattedShifts = shifts.map(shift => ({
            ...shift,
            startDate: shift.startDate ? new Date(shift.startDate).toISOString().split('T')[0] : null,
            endDate: shift.endDate ? new Date(shift.endDate).toISOString().split('T')[0] : null
        }));

        connection.release();
        res.status(200).json(formattedShifts);
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    } finally {
        if (connection) connection.release();
    }
}

const generateShift = async (req, res) => {
    const { start, end } = req.body;
    if (!start || !end) return res.status(400).json({ error: "Start and end dates are required." });

    const dayCodeMap = {
        M: 1,     // Monday
        T: 2,     // Tuesday
        W: 3,     // Wednesday
        TH: 4,    // Thursday
        F: 5,     // Friday
        S: 6,     // Saturday
        SN: 0     // Sunday
    };

    let connection; 
    try {
        connection = await db.getConnection(); 
        
        // Validate that we have departments that can have shifts
        const [deps] = await connection.execute("SELECT departmentName FROM department WHERE shifting = 1");
        if (!deps.length) {
            return res.status(400).json({ error: "No departments are configured for shift generation." });
        }

        // Get employees with approved availabilities
        const [availabilities] = await connection.execute(
            "SELECT a.employeeId, a.preferredDates, u.department FROM availability a " +
            "JOIN user u ON a.employeeId = u.userId WHERE a.status = 'Approved'"
        );

        // Get employees without availabilities
        const [employees] = await connection.execute(
            "SELECT u.userId, u.department FROM user u " +
            "LEFT JOIN availability a ON u.userId = a.employeeId WHERE a.employeeId IS NULL"
        );

        // Check if we have any employees to generate shifts for
        if (!availabilities.length && !employees.length) {
            return res.status(400).json({ error: "No eligible employees found for shift generation." });
        }

        const preferred = {};
        const count = {};

        // Process employees with preferred availabilities
        for (const entry of availabilities) {
            const { employeeId, preferredDates, department } = entry;
            if (!preferredDates) continue; // Skip if no preferred dates
            
            const preferredDays = preferredDates.split(",")
                .map(day => dayCodeMap[day.trim()])
                .filter(day => day !== undefined); // Filter out invalid days
                
            if (preferredDays.length) {
                preferred[employeeId] = { preferredDays, department };
                count[employeeId] = 0;
            }
        }

        // Initialize counts for employees without availabilities
        for (const employee of employees) {
            const { userId, department } = employee;
            count[userId] = 0;
        }

        const shifts = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const currentDate = new Date(startDate.getTime());

        // Generate shifts for each day in the range
        while (currentDate.getTime() <= endDate.getTime()) {
            const dayCode = currentDate.getDay();
            const formattedDate = currentDate.toISOString().split("T")[0];
            const depCount = {};
            
            // Initialize department counts
            for (const dep of deps) {
                depCount[dep.departmentName] = 0;
            }

            // First, assign shifts to employees with preferred availability
            const sortedPreferred = Object.entries(preferred)
                .sort((a, b) => count[a[0]] - count[b[0]]);
                
            for (const [employeeId, { preferredDays, department }] of sortedPreferred) {
                if (preferredDays.includes(dayCode) && depCount[department] < 2 && count[employeeId] < 6) {
                    console.log(`Adding preferred shift for employee ${employeeId} on ${formattedDate}`);
                    shifts.push({ 
                        employeeId, 
                        startDate: formattedDate, 
                        endDate: formattedDate, 
                        status: "Pending",
                        title: `Generated shift for ${employeeId}`
                    });
                    depCount[department]++;
                    count[employeeId]++;
                }
            }

            // Then fill remaining slots with other employees
            const sortedEmployees = [...employees]
                .sort((a, b) => count[a.userId] - count[b.userId]);
                
            for (const employee of sortedEmployees) {
                const { userId, department } = employee;
                if (depCount[department] < 2 && count[userId] < 6) {
                    console.log(`Adding regular shift for employee ${userId} on ${formattedDate}`);
                    shifts.push({ 
                        employeeId: userId, 
                        startDate: formattedDate, 
                        endDate: formattedDate, 
                        status: "Pending",
                        title: `Generated shift for ${userId}`
                    });
                    depCount[department]++;
                    count[userId]++;
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // If no shifts were generated, return an error
        if (shifts.length === 0) {
            return res.status(400).json({ error: "No shifts could be generated for the given date range." });
        }

        console.log(`Generated ${shifts.length} shifts`);

        // Begin transaction for saving shifts
        await connection.beginTransaction();
        
        try {
            const shiftQuery = "INSERT INTO pendingShift (employeeId, startDate, endDate, status, title) VALUES (?, ?, ?, ?, ?)";
            
            for (const shift of shifts) {
                const { employeeId, startDate, endDate, status, title } = shift;
                console.log('Inserting shift:', { employeeId, startDate, endDate, status, title });
                const [result] = await connection.execute(shiftQuery, [employeeId, startDate, endDate, status, title]);
                console.log('Insert result:', result);
            }
            
            await connection.commit();
            console.log('Transaction committed');
            
            res.status(200).json({ 
                message: "Pending Shifts generated successfully.",
                count: shifts.length
            });
        } catch (error) {
            console.error('Error in transaction:', error);
            await connection.rollback();
            throw error;
        }

    } catch (err) {
        console.error('Error in generateShift:', err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        res.status(500).json({ error: err.message || "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

const getPendingShifts = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();

        // First get a count of all pending shifts
        const countQuery = `SELECT COUNT(*) as count FROM pendingShift`;
        const [countResult] = await connection.execute(countQuery);
        console.log('Total pending shifts:', countResult[0].count);

        // Get all pending shifts regardless of status
        const query = `
            SELECT ps.*, u.name as employeeName, u.department 
            FROM pendingShift ps
            JOIN user u ON ps.employeeId = u.userId
            ORDER BY ps.startDate ASC
        `;

        const [pendingShifts] = await connection.execute(query);
        console.log('Raw pending shifts result:', pendingShifts);
        
        // Format dates for better compatibility
        const formattedShifts = pendingShifts.map(shift => ({
            ...shift,
            startDate: shift.startDate ? new Date(shift.startDate).toISOString().split('T')[0] : null,
            endDate: shift.endDate ? new Date(shift.endDate).toISOString().split('T')[0] : null
        }));

        return res.status(200).json(formattedShifts);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    } finally {
        if (connection) connection.release();
    }
};

const approvePendingShifts = async (req, res) => {
    let connection;

    try{
        connection = await db.getConnection();
        [pendingShifts] = await connection.execute(`SELECT * FROM pendingShift`);

        for (shift of pendingShifts) {
            const { employeeId, startDate, endDate } = shift;
            const query = `INSERT INTO shift (employeeId, startDate, endDate, status) VALUES (?, ?, ?, ?)`;
            await connection.execute(query, [employeeId, startDate, endDate, "Assigned"]);
        }
        // Delete the pending shifts after approval
        const deleteQuery = `DELETE FROM pendingShift`;
        await connection.execute(deleteQuery);
        connection.release();
        return res.status(200).json({ message: "Pending shifts approved and deleted." });
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }
    finally {
        if (connection) connection.release();
    }
}

const logAttendance = async (req, res) => {
    const {shiftId, status } = req.body;
    if (!shiftId || !status) return res.status(400).json({ error: "Shift ID and status are required." });
    let connection;

    try{
        connection = await db.getConnection();
        //query to update the attendance status of a shift
        const query = `UPDATE shift SET status = ? WHERE shiftId = ?`;
        await connection.execute(query, [status, shiftId]);
        connection.release();
        return res.status(200).json({ message: "Attendance logged successfully." });
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally{ 
        if (connection) connection.release();
    }
}

const approvePendingShift = async (req, res) => {
    const { pendingShiftId, managerId } = req.body;
    
    if (!pendingShiftId || !managerId) {
        return res.status(400).json({ error: "Pending shift ID and manager ID are required." });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if the user is a manager
        const [managers] = await connection.execute(
            "SELECT role FROM user WHERE userId = ?",
            [managerId]
        );
        
        if (managers.length === 0 || !['Manager', 'Admin'].includes(managers[0].role)) {
            connection.release();
            return res.status(403).json({ error: "Only managers and admins can approve shifts." });
        }
        
        // Begin transaction
        await connection.beginTransaction();
        
        try {
            // Get the pending shift
            const [pendingShifts] = await connection.execute(
                "SELECT * FROM pendingShift WHERE pendingShiftId = ?",
                [pendingShiftId]
            );
            
            if (pendingShifts.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: "Pending shift not found." });
            }
            
            const shift = pendingShifts[0];
            const { employeeId, startDate, endDate, title } = shift;
            
            // Insert into shift table
            const query = `
                INSERT INTO shift (employeeId, startDate, endDate, title, status) 
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.execute(query, [
                employeeId, 
                startDate,
                endDate,
                title || `Approved shift for ${employeeId}`,
                "Scheduled"
            ]);
            
            // Delete from pendingShift table
            await connection.execute(
                "DELETE FROM pendingShift WHERE pendingShiftId = ?",
                [pendingShiftId]
            );
            
            // Commit transaction
            await connection.commit();
            
            // Send notification to employee if socket.io is available
            const io = req.app.get('io');
            if (io && employeeId) {
                io.to(`user_${employeeId}`).emit('shift_approved', {
                    message: `Your pending shift has been approved.`,
                    type: 'shift',
                    shiftDetails: {
                        start: startDate,
                        end: endDate,
                        title: title || `Approved shift for ${employeeId}`,
                    }       
                });
            }
            
            return res.status(200).json({ 
                message: "Pending shift approved successfully.",
                shift: {
                    employeeId,
                    startDate,
                    endDate,
                    title
                }
            });
        } catch (err) {
            // Rollback in case of error
            await connection.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Error approving pending shift:', err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally {
        if (connection) connection.release();
    }
};

const addPendingShift = async (req, res) => {
    const { employeeId, startDate, endDate, title } = req.body;
    //to validate required fields are provided
    if (!employeeId || !startDate || !endDate) {
        return res.status(400).json({ error: "Employee ID, start date, and end date are required." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        //query to insert a new pending shift into DB 
        const q = "INSERT INTO pendingShift (employeeId, startDate, endDate, status, title) VALUES (?, ?, ?, ?, ?)";
        const data = [employeeId, startDate, endDate, "Pending", title || `Pending shift for ${employeeId}`];

        const [result] = await connection.execute(q, data);
        console.log('Insert result:', result);

        return res.status(201).json({ 
            message: "Pending shift added successfully.",
            pendingShiftId: result.insertId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error." });
    } finally { //close the connection after executing sql scripts
        if (connection) connection.release(); //if connection is not released no response will be given
    }
};

module.exports = { addShift, getShifts, getShiftsinRange, swapRequest, updateSwap, getAllShifts, generateShift, getPendingShifts, approvePendingShifts, approvePendingShift, logAttendance, addPendingShift };