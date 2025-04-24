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

        const [clinics] = await connection.execute("SELECT * FROM clinics");

        return res.status(200).json(clinics);

    } catch(err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection)  connection.release();
    }
}

module.exports = {getClinics, createClinic};