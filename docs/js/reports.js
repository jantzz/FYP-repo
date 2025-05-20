// Store chart instances so they can be destroyed before recreating
const reportChartInstances = {
    attendanceHistoryChart: null,
    punctualityChart: null,
    timeOffBreakdownChart: null
};

// Keep track of initialization status
let reportsInitialized = false;
let clinicFilterPopulated = false;

// Initialize Reports functionality
function initializeReports() {
    try {
        // Prevent duplicate initialization
        if (reportsInitialized) {
            console.log('Reports already initialized, skipping...');
            return;
        }
        reportsInitialized = true; // Set flag earlier

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            showNotification('Error loading charts: Chart.js library is missing', 'error');
            reportsInitialized = false; // Reset flag
            return;
        }
        
        // Clean up any existing charts first
        destroyReportCharts();
        
        // Small delay to ensure DOM is updated after chart destruction
        setTimeout(() => {
            try {
                // Get user info to determine role
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const userRole = (userInfo.role || '').toLowerCase();
                const isAdmin = userRole === 'admin';
                const isManager = userRole === 'manager';
                
                // Fetch real attendance data
                fetchAttendanceReportData();
                
                // Add event listeners for export buttons
                const pdfButton = document.getElementById('export-pdf');
                if (pdfButton) {
                    pdfButton.addEventListener('click', exportReportAsPDF);
                }
                
                const csvButton = document.getElementById('export-csv');
                if (csvButton) {
                    csvButton.addEventListener('click', exportReportAsCSV);
                }
                
                // Add event listener for period selector if it exists
                const periodSelector = document.getElementById('report-period-selector');
                if (periodSelector) {
                    periodSelector.addEventListener('change', function() {
                        fetchAttendanceReportData(this.value);
                    });
                }
                
                // Initialize working hours section for both admin and manager
                if (isAdmin || isManager) {
                    initializeWorkingHoursReport();
                } else {
                    // Hide working hours section for employees
                    const workingHoursSection = document.querySelector('.working-hours-report');
                    if (workingHoursSection) {
                        workingHoursSection.style.display = 'none';
                    }
                }
            } catch (err) {
                reportsInitialized = false; // Reset flag on error in async part
                console.error('Error in reports initialization inner block:', err);
            }
        }, 50);
    } catch (error) {
        reportsInitialized = false; // Reset flag on error in sync part
        console.error('Error in reports initialization:', error);
    }
}

//fetch and populate clinics for the report filter
async function populateClinicFilter() {
    // Prevent duplicate population
    if (clinicFilterPopulated) {
        console.log('Clinic filter already populated, skipping...');
        return;
    }
    
    const clinicFilter = document.getElementById('report-clinic-filter');
    if (!clinicFilter) return;
    
    // Clear existing options except 'All Clinics'
    clinicFilter.innerHTML = '<option value="all">All Clinics</option>';
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';
        const response = await fetch(`${API_BASE_URL}/clinic/getClinics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const clinics = await response.json();
            clinics.forEach(clinic => {
                const option = document.createElement('option');
                option.value = clinic.clinicId;
                option.textContent = clinic.clinicName;
                clinicFilter.appendChild(option);
            });
            // Mark as populated
            clinicFilterPopulated = true;
        }
    } catch (err) { /* ignore */ }
}

//fetch attendance for all employees, filtered by clinic if selected
async function fetchAttendanceReportData(period = 'yearly') {
    try {
        const token = localStorage.getItem('token');
        if (!token) { 
            console.error('No authentication token found');
            renderChartsWithMockData(); 
            return; 
        }
        
        // Get user info to determine role
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userRole = (userInfo.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isManager = userRole === 'manager';
        const userId = userInfo.userId;
        
        //get selected clinic
        const clinicFilter = document.getElementById('report-clinic-filter');
        const selectedClinicId = clinicFilter ? clinicFilter.value : 'all';
        
        //set up date range based on period
        const today = new Date();
        let startDate, endDate = today.toISOString().split('T')[0];
        switch (period) {
            case 'weekly':
                const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7);
                startDate = oneWeekAgo.toISOString().split('T')[0]; break;
            case 'monthly':
                const oneMonthAgo = new Date(today); oneMonthAgo.setMonth(today.getMonth() - 1);
                startDate = oneMonthAgo.toISOString().split('T')[0]; break;
            case 'quarterly':
                const threeMonthsAgo = new Date(today); threeMonthsAgo.setMonth(today.getMonth() - 3);
                startDate = threeMonthsAgo.toISOString().split('T')[0]; break;
            case 'yearly':
                const oneYearAgo = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1);
                startDate = oneYearAgo.toISOString().split('T')[0]; break;
            default:
                const defaultOneYearAgo = new Date(today); defaultOneYearAgo.setFullYear(today.getFullYear() - 1);
                startDate = defaultOneYearAgo.toISOString().split('T')[0];
        }
        const API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';
        
        let url;
        // For both admin and managers - show all attendance data
        if (isAdmin || isManager) {
        //build query for all attendance
            url = `${API_BASE_URL}/attendance/all?startDate=${startDate}&endDate=${endDate}`;
        if (selectedClinicId && selectedClinicId !== 'all') {
            url += `&clinicId=${selectedClinicId}`;
        }
        
            console.log('Admin/Manager: Fetching all attendance data from:', url);
        } 
        // For employees - show only their own data
        else {
            // Use the employee-specific endpoint with their userId
            url = `${API_BASE_URL}/attendance/employee/${userId}?startDate=${startDate}&endDate=${endDate}`;
            console.log('Employee: Fetching personal attendance data from:', url);
        }
        
        //fetch attendance records
        const response = await fetch(url, { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Successfully fetched attendance data:', data);
            //render charts with data
            renderAttendanceHistoryChart(aggregateAttendanceData(data), isAdmin || isManager);
            renderPunctualityTrendChart(aggregateAttendanceData(data), period, isAdmin || isManager);
        } else {
            const errorText = await response.text();
            console.error('Error fetching attendance data:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            renderChartsWithMockData();
        }
    } catch (error) {
        console.error('Exception while fetching attendance data:', error);
        renderChartsWithMockData();
    }
}

//raw attendance records into dailyBreakdown for chart rendering
function aggregateAttendanceData(records) {
    //group by date
    const breakdownMap = {};
    records.forEach(rec => {
        const date = rec.date;
        if (!breakdownMap[date]) {
            breakdownMap[date] = { date, presentCount: 0, lateCount: 0, absentCount: 0, leaveCount: 0, totalCount: 0 };
        }
        if (rec.status === 'Present') breakdownMap[date].presentCount++;
        else if (rec.status === 'Late') breakdownMap[date].lateCount++;
        else if (rec.status === 'Absent') breakdownMap[date].absentCount++;
        else if (rec.status === 'Leave') breakdownMap[date].leaveCount++;
        breakdownMap[date].totalCount++;
    });
    return { dailyBreakdown: Object.values(breakdownMap) };
}

// Function to render charts with mock data when API fails
function renderChartsWithMockData() {
    renderAttendanceHistoryChart();
    renderPunctualityTrendChart();
    
    // Add mock data for time off breakdown if canvas exists
    const timeOffCanvas = document.getElementById('timeoffBreakdownChart');
    if (timeOffCanvas) {
        renderTimeOffBreakdownChart();
    }
}

// Function to safely destroy a chart on a specific canvas
function safeDestroyChart(canvasId) {
    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Check if Chart.getChart exists (available in Chart.js v3+)
        if (typeof Chart.getChart === 'function') {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
                return true;
            }
        } else {
            // Fallback for older Chart.js versions that don't have getChart
            // Just clear the canvas manually
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch (err) {
        // Error handling remains in place
    }
    return false;
}

// Function to destroy existing chart instances
function destroyReportCharts() {
    try {
        // Destroy each chart instance if it exists
        Object.keys(reportChartInstances).forEach(key => {
            try {
                if (reportChartInstances[key] instanceof Chart) {
                    reportChartInstances[key].destroy();
                }
            } catch (err) {
                // Error handling remains in place
            }
            reportChartInstances[key] = null;
        });
        
        // Also check for any charts that might be hanging around on canvases
        safeDestroyChart('attendanceHistoryChart');
        safeDestroyChart('punctualityChart');
        safeDestroyChart('timeoffBreakdownChart');
    } catch (error) {
        // Error handling remains in place
    }
}

// Function to render attendance history chart
function renderAttendanceHistoryChart(apiData = null, isAdminOrManager = false) {
    try {
        const chartCanvas = document.getElementById('attendanceHistoryChart');
        if (!chartCanvas) {
            return;
        }
        
        // Force cleanup any existing chart on this canvas
        safeDestroyChart('attendanceHistoryChart');
        
        const ctx = chartCanvas.getContext('2d');
        
        // Prepare data based on API data or use mock data
        let labels = [], data = [];
        
        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            // Use API data
            const breakdown = apiData.dailyBreakdown;
            
            // Sort data by date to ensure chronological order
            breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Group data by month for a yearly report
            const months = {};
            
            // Track the number of days in each month for completeness check
            const daysInMonth = {};
            
            breakdown.forEach(item => {
                const date = new Date(item.date);
                const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                
                if (!months[monthKey]) {
                    months[monthKey] = {
                        presentCount: 0,
                        lateCount: 0,
                        absentCount: 0,
                        leaveCount: 0,
                        totalCount: 0,
                        days: 0
                    };
                    
                    // Calculate total days in this month
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    daysInMonth[monthKey] = new Date(year, month + 1, 0).getDate();
                }
                
                months[monthKey].presentCount += item.presentCount;
                months[monthKey].lateCount += item.lateCount;
                months[monthKey].absentCount += item.absentCount;
                months[monthKey].leaveCount += item.leaveCount;
                months[monthKey].totalCount += item.totalCount;
                months[monthKey].days += 1;
            });
            
            // Convert months object to arrays for chart
            labels = Object.keys(months);
            
            // For each month, calculate number of days for each status
            const presentData = labels.map(month => months[month].presentCount);
            const lateData = labels.map(month => months[month].lateCount);
            const absentData = labels.map(month => months[month].absentCount);
            const leaveData = labels.map(month => months[month].leaveCount);
            
            // Check for incomplete months and mark them
            const completeMonths = labels.map(month => 
                months[month].days >= daysInMonth[month] * 0.9 // Consider 90% or more as complete
            );
            
            // Prepare labels with indicators for incomplete months
            const formattedLabels = labels.map((month, index) => 
                completeMonths[index] ? month : `${month}*`
            );
            
            // Create new chart with attendance system colors from attendance.css
            reportChartInstances.attendanceHistoryChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: formattedLabels,
                    datasets: [
                        {
                            label: 'Present',
                            backgroundColor: '#4CAF50',  // Green color from attendance.css
                            data: presentData
                        }, 
                        {
                            label: 'Late',
                            backgroundColor: '#FF9800',  // Orange/amber color from attendance.css
                            data: lateData
                        }, 
                        {
                            label: 'Absent',
                            backgroundColor: '#F44336',  // Red color from attendance.css
                            data: absentData
                        },
                        {
                            label: 'Time Off',
                            backgroundColor: '#2196F3',  // Blue color from attendance.css
                            data: leaveData
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Month'
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Days'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                footer: function(tooltipItems) {
                                    const monthIndex = tooltipItems[0].dataIndex;
                                    const monthKey = labels[monthIndex];
                                    const monthData = months[monthKey];
                                    const totalDays = tooltipItems.reduce((total, item) => total + item.parsed.y, 0);
                                    
                                    let footer = `Total: ${totalDays} days`;
                                    
                                    // Add completeness information
                                    if (monthData && daysInMonth[monthKey]) {
                                        footer += `\nData: ${monthData.days}/${daysInMonth[monthKey]} days (${Math.round(monthData.days/daysInMonth[monthKey]*100)}%)`;
                                    }
                                    
                                    return footer;
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: isAdminOrManager ? 'Organization Monthly Attendance Breakdown' : 'Personal Monthly Attendance Breakdown',
                            font: {
                                size: 16
                            }
                        },
                        subtitle: {
                            display: true,
                            text: '* Indicates incomplete month data',
                            padding: {
                                bottom: 10
                            }
                        }
                    }
                }
            });
        } else {
            // Use mock data if no API data is available
            
            // Create new chart with mock data
            reportChartInstances.attendanceHistoryChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Present',
                        backgroundColor: '#4CAF50',  // Green color from attendance.css
                        data: [20, 18, 22, 21, 19, 20, 22, 21, 18, 19, 20, 0]
                    }, {
                        label: 'Late',
                        backgroundColor: '#FF9800',  // Orange/amber color from attendance.css
                        data: [2, 3, 1, 2, 4, 3, 1, 2, 3, 4, 3, 0]
                    }, {
                        label: 'Absent',
                        backgroundColor: '#F44336',  // Red color from attendance.css
                        data: [1, 1, 0, 1, 0, 0, 0, 1, 2, 0, 0, 0]
                    }, {
                        label: 'Time Off',
                        backgroundColor: '#2196F3',  // Blue color from attendance.css
                        data: [0, 1, 2, 0, 1, 1, 1, 0, 0, 0, 1, 0]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                footer: function(tooltipItems) {
                                    const totalDays = tooltipItems.reduce((total, item) => total + item.parsed.y, 0);
                                    return `Total: ${totalDays} days`;
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: isAdminOrManager ? 'Organization Monthly Attendance Breakdown (Sample Data)' : 'Personal Monthly Attendance Breakdown (Sample Data)',
                            font: {
                                size: 16
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        // Error handling remains in place
    }
}

// Function to render punctuality trend chart
function renderPunctualityTrendChart(apiData = null, period = 'yearly', isAdminOrManager = false) {
    try {
        const chartCanvas = document.getElementById('punctualityChart');
        if (!chartCanvas) return;

        safeDestroyChart('punctualityChart');
        const ctx = chartCanvas.getContext('2d');

        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            const breakdown = apiData.dailyBreakdown;

            //group by month or by day depending on period
            const groupKey = period === 'monthly'
                ? (item) => item.date // group by day
                : (item) => {
                    const date = new Date(item.date);
                    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                };

            const grouped = {};
            breakdown.forEach(item => {
                const key = groupKey(item);
                if (!grouped[key]) {
                    grouped[key] = { present: 0, late: 0, absent: 0, leave: 0 };
                }
                grouped[key].present += item.presentCount;
                grouped[key].late += item.lateCount;
                grouped[key].absent += item.absentCount;
                grouped[key].leave += item.leaveCount;
            });

            const labels = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
            const presentData = labels.map(label => grouped[label].present);
            const lateData = labels.map(label => grouped[label].late);
            const absentData = labels.map(label => grouped[label].absent);
            const leaveData = labels.map(label => grouped[label].leave);

            reportChartInstances.punctualityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Present',
                            data: presentData,
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            fill: false,
                            tension: 0.2
                        },
                        {
                            label: 'Late',
                            data: lateData,
                            borderColor: '#FF9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.2)',
                            fill: false,
                            tension: 0.2
                        },
                        {
                            label: 'Absent',
                            data: absentData,
                            borderColor: '#F44336',
                            backgroundColor: 'rgba(244, 67, 54, 0.2)',
                            fill: false,
                            tension: 0.2
                        },
                        {
                            label: 'Time Off',
                            data: leaveData,
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.2)',
                            fill: false,
                            tension: 0.2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: period === 'monthly'
                                ? (isAdminOrManager ? 'Organization Daily Attendance Trend' : 'Personal Daily Attendance Trend')
                                : (isAdminOrManager ? 'Organization Monthly Attendance Trend' : 'Personal Monthly Attendance Trend'),
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Number of Days' }
                        },
                        x: {
                            title: { display: true, text: period === 'monthly' ? 'Day' : 'Month' }
                        }
                    }
                }
            });
        } else {
            // Fallback: show empty or mock data with appropriate title
            reportChartInstances.punctualityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [
                        {
                            label: 'Present',
                            data: [20, 18, 22, 21, 19, 20, 22, 21, 18, 19, 20, 0],
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            fill: false,
                            tension: 0.2
                        },
                        {
                            label: 'Late',
                            data: [2, 3, 1, 2, 4, 3, 1, 2, 3, 4, 3, 0],
                            borderColor: '#FF9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.2)',
                            fill: false,
                            tension: 0.2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: isAdminOrManager ? 'Organization Attendance Trend (Sample Data)' : 'Personal Attendance Trend (Sample Data)',
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Number of Days' }
                        }
                    }
                }
            });
        }
    } catch (error) {
        // Error handling remains in place
    }
}

// Function to render time off breakdown chart
function renderTimeOffBreakdownChart(timeOffData = null) {
    try {
        const chartCanvas = document.getElementById('timeoffBreakdownChart');
        if (!chartCanvas) {
            return;
        }
        
        // Force cleanup any existing chart on this canvas
        safeDestroyChart('timeoffBreakdownChart');
        
        const ctx = chartCanvas.getContext('2d');
        
        if (timeOffData && Array.isArray(timeOffData) && timeOffData.length > 0) {
            // Use actual time off data
            
            // Count time off by type
            const timeOffCounts = {
                'Paid': 0,
                'Unpaid': 0,
                'Medical': 0
            };
            
            // Total days for each type
            timeOffData.forEach(request => {
                if (request.status === 'Approved') {
                    const startDate = new Date(request.startDate);
                    const endDate = new Date(request.endDate);
                    
                    // Calculate days between (inclusive)
                    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                    
                    // Add to the appropriate category
                    if (request.type in timeOffCounts) {
                        timeOffCounts[request.type] += days;
                    } else {
                        // Default to Paid if type is unknown
                        timeOffCounts['Paid'] += days;
                    }
                }
            });
            
            // Create data for pie chart
            const labels = Object.keys(timeOffCounts);
            const data = Object.values(timeOffCounts);
            const backgroundColor = [
                'rgba(54, 162, 235, 0.8)',  // Blue for Paid
                'rgba(255, 159, 64, 0.8)',  // Orange for Unpaid
                'rgba(153, 102, 255, 0.8)'  // Purple for Medical
            ];
            
            // Create new chart
            reportChartInstances.timeOffBreakdownChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColor,
                        borderColor: backgroundColor.map(color => color.replace('0.8', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Time Off Breakdown by Type',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} days (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            // Use mock data
            
            reportChartInstances.timeOffBreakdownChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Paid Leave', 'Unpaid Leave', 'Medical Leave'],
                    datasets: [{
                        data: [5, 2, 3],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.8)',  // Blue for Paid
                            'rgba(255, 159, 64, 0.8)',  // Orange for Unpaid
                            'rgba(153, 102, 255, 0.8)'  // Purple for Medical
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 159, 64, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Time Off Breakdown by Type (Sample Data)',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} days (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        // Error handling remains in place
    }
}

// Function to export report as PDF
function exportReportAsPDF() {
    try {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            showNotification('PDF library is not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Create a new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        
        // Add title
        doc.setFontSize(18);
        doc.text('Attendance Report', 15, 15);
        
        // Add date of generation
        const today = new Date();
        doc.setFontSize(10);
        doc.text(`Generated on: ${today.toLocaleDateString()} ${today.toLocaleTimeString()}`, 15, 22);
        
        // Get selected time period
        const periodSelector = document.getElementById('report-period-selector');
        const periodText = periodSelector ? `Period: ${periodSelector.options[periodSelector.selectedIndex].text}` : 'Period: Yearly';
        doc.text(periodText, 15, 28);
        
        // Use html2canvas to capture each chart
        const captureAndAddChart = (chartId, title, yPosition) => {
            return new Promise((resolve) => {
                const chart = document.getElementById(chartId);
                if (!chart) {
                    resolve(yPosition); // Skip if chart doesn't exist
                    return;
                }
                
                // Create an offscreen canvas with willReadFrequently set to true
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = chart.width;
                offscreenCanvas.height = chart.height;
                const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
                
                // Use html2canvas with the optimized canvas
                html2canvas(chart, { 
                    canvas: offscreenCanvas,
                    useCORS: true,
                    allowTaint: true,
                    scale: 2 // Improve quality
                }).then(canvas => {
                    // Add chart title
                    doc.setFontSize(14);
                    doc.text(title, 15, yPosition);
                    
                    // Add canvas as image
                    const imgData = canvas.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', 15, yPosition + 5, 270, 80);
                    
                    resolve(yPosition + 90); // Return next Y position
                });
            });
        };
        
        // Capture all charts in sequence
        captureAndAddChart('attendanceHistoryChart', 'Attendance History', 35)
            .then(nextY => captureAndAddChart('punctualityChart', 'Punctuality Trend', nextY))
            .then(nextY => captureAndAddChart('timeoffBreakdownChart', 'Time Off Breakdown', nextY))
            .then(() => {
                // Get user info
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const userName = userInfo.name || 'Employee';
                
                // Add footer with user info
                doc.setFontSize(10);
                doc.text(`Report for: ${userName}`, 15, doc.internal.pageSize.height - 10);
                
                // Save the PDF
                doc.save(`attendance_report_${today.toISOString().split('T')[0]}.pdf`);
                
                showNotification('PDF report has been downloaded', 'success');
            })
            .catch(err => {
                showNotification('Error generating PDF: ' + err.message, 'error');
            });
    } catch (error) {
        showNotification('Error generating PDF: ' + error.message, 'error');
    }
}

// Function to export report as CSV
function exportReportAsCSV() {
    try {
        // Get attendance history data from the chart
        const attendanceChart = reportChartInstances.attendanceHistoryChart;
        if (!attendanceChart) {
            showNotification('No chart data available to export', 'error');
            return;
        }
        
        // Extract chart data
        const labels = attendanceChart.data.labels;
        const datasets = attendanceChart.data.datasets;
        
        // Create CSV header row
        let csvContent = 'Period,Present Days,Late Days,Absent Days,Time Off Days,Total Days\n';
        
        // Create data rows
        for (let i = 0; i < labels.length; i++) {
            const period = labels[i].replace('*', ''); // Remove asterisk from incomplete months
            
            // Get values for each category for this month
            const presentDays = datasets[0].data[i] || 0;
            const lateDays = datasets[1].data[i] || 0;
            const absentDays = datasets[2].data[i] || 0;
            const timeOffDays = datasets[3].data[i] || 0;
            const totalDays = presentDays + lateDays + absentDays + timeOffDays;
            
            // Add row to CSV
            csvContent += `${period},${presentDays},${lateDays},${absentDays},${timeOffDays},${totalDays}\n`;
        }
        
        // Create a download link for the CSV
        const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        // Trigger download and clean up
        link.click();
        document.body.removeChild(link);
        
        showNotification('CSV report has been downloaded', 'success');
    } catch (error) {
        showNotification('Error generating CSV: ' + error.message, 'error');
    }
}

// Utility function to show notifications
function showNotification(message, type = 'info') {
    // Check if showNotification already exists in global scope
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback to alert if the global function doesn't exist
        alert(message);
    }
}

// Initialize reports when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Check if reports section is visible on page load and initialize if needed
        setTimeout(function() {
            try {
                const reportSection = document.querySelector('.report-section');
                if (reportSection && window.getComputedStyle(reportSection).display === 'block') {
                    initializeReports();
                }
            } catch (error) {
                // Error handling remains in place
            }
        }, 200); // Slightly longer timeout for initial load
        
        // Create a MutationObserver to watch for changes to the report section display style
        const reportSection = document.querySelector('.report-section');
        if (reportSection) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'style' && 
                        window.getComputedStyle(reportSection).display === 'block') {
                        initializeReports();
                    }
                });
            });
            
            observer.observe(reportSection, { attributes: true, attributeFilter: ['style'] });
        }
        
        // Also add event listener for Reports menu item as a fallback
        const reportsNavItem = document.querySelector('.nav-item:has(.fa-chart-bar)');
        if (reportsNavItem) {
            reportsNavItem.addEventListener('click', function() {
                try {
                    // Small delay to let the DOM update
                    setTimeout(function() {
                        const reportSection = document.querySelector('.report-section');
                        if (reportSection && window.getComputedStyle(reportSection).display === 'block') {
                            initializeReports();
                        }
                    }, 100);
                } catch (error) {
                    // Error handling remains in place
                }
            });
        }
    } catch (error) {
        // Error handling remains in place
    }
});

//on DOMContentLoaded populate clinic filter and set up event
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupReportsClinicFilter);
} else {
    setupReportsClinicFilter();
}
function setupReportsClinicFilter() {
    // Get user info to determine role
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    
    // Hide clinic filter for employees
    const filterRow = document.querySelector('.filter-row:has(#report-clinic-filter)');
    if (filterRow) {
        filterRow.style.display = (isAdmin || isManager) ? 'flex' : 'none';
    }
    
    // Only populate if not already done and user is admin/manager
    if (!clinicFilterPopulated && (isAdmin || isManager)) {
    populateClinicFilter();
    }
    
    const clinicFilter = document.getElementById('report-clinic-filter');
    if (clinicFilter && (isAdmin || isManager)) {
        // Check if event listener is already added
        if (!clinicFilter.hasAttribute('data-event-attached')) {
        clinicFilter.addEventListener('change', function() {
            fetchAttendanceReportData();
                // Also update working hours if we're an admin/manager
                if (isAdmin || isManager) {
                    fetchWorkingHoursData();
                }
            });
            // Mark that event listener has been attached
            clinicFilter.setAttribute('data-event-attached', 'true');
        }
    }
}

// Initialize working hours report
function initializeWorkingHoursReport() {
    // Check user role - only show for admin/manager
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    
    if (!isAdmin && !isManager) {
        // Hide the working hours section if not admin/manager
        const workingHoursSection = document.querySelector('.working-hours-report');
        if (workingHoursSection) {
            workingHoursSection.style.display = 'none';
        }
        return;
    }
    
    // Show the working hours section
    const workingHoursSection = document.querySelector('.working-hours-report');
    if (workingHoursSection) {
        workingHoursSection.style.display = 'block';
    }
    
    // Initialize clinic filter for working hours
    populateWorkingHoursClinicFilter();
    
    // Initialize month selector
    initializeMonthSelector();
    
    // Fetch working hours data for current month
    fetchWorkingHoursData();
}

// Keep track of working hours filter initialization
let workingHoursClinicFilterPopulated = false;

// Populate clinic filter for working hours section
async function populateWorkingHoursClinicFilter() {
    // Prevent duplicate population
    if (workingHoursClinicFilterPopulated) {
        console.log('Working hours clinic filter already populated, skipping...');
        return;
    }
    workingHoursClinicFilterPopulated = true;
    
    const clinicFilter = document.getElementById('working-hours-clinic-filter');
    if (!clinicFilter) {
        workingHoursClinicFilterPopulated = false; // Reset if element not found
        console.error('Working hours clinic filter element not found.');
        return;
    }
    
    // Clear existing options except 'All Clinics'
    clinicFilter.innerHTML = '<option value="all">All Clinics</option>';
    
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';
        const response = await fetch(`${API_BASE_URL}/clinic/getClinics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const clinics = await response.json();
            clinics.forEach(clinic => {
                const option = document.createElement('option');
                option.value = clinic.clinicId;
                option.textContent = clinic.clinicName;
                clinicFilter.appendChild(option);
            });
            
            // Add event listener for clinic filter change
            if (!clinicFilter.hasAttribute('data-event-attached')) {
                clinicFilter.addEventListener('change', function() {
                    fetchWorkingHoursData();
                });
                clinicFilter.setAttribute('data-event-attached', 'true');
            }
            // Successfully populated, workingHoursClinicFilterPopulated remains true.
        } else {
            workingHoursClinicFilterPopulated = false; // Reset flag on fetch failure
            console.error('Failed to load clinics for working hours filter. Status:', response.status);
        }
    } catch (err) { 
        workingHoursClinicFilterPopulated = false; // Reset flag on exception
        console.error('Error loading clinics for filter:', err);
    }
}

// Initialize month selector with months from the past year
function initializeMonthSelector() {
    const monthSelect = document.getElementById('working-hours-month');
    if (!monthSelect) return;
    
    // Clear existing options
    monthSelect.innerHTML = '';
    
    // Get current date
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Add options for the current month and past 11 months
    for (let i = 0; i < 12; i++) {
        const monthIndex = (currentMonth - i + 12) % 12;
        const year = currentYear - (monthIndex > currentMonth ? 1 : 0);
        
        const option = document.createElement('option');
        option.value = `${monthIndex + 1},${year}`;
        
        // Format month name
        const monthName = new Date(year, monthIndex, 1).toLocaleString('default', { month: 'long' });
        option.textContent = `${monthName} ${year}`;
        
        // Select current month by default
        if (i === 0) {
            option.selected = true;
        }
        
        monthSelect.appendChild(option);
    }
    
    // Add event listener for month change
    monthSelect.addEventListener('change', function() {
        fetchWorkingHoursData();
    });
}

// Fetch working hours data from the API
async function fetchWorkingHoursData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            showNoDataMessage('You must be logged in to view this report.');
            return;
        }
        
        console.log('Fetching working hours data...');
        
        // Get selected month and year
        const monthSelect = document.getElementById('working-hours-month');
        if (!monthSelect) {
            console.error('Month select element not found in DOM');
            showNoDataMessage('Error: Could not find month selector.');
            return;
        }
        
        const [month, year] = monthSelect.value.split(',');
        console.log(`Selected month: ${month}, year: ${year}`);
        
        // Get selected clinic
        const clinicFilter = document.getElementById('working-hours-clinic-filter');
        const clinicId = clinicFilter ? clinicFilter.value : 'all';
        console.log(`Selected clinic: ${clinicId}`);
        
        // Show loading message
        const tableBody = document.getElementById('working-hours-table-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3" class="loading-message">Loading working hours data...</td></tr>';
        } else {
            console.error('Working hours table body not found in DOM');
        }
        
        const API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';
        const url = `${API_BASE_URL}/attendance/working-hours?month=${month}&year=${year}&clinicId=${clinicId}`;
        console.log(`Fetching from URL: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Successfully fetched working hours data:', data);
            renderWorkingHoursTable(data);
        } else {
            const errorText = await response.text();
            console.error('Error fetching working hours data:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            showNoDataMessage('Error loading data. Please try again later.');
        }
    } catch (error) {
        console.error('Exception while fetching working hours data:', error);
        showNoDataMessage('Error loading data. Please try again later.');
    }
}

// Render working hours data in table
function renderWorkingHoursTable(data) {
    const tableBody = document.getElementById('working-hours-table-body');
    if (!tableBody) return;
    
    if (!data.employees || data.employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="no-records-message">No working hours data found for the selected period.</td></tr>';
        return;
    }
    
    let html = '';
    data.employees.forEach(employee => {
        // Format hours in HH:MM format
        const totalHours = formatHoursToHHMM(employee.totalHours);
        
        html += `
            <tr>
                <td>${employee.name}</td>
                <td>${employee.department || 'Not Assigned'}</td>
                <td>${totalHours}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Format decimal hours to "HH hours MM minutes" format
function formatHoursToHHMM(decimalHours) {
    // Calculate hours and minutes
    let hours = Math.floor(decimalHours);
    let minutes = Math.round((decimalHours - hours) * 60);
    
    // Handle case where minutes round up to 60
    if (minutes === 60) {
        hours += 1;
        minutes = 0;
    }
    
    // Format with proper unit labels
    const hourLabel = hours === 1 ? 'hour' : 'hours';
    const minuteLabel = minutes === 1 ? 'minute' : 'minutes';
    
    // Format with proper pluralization
    if (minutes === 0) {
        return `${hours} ${hourLabel}`;
    } else if (hours === 0) {
        return `${minutes} ${minuteLabel}`;
    } else {
        return `${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
    }
}

// Show no data message in table
function showNoDataMessage(message) {
    const tableBody = document.getElementById('working-hours-table-body');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="3" class="no-records-message">${message}</td></tr>`;
    }
}
