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
        return;
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
        "DELETE FROM pendingShift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ?",
        [clinicId, startOfMonth, endOfMonth]
    );
    console.log('Previous shift records deleted');

    function getDayAbbreviation(date) {
        const dayMap = ['SN', 'M', 'T', 'W', 'TH', 'F', 'S']; // Sunday = 0
        return dayMap[date.getDay()];
    }

    // 2. Get all employees of the clinic
    const [employees] = await connection.execute(
        "SELECT userId, department FROM user WHERE clinicId = ? AND department IN ('Doctor', 'Nurse', 'Receptionist')",
        [clinicId]
    );

    const [availabilities] = await connection.execute(
            "SELECT employeeId, preferredDates, preferredShiftTimes FROM availability WHERE status = 'Approved'"
        );
        const employeeAvailability = {};
        for (const row of availabilities) {
            const days = row.preferredDates.split(',').map(d => d.trim().toUpperCase());
            if (!employeeAvailability[row.employeeId]) {
                employeeAvailability[row.employeeId] = {
                    days: new Set(days),
                    shiftTime: row.preferredShiftTimes || null
                };
            } else {
                // If employee has multiple availability entries, merge them
                days.forEach(day => employeeAvailability[row.employeeId].days.add(day));
                // Use the most recent shift time preference if available
                if (row.preferredShiftTimes) {
                    employeeAvailability[row.employeeId].shiftTime = row.preferredShiftTimes;
                }
            }
        }

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
        "SELECT employeeId, COUNT(*) as shiftCount FROM pendingShift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ? GROUP BY employeeId",
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

    // Define shift times
    const shiftTimes = [
        { id: '9am-5pm', startTime: '09:00:00', endTime: '17:00:00' },
        { id: '5pm-1am', startTime: '17:00:00', endTime: '01:00:00' }
    ];

    // 6. Generate shifts for each day of the month
    for (let d = startOfMonth; d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const currentDt = new Date(parseTime(new Date(d)));
        const dayAbbreviation = getDayAbbreviation(currentDt);
        const dailyAssigned = {};
        // Create shifts for each shift time (9am-5pm and 5pm-1am)
        for (const shiftTime of shiftTimes) {
            const shift = {
                shiftDate: currentDt,
                startDate: shiftTime.startTime,
                endDate: shiftTime.endTime,
                shiftTimeId: shiftTime.id,
                clinicId: clinicId,
                employees: []
            };
            for (const role of roles) {
                const eligibleEmployees = categorizedEmployees[role];
                let selectedEmployees = [];
                
                const sortedEligible = eligibleEmployees
                .filter(empId => !dailyAssigned[`${empId}_${currentDt.toISOString().split('T')[0]}`]) //make sure employees are not already assigned today
                .sort((emp1, emp2) => {
                    const emp1Pref = employeeAvailability[emp1] || {};
                    const emp2Pref = employeeAvailability[emp2] || {};
                    //give employees a score based on preferences, 
                    const emp1Score = ((emp1Pref.days?.has(dayAbbreviation) ? 1 : 0) + 
                                (emp1Pref.shiftTime === shiftTime.id ? 1 : 0));
                    const emp2Score = ((emp2Pref.days?.has(dayAbbreviation) ? 1 : 0) + 
                                (emp2Pref.shiftTime === shiftTime.id ? 1 : 0));
                    //sort by the score then number of shifts already assigned to the employee
                    if (emp2Score !== emp1Score) return emp2Score - emp1Score;
                    return (shiftCounts[emp1] || 0) - (shiftCounts[emp2] || 0);
                });

                selectedEmployees = [];
                for (const empId of sortedEligible) {
                    const maxReached = (shiftCounts[empId] || 0) >= 22;
                    const empDateKey = `${empId}_${currentDt.toISOString().split('T')[0]}`;
                    
                    const empAvailability = employeeAvailability[empId] || { days: new Set(['SN', 'M', 'T', 'W', 'TH', 'F', 'S']) }; //Default of all days if no given availability
                    
                    // Check if this day is in the employee's preferred days
                    const isPreferredDay = empAvailability.days.has(dayAbbreviation);
                    
                    // If the employee has availability but it's not a preferred day, skip
                    if (!isPreferredDay) continue;
                    // Check if employee has a preferred shift time and if it matches this shift
                    if (empAvailability.shiftTime && empAvailability.shiftTime !== shiftTime.id) continue;
                    
                    //If max shift reached or already assigned that day, skip
                    if (maxReached || dailyAssigned[empDateKey]) continue;
                    
                    //Assign employee
                    selectedEmployees.push(empId);
                    shiftCounts[empId] = (shiftCounts[empId] || 0) + 1;
                    dailyAssigned[empDateKey] = true;
                    
                    if (selectedEmployees.length >= roleCounts[role]) break;
                }
                shift.employees.push(...selectedEmployees);
            }
            shifts.push(shift);
        }
    }

    // 7. Insert shift data into the database
    for (const shift of shifts) {
        const { shiftDate, startDate, endDate, shiftTimeId, clinicId, employees } = shift;
        for (const employeeId of employees) {
            try{
                await connection.execute(
                    "INSERT INTO pendingShift (employeeId, shiftDate, startDate, endDate, title, status, clinicId) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [employeeId, parseTime(shiftDate), startDate, endDate, `${shiftTimeId} shift for ${employeeId}`, 'Pending', clinicId]
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
