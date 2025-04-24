const db = require('../database/db');

const createClinic = async (req, res) => {
    const { name, address, email, phone } = req.body;

    const description = req.body.description ? req.body.description : null;

    if( !name || !address || !email || !phone) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    let connection;

    try { 

        connection = await db.getConnection();

        const q = "INSERT INTO clinics (clinicName, location, email, phone, description) VALUES (?, ?, ?, ?, ?)";
        const values = [name, address, email, phone, description];

        await connection.execute(q, values);

        return res.status(201).json({ message: 'Clinic created successfully' });

    } catch(err){
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    } finally{
        if (connection)  connection.release();
    }
}

const getClinics = async (req, res) => {
    let connection; 

    try {
        connection = await db.getConnection();

        // Use DISTINCT, GROUP BY, and ORDER BY to prevent duplicates and sort results
        const [clinics] = await connection.execute(`
            SELECT clinicId, clinicName, location, email, phone, description 
            FROM clinics 
            GROUP BY clinicId 
            ORDER BY clinicName`
        );

        return res.status(200).json(clinics);

    } catch(err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection)  connection.release();
    }
}

const updateClinic = async (req, res) => {
    const { clinicId, name, address, email, phone, description } = req.body;

    if (!clinicId || !name || !address || !email || !phone) {
        return res.status(400).json({ message: 'Please fill all required fields' });
    }

    let connection;

    try {
        connection = await db.getConnection();

        const q = "UPDATE clinics SET clinicName = ?, location = ?, email = ?, phone = ?, description = ? WHERE clinicId = ?";
        const values = [name, address, email, phone, description || null, clinicId];

        const [result] = await connection.execute(q, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        return res.status(200).json({ message: 'Clinic updated successfully' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) connection.release();
    }
}

const deleteClinic = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Clinic ID is required' });
    }

    let connection;

    try {
        connection = await db.getConnection();

        // Check if this clinic is associated with any users
        const [userCheck] = await connection.execute(
            "SELECT COUNT(*) as userCount FROM user WHERE clinicId = ?",
            [id]
        );

        if (userCheck[0].userCount > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete this clinic because it is associated with existing users. Please reassign these users to another clinic first.'
            });
        }

        const [result] = await connection.execute(
            "DELETE FROM clinics WHERE clinicId = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        return res.status(200).json({ message: 'Clinic deleted successfully' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    getClinics, 
    createClinic,
    updateClinic,
    deleteClinic
};