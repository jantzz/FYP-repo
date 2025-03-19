// Attendance Rate functionality
// Store chart instances so they can be destroyed before recreating
const attendanceChartInstances = {
    attendanceHistoryChart: null,
    punctualityChart: null,
    departmentComparisonChart: null
};

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (!document.querySelector('.sidebar')) return;

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
});

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

// Function to initialize the attendance charts and data
function initializeAttendance() {
    console.log('Initializing attendance data');
    
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
function updateAttendanceData(period) {
    console.log('Updating attendance data for period:', period);
    
    // In a real app, this would fetch data from the backend
    // For this demo, we'll use sample data
    
    let attendanceRate, onTimeDays, lateArrivals, absences, approvedLeave;
    
    // Set sample data based on the selected period
    switch(period) {
        case 'weekly':
            attendanceRate = 90;
            onTimeDays = 4;
            lateArrivals = 0;
            absences = 0;
            approvedLeave = 1;
            break;
        case 'monthly':
            attendanceRate = 85;
            onTimeDays = 17;
            lateArrivals = 2;
            absences = 1;
            approvedLeave = 0;
            break;
        case 'quarterly':
            attendanceRate = 87;
            onTimeDays = 52;
            lateArrivals = 6;
            absences = 2;
            approvedLeave = 2;
            break;
        case 'yearly':
            attendanceRate = 83;
            onTimeDays = 205;
            lateArrivals = 18;
            absences = 7;
            approvedLeave = 15;
            break;
        default:
            attendanceRate = 85;
            onTimeDays = 17;
            lateArrivals = 2;
            absences = 1;
            approvedLeave = 0;
    }
    
    // Update the UI with the new data
    updateAttendanceUI(attendanceRate, onTimeDays, lateArrivals, absences, approvedLeave);
    
    // Reinitialize charts with the new data
    initializeAttendanceCharts(period);
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
    document.querySelector('.detail-item:nth-child(1) .value').textContent = onTime;
    document.querySelector('.detail-item:nth-child(2) .value').textContent = late;
    document.querySelector('.detail-item:nth-child(3) .value').textContent = absences;
    document.querySelector('.detail-item:nth-child(4) .value').textContent = leave;
}

// Function to initialize all attendance charts
function initializeAttendanceCharts(period = 'monthly') {
    createAttendanceHistoryChart(period);
    createPunctualityChart(period);
    createDepartmentComparisonChart(period);
}

// Function to create attendance history chart
function createAttendanceHistoryChart(period) {
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
        
        // Prepare data based on the selected period
        let labels, data;
        
        switch(period) {
            case 'weekly':
                labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                data = [100, 100, 0, 100, 100]; // 0 means absent
                break;
            case 'monthly':
                labels = Array.from({length: 20}, (_, i) => `Day ${i+1}`);
                data = [
                    100, 100, 100, 90, 100, 
                    100, 100, 100, 100, 0, 
                    100, 90, 100, 100, 100, 
                    100, 100, 100, 100, 100
                ];
                break;
            case 'quarterly':
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 
                          'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12'];
                data = [95, 90, 100, 85, 80, 100, 90, 100, 80, 70, 90, 85];
                break;
            case 'yearly':
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                data = [85, 88, 90, 82, 79, 85, 80, 75, 83, 87, 84, 80];
                break;
            default:
                labels = Array.from({length: 20}, (_, i) => `Day ${i+1}`);
                data = [
                    100, 100, 100, 90, 100, 
                    100, 100, 100, 100, 0, 
                    100, 90, 100, 100, 100, 
                    100, 100, 100, 100, 100
                ];
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
                        if (value < 100) return 'rgba(255, 205, 86, 0.6)'; // Late
                        return 'rgba(75, 192, 192, 0.6)'; // On time
                    }),
                    borderColor: data.map(value => {
                        if (value === 0) return 'rgb(255, 99, 132)'; // Absent
                        if (value < 100) return 'rgb(255, 205, 86)'; // Late
                        return 'rgb(75, 192, 192)'; // On time
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
                        title: {
                            display: true,
                            text: period === 'weekly' ? 'Day' : 
                                 period === 'monthly' ? 'Day of Month' :
                                 period === 'quarterly' ? 'Week' : 'Month'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                if (value === 0) return 'Absent';
                                if (value < 100) return 'Late';
                                return 'On Time';
                            }
                        }
                    },
                    legend: {
                        display: false
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
function createPunctualityChart(period) {
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
        
        // Prepare data based on the selected period
        let labels, onTimeData, lateData;
        
        switch(period) {
            case 'weekly':
                labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                onTimeData = [1, 1, 0, 1, 1];
                lateData = [0, 0, 0, 0, 0];
                break;
            case 'monthly':
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                onTimeData = [5, 4, 4, 4];
                lateData = [0, 1, 1, 0];
                break;
            case 'quarterly':
                labels = ['Month 1', 'Month 2', 'Month 3'];
                onTimeData = [18, 17, 17];
                lateData = [2, 2, 2];
                break;
            case 'yearly':
                labels = ['Q1', 'Q2', 'Q3', 'Q4'];
                onTimeData = [52, 50, 53, 50];
                lateData = [6, 5, 4, 3];
                break;
            default:
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                onTimeData = [5, 4, 4, 4];
                lateData = [0, 1, 1, 0];
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

// Function to create department comparison chart
function createDepartmentComparisonChart(period) {
    try {
        const canvas = document.getElementById('departmentComparisonChart');
        if (!canvas) {
            console.error('Department comparison chart canvas not found');
            return;
        }
        
        // Make sure we have a clean canvas
        if (attendanceChartInstances.departmentComparisonChart) {
            attendanceChartInstances.departmentComparisonChart.destroy();
            attendanceChartInstances.departmentComparisonChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Sample data - would be fetched from backend in a real app
        const departments = ['Front Desk', 'Housekeeping', 'Kitchen', 'Your Department'];
        const attendanceRates = [82, 78, 80, 85]; // Your department highlighted with the highest rate
        
        // Create chart
        attendanceChartInstances.departmentComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: departments,
                datasets: [{
                    label: 'Attendance Rate (%)',
                    data: attendanceRates,
                    backgroundColor: [
                        'rgba(128, 128, 128, 0.6)',
                        'rgba(128, 128, 128, 0.6)',
                        'rgba(128, 128, 128, 0.6)',
                        'rgba(75, 192, 192, 0.6)' // Highlight your department
                    ],
                    borderColor: [
                        'rgba(128, 128, 128, 1)',
                        'rgba(128, 128, 128, 1)',
                        'rgba(128, 128, 128, 1)',
                        'rgba(75, 192, 192, 1)' // Highlight your department
                    ],
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
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Attendance Rate: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Department comparison chart created');
    } catch (error) {
        console.error('Error creating department comparison chart:', error);
    }
}

// Helper function to find elements by text content
function findElementByText(baseSelector, searchText) {
    // Find all elements that match the base selector
    const elements = document.querySelectorAll(baseSelector);
    
    // Filter to only those containing the text
    for (let i = 0; i < elements.length; i++) {
        if (elements[i].textContent.trim() === searchText) {
            return elements[i];
        }
    }
    return null;
} 