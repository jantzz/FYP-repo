const schedule = require('node-schedule');
const { getLastMondayOfMonth, parseTime } = require('../utils/dateUtils');
const db = require('../database/db');


const job = new schedule.Job('monthlyShift', async function() {
    const lastMondayDate = getLastMondayOfMonth();
    console.log('Last Monday of the month:', getLastMondayOfMonth());

    const today = new Date();
    if (today.getFullYear() !== lastMondayDate.getFullYear() ||
        today.getMonth()+1 !== lastMondayDate.getMonth()+1 ||
        today.getDate() !== lastMondayDate.getDate()) {
        console.log(`Today ${today.toISOString()} is not the last Monday of the month ${lastMondayDate.toISOString()}`);
        // return;
    }

    let connection;
    try {
        connection = await db.getConnection();
        // Validate that we have departments that can have shifts
        const [deps] = await connection.execute("SELECT departmentName FROM department WHERE shifting = 1");
        if (!deps.length) {
            console.log('No departments are configured for shift generation.');
            return;
        }
        // 诊所列表
        const [clinics] = await connection.execute("SELECT clinicId FROM clinics");
        if (!clinics.length) {
            console.log('Clinic list is empty');
            return;
        }

         for (const clinic of clinics) {
             await generateShift(connection, clinic.clinicId);
         }
        // await generateShift(connection, 1);
    } catch (err) {
        console.error('Task execution failed:', err);
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

async function generateShift(connection, clinicId) {
    // 1. 获取当前日期
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);

    console.log('Start generating shifts:', parseTime(startOfMonth), parseTime(endOfMonth));
    await connection.execute(
        "DELETE FROM pendingshift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ?",
        [clinicId, startOfMonth, endOfMonth]
    );
    console.log('Previous shift records deleted');

    // 2. Get all employees of the clinic
    const [employees] = await connection.execute(
        "SELECT userId, department FROM user WHERE clinicId = ? AND department IN ('Doctor', 'Nurse', 'Receptionist')",
        [clinicId]
    );
    if (!employees.length) {
        console.log('No employees found for this clinic');
        return;
    }
    // 3. Categorize employees by role
    // Modified classification logic
    const categorizedEmployees = employees.reduce((acc, employee) => {
        // Ensure each role has an initial array
        ['Doctor', 'Nurse', 'Receptionist'].forEach(role => {
            if (!acc[role]) acc[role] = [];
        });
        // If the employee role is not in the predefined list, skip
        if (acc[employee.department]) {
            acc[employee.department].push(employee.userId);
        }
        return acc;
    }, {});

    // 4. Check the number of shifts each employee has this month
    const [existingShifts] = await connection.execute(
        "SELECT employeeId, COUNT(*) as shiftCount FROM pendingshift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ? GROUP BY employeeId",
        [clinicId, startOfMonth, endOfMonth]
    );

    const shiftCounts = existingShifts.reduce((acc, { employeeId, shiftCount }) => {
        acc[employeeId] = shiftCount;
        return acc;
    }, {});

    // 5. Initialize the shift array
    const shifts = [];
    const roles = ['Nurse', 'Doctor', 'Receptionist'];
    const roleCounts = { 'Nurse': 2, 'Doctor': 2, 'Receptionist': 1 };

    // 6. Generate shifts for each day of the month
    for (let d = startOfMonth; d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const currentDt = new Date(parseTime(new Date(d)));
        for (let session = 0; session < 2; session++) { // 两个班次
            const shift = {
                shiftDate: currentDt,
                startDate: session === 0 ? '09:00:00' : '17:00:00',
                endDate: session === 0 ? '17:00:00' : '01:00:00',
                clinicId: clinicId,
                employees: []
            };
            for (const role of roles) {
                const eligibleEmployees = categorizedEmployees[role];
                let selectedEmployees = [];
                if(eligibleEmployees.length < shifts.length*roleCounts[role]-1+roleCounts[role])eligibleEmployees.push(...eligibleEmployees);
                if(shifts.length === 0){
                    selectedEmployees = eligibleEmployees.slice(0, roleCounts[role]);
                }else{
                    selectedEmployees = eligibleEmployees.slice(shifts.length*roleCounts[role]-1, shifts.length*roleCounts[role]-1+roleCounts[role]);
                }
                shift.employees.push(...selectedEmployees);
                // Update the number of shifts
                selectedEmployees.forEach(employeeId => {
                    shiftCounts[employeeId] = (shiftCounts[employeeId] || 0) + 1;
                });
            }
            shifts.push(shift);
        }
    }
    // 7. Insert shift data into the database
    for (const shift of shifts) {
        const { shiftDate, startDate, endDate, clinicId, employees } = shift;
        for (const employeeId of employees) {
            try{
                await connection.execute(
                    "INSERT INTO pendingshift ( employeeId, shiftDate, startDate, endDate, title, status, clinicId) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [ employeeId, parseTime(shiftDate), startDate, endDate,`Generated shift for ${employeeId}`, 'Pending', clinicId]
                );
            }catch (err){
                console.log(err);
            }

        }
    }
    console.log('Shift generation completed');
}

job.schedule({
    rule: '0 0 0 * * *',
    tz: 'Asia/Shanghai' // Set to Chinese timezone
});
// Trigger the task immediately
job.invoke();

module.exports = job;
