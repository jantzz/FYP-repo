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
            INSERT INTO swap (shiftId, swapId) VALUES (?, ?)
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

    if(status !== "Accepted" && status !== "Rejected") return res.status(400).json({ error: "Invalid status" });
    
    let connection;

    try{
        connection = await db.getConnection();

        const query = `UPDATE swap SET status = ? WHERE swapId = ?`;
        await connection.execute(query, [status, swapId]);
        connection.release();

        return res.status(200).json({ message: "Swap request updated." });

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
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