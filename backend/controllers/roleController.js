const db = require('../database/db');

const createRole = async(req, res) =>{ 
    const { roleName } = req.body; 

    const desc = req.body.description ? req.body.description : "";

    if(!roleName) return res.status(400).json({error: "please enter role name"});

    let connection;

    try{ 
        connection = await db.getConnection();

        const q = "INSERT INTO role (roleName, description) VALUES (?, ?)";

        const data = [roleName, desc];

        connection.execute(q, data);

        return res.status(200).json({message: "role created successfully"});

    } catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    createRole
}