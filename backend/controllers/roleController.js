const db = require('../database/db');

const createRole = async(req, res) =>{ 
    const { roleName } = req.body; 

    //check if a description is provided, if none set desription to ""
    const desc = req.body.description ? req.body.description : "";

    if(!roleName) return res.status(400).json({error: "please enter role name"});

    let connection;
    try{ 
        connection = await db.getConnection();

        // First check if the role already exists
        const [existingRoles] = await connection.execute(
            "SELECT roleName FROM role WHERE roleName = ?",
            [roleName]
        );

        // If role already exists, return success (idempotent operation)
        if (existingRoles.length > 0) {
            return res.status(200).json({
                message: "Role already exists", 
                roleExists: true
            });
        }

        // Only insert if the role doesn't exist
        const q = "INSERT INTO role (roleName, description) VALUES (?, ?)";
        const data = [roleName, desc];
        await connection.execute(q, data);

        return res.status(200).json({message: "role created successfully"});

    } catch(err) {
        console.error(err);
        // If it's a duplicate key error, handle it gracefully
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(200).json({
                message: "Role already exists",
                roleExists: true
            });
        }
        res.status(500).json({error: "Internal Server Error"});
    } finally { //close the connection after executing sql scripts
        if (connection) connection.release(); //if connection is not released no response will be given
    }
}

// Get all departments
const getDepartments = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Use both DISTINCT and GROUP BY for maximum duplicate protection
        const [departments] = await connection.execute(`
            SELECT departmentName, description, shifting 
            FROM department 
            GROUP BY departmentName 
            ORDER BY departmentName
        `);
        
        return res.status(200).json(departments);
        
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({error: "Internal Server Error"});
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createRole,
    getDepartments
}