const jwt = require('jsonwebtoken');
const db = require('../database/db');

const adminAuth = async (req, res, next) =>{ 
    //verify auth token 
    const { auth } = req.headers;

    if(!auth) return res.status(401).json({error: "Unauthorized"});

    try{
        const token = auth.split(" ")[1];

        const decoded = jwt.verify(token, process.env.SECRET);
        const connection = await db.getConnection();
        const [roles] = await connection.execute(
            "SELECT role FROM user WHERE userId = ?",
            [decoded._id]
        );

        connection.release();

        if(roles.length === 0) return res.status(401).json({error: "Unauthorized"});

        if(roles[0].role !== 'Admin') return res.status(401).json({error: "Unauthorized"});

        next();

    } catch(err){
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }
}

module.exports = adminAuth;