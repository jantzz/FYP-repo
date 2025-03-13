const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const createToken = (_id) => {
    return (jwt.sign({_id: _id}, process.env.SECRET, { expiresIn : '3d'}));
}

const loginUser = async (req, res) => {
    //get email and password from request body 
    const { email, password } = req.body;

    //check if any fields are invalid / empty 
    if(!email || !password ) return res.status(400).json({ error : "Email and password are required"});

    try{    
        //await connection to database 
        const connection = await db.getConnection();

        //select all users that have the given email
        const [users] = await connection.execute(
            "SELECT userId, password FROM user WHERE email = ?",
            [email]
        );

        //after data is received release the connection with db
        connection.release();

        //check if no users are found
        if (users.length === 0) return res.status(401).json({error : "Invalid email or password"});

        //get the first user in the pool (should only have one)
        const user = users[0];
        //check if password match
        const match = await bcrypt.compare(password, user.password);

        if(!match) return res.status(401).json({error : "Invalid email or password"});

        const token = createToken(user.userId);
        res.status(200).json({token: token});

    }catch(err) {
        console.error("Error logging in:", err);
        res.status(500).json({error: "Internal Server Error"});
    }

}

const createUser = async (req, res) => {
    const { name, email, password, role, birthday, gender } = req.body;

    //for dep and assignedTasks check if there are values, if not set null 
    const department = req.body.department ? req.body.department: null; 
    const assignedTask = req.body.assignedTask ? req.body.assignedTask: null;

    if(!name || ! email || !password || !role || !birthday ) return res.status(400).json({error: "certain fields cannot be left empty"});

    let connection;

    try{
        connection = await db.getConnection();
    
        const q = "INSERT INTO user (name, email, password, role, birthday, gender, department, assignedTask) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        //generate salt and hash password 
        const salt = await bcrypt.genSalt(10);

        const hashed = await bcrypt.hash(password, salt);

        const data = [
            name, email, hashed , role, birthday, gender, department, assignedTask
        ];

        //command .execute is used over .query because we are handling async functions 
        connection.execute(q, data);

        return res.status(200).json({message: "User created successfully"});

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally { //release the connection to avoid infinite wait times 
        if (connection) connection.release();
    }
}

const updateUser = async (req, res) => {
    const { email, data } = req.body; 

    //check if any of the fields are empty or if no data is being changed 
    if (!email || !data || Object.keys(data).legnth === 0) return res.status(400).json({error: "Please fill out the form"});

    let connection; 

    try{
        connection = await db.getConnection();

        //check if password is being changed 
        if(data.password) { //if its being changed hash the password 
            const salt = await bcrypt.genSalt(10);
            data.password = await bcrypt.hash(data.password, salt);
        }
        
        //fields constructs it so that you get i.e. name = ?, password = ? etc.
        const fields = Object.keys(data).map(field => `${field} = ?`).join(", ");
        const values = Object.values(data); // get all the values into one array 

        values.push(email); //add in email for the last WHERE email = ? clause 

        const q = `UPDATE user SET ${fields} WHERE email = ?`;

        const [result] = await connection.execute(q, values); // execute and return for checking

        // check if any users were affected 
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ message: "User updated successfully" });

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally {
        if(connection) connection.release();
    }

}

module.exports = {
    loginUser,
    createUser,
    updateUser
}