const schedule = require('node-schedule');
const { getLastMondayOfMonth, parseTime } = require('../utils/dateUtils');
const db = require('../database/db');


const job = new schedule.Job('monthlyShift', async function() {
    const lastMondayDate = getLastMondayOfMonth();
    console.log('本月最后一个周一：', getLastMondayOfMonth());

    const today = new Date();
    if (today.getFullYear() !== lastMondayDate.getFullYear() ||
        today.getMonth()+1 !== lastMondayDate.getMonth()+1 ||
        today.getDate() !== lastMondayDate.getDate()) {
        console.log(`今日 ${today.toISOString()} 非最后一个周一 ${lastMondayDate.toISOString()}`);
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
            console.log('诊所列表为空');
            return;
        }

         for (const clinic of clinics) {
             await generateShift(connection, clinic.clinicId);
         }
        // await generateShift(connection, 1);
    } catch (err) {
        console.error('定时任务执行失败:', err);
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

    console.log('开始生成排班：', parseTime(startOfMonth), parseTime(endOfMonth));
    await connection.execute(
        "DELETE FROM pendingshift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ?",
        [clinicId, startOfMonth, endOfMonth]
    );
    console.log('已删除之前的排班记录');

    // 2. 获取该诊所的所有员工
    const [employees] = await connection.execute(
        "SELECT userId, department FROM user WHERE clinicId = ? AND department IN ('Doctor', 'Nurse', 'Receptionist')",
        [clinicId]
    );
    // 3. 根据角色分类员工
    // 修改后的分类逻辑
    const categorizedEmployees = employees.reduce((acc, employee) => {
        // 确保每个角色都有初始数组
        ['Doctor', 'Nurse', 'Receptionist'].forEach(role => {
            if (!acc[role]) acc[role] = [];
        });
        // 如果员工角色不在预定义列表中，跳过
        if (acc[employee.department]) {
            acc[employee.department].push(employee.userId);
        }
        return acc;
    }, {});

    // 4. 检查每个员工本月已排班次数
    const [existingShifts] = await connection.execute(
        "SELECT employeeId, COUNT(*) as shiftCount FROM pendingshift WHERE clinicId = ? AND shiftDate >= ? AND shiftDate <= ? GROUP BY employeeId",
        [clinicId, startOfMonth, endOfMonth]
    );

    const shiftCounts = existingShifts.reduce((acc, { employeeId, shiftCount }) => {
        acc[employeeId] = shiftCount;
        return acc;
    }, {});

    // 5. 初始化排班数组
    const shifts = [];
    const roles = ['Nurse', 'Doctor', 'Receptionist'];
    const roleCounts = { 'Nurse': 2, 'Doctor': 2, 'Receptionist': 1 };

    // 6. 生成每月每天的排班
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
                // 更新已排班次数
                selectedEmployees.forEach(employeeId => {
                    shiftCounts[employeeId] = (shiftCounts[employeeId] || 0) + 1;
                });
            }
            shifts.push(shift);
        }
    }
    // 7. 插入排班数据到数据库
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
    console.log('排班生成完成');
}

job.schedule({
    rule: '0 0 0 * * *',
    tz: 'Asia/Shanghai' // 设置为中国时区
});
// 立即触发一次执行任务
job.invoke();

module.exports = job;
