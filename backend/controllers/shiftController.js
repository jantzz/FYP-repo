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

        const [clinics] = await connection.execute("SELECT clinicId FROM clinics ");

        // Get employees with approved availabilities
        const [availabilities] = await connection.execute(
            "SELECT a.employeeId, a.preferredDates, u.department, u.clinicId FROM availability a " +
            "JOIN user u ON a.employeeId = u.userId WHERE a.status = 'Approved'"
        );

        // Get employees without availabilities
        const [employees] = await connection.execute(
            "SELECT u.userId, u.department, u.clinicId FROM user u " +
            "LEFT JOIN availability a ON u.userId = a.employeeId WHERE a.employeeId IS NULL"
        );

        // Check if we have any employees to generate shifts for
        if (!availabilities.length && !employees.length) {
            return res.status(400).json({ error: "No eligible employees found for shift generation." });
        }
        
        if (!clinics.length) {
            return res.status(400).json({ error: "No clinics found." });
        }
    
        const preferredInClinic = {}; 
        const count = {};
        const nonPreferredInClinic = {};

        for( const entry of availabilities){
            const { employeeId, preferredDates, department, clinicId } = entry;
            if (!preferredDates) continue; // Skip if no preferred dates
            
            const preferredDays = preferredDates.split(",")
                .map(day => dayCodeMap[day.trim()])
                .filter(day => day !== undefined); // Filter out invalid days
                
            if (preferredDays.length) {
                if (!preferredInClinic[clinicId]) {
                    preferredInClinic[clinicId] = [];
                }
                preferredInClinic[clinicId].push({ employeeId, preferredDays, department });
                count[employeeId] = 0;
            }
        }

        for (const employee of employees) {
            const { userId, department, clinicId } = employee;
            if (!nonPreferredInClinic[clinicId]) {
                nonPreferredInClinic[clinicId] = [];
            }
            nonPreferredInClinic[clinicId].push({ userId, department });
            count[userId] = 0;
        }

        const shifts = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const currentDate = new Date(startDate.getTime());

        while(currentDate.getTime() <= endDate.getTime()) { //TODO FIX THE COUNTING SO EACH CLINIC HAS DIFF DEP COUNT
            const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
            const formattedDate = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            const depCount  = {};
            const assignedToday = new Set(); // prevent double shifts for the same employee in a day

            for (const dep of deps) {
                const depName = dep.departmentName;
                for (const clinic of clinics) {
                    depCount[depName] = 0;

                    const preferred = preferredInClinic[clinic.clinicId] || []; 

                    const sortedPreferred = preferred
                    .filter(e => e.preferredDays.includes(dayOfWeek))
                    .sort((a,b) => count[a.employeeId] - count[b.employeeId]);
                    
                    for (const person of sortedPreferred) {
                        const { employeeId, department } = person;
                        if ( department == dep.departmentName && depCount[department] < 2 && count[employeeId] < 6 && !assignedToday.has(`${employeeId}:${formattedDate}`)) {
                            console.log(`Adding preferred shift for employee ${employeeId} on ${formattedDate}`);
                            shifts.push({ 
                                employeeId, 
                                startDate: formattedDate, 
                                endDate: formattedDate, 
                                status: "Pending",
                                title: `Generated shift for ${employeeId}`,
                                clinicId: clinic.clinicId
                            });
                            depCount[department]++;
                            count[employeeId]++;
                            assignedToday.add(`${employeeId}:${formattedDate}`);
                        }
                    }

                    const nonPreferred = nonPreferredInClinic[clinic.clinicId] || [];
                    const sortedNonPreferred = nonPreferred
                    .sort((a,b) => count[a.userId] - count[b.userId]);

                    for (const person of sortedNonPreferred) {
                        const { userId, department } = person;
                        if ( department == dep.departmentName && depCount[department] < 2 && count[userId] < 6 && !assignedToday.has(`${userId}:${formattedDate}`) ) {
                            console.log(`Adding regular shift for employee ${userId} on ${formattedDate}`);
                            shifts.push({ 
                                employeeId: userId, 
                                startDate: formattedDate, 
                                endDate: formattedDate, 
                                status: "Pending",
                                title: `Generated shift for ${userId}`,
                                clinicId: clinic.clinicId
                            });
                            depCount[department]++;
                            count[userId]++;
                            assignedToday.add(`${employeeId}:${formattedDate}`);
                        }
                    }

                    if (depCount[dep.departmentName] >= 2) { // no need to continue if we have filled all the slots for this department
                        break;
                    }
                    
                    if (depCount[dep.departmentName] < 2) { //if there are less than 2 shifts, we try to fill them with staff from other clinics 
                        const otherClinics = clinics.filter(c => c.clinicId !== clinic.clinicId);
                        for (const otherClinic of otherClinics) {
                            const otherPreferred = preferredInClinic[otherClinic.clinicId] || []; 
                            const sortedOtherPreferred = otherPreferred
                            .filter(e => e.preferredDays.includes(dayOfWeek))
                            .sort((a,b) => count[a.employeeId] - count[b.employeeId]);

                            for (const person of sortedOtherPreferred) {
                                const { employeeId, department } = person;
                                if ( department == dep.departmentName && depCount[department] < 2 && count[employeeId] < 6 && !assignedToday.has(`${employeeId}:${formattedDate}`)) {
                                    console.log(`Adding preferred shift for employee ${employeeId} on ${formattedDate}`);
                                    shifts.push({ 
                                        employeeId, 
                                        startDate: formattedDate, 
                                        endDate: formattedDate, 
                                        status: "Pending",
                                        title: `Generated shift for ${employeeId}`,
                                        clinicId: otherClinic.clinicId
                                    });
                                    depCount[department]++;
                                    count[employeeId]++;
                                    assignedToday.add(`${employeeId}:${formattedDate}`);
                                }
                            }

                        }
                    }

                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (shifts.length === 0) {
            return res.status(400).json({ error: "No shifts could be generated for the given date range." });
        }

        console.log(`Generated ${shifts.length} shifts`);

        // Begin transaction for saving shifts
        await connection.beginTransaction();
        
        try {
            const shiftQuery = "INSERT INTO pendingShift (employeeId, startDate, endDate, status, title, clinicId) VALUES (?, ?, ?, ?, ?, ?)";
            
            for (const shift of shifts) {
                const { employeeId, startDate, endDate, status, title, clinicId } = shift;
                console.log('Inserting shift:', { employeeId, startDate, endDate, status, title, clinicId });
                const [result] = await connection.execute(shiftQuery, [employeeId, startDate, endDate, status, title, clinicId]);
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
            startDate: shift.startDate ? shift.startDate : null,
            endDate: shift.endDate ? shift.endDate : null
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

// Function to get all swap requests with detailed information
const getSwaps = async (req, res) => {
    let connection;

    try {
        console.log('getSwaps endpoint called');
        connection = await db.getConnection();
        
        // First check if the swap table exists
        try {
        const [tableCheck] = await connection.execute(`SHOW TABLES LIKE 'swap'`);
            
            if (tableCheck.length === 0) {
                // Table doesn't exist, return empty array instead of error
                console.log('Swap table does not exist');
                return res.status(200).json([]);
            }
            
            // Check if the swap table has records
            const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM swap');
            console.log('Number of swap records:', countResult[0].count);
            
            if (countResult[0].count === 0) {
                // No swap records, return empty array
                console.log('No swap records found');
                return res.status(200).json([]);
            }
            
                // Get basic swap data without joins to diagnose possible issues
                const [basicSwapData] = await connection.execute('SELECT * FROM swap');
            console.log('Basic swap data found:', basicSwapData.length);
                
            // Use a simpler query first to avoid join issues
            const query = `
                SELECT s.swapId, s.currentShift, s.swapWith, s.status, s.submittedAt
                FROM swap s
                ORDER BY s.submittedAt DESC
            `;
            
            const [swaps] = await connection.execute(query);
            
            // Enhance data with additional information where available
            const enhancedSwaps = [];
            for (const swap of swaps) {
                const enhancedSwap = { ...swap };
                
                try {
                    // Get current shift info
                    const [currentShiftData] = await connection.execute(
                        'SELECT s.*, u.name as employeeName FROM shift s LEFT JOIN user u ON s.employeeId = u.userId WHERE s.shiftId = ?', 
                        [swap.currentShift]
                    );
                    
                    if (currentShiftData.length > 0) {
                        enhancedSwap.currentShift_startDate = currentShiftData[0].startDate;
                        enhancedSwap.currentShift_endDate = currentShiftData[0].endDate;
                        enhancedSwap.currentShift_employeeId = currentShiftData[0].employeeId;
                        enhancedSwap.requesterName = currentShiftData[0].employeeName;
                    }
                    
                    // Get swap with info
                    const [swapWithData] = await connection.execute(
                        'SELECT s.*, u.name as employeeName FROM shift s LEFT JOIN user u ON s.employeeId = u.userId WHERE s.shiftId = ?', 
                        [swap.swapWith]
                    );
                    
                    if (swapWithData.length > 0) {
                        enhancedSwap.swapWith_startDate = swapWithData[0].startDate;
                        enhancedSwap.swapWith_endDate = swapWithData[0].endDate;
                        enhancedSwap.swapWith_employeeId = swapWithData[0].employeeId;
                        enhancedSwap.targetEmployeeName = swapWithData[0].employeeName;
                    }
                } catch (error) {
                    console.error(`Error enhancing swap data for swap ID ${swap.swapId}:`, error);
                    // Continue with next swap without additional data
                }
                
                enhancedSwaps.push(enhancedSwap);
            }
        
        // Format dates for consistency
            const formattedSwaps = enhancedSwaps.map(swap => ({
            ...swap,
            submittedAt: swap.submittedAt ? new Date(swap.submittedAt).toISOString() : null,
            currentShift_startDate: swap.currentShift_startDate ? new Date(swap.currentShift_startDate).toISOString() : null,
            currentShift_endDate: swap.currentShift_endDate ? new Date(swap.currentShift_endDate).toISOString() : null,
            swapWith_startDate: swap.swapWith_startDate ? new Date(swap.swapWith_startDate).toISOString() : null,
            swapWith_endDate: swap.swapWith_endDate ? new Date(swap.swapWith_endDate).toISOString() : null
        }));
        
        return res.status(200).json(formattedSwaps);
            
        } catch (error) {
            console.error('Error checking or querying swap table:', error);
            // Return empty array instead of error
            return res.status(200).json([]);
        }
    } catch (err) {
        console.error('Error getting swaps:', err);
        // Return empty array instead of error status
        return res.status(200).json([]);
    } finally {
        if (connection) connection.release();
    }
};
/**
 * Recommend Employee
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
const recommendEmployee = async (req, res) => {
    const { shiftId } = req.body;
    if (!shiftId) return res.status(400).json({ error: "Shift ID is required." });
    let connection;
    try {
        connection = await db.getConnection();

        const [shifts] = await connection.execute(`SELECT * FROM shift WHERE shiftId = ?`,[shiftId]);
        if (shifts.length === 0) {
            console.log('No shifts found');
            return res.status(200).json([]);
        }

        const shift = shifts[0];

        // Get clinic
        const [clinics] = await connection.execute(`SELECT * FROM clinic WHERE clinicId = ?`,[shift.clinicId]);
        if (clinics.length === 0){
            console.log('No clinics found');
            return res.status(200).json([]);
        }
        const clinic = clinics[0];

        // Get the first two digits of postalCode
        const clinicPostalCode = clinic.postalCode.substring(0, 2);
        // Load the utils/singapore_postal_mapping_full.json file to get values where key equals clinicPostalCode
        const singaporePostalMapping = require('../utils/singapore_postal_mapping_full.json');
        const clinicPostalCodes = singaporePostalMapping[clinicPostalCode];
        if (!clinicPostalCodes || clinicPostalCodes.length === 0) {
            console.log('No clinicPostalCodes found');
            return res.status(200).json([]);
        }
        // clinicCity is in array format like [ '01', '04', '06', '07' ]
        // Find employees whose postalCode starts with values in clinicCity
        // Build dynamic LIKE conditions
        const likeConditions = clinicPostalCodes.map(code => `postalCode LIKE '${code}%'`).join(' OR ');
        // Query employees based on clinic ID, postal code, and where userId is not equal to shift.employeeId
        const [employees] = await connection.execute(`SELECT * FROM user WHERE clinicId = ? AND ? AND userId != ?`,[clinic.clinicId, likeConditions, shift.employeeId]);
        if (employees.length === 0){
            console.log('No employees found');
            return res.status(200).json([]);
        }
        let employee = employees[0];
        // Perform shift swap
        await connection.execute(`INSERT INTO swap (currentShift, swapWith, status) values (?, ?, ?)`,[shift.employeeId, employee.userId, 'Pending']);

        return res.status(200).json(employee);
    } catch (error) {
        console.error('Error checking or querying swap table:', error);
        // Return empty array instead of error
        return res.status(200).json([]);
    } finally {
        if (connection) connection.release();
    }
    return res.status(200).json([]);
}

module.exports = { addShift, getShifts, getShiftsinRange, swapRequest, updateSwap, getAllShifts, generateShift, getPendingShifts, approvePendingShifts, approvePendingShift, logAttendance, addPendingShift, getSwaps, recommendEmployee };