const db = require('../database/db');

const createRole = async(req, res) =>{ 
    const { roleName } = req.body; 

    //check if a description is provided, if none set desription to ""
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
    } finally { //close the connection after executing sql scripts
        if (connection) connection.release(); //if connection is not released no response will be given
    }
}

module.exports = {
    createRole
}