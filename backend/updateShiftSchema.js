/**
 * This script adds a shiftDate column to shift and pendingShift tables
 * and sets it based on the startDate value for existing records.
 */

const db = require('./database/db');

async function updateShiftSchema() {
  let connection;
  
  try {
    connection = await db.getConnection();
    console.log('Connected to database, checking tables...');

    // Check if shiftDate column already exists in shift table
    const [shiftColumns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'shift' AND COLUMN_NAME = 'shiftDate'
    `);
    
    // Check if shiftDate column already exists in pendingShift table
    const [pendingShiftColumns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'pendingShift' AND COLUMN_NAME = 'shiftDate'
    `);
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Add shiftDate column to shift table if it doesn't exist
      if (shiftColumns.length === 0) {
        console.log('Adding shiftDate column to shift table...');
        await connection.execute(`
          ALTER TABLE shift ADD COLUMN shiftDate DATE AFTER employeeId
        `);
        
        // Update existing records to set shiftDate = startDate
        console.log('Updating existing shift records...');
        await connection.execute(`
          UPDATE shift SET shiftDate = startDate WHERE shiftDate IS NULL
        `);
      } else {
        console.log('shiftDate column already exists in shift table');
      }
      
      // Add shiftDate column to pendingShift table if it doesn't exist
      if (pendingShiftColumns.length === 0) {
        console.log('Adding shiftDate column to pendingShift table...');
        await connection.execute(`
          ALTER TABLE pendingShift ADD COLUMN shiftDate DATE AFTER employeeId
        `);
        
        // Update existing records to set shiftDate = startDate
        console.log('Updating existing pendingShift records...');
        await connection.execute(`
          UPDATE pendingShift SET shiftDate = startDate WHERE shiftDate IS NULL
        `);
      } else {
        console.log('shiftDate column already exists in pendingShift table');
      }
      
      // Commit transaction
      await connection.commit();
      console.log('Schema update completed successfully!');
      
    } catch (error) {
      // Rollback in case of error
      await connection.rollback();
      console.error('Error during schema update:', error);
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

// Run the function
updateShiftSchema(); 