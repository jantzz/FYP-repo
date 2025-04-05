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

const addShift = async (req, res) => {
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
        connection.release();

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

        const [shifts] = await connection.execute("SELECT * FROM shift");
        await connection.release();

        res.status(200).json(shifts);

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
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
    try{
        connection = await db.getConnection(); 
        //grab employees that have approved preferred availability 
        const [availabilities] = await connection.execute("SELECT a.employeeId, a.preferredDates, u.department FROM availability a JOIN user u ON a.employeeId = u.userId WHERE a.status = 'Approved");

        //grab the remaining employees that are supposed to be available for shifts at most times (no approved availabilities)
        const equery = "SELECT u.userId, u.role FROM user u JOIN availability a ON u.userId = a.employeeId WHERE a.employeeId IS NULL"
        const [employees] = await connection.execute(equery);

        const preferred = {};
        const count = {};

        for(const entry of availabilities) {
            const { employeeId, preferredDates, role } = entry;
            const preferredDays = preferredDates.split(",").map(day => dayCodeMap[day.trim()]); //convert the days to their corresponding numbers
            preferred[employeeId] = {preferredDays, role}; //store the preferred days and department of each employee
            count[employeeId] = 0; //initialize the count of shifts for each employee
        }

        const shifts = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const currentDate = new Date(startDate.getTime());

        while(currentDate != endDate) {
            const dayCode = currentDate.getDay(); //get the day code of the current date
            const formattedDate = currentDate.toISOString().split("T")[0]; //format the date to YYYY-MM-DD
            const [roles] = connection.execute("SELECT roleName FROM role WHERE shifting = 1"); //grab the roles that are supposed to be available for shifts
            const roleCount = {}; //initialize the count of shifts for each role

            for(const role of roles) {
                roleCount[role.roleName] = 0; //initialize the count of shifts for each role
            }
            //check if there are employees with preferred shifts for the current date  
            for(const employeeId in preferred) {
                const { preferredDays, role } = preferred[employeeId];
                if(preferredDays.includes(dayCode)) { //if the employee has a preferred shift for the current date
                    if(roleCount[role] < 2 && count[employeeId] < 6) { //if the role has not reached its limit and the employee has not reached its limit
                        shifts.push({ employeeId, startDate: formattedDate, endDate: formattedDate, status: "Approved" });
                        roleCount[role]++; //increment the count of shifts for the role
                        count[employeeId]++; //increment the count of shifts for the employee
                    }
                }
            }
            //check if there are employees without preferred shifts for the current date
            for(const employee of employees) {
                const { userId, role } = employee;
                if(roleCount[role] < 2 && count[userId] < 6) { //if the role has not reached its limit and the employee has not reached its limit
                    shifts.push({ employeeId: userId, startDate: formattedDate, endDate: formattedDate, status: "Approved" });
                    roleCount[role]++; //increment the count of shifts for the role
                    count[userId]++; //increment the count of shifts for the employee
                }
            }

            currentDate.setDate(currentDate.getDate() + 1); //increment the date by 1 day
        }

        //insert the shifts into the database
        connection.startTransaction(); //start transaction to ensure all queries are executed before committing the changes
        const shiftQuery = "INSERT INTO shift (employeeId, startDate, endDate, status) VALUES (?, ?, ?, ?)";
        for(const shift of shifts) {
            const { employeeId, startDate, endDate, status } = shift;
            await connection.execute(shiftQuery, [employeeId, startDate, endDate, status]);
        }
        await connection.commit(); //commit the changes
        connection.release(); //release the connection

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }
    finally {
        if (connection) connection.release(); //if something goes wrong, no matter what release the connection
    }
}

module.exports = { addShift, getShifts, getShiftsinRange, swapRequest, updateSwap, getAllShifts};