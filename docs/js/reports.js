// Store chart instances so they can be destroyed before recreating
const reportChartInstances = {
    attendanceHistoryChart: null,
    punctualityChart: null,
    timeOffBreakdownChart: null
};

// Initialize Reports functionality
function initializeReports() {
    try {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            showNotification('Error loading charts: Chart.js library is missing', 'error');
            return;
        }
        
        // Clean up any existing charts first
        destroyReportCharts();
        
        // Small delay to ensure DOM is updated after chart destruction
        setTimeout(() => {
            try {
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
            } catch (err) {
                // Error handling remains in place
            }
        }, 50);
    } catch (error) {
        // Error handling remains in place
    }
}

// Function to fetch real attendance data from the API
async function fetchAttendanceReportData(period = 'yearly') {
    try {
        // Get the current user info and token
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const token = localStorage.getItem('token');
        
        if (!userInfo.userId || !token) {
            renderChartsWithMockData();
            return;
        }
        
        // Set up date range based on period
        const today = new Date();
        let startDate, endDate = today.toISOString().split('T')[0];
        
        // Calculate start date based on selected period
        switch (period) {
            case 'weekly':
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(today.getDate() - 7);
                startDate = oneWeekAgo.toISOString().split('T')[0];
                break;
            case 'monthly':
                const oneMonthAgo = new Date(today);
                oneMonthAgo.setMonth(today.getMonth() - 1);
                startDate = oneMonthAgo.toISOString().split('T')[0];
                break;
            case 'quarterly':
                const threeMonthsAgo = new Date(today);
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                startDate = threeMonthsAgo.toISOString().split('T')[0];
                break;
            case 'yearly':
                const oneYearAgo = new Date(today);
                oneYearAgo.setFullYear(today.getFullYear() - 1);
                startDate = oneYearAgo.toISOString().split('T')[0];
                break;
            default:
                // Default to yearly view
                const defaultOneYearAgo = new Date(today);
                defaultOneYearAgo.setFullYear(today.getFullYear() - 1);
                startDate = defaultOneYearAgo.toISOString().split('T')[0];
        }
        
        // Use the API_BASE_URL from window or fallback to localhost
        const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8800/api';
        
        // Fetch attendance statistics from the API
        const response = await fetch(`${API_BASE_URL}/attendance/stats?employeeId=${userInfo.userId}&startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Render charts with real data
            renderAttendanceHistoryChart(data);
            renderPunctualityTrendChart(data);
            
            // Also fetch time off details if possible to show breakdown by type
            try {
                // Get time off data for the same period
                const timeOffResponse = await fetch(`${API_BASE_URL}/timeoff/employee/${userInfo.userId}?startDate=${startDate}&endDate=${endDate}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (timeOffResponse.ok) {
                    const timeOffData = await timeOffResponse.json();
                    
                    // Add a time off breakdown chart if the canvas exists
                    const timeOffCanvas = document.getElementById('timeoffBreakdownChart');
                    if (timeOffCanvas) {
                        renderTimeOffBreakdownChart(timeOffData);
                    }
                }
            } catch (err) {
                // Error handling remains in place
            }
        } else {
            renderChartsWithMockData();
        }
    } catch (error) {
        renderChartsWithMockData();
    }
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
function renderAttendanceHistoryChart(apiData = null) {
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
                            text: 'Monthly Attendance Breakdown',
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
                            text: 'Monthly Attendance Breakdown (Sample Data)',
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
function renderPunctualityTrendChart(apiData = null) {
    try {
        const chartCanvas = document.getElementById('punctualityChart');
        if (!chartCanvas) {
            return;
        }
        
        // Force cleanup any existing chart on this canvas
        safeDestroyChart('punctualityChart');
        
        const ctx = chartCanvas.getContext('2d');
        
        if (apiData && apiData.dailyBreakdown && apiData.dailyBreakdown.length > 0) {
            // Use API data
            const breakdown = apiData.dailyBreakdown;
            
            // Sort data by date to ensure chronological order
            breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Group data by month for a yearly report
            const months = {};
            breakdown.forEach(item => {
                const date = new Date(item.date);
                const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                
                if (!months[monthKey]) {
                    months[monthKey] = {
                        presentCount: 0,
                        lateCount: 0,
                        totalCount: 0
                    };
                }
                
                months[monthKey].presentCount += item.presentCount;
                months[monthKey].lateCount += item.lateCount;
                months[monthKey].totalCount += (item.presentCount + item.lateCount);
            });
            
            // Convert months object to arrays for chart
            const labels = Object.keys(months);
            
            // Calculate on-time percentage for each month
            const onTimePercentages = labels.map(month => {
                if (months[month].totalCount === 0) return 0;
                return ((months[month].presentCount / months[month].totalCount) * 100).toFixed(1);
            });
            
            // Create new chart
            reportChartInstances.punctualityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'On Time %',
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        borderColor: '#4CAF50',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#4CAF50',
                        data: onTimePercentages
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            title: {
                                display: true,
                                text: 'On-Time Percentage (%)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Month'
                            }
                        }
                    }
                }
            });
        } else {
            // Use mock data if no API data is available
            
            // Create new chart with mock data
            reportChartInstances.punctualityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'On Time %',
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        borderColor: '#4CAF50',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#4CAF50',
                        data: [90, 85, 95, 90, 82, 87, 95, 91, 86, 83, 87, 0]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 50,
                            max: 100
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
