const db = require('../database/db');

// Get all departments with additional info like manager name and employee count
const getDepartments = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Get all departments first
        const [departments] = await connection.execute(
            "SELECT * FROM department ORDER BY departmentName"
        );
        
        // For each department, count employees separately
        const transformedDepartments = await Promise.all(departments.map(async dept => {
            // Count employees for this department
            const [employeeResult] = await connection.execute(
                "SELECT COUNT(*) as count FROM user WHERE department = ?",
                [dept.departmentName]
            );
            
            const employeeCount = employeeResult[0]?.count || 0;
            
            return {
                name: dept.departmentName,
                description: dept.description || '',
                managerName: 'Not Assigned', // Default value
                employeeCount: employeeCount
            };
        }));
        
        return res.status(200).json(transformedDepartments);
    } catch (err) {
        console.error('Error fetching departments:', err);
        return res.status(500).json({ error: "Internal Server Error: " + err.message });
    } finally {
        if (connection) connection.release();
    }
};

// Get all departments
const getAllDepartments = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        const [departments] = await connection.execute(
            "SELECT * FROM department ORDER BY departmentName"
        );
        
        return res.status(200).json(departments);
    } catch (err) {
        console.error('Error fetching departments:', err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Get department by name
const getDepartmentByName = async (req, res) => {
    const { departmentName } = req.params;
    
    if (!departmentName) {
        return res.status(400).json({ error: "Department name is required" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        const [departments] = await connection.execute(
            "SELECT * FROM department WHERE departmentName = ?",
            [departmentName]
        );
        
        if (departments.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }
        
        return res.status(200).json(departments[0]);
    } catch (err) {
        console.error('Error fetching department:', err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Create a new department
const createDepartment = async (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: "Department name is required" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if department already exists
        const [existingDepartments] = await connection.execute(
            "SELECT * FROM department WHERE departmentName = ?",
            [name]
        );
        
        if (existingDepartments.length > 0) {
            return res.status(400).json({ error: "Department already exists" });
        }
        
        // Create new department
        await connection.execute(
            "INSERT INTO department (departmentName, description, shifting) VALUES (?, ?, ?)",
            [name, description || null, true]
        );
        
        return res.status(201).json({
            message: "Department created successfully",
            department: {
                name: name,
                description
            }
        });
    } catch (err) {
        console.error('Error creating department:', err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Update department
const updateDepartment = async (req, res) => {
    const { originalName, name, description } = req.body;
    
    if (!originalName) {
        return res.status(400).json({ error: "Original department name is required" });
    }
    
    if (!name) {
        return res.status(400).json({ error: "New department name is required" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if department exists
        const [existingDepartments] = await connection.execute(
            "SELECT * FROM department WHERE departmentName = ?",
            [originalName]
        );
        
        if (existingDepartments.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }
        
        // If changing the name, check that new name doesn't already exist
        if (name !== originalName) {
            const [existingNewName] = await connection.execute(
                "SELECT * FROM department WHERE departmentName = ?",
                [name]
            );
            
            if (existingNewName.length > 0) {
                return res.status(400).json({ error: "Department with new name already exists" });
            }
        }
        
        // Start a transaction
        await connection.beginTransaction();
        
        // Update the department
        await connection.execute(
            "UPDATE department SET departmentName = ?, description = ? WHERE departmentName = ?",
            [name, description || null, originalName]
        );
        
        // Update all users who were in the old department
        await connection.execute(
            "UPDATE user SET department = ? WHERE department = ?",
            [name, originalName]
        );
        
        // Commit the transaction
        await connection.commit();
        
        return res.status(200).json({
            message: "Department updated successfully",
            department: {
                name: name,
                description
            }
        });
    } catch (err) {
        // Rollback in case of error
        if (connection) {
            await connection.rollback();
        }
        
        console.error('Error updating department:', err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

// Delete department
const deleteDepartment = async (req, res) => {
    const { name } = req.params;
    
    if (!name) {
        return res.status(400).json({ error: "Department name is required" });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // Check if department exists
        const [existingDepartments] = await connection.execute(
            "SELECT * FROM department WHERE departmentName = ?",
            [name]
        );
        
        if (existingDepartments.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }
        
        // Check if department is in use
        const [employees] = await connection.execute(
            "SELECT COUNT(*) as count FROM user WHERE department = ?",
            [name]
        );
        
        if (employees[0].count > 0) {
            return res.status(400).json({ 
                error: "Cannot delete department that has employees assigned to it" 
            });
        }
        
        // Delete department
        await connection.execute(
            "DELETE FROM department WHERE departmentName = ?",
            [name]
        );
        
        return res.status(200).json({
            message: "Department deleted successfully"
        });
    } catch (err) {
        console.error('Error deleting department:', err);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getDepartments,
    getAllDepartments,
    getDepartmentByName,
    createDepartment,
    updateDepartment,
    deleteDepartment
};