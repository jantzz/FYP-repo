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

const getUsers = async (req, res) => { 
    let connection; 

    try{
        connection = await db.getConnection();

        const [users] = await connection.execute("SELECT * FROM user");

        res.status(200).json(users);

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally {
        if(connection) connection.release();
    }
}

const getUser = async (req, res) => {
    const { email } = req.params;

    let connection; 
    try{
        connection = await db.getConnection();

        const [users] = await connection.execute("SELECT * FROM user WHERE email = ?", [email]);

        if(users.length === 0) return res.status(404).json({error: "User not found"});

        res.status(200).json(users[0]);
    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally {
        if(connection) connection.release();
    }
}

const createUser = async (req, res) => {
    const { name, email, password, role, birthday, gender, baseSalary, postalCode } = req.body; 

    //for dep and assignedTasks check if there are values, if not set null 
    const department = req.body.department ? req.body.department: null; 
    const assignedTask = req.body.assignedTask ? req.body.assignedTask: null;

    if(!name || !email || !password || !role || !birthday || !postalCode ) {
        return res.status(400).json({error: "Name, email, password, role, birthday, and postal code are required fields"});
    }

    let connection;

    try{
        connection = await db.getConnection();
        
        // Find clinic based on postal code first two digits
        let clinicId = null;
        
        try {
            // Get all clinics
            const [clinics] = await connection.execute("SELECT clinicId, postalCode FROM clinics WHERE postalCode IS NOT NULL AND postalCode != ''");
            let minDistance = Infinity;
            let nearestClinicId = null;
            
            clinics.forEach(clinic => {
                if (clinic.postalCode && clinic.postalCode.length >= 6 && postalCode.length >= 6) {
                    // Use absolute difference as proxy for distance
                    const dist = Math.abs(parseInt(clinic.postalCode) - parseInt(postalCode));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestClinicId = clinic.clinicId;
                    }
                }
            });
            
            if (nearestClinicId) {
                clinicId = nearestClinicId;
                //console.log(`Auto-assigned user to clinic ID ${clinicId} based on postal code ${postalCode}`);
            } else {
                // Fallback to the original method if the new method finds no clinic
                // Load the postal code mapping
                const singaporePostalMapping = require('../utils/singapore_postal_mapping_full.json');
                const postalPrefix = postalCode.substring(0, 2);
                
                if (singaporePostalMapping[postalPrefix]) {
                    // Find a clinic with matching postal code prefix
                    const [prefixClinics] = await connection.execute(
                        "SELECT clinicId FROM clinics WHERE SUBSTRING(postalCode, 1, 2) = ? LIMIT 1",
                        [postalPrefix]
                    );
                    
                    if (prefixClinics.length > 0) {
                        clinicId = prefixClinics[0].clinicId;
                        //console.log(`Fallback assignment: assigned user to clinic ID ${clinicId} based on postal prefix ${postalPrefix}`);
                    }
                }
            }
        } catch (err) {
            console.error("Error assigning clinic by postal code:", err);
            // Continue with user creation, but with null clinicId
        }
    
        const q = "INSERT INTO user (name, email, password, role, birthday, gender, department, clinicId, assignedTask, baseSalary, postalCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        //generate salt and hash password 
        const salt = await bcrypt.genSalt(10);

        const hashed = await bcrypt.hash(password, salt);

        const data = [
            name, email, hashed, role, birthday, gender, department, clinicId, assignedTask, baseSalary || null, postalCode || null
        ];

        //command .execute is used over .query because we are handling async functions 
        connection.execute(q, data);

        return res.status(200).json({
            message: "User created successfully",
            clinicAssigned: clinicId !== null,
            clinicId: clinicId
        });

    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally { //release the connection to avoid infinite wait times 
        if (connection) connection.release();
    }
}

const updateUser = async (req, res) => {

    let email, data;

    if (req.body.data) {
        email = req.body.email;
        data = req.body.data;
    } else {
        email = req.body.email;
        // extract all fields except email
        data = { ...req.body };
        delete data.email;
    }

    //check if any of the fields are empty or if no data is being changed 
    if (!email) {
        return res.status(400).json({error: "Email is required"});
    }
    
    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({error: "No data provided for update"});
    }

    // process birthday field if present
    if (data.birthday) {
        try {
            // check if it's a valid date
            const dateObj = new Date(data.birthday);
            if (isNaN(dateObj.getTime())) {
                return res.status(400).json({error: "Invalid birthday format. Use YYYY-MM-DD format"});
            }
            // convert to MySQL date format (YYYY-MM-DD)
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            data.birthday = `${yyyy}-${mm}-${dd}`;
        } catch (e) {
            console.error('Error processing birthday:', e);
            return res.status(400).json({error: "Invalid birthday format. Use YYYY-MM-DD format"});
        }
    }

    let connection; 

    try{
        connection = await db.getConnection();

        //check if password is being changed 
        if(data.password) { //if its being changed hash the password 
            const salt = await bcrypt.genSalt(10);
            data.password = await bcrypt.hash(data.password, salt);
        }

        // If postalCode is being updated, find the nearest clinic and update clinicId
        if (data.postalCode) {
            const newPostalCode = data.postalCode;
            // Get all clinics
            const [clinics] = await connection.execute("SELECT clinicId, postalCode FROM clinics WHERE postalCode IS NOT NULL AND postalCode != ''");
            let minDistance = Infinity;
            let nearestClinicId = null;
            clinics.forEach(clinic => {
                if (clinic.postalCode && clinic.postalCode.length >= 6 && newPostalCode.length >= 6) {
                    // Use absolute difference as proxy for distance
                    const dist = Math.abs(parseInt(clinic.postalCode) - parseInt(newPostalCode));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestClinicId = clinic.clinicId;
                    }
                }
            });
            if (nearestClinicId) {
                data.clinicId = nearestClinicId;
            }
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
        res.status(200).json({ message: "User updated successfully. Clinic auto-assigned based on postal code." });
    }catch(err) {
        console.error(err);
        res.status(500).json({error: "Internal Server Error"});
    }finally {
        if(connection) connection.release();
    }
}

const getMe = async (req, res) => {
    try {
        // get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        const token = authHeader.split(' ')[1];

        // verify the token
        const { _id } = jwt.verify(token, process.env.SECRET);

        // get user info from database
        const connection = await db.getConnection();
        const [users] = await connection.execute(
            "SELECT userId, name, email, role, department, birthday, gender, baseSalary, clinicId FROM user WHERE userId = ?",
            [_id]
        );
        connection.release();

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // return user data (ensuring baseSalary and clinicId are included)
        const userData = users[0];
        
        // Log the data being returned (for debugging)
        //console.log('User data being returned:', userData);
        
        res.status(200).json(userData);
    } catch (error) {
        console.error('Error getting user info:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete user function
const deleteUser = async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Check if user exists
        const [userCheck] = await connection.execute(
            "SELECT * FROM user WHERE userId = ?",
            [userId]
        );

        if (userCheck.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete user
        const [result] = await connection.execute(
            "DELETE FROM user WHERE userId = ?",
            [userId]
        );

        return res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

const updateUserBaseSalary = async (req, res) => {
    const { userId, baseSalary } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    if (baseSalary === undefined || baseSalary === '') {
        return res.status(400).json({ error: "Base salary is required" });
    }

    let connection;
    try {
        connection = await db.getConnection();

        // Check if user exists
        const [userCheck] = await connection.execute(
            "SELECT * FROM user WHERE userId = ?",
            [userId]
        );

        if (userCheck.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Update user's base salary
        const [result] = await connection.execute(
            "UPDATE user SET baseSalary = ? WHERE userId = ?",
            [baseSalary, userId]
        );

        // Log the update for debugging
        //console.log(`Updated user ${userId} base salary to ${baseSalary}. Affected rows: ${result.affectedRows}`);

        return res.status(200).json({ 
            message: "Base salary updated successfully",
            baseSalary: baseSalary
        });
    } catch (err) {
        console.error("Error updating base salary:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};
// Automatically assign employees to clinics
// System automatically assigns employees to the nearest clinic based on employee and clinic postal codes 
// (need to add postalCode field to user and clinic tables, varchar(6) for 6-digit postal code)
const assignUser = async (req, res) => {

    // Get clinic information
    let connection;
    try {
        connection = await db.getConnection();

        // Get list of clinics
        const [clinics] = await connection.execute(`
            SELECT clinicId, clinicName, location, email, phone, description, postalCode 
            FROM clinics`
        );

        for (const clinic of clinics) {
            // Get the first two digits of postalCode
            const clinicPostalCode = clinic.postalCode.substring(0, 2);
            // Load utils/singapore_postal_mapping_full.json file to get values where key equals clinicPostalCode
            const singaporePostalMapping = require('../utils/singapore_postal_mapping_full.json');
            const clinicPostalCodes = singaporePostalMapping[clinicPostalCode];
            if (!clinicPostalCodes || clinicPostalCodes.length === 0) {
                continue; // Skip clinics without matching cities
            }
            // clinicCity is in array format like [ '01', '04', '06', '07' ]
            // Find employees whose postalCode starts with values in clinicCity
            // Build dynamic LIKE conditions
            const likeConditions = clinicPostalCodes.map(code => `postalCode LIKE '${code}%'`).join(' OR ');

            const [users] = await connection.execute(`SELECT userId, name, email, role, department, birthday, gender, baseSalary, postalCode
                                FROM user
                                WHERE clinicId IS NULL AND ${likeConditions}`);

            for (const user of users) {
                const [result] = await connection.execute(
                    "UPDATE user SET clinicId = ? WHERE userId = ?",
                    [clinic.clinicId, user.userId]
                );
                //console.log(`Updated user ${user.userId} clinicId to ${clinic.clinicId}. Affected rows: ${result.affectedRows}`);
            }

        }
        return res.status(200).json({message: 'Assigned successfully'});
    } catch (err) {
        console.error(err);
        return res.status(500).json({message: 'Internal server error'});
    } finally {
        if (connection) connection.release();
    }
    return res.status(200).json({message: 'Assigned successfully'});
};

module.exports = {
    loginUser,
    getUsers,
    getUser,
    createUser,
    updateUser,
    getMe,
    deleteUser,
    updateUserBaseSalary,
    assignUser
}