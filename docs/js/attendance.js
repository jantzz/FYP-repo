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
            console.log('Period filter changed to:', this.value);
            updateAttendanceData(this.value);
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
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        console.log('Looking for shift on date:', today);
        
        // Get all shifts for the employee
        const response = await fetch(`${API_BASE_URL}/shift/${employeeId}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const shifts = await response.json();
            console.log('Shifts loaded for employee:', shifts.length);
            
            // Find a shift that matches today's date
            // This handles timezone properly by just comparing the date portions
            const todayShift = shifts.find(shift => {
                // Extract just the date part from each shift date 
                const shiftStartDateStr = shift.startDate.split('T')[0];
                const shiftEndDateStr = shift.endDate.split('T')[0];
                
                console.log('Comparing shift:', {
                    shiftId: shift.shiftId,
                    shiftStart: shiftStartDateStr,
                    shiftEnd: shiftEndDateStr,
                    today: today,
                    matches: (shiftStartDateStr === today || shiftEndDateStr === today)
                });
                
                // Return true if either the start or end date matches today
                return shiftStartDateStr === today || shiftEndDateStr === today;
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
        
        if (todayShift) {
            console.log('Today\'s shift found, rendering:', todayShift);
            
            // Format the shift times
            const startDate = new Date(todayShift.startDate);
            const endDate = new Date(todayShift.endDate);
            
            // Format time only (hours and minutes)
            const startTime = startDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true
            });
            
            const endTime = endDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true
            });
            
            // Create the HTML for the shift
            todayShiftsContainer.innerHTML = `
                <div class="shift-card ${todayShift.status.toLowerCase()}">
                    <div class="shift-header">
                        <span class="shift-title">${todayShift.title || 'Regular Shift'}</span>
                        <span class="shift-status">${todayShift.status}</span>
                    </div>
                    <div class="shift-details">
                        <div class="shift-time">
                            <i class="fas fa-clock"></i>
                            <span>${startTime} - ${endTime}</span>
                        </div>
                        <div class="shift-id">
                            <i class="fas fa-id-badge"></i>
                            <span>Shift ID: ${todayShift.shiftId}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            console.log('No shift found for today');
            todayShiftsContainer.innerHTML = `
                <div class="no-shifts-message">
                    <i class="fas fa-calendar-times"></i>
                    <p>No shifts scheduled for today.</p>
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

// Load attendance records for the current user
async function loadAttendanceRecords() {
    if (!currentUser) return;
    
    const tableBody = document.getElementById('attendance-records-body');
    if (!tableBody) return;
    
    try {
        // Get the last 7 days' records
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const formattedStartDate = startDate.toISOString().split('T')[0];
        
        const response = await fetch(`${API_BASE_URL}/attendance/employee/${currentUser.userId}?startDate=${formattedStartDate}&endDate=${endDate}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const records = await response.json();
            
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
                // Format time and calculate duration
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
                        
                        // Calculate duration in hours
                        const durationMs = clockOutDate - clockInDate;
                        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
                        totalHours = `${durationHours} hrs`;
                    }
                }
                
                // Create status badge with appropriate class
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
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="error-message">Error loading attendance records.</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading attendance records:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="error-message">System error. Please try again.</td>
            </tr>
        `;
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
    
    // Load attendance records
    loadAttendanceRecords();
    
    // Clean up any existing charts first
    destroyAttendanceCharts();
    
    // Get the current selected period
    const periodFilter = document.getElementById('attendance-period-filter');
    const selectedPeriod = periodFilter ? periodFilter.value : 'monthly';
    
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

// Function to update attendance data based on the selected period
async function updateAttendanceData(period) {
    console.log('Updating attendance data for period:', period);
    
    if (!currentUser) return;
    
    try {
        // Calculate date range based on selected period
        let startDate, endDate;
        const today = new Date();
        endDate = today.toISOString().split('T')[0];
        
    switch(period) {
        case 'weekly':
                // Last 7 days
                startDate = new Date();
                startDate.setDate(today.getDate() - 7);
                startDate = startDate.toISOString().split('T')[0];
            break;
        case 'monthly':
                // Last 30 days
                startDate = new Date();
                startDate.setDate(today.getDate() - 30);
                startDate = startDate.toISOString().split('T')[0];
            break;
        case 'quarterly':
                // Last 90 days
                startDate = new Date();
                startDate.setDate(today.getDate() - 90);
                startDate = startDate.toISOString().split('T')[0];
            break;
        case 'yearly':
                // Last 365 days
                startDate = new Date();
                startDate.setDate(today.getDate() - 365);
                startDate = startDate.toISOString().split('T')[0];
            break;
        default:
                // Default to monthly
                startDate = new Date();
                startDate.setDate(today.getDate() - 30);
                startDate = startDate.toISOString().split('T')[0];
        }
        
        // Fetch attendance statistics from the API
        const response = await fetch(`${API_BASE_URL}/attendance/stats?employeeId=${currentUser.userId}&startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
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
            labels = breakdown.map(item => {
                const date = new Date(item.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            
            // Calculate attendance percentage for each day
            data = breakdown.map(item => {
                if (item.totalCount === 0) return 0;
                return ((item.presentCount + item.lateCount) / item.totalCount * 100).toFixed(0);
            });
        } else {
            // Use empty data with single placeholder entry if no API data
            labels = ['No Data'];
            data = [0];
        }
        
        // Limit data points to avoid overcrowding
        if (labels.length > 30) {
            const step = Math.ceil(labels.length / 30);
            labels = labels.filter((_, i) => i % step === 0);
            data = data.filter((_, i) => i % step === 0);
        }
        
        // Create chart
        attendanceChartInstances.attendanceHistoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance',
                    data: data,
                    backgroundColor: data.map(value => {
                        if (value === 0) return 'rgba(255, 99, 132, 0.6)'; // Absent
                        if (value < 80) return 'rgba(255, 205, 86, 0.6)'; // Late
                        return 'rgba(75, 192, 192, 0.6)'; // Present
                    }),
                    borderColor: data.map(value => {
                        if (value === 0) return 'rgb(255, 99, 132)'; // Absent
                        if (value < 80) return 'rgb(255, 205, 86)'; // Late
                        return 'rgb(75, 192, 192)'; // Present
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
                            text: 'Attendance Score'
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
                                if (context.raw === 0) return 'Absent';
                                if (context.raw < 80) return `Late: ${context.raw}%`;
                                return `Present: ${context.raw}%`;
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
        let labels = [], onTimeData = [], lateData = [];
        
        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            // Use API data
            const breakdown = apiData.dailyBreakdown;
            labels = breakdown.map(item => {
                const date = new Date(item.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            
            // Calculate attendance percentage for each day
            onTimeData = breakdown.map(item => {
                if (item.totalCount === 0) return 0;
                return item.presentCount;
            });
            
            // Calculate late percentage for each day
            lateData = breakdown.map(item => {
                if (item.totalCount === 0) return 0;
                return item.lateCount;
            });
        } else {
            // Use empty data with single placeholder entry if no API data
            labels = ['No Data'];
            onTimeData = [0];
            lateData = [0];
        }
        
        // Create chart
        attendanceChartInstances.punctualityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'On Time',
                        data: onTimeData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Late',
                        data: lateData,
                        borderColor: 'rgba(255, 205, 86, 1)',
                        backgroundColor: 'rgba(255, 205, 86, 0.2)',
                        tension: 0.3,
                        fill: true
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
                            text: 'Count'
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
        
        console.log('Punctuality chart created');
    } catch (error) {
        console.error('Error creating punctuality chart:', error);
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