// Attendance functionality
// Store chart instances so they can be destroyed before recreating
const attendanceChartInstances = {
    attendanceHistoryChart: null,
    punctualityChart: null
};

// API Base URL
const API_BASE_URL = 'http://localhost:8800/api';

// Current user info
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (!document.querySelector('.sidebar')) return;

    // Get the current user from session storage or mock data
    getCurrentUser().then(user => {
        currentUser = user;
        
        // Set up the clock
        startClock();
        
        // Initialize the attendance system
        initializeAttendance();
    });

    // Add event listener to the Attendance Rate nav item
    const attendanceNavItem = findElementByText('.sidebar .nav-item', 'Attendance Rate');
    
    if (attendanceNavItem) {
        console.log('Found Attendance Rate nav item, adding click listener');
        attendanceNavItem.addEventListener('click', function() {
            console.log('Attendance Rate nav item clicked');
            showAttendanceSection();
        });
    } else {
        console.error('Attendance Rate nav item not found');
    }

    // Set up period filter change event
    const periodFilter = document.getElementById('attendance-period-filter');
    if (periodFilter) {
        periodFilter.addEventListener('change', function() {
            const selectedPeriod = this.value;
            console.log('Period filter changed to:', selectedPeriod);
            
            // Update attendance data for charts and stats
            updateAttendanceData(selectedPeriod);
            
            // Also reload attendance records with the new period
            loadAttendanceRecords();
        });
    }

    // Set up clock in/out buttons
    setupClockButtons();
});

// Function to get the current user (simulated, would use session/JWT in production)
async function getCurrentUser() {
    // This function gets the current user from the backend API
    try {
        // Get the token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No authentication token found. Please log in.');
            return null;
        }
        
        // Make the request with the Authorization header
        const response = await fetch(`${API_BASE_URL}/user/current`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            console.error('Authentication failed. Status:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }
}

// Setup digital clock and current date
function startClock() {
    const digitalClock = document.getElementById('digital-clock');
    const currentDateDisplay = document.getElementById('current-date');
    
    if (!digitalClock || !currentDateDisplay) return;
    
    function updateClock() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        
        digitalClock.textContent = `${hours}:${minutes}:${seconds}`;
        
        // Format date: Day, Month Date, Year
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateDisplay.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Update immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);
}

// Setup clock in/out buttons
function setupClockButtons() {
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const clockStatus = document.getElementById('clock-status');
    
    if (!clockInBtn || !clockOutBtn) return;
    
    // Check if user has already clocked in/out today and update button states
    checkClockStatus();
    
    // Set up click handlers
    clockInBtn.addEventListener('click', async function() {
        if (!currentUser) {
            showStatusMessage(clockStatus, 'Please log in to clock in.', 'error');
            return;
        }
        
        try {
            // First, get the user's active shift for today
            const todayShift = await getTodayShift(currentUser.userId);
            
            if (!todayShift) {
                showStatusMessage(clockStatus, 'No active shift found for today.', 'error');
                return;
            }
            
            // Send clock in request to the API
            const response = await fetch(`${API_BASE_URL}/attendance/clock-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    employeeId: currentUser.userId,
                    shiftId: todayShift.shiftId
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showStatusMessage(clockStatus, 'Successfully clocked in!', 'success');
                clockInBtn.disabled = true;
                clockOutBtn.disabled = false;
                
                // Refresh the attendance records
                loadAttendanceRecords();
            } else {
                showStatusMessage(clockStatus, data.error || 'Error clocking in.', 'error');
            }
        } catch (error) {
            console.error('Error clocking in:', error);
            showStatusMessage(clockStatus, 'System error. Please try again.', 'error');
        }
    });
    
    clockOutBtn.addEventListener('click', async function() {
        if (!currentUser) {
            showStatusMessage(clockStatus, 'Please log in to clock out.', 'error');
            return;
        }
        
        try {
            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            
            // Check if there's an existing attendance record
            const attendanceResponse = await fetch(`${API_BASE_URL}/attendance/employee/${currentUser.userId}?startDate=${today}&endDate=${today}`, {
                credentials: 'include'
            });
            
            if (attendanceResponse.ok) {
                const records = await attendanceResponse.json();
                
                // If we have an attendance record, use that for clocking out
                if (records.length > 0 && records[0].clockInTime && !records[0].clockOutTime) {
                    console.log('Found active attendance record:', records[0]);
                    
                    // Send clock out request to the API using the existing attendance record
                    const response = await fetch(`${API_BASE_URL}/attendance/clock-out`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            employeeId: currentUser.userId,
                            attendanceId: records[0].attendanceId
                        }),
                        credentials: 'include'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showStatusMessage(clockStatus, 'Successfully clocked out!', 'success');
                        clockInBtn.disabled = true;
                        clockOutBtn.disabled = true;
                        
                        // Refresh the attendance records
                        loadAttendanceRecords();
                        return;
                    } else {
                        showStatusMessage(clockStatus, data.error || 'Error clocking out.', 'error');
                        return;
                    }
                }
            }
            
            // Fallback to using shift data if no attendance record found
            const todayShift = await getTodayShift(currentUser.userId);
            
            if (!todayShift) {
                showStatusMessage(clockStatus, 'No active shift found for today.', 'error');
                return;
            }
            
            // Send clock out request to the API
            const response = await fetch(`${API_BASE_URL}/attendance/clock-out`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    employeeId: currentUser.userId,
                    shiftId: todayShift.shiftId
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showStatusMessage(clockStatus, 'Successfully clocked out!', 'success');
                clockInBtn.disabled = true;
                clockOutBtn.disabled = true;
                
                // Refresh the attendance records
                loadAttendanceRecords();
            } else {
                showStatusMessage(clockStatus, data.error || 'Error clocking out.', 'error');
            }
        } catch (error) {
            console.error('Error clocking out:', error);
            showStatusMessage(clockStatus, 'System error. Please try again.', 'error');
        }
    });
}

// Check if user has already clocked in/out today
async function checkClockStatus() {
    if (!currentUser) return;
    
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const clockStatus = document.getElementById('clock-status');
    
    try {
        // First, get the user's active shift for today
        const todayShift = await getTodayShift(currentUser.userId);
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        console.log('Checking clock status for date:', today);
        
        // Check directly in attendance records even if no shift is found
        const response = await fetch(`${API_BASE_URL}/attendance/employee/${currentUser.userId}?startDate=${today}&endDate=${today}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const records = await response.json();
            console.log('Found attendance records for today:', records);
            
            if (records.length > 0) {
                const todayRecord = records[0];
                console.log('Today\'s attendance record:', todayRecord);
                
                if (todayRecord.clockInTime && todayRecord.clockOutTime) {
                    // Already clocked in and out
                    clockInBtn.disabled = true;
                    clockOutBtn.disabled = true;
                    showStatusMessage(clockStatus, 'You have completed your shift for today.', 'success');
                } else if (todayRecord.clockInTime) {
                    // Clocked in but not out - enable clock out
                    clockInBtn.disabled = true;
                    clockOutBtn.disabled = false;
                    showStatusMessage(clockStatus, 'You are currently clocked in. Don\'t forget to clock out!', 'info');
                } else {
                    // Record exists but no clock in (shouldn't happen)
                    clockInBtn.disabled = false;
                    clockOutBtn.disabled = true;
                }
                
                // We found a record, so we're done
                return;
            }
        }
        
        // If we reach here, there's no attendance record yet
        if (!todayShift) {
            clockInBtn.disabled = true;
            clockOutBtn.disabled = true;
            showStatusMessage(clockStatus, 'No shifts scheduled for today.', 'info');
            return;
        }
        
        // If there's a shift but no attendance record, they can clock in
        clockInBtn.disabled = false;
        clockOutBtn.disabled = true;
        showStatusMessage(clockStatus, 'You can clock in for your shift.', 'info');
        
    } catch (error) {
        console.error('Error checking clock status:', error);
        showStatusMessage(clockStatus, 'System error. Please try again.', 'error');
    }
}

// Get user's shift for today
async function getTodayShift(employeeId) {
    try {
        // Get today's date in local timezone YYYY-MM-DD format
        const today = new Date();
        const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayStr = localToday.toISOString().split('T')[0];
        
        console.log('Looking for shift on date (local timezone):', todayStr);
        
        // Get all shifts for the employee
        const response = await fetch(`${API_BASE_URL}/shift/${employeeId}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const shifts = await response.json();
            console.log('Shifts loaded for employee:', shifts.length);
            
            // Find a shift that matches today's date
            // This handles timezone properly by using local date comparison
            const todayShift = shifts.find(shift => {
                // Check shiftDate first if it exists
                if (shift.shiftDate) {
                    // Parse in local timezone to avoid UTC conversion issues
                    try {
                        // Get just the date part, ignoring time
                        const shiftDateParts = shift.shiftDate.split('T')[0].split('-');
                        if (shiftDateParts.length === 3) {
                            const shiftDateLocal = new Date(
                                parseInt(shiftDateParts[0]), 
                                parseInt(shiftDateParts[1]) - 1, // JS months are 0-indexed
                                parseInt(shiftDateParts[2])
                            );
                            const shiftDateStr = shiftDateLocal.toISOString().split('T')[0];
                            
                            console.log('Comparing shift by shiftDate:', {
                                shiftId: shift.shiftId,
                                shiftDate: shiftDateStr,
                                today: todayStr,
                                matches: (shiftDateStr === todayStr)
                            });
                            
                            if (shiftDateStr === todayStr) {
                                return true;
                            }
                        }
                    } catch (err) {
                        console.error('Error parsing shiftDate:', err);
                    }
                }
                
                // Extract just the date part from startDate and endDate
                // If startDate/endDate are just times (HH:MM:SS), assume they're for today
                if (shift.startDate && shift.startDate.includes(':') && !shift.startDate.includes('-') && !shift.startDate.includes('T')) {
                    // This is just a time like "09:00:00", so assume it's for today
                    console.log('Found time-only format for startDate, assuming today:', shift.shiftId);
                    return true;
                }
                
                // Try to parse full dates if available
                try {
                    let shiftStartDateStr = null;
                    let shiftEndDateStr = null;
                    
                    if (shift.startDate) {
                        if (shift.startDate.includes('T') || shift.startDate.includes('-')) {
                            // Get just the date part
                            const startDateParts = shift.startDate.split('T')[0].split('-');
                            if (startDateParts.length === 3) {
                                const startDateLocal = new Date(
                                    parseInt(startDateParts[0]), 
                                    parseInt(startDateParts[1]) - 1, // JS months are 0-indexed
                                    parseInt(startDateParts[2])
                                );
                                shiftStartDateStr = startDateLocal.toISOString().split('T')[0];
                            }
                        }
                    }
                    
                    if (shift.endDate) {
                        if (shift.endDate.includes('T') || shift.endDate.includes('-')) {
                            // Get just the date part
                            const endDateParts = shift.endDate.split('T')[0].split('-');
                            if (endDateParts.length === 3) {
                                const endDateLocal = new Date(
                                    parseInt(endDateParts[0]), 
                                    parseInt(endDateParts[1]) - 1, // JS months are 0-indexed
                                    parseInt(endDateParts[2])
                                );
                                shiftEndDateStr = endDateLocal.toISOString().split('T')[0];
                            }
                        }
                    }
                    
                    console.log('Comparing shift by startDate/endDate:', {
                        shiftId: shift.shiftId,
                        shiftStart: shiftStartDateStr,
                        shiftEnd: shiftEndDateStr,
                        today: todayStr,
                        matches: (shiftStartDateStr === todayStr || shiftEndDateStr === todayStr)
                    });
                    
                    // Return true if either the start or end date matches today
                    return shiftStartDateStr === todayStr || shiftEndDateStr === todayStr;
                } catch (err) {
                    console.error('Error parsing dates:', err);
                    return false;
                }
            });
            
            console.log('Today\'s shift found:', todayShift);
            return todayShift;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting today\'s shift:', error);
        return null;
    }
}

// Show status message with appropriate styling
function showStatusMessage(element, message, type = 'info') {
    if (!element) return;
    
    // Clear existing classes
    element.className = 'status-message';
    
    // Add class based on type
    element.classList.add(`status-${type}`);
    
    // Set message
    element.textContent = message;
    
    // Ensure it's visible
    element.style.display = 'block';
}

// Load today's shifts for the user
async function loadTodayShifts() {
    if (!currentUser) return;
    
    const todayShiftsContainer = document.getElementById('today-shifts');
    if (!todayShiftsContainer) return;
    
    try {
        console.log('Loading today\'s shifts for user:', currentUser.userId);
        const todayShift = await getTodayShift(currentUser.userId);
        
        // Get today's date for display - always use local date
        const today = new Date();
        const shiftDateDisplay = today.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        
        if (todayShift) {
            console.log('Today\'s shift found, rendering:', todayShift);
            
            // Format the shift times
            let startTime, endTime;
            
            // Check if startDate and endDate are time strings (HH:MM:SS) or datetime objects
            if (todayShift.startDate && todayShift.startDate.includes(':') && todayShift.startDate.length <= 8) {
                // Handle time string format (HH:MM:SS)
                const startParts = todayShift.startDate.split(':');
                const endParts = todayShift.endDate.split(':');
                
                if (startParts.length >= 2) {
                    const hour = parseInt(startParts[0], 10);
                    const minute = parseInt(startParts[1], 10);
                    const period = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                    startTime = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
                } else {
                    startTime = 'N/A';
                }
                
                if (endParts.length >= 2) {
                    const hour = parseInt(endParts[0], 10);
                    const minute = parseInt(endParts[1], 10);
                    const period = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                    endTime = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
                } else {
                    endTime = 'N/A';
                }
            } else {
                // Try to parse as full datetime
                try {
                    const startDate = new Date(todayShift.startDate);
                    const endDate = new Date(todayShift.endDate);
                    
                    if (!isNaN(startDate.getTime())) {
                        startTime = startDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true
                        });
                    } else {
                        startTime = 'N/A';
                    }
                    
                    if (!isNaN(endDate.getTime())) {
                        endTime = endDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true
                        });
                    } else {
                        endTime = 'N/A';
                    }
                } catch (e) {
                    console.error('Error parsing shift dates:', e);
                    startTime = 'N/A';
                    endTime = 'N/A';
                }
            }
            
            console.log('Formatted shift times:', startTime, endTime);
            
            // Create the HTML for the shift with a cleaner layout
            todayShiftsContainer.innerHTML = `
                <div class="shift-card ${todayShift.status.toLowerCase()}">
                    <div class="shift-header">
                        <span class="shift-title">${todayShift.title || 'Regular Shift'}</span>
                        <span class="shift-status">${todayShift.status}</span>
                    </div>
                    <div class="shift-details">
                        <div class="shift-datetime">
                            <i class="fas fa-calendar-alt"></i>
                            <div class="datetime-info">
                                <div class="shift-date">${shiftDateDisplay}</div>
                                <div class="shift-time">${startTime} - ${endTime}</div>
                            </div>
                        </div>
                        <div class="shift-meta">
                            <span class="shift-id">ID: ${todayShift.shiftId}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            console.log('No shift found for today');
            
            todayShiftsContainer.innerHTML = `
                <div class="no-shifts-message">
                    <i class="fas fa-calendar-times"></i>
                    <p>No shifts scheduled for</p>
                    <p class="no-shift-date">${shiftDateDisplay}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading today\'s shifts:', error);
        todayShiftsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading shift data. Please try again.</p>
            </div>
        `;
    }
}

// Function to calculate and update total work hours display
function updateTotalWorkHours(records) {
    const totalWorkHoursElement = document.getElementById('total-work-hours');
    const hoursMeterBar = document.getElementById('hours-meter-bar');
    const hoursStatus = document.getElementById('hours-status');
    const hoursThreshold = 176; // Standard monthly work hour threshold
    
    if (!totalWorkHoursElement || !hoursMeterBar || !hoursStatus) return;
    
    // Calculate total work hours from attendance records
    let totalHours = 0;
    
    if (records && records.length > 0) {
        records.forEach(record => {
            if (record.clockInTime && record.clockOutTime && record.status != 'Absent') {
                const clockInDate = new Date(record.clockInTime);
                const clockOutDate = new Date(record.clockOutTime);
                
                // Calculate duration in hours
                const durationMs = clockOutDate - clockInDate;
                const durationHours = durationMs / (1000 * 60 * 60);
                totalHours += durationHours;
            }
        });
    }
    
    // Round to 2 decimal places
    totalHours = Math.round(totalHours * 100) / 100;
    
    // Update the display
    totalWorkHoursElement.textContent = `${totalHours} hrs`;
    
    // Calculate percentage for meter (cap at 120% to prevent extreme values)
    const percentage = Math.min((totalHours / hoursThreshold) * 100, 120);
    hoursMeterBar.style.width = `${percentage}%`;
    
    // Update status indicator
    if (totalHours > hoursThreshold) {
        hoursMeterBar.classList.add('exceeded');
        hoursStatus.classList.remove('hours-normal');
        hoursStatus.classList.add('hours-exceeded');
        hoursStatus.textContent = 'Overtime';
    } else {
        hoursMeterBar.classList.remove('exceeded');
        hoursStatus.classList.remove('hours-exceeded');
        hoursStatus.classList.add('hours-normal');
        hoursStatus.textContent = 'Normal';
    }
    
    console.log(`Updated total work hours: ${totalHours} hours`);
}

// Load attendance records for the current user
async function loadAttendanceRecords() {
    if (!currentUser) return;
    
    const tableBody = document.getElementById('attendance-records-body');
    if (!tableBody) return;
    
    try {
        // Get the current selected period
        const periodFilter = document.getElementById('attendance-period-filter');
        const selectedPeriod = periodFilter ? periodFilter.value : 'monthly';
        
        //updated to use current date
        const now = new Date();
        let startDate, endDate;
        
        //calculates date range from selcted period
        switch(selectedPeriod) {
            case 'weekly':
                //last 7 days from today
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                endDate = now.toISOString().split('T')[0];
                startDate = startDate.toISOString().split('T')[0];
                break;
            case 'monthly':
                //current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case 'quarterly':
                //current quarter
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().split('T')[0];
                break;
            case 'yearly':
                //current year
                startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                break;
            default:
                //defaults to monthly
                startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        
        console.log(`Fetching attendance records from ${startDate} to ${endDate} (${selectedPeriod} view)`);
        
        const response = await fetch(`${API_BASE_URL}/attendance/employee/${currentUser.userId}?startDate=${startDate}&endDate=${endDate}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const records = await response.json();
            console.log('Retrieved attendance records:', records);
            
            //update the total work hours display
            updateTotalWorkHours(records);
            
            if (records.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="no-records-message">No attendance records found for the selected period.</td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            
            records.forEach(record => {
                //format for time and calcula durationm
                const date = new Date(record.date).toLocaleDateString('en-US');
                
                let clockIn = 'N/A';
                let clockOut = 'N/A';
                let totalHours = 'N/A';
                
                if (record.clockInTime) {
                    const clockInDate = new Date(record.clockInTime);
                    clockIn = clockInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    
                    if (record.clockOutTime) {
                        const clockOutDate = new Date(record.clockOutTime);
                        clockOut = clockOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        
                        //calculate duration in hours
                        const durationMs = clockOutDate - clockInDate;
                        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
                        totalHours = `${durationHours} hrs`;
                    }
                }
                
                //create status badge 
                const statusClass = record.status.toLowerCase();
                
                html += `
                    <tr>
                        <td>${date}</td>
                        <td>${clockIn}</td>
                        <td>${clockOut}</td>
                        <td><span class="status-badge ${statusClass}">${record.status}</span></td>
                        <td>${totalHours}</td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = html;
        } else {
            console.error('Error response:', await response.text());
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="error-message">Error loading attendance records.</td>
                </tr>
            `;
            //reset work hours display on error
            updateTotalWorkHours([]);
        }
    } catch (error) {
        console.error('Error loading attendance records:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="error-message">System error. Please try again.</td>
            </tr>
        `;
        //reset work hours display on error
        updateTotalWorkHours([]);
    }
}

// Function to show the attendance rate section
function showAttendanceSection() {
    console.log('Showing attendance section');
    
    // Hide all other sections
    const sections = document.querySelectorAll('.main-content > div');
    sections.forEach(section => {
        if (section.classList.contains('attendance-section')) {
            section.style.display = 'block';
            console.log('Made attendance section visible');
        } else {
            section.style.display = 'none';
        }
    });

    // Remove active class from all nav items
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to Attendance Rate nav item
    const attendanceNavItem = findElementByText('.sidebar .nav-item', 'Attendance Rate');
    if (attendanceNavItem) {
        attendanceNavItem.classList.add('active');
    }

    // Initialize the attendance content
    initializeAttendance();
}

// Initialize the attendance system
function initializeAttendance() {
    console.log('Initializing attendance data');
    
    // Check clock status
    checkClockStatus();
    
    // Load today's shifts
    loadTodayShifts();
    
    // Get the current selected period
    const periodFilter = document.getElementById('attendance-period-filter');
    const selectedPeriod = periodFilter ? periodFilter.value : 'monthly';
    
    // Update the date range display on the UI
    updateDateRangeDisplay(selectedPeriod);
    
    // Load attendance records
    loadAttendanceRecords();
    
    // Clean up any existing charts first
    destroyAttendanceCharts();
    
    // Load attendance data based on the selected period
    updateAttendanceData(selectedPeriod);
    
    // Initialize charts
    setTimeout(() => {
        initializeAttendanceCharts();
    }, 100);
}

// Function to destroy existing chart instances
function destroyAttendanceCharts() {
    console.log('Destroying existing attendance charts');
    
    // Destroy each chart instance if it exists
    Object.keys(attendanceChartInstances).forEach(key => {
        try {
            if (attendanceChartInstances[key]) {
                console.log(`Destroying chart: ${key}`);
                attendanceChartInstances[key].destroy();
            }
        } catch (err) {
            console.warn(`Error destroying chart ${key}:`, err);
        } finally {
            attendanceChartInstances[key] = null;
        }
    });
}

// Function to get formatted date range text based on period
function getDateRangeText(period) {
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            endDate = now;
            return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        case 'monthly':
            return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        case 'quarterly':
            const quarter = Math.floor(now.getMonth() / 3);
            const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
            const quarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
            return `Q${quarter + 1} ${now.getFullYear()} (${quarterStart.toLocaleDateString('en-US', { month: 'short' })}-${quarterEnd.toLocaleDateString('en-US', { month: 'short' })})`;
        case 'yearly':
            return `Year ${now.getFullYear()}`;
        default:
            return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
}

// Function to update the date range display on the UI
function updateDateRangeDisplay(period) {
    const dateRangeDisplay = document.querySelector('.attendance-section .section-header .date-range');
    
    if (dateRangeDisplay) {
        dateRangeDisplay.textContent = getDateRangeText(period);
    } else {
        // Create date range display if it doesn't exist
        const sectionHeader = document.querySelector('.attendance-section .section-header');
        if (sectionHeader) {
            const dateRangeElement = document.createElement('div');
            dateRangeElement.className = 'date-range';
            dateRangeElement.textContent = getDateRangeText(period);
            sectionHeader.appendChild(dateRangeElement);
            
            // Add some CSS to position it properly
            dateRangeElement.style.marginTop = '5px';
            dateRangeElement.style.fontSize = '14px';
            dateRangeElement.style.fontWeight = 'normal';
            dateRangeElement.style.color = '#666';
        }
    }
}

// Function to update attendance data based on the selected period
async function updateAttendanceData(period) {
    console.log('Updating attendance data for period:', period);
    
    if (!currentUser) return;
    
    // Update the date range display on the UI
    updateDateRangeDisplay(period);
    
    try {
        //use current date
        const now = new Date();
        let startDate, endDate;
        
        //calculate date range based on selected period
        switch(period) {
            case 'weekly':
                //last 7 days from today
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                endDate = now.toISOString().split('T')[0];
                startDate = startDate.toISOString().split('T')[0];
                break;
            case 'monthly':
                //current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case 'quarterly':
                //current quarter
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().split('T')[0];
                break;
            case 'yearly':
                //durrent year
                startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                break;
            default:
                //default to monthly
                startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        
        console.log(`Fetching attendance stats from ${startDate} to ${endDate} (${period} view)`);
        
        // Fetch attendance statistics from the API
        const response = await fetch(`${API_BASE_URL}/attendance/stats?employeeId=${currentUser.userId}&startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Retrieved attendance stats:', data);
            
            // Update UI with real data
            updateAttendanceUI(
                data.stats.attendanceRate || 0,
                data.stats.presentCount || 0,
                data.stats.lateCount || 0,
                data.stats.absentCount || 0,
                data.stats.leaveCount || 0
            );
            
            // Update charts
            initializeAttendanceCharts(period, data);
        } else {
            console.error('Error fetching attendance data:', await response.text());
            
            // Update UI with zeros if API fails
            updateAttendanceUI(0, 0, 0, 0, 0);
            
            // Initialize charts with empty data
            initializeAttendanceCharts(period);
        }
    } catch (error) {
        console.error('Error updating attendance data:', error);
        
        // Update UI with zeros if API fails
        updateAttendanceUI(0, 0, 0, 0, 0);
        
        // Initialize charts with empty data
        initializeAttendanceCharts(period);
    }
}

// Function to update the attendance UI elements
function updateAttendanceUI(rate, onTime, late, absences, leave) {
    // Update the circular progress chart
    const circlePath = document.querySelector('.circle');
    if (circlePath) {
        circlePath.setAttribute('stroke-dasharray', `${rate}, 100`);
    }
    
    // Update the percentage text
    const percentageText = document.querySelector('.percentage');
    if (percentageText) {
        percentageText.textContent = `${rate}%`;
    }
    
    // Update the detail values
    const detailItems = document.querySelectorAll('.attendance-details .detail-item .value');
    if (detailItems.length >= 4) {
        detailItems[0].textContent = onTime;
        detailItems[1].textContent = late;
        detailItems[2].textContent = absences;
        detailItems[3].textContent = leave;
    }
}

// Function to initialize all attendance charts
function initializeAttendanceCharts(period = 'monthly', apiData = null) {
    createAttendanceHistoryChart(period, apiData);
    createPunctualityChart(period, apiData);
}

// Function to create attendance history chart
function createAttendanceHistoryChart(period, apiData = null) {
    try {
        const canvas = document.getElementById('attendanceHistoryChart');
        if (!canvas) {
            console.error('Attendance history chart canvas not found');
            return;
        }
        
        // Make sure we have a clean canvas
        if (attendanceChartInstances.attendanceHistoryChart) {
            attendanceChartInstances.attendanceHistoryChart.destroy();
            attendanceChartInstances.attendanceHistoryChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare data based on API data or use empty data
        let labels = [], data = [];
        
        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            // Use API data
            const breakdown = apiData.dailyBreakdown;
            console.log(`Processing ${breakdown.length} days of attendance data for chart`);
            
            // Sort data by date to ensure chronological order
            breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Group data by week for better visualization
            const weeks = {};
            breakdown.forEach(item => {
                const date = new Date(item.date);
                // Get week number (rough estimation - week 1, 2, 3, etc. of the month)
                const weekNum = Math.ceil(date.getDate() / 7);
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                const weekKey = `${monthName} W${weekNum}`;
                
                if (!weeks[weekKey]) {
                    weeks[weekKey] = {
                        presentCount: 0,
                        lateCount: 0,
                        absentCount: 0,
                        leaveCount: 0,
                        totalCount: 0,
                        days: 0
                    };
                }
                
                weeks[weekKey].presentCount += item.presentCount;
                weeks[weekKey].lateCount += item.lateCount;
                weeks[weekKey].absentCount += item.absentCount;
                weeks[weekKey].leaveCount += item.leaveCount;
                weeks[weekKey].totalCount += item.totalCount;
                weeks[weekKey].days += 1;
            });
            
            // Convert weeks object to arrays for chart
            labels = Object.keys(weeks);
            
            // Calculate attendance percentage for each week
            data = labels.map(weekKey => {
                const week = weeks[weekKey];
                if (week.totalCount === 0) return 0;
                // Calculate percentage: (present + late) / (total - leave) * 100
                const nonLeaveTotal = week.totalCount - week.leaveCount;
                if (nonLeaveTotal === 0) return 100; // All leave days = 100% attendance
                return ((week.presentCount + week.lateCount) / nonLeaveTotal * 100).toFixed(0);
            });
            
            console.log('Weekly attendance data:', labels, data);
        } else {
            // Use empty data with single placeholder entry if no API data
            labels = ['No Data'];
            data = [0];
        }
        
        // Create chart
        attendanceChartInstances.attendanceHistoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance Rate (%)',
                    data: data,
                    backgroundColor: data.map(value => {
                        if (value < 70) return 'rgba(255, 99, 132, 0.6)'; // Poor
                        if (value < 90) return 'rgba(255, 205, 86, 0.6)'; // Average
                        return 'rgba(75, 192, 192, 0.6)'; // Good
                    }),
                    borderColor: data.map(value => {
                        if (value < 70) return 'rgb(255, 99, 132)'; // Poor
                        if (value < 90) return 'rgb(255, 205, 86)'; // Average
                        return 'rgb(75, 192, 192)'; // Good
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Attendance Rate (%)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                if (value < 70) return `Poor: ${value}%`;
                                if (value < 90) return `Average: ${value}%`;
                                return `Good: ${value}%`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Attendance history chart created');
    } catch (error) {
        console.error('Error creating attendance history chart:', error);
    }
}

// Function to create punctuality trend chart
function createPunctualityChart(period, apiData = null) {
    try {
        const canvas = document.getElementById('punctualityChart');
        if (!canvas) {
            console.error('Punctuality chart canvas not found');
            return;
        }
        
        // Make sure we have a clean canvas
        if (attendanceChartInstances.punctualityChart) {
            attendanceChartInstances.punctualityChart.destroy();
            attendanceChartInstances.punctualityChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare data based on API data or use empty data
        let labels = [], presentData = [], lateData = [], absentData = [], leaveData = [];
        
        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            // Use API data
            const breakdown = apiData.dailyBreakdown;
            console.log(`Processing ${breakdown.length} days of attendance breakdown for chart`);
            
            // Sort data by date to ensure chronological order
            breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Group data by week for better visualization
            const weeks = {};
            breakdown.forEach(item => {
                const date = new Date(item.date);
                // Get week number (rough estimation - week 1, 2, 3, etc. of the month)
                const weekNum = Math.ceil(date.getDate() / 7);
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                const weekKey = `${monthName} W${weekNum}`;
                
                if (!weeks[weekKey]) {
                    weeks[weekKey] = {
                        presentCount: 0,
                        lateCount: 0,
                        absentCount: 0,
                        leaveCount: 0,
                        days: 0
                    };
                }
                
                weeks[weekKey].presentCount += item.presentCount;
                weeks[weekKey].lateCount += item.lateCount;
                weeks[weekKey].absentCount += item.absentCount;
                weeks[weekKey].leaveCount += item.leaveCount;
                weeks[weekKey].days += 1;
            });
            
            // Convert weeks object to arrays for chart
            labels = Object.keys(weeks);
            presentData = labels.map(weekKey => weeks[weekKey].presentCount);
            lateData = labels.map(weekKey => weeks[weekKey].lateCount);
            absentData = labels.map(weekKey => weeks[weekKey].absentCount);
            leaveData = labels.map(weekKey => weeks[weekKey].leaveCount);
            
            console.log('Weekly status breakdown:', {
                labels,
                present: presentData,
                late: lateData,
                absent: absentData,
                leave: leaveData
            });
        } else {
            // Use empty data with single placeholder entry if no API data
            labels = ['No Data'];
            presentData = [0];
            lateData = [0];
            absentData = [0];
            leaveData = [0];
        }
        
        // Create chart
        attendanceChartInstances.punctualityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Present',
                        data: presentData,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Late',
                        data: lateData,
                        backgroundColor: 'rgba(255, 205, 86, 0.6)',
                        borderColor: 'rgba(255, 205, 86, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Absent',
                        data: absentData,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Leave',
                        data: leaveData,
                        backgroundColor: 'rgba(153, 102, 255, 0.6)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Days'
                        },
                        stacked: true
                    },
                    x: {
                        stacked: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index'
                    }
                }
            }
        });
        
        console.log('Attendance breakdown chart created');
    } catch (error) {
        console.error('Error creating attendance breakdown chart:', error);
    }
}

// Helper function to find element by text content
function findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    
    for (let i = 0; i < elements.length; i++) {
        if (elements[i].textContent.trim() === text) {
            return elements[i];
        }
    }
    
    return null;
} 