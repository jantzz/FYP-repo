const db = require('../database/db');

const createClinic = async (req, res) => {
    const { name, address, postalCode, email, phone } = req.body;

    const description = req.body.description ? req.body.description : null;

    if( !name || !address || !postalCode || !email || !phone) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    let connection;

    try { 

        connection = await db.getConnection();

        const q = "INSERT INTO clinics (clinicName, location, postalCode, email, phone, description) VALUES (?, ?, ?, ?, ?, ?)";
        const values = [name, address, postalCode, email, phone, description];

        const [result] = await connection.execute(q, values);
        const newClinicId = result.insertId;

        // After creating the clinic, check all employees for reassignment
        // Get all employees
        const [employees] = await connection.execute("SELECT userId, postalCode, clinicId FROM user WHERE postalCode IS NOT NULL AND postalCode != ''");
        // Get all clinics (including the new one)
        const [allClinics] = await connection.execute("SELECT clinicId, postalCode FROM clinics WHERE postalCode IS NOT NULL AND postalCode != ''");
        for (const employee of employees) {
            let minDistance = Infinity;
            let nearestClinicId = null;
            for (const clinic of allClinics) {
                if (clinic.postalCode && employee.postalCode && clinic.postalCode.length >= 6 && employee.postalCode.length >= 6) {
                    const dist = Math.abs(parseInt(clinic.postalCode) - parseInt(employee.postalCode));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestClinicId = clinic.clinicId;
                    }
                }
            }
            // If the nearest clinic is the new one and it's different from current, update
            if (nearestClinicId === newClinicId && employee.clinicId !== newClinicId) {
                await connection.execute(
                    "UPDATE user SET clinicId = ? WHERE userId = ?",
                    [newClinicId, employee.userId]
                );
            }
        }

        return res.status(201).json({ message: 'Clinic created successfully. Employees reassigned if this is their nearest clinic.' });

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
            SELECT clinicId, clinicName, location, postalCode, email, phone, description 
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
    const { clinicId, name, address, postalCode, email, phone, description } = req.body;

    if (!clinicId || !name || !address || !postalCode || !email || !phone) {
        return res.status(400).json({ message: 'Please fill all required fields' });
    }

    let connection;

    try {
        connection = await db.getConnection();

        const q = "UPDATE clinics SET clinicName = ?, location = ?, postalCode = ?, email = ?, phone = ?, description = ? WHERE clinicId = ?";
        const values = [name, address, postalCode, email, phone, description || null, clinicId];

        const [result] = await connection.execute(q, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        // After updating the clinic, check all employees for reassignment
        // Get all employees
        const [employees] = await connection.execute("SELECT userId, postalCode, clinicId FROM user WHERE postalCode IS NOT NULL AND postalCode != ''");
        // Get all clinics (with updated postal codes)
        const [allClinics] = await connection.execute("SELECT clinicId, postalCode FROM clinics WHERE postalCode IS NOT NULL AND postalCode != ''");
        for (const employee of employees) {
            let minDistance = Infinity;
            let nearestClinicId = null;
            for (const clinic of allClinics) {
                if (clinic.postalCode && employee.postalCode && clinic.postalCode.length >= 6 && employee.postalCode.length >= 6) {
                    const dist = Math.abs(parseInt(clinic.postalCode) - parseInt(employee.postalCode));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestClinicId = clinic.clinicId;
                    }
                }
            }
            // If the nearest clinic is different from current, update
            if (nearestClinicId && employee.clinicId !== nearestClinicId) {
                await connection.execute(
                    "UPDATE user SET clinicId = ? WHERE userId = ?",
                    [nearestClinicId, employee.userId]
                );
            }
        }

        return res.status(200).json({ message: 'Clinic updated successfully. Employees reassigned to their nearest clinic if needed.' });

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

        // Get all employees assigned to this clinic
        const [employees] = await connection.execute(
            "SELECT userId, postalCode FROM user WHERE clinicId = ?",
            [id]
        );

        // Get all other clinics (excluding the one being deleted)
        const [otherClinics] = await connection.execute(
            "SELECT clinicId, postalCode FROM clinics WHERE clinicId != ? AND postalCode IS NOT NULL AND postalCode != ''",
            [id]
        );

        // For each employee, find the nearest clinic and update their clinicId
        for (const employee of employees) {
            let minDistance = Infinity;
            let nearestClinicId = null;
            for (const clinic of otherClinics) {
                if (clinic.postalCode && employee.postalCode && clinic.postalCode.length >= 6 && employee.postalCode.length >= 6) {
                    const dist = Math.abs(parseInt(clinic.postalCode) - parseInt(employee.postalCode));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestClinicId = clinic.clinicId;
                    }
                }
            }
            if (nearestClinicId) {
                await connection.execute(
                    "UPDATE user SET clinicId = ? WHERE userId = ?",
                    [nearestClinicId, employee.userId]
                );
            }
        }

        // Now delete the clinic
        const [result] = await connection.execute(
            "DELETE FROM clinics WHERE clinicId = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        return res.status(200).json({ message: 'Clinic deleted successfully. Employees were reassigned to the nearest clinic.' });

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