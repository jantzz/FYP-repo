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

module.exports = { addShift, getShifts, getShiftsinRange, swapRequest, updateSwap, getAllShifts};