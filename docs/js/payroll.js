// Payroll functionality
// Store chart instances so they can be destroyed before recreating
const payrollChartInstances = {
    earningsChart: null,
    deductionsChart: null
};

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (!document.querySelector('.sidebar')) return;

    // Add event listener to the Payroll nav item
    const payrollNavItem = findElementByText('.sidebar .nav-item', 'Payroll');
    
    if (payrollNavItem) {
        console.log('Found Payroll nav item, adding click listener');
        payrollNavItem.addEventListener('click', function() {
            console.log('Payroll nav item clicked');
            showPayrollSection();
        });
    } else {
        console.error('Payroll nav item not found');
    }

    // Set up period filter change event
    const periodFilter = document.getElementById('payroll-period-filter');
    if (periodFilter) {
        periodFilter.addEventListener('change', function() {
            console.log('Period filter changed to:', this.value);
            updatePayrollData(this.value);
        });
    }

    // Set up calculate button
    const calculateBtn = document.getElementById('calculate-payroll');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', function() {
            console.log('Calculate button clicked');
            calculatePayroll();
        });
    }

    // Set up tab switching
    const tabs = document.querySelectorAll('.tab-header .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
});

// Function to show the payroll section
function showPayrollSection() {
    console.log('Showing payroll section');
    
    // Hide all other sections
    const sections = document.querySelectorAll('.main-content > div');
    sections.forEach(section => {
        if (section.classList.contains('payroll-section')) {
            section.style.display = 'block';
            console.log('Made payroll section visible');
        } else {
            section.style.display = 'none';
        }
    });

    // Remove active class from all nav items
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to Payroll nav item
    const payrollNavItem = findElementByText('.sidebar .nav-item', 'Payroll');
    if (payrollNavItem) {
        payrollNavItem.classList.add('active');
    }

    // Initialize the payroll data and charts
    initializePayroll();
}

// Function to initialize the payroll data and charts
function initializePayroll() {
    console.log('Initializing payroll data');
    
    // Load sample data
    loadSampleData();
    
    // Initialize tabs and charts
    switchTab('hours');
    initializePayrollCharts();
}

// Function to load sample payroll data
function loadSampleData() {
    // Sample hours data
    const hoursData = [
        { date: '2025-03-01', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-02', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-03', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-04', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-05', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-08', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-09', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-10', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-11', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-12', shift: 'Morning', clockIn: '09:00', clockOut: '17:00', break: '30 min', hours: '7.5', type: 'Regular' },
        { date: '2025-03-15', shift: 'Weekend', clockIn: '10:00', clockOut: '17:30', break: '30 min', hours: '7.0', type: 'Overtime' }
    ];
    
    // Populate hours table
    const hoursTableBody = document.getElementById('hours-table-body');
    if (hoursTableBody) {
        let html = '';
        hoursData.forEach(day => {
            html += `
                <tr>
                    <td>${formatDate(day.date)}</td>
                    <td>${day.shift}</td>
                    <td>${day.clockIn}</td>
                    <td>${day.clockOut}</td>
                    <td>${day.break}</td>
                    <td>${day.hours}</td>
                    <td>${day.type}</td>
                </tr>
            `;
        });
        hoursTableBody.innerHTML = html;
    }
    
    // Sample payment history data
    const historyData = [
        { period: 'Feb 15 - Feb 28, 2025', gross: '$1,620.00', deductions: '$365.50', net: '$1,254.50', date: 'Mar 5, 2025', status: 'Paid' },
        { period: 'Feb 1 - Feb 14, 2025', gross: '$1,600.00', deductions: '$360.00', net: '$1,240.00', date: 'Feb 20, 2025', status: 'Paid' },
        { period: 'Jan 15 - Jan 31, 2025', gross: '$1,680.00', deductions: '$378.00', net: '$1,302.00', date: 'Feb 5, 2025', status: 'Paid' },
        { period: 'Jan 1 - Jan 14, 2025', gross: '$1,600.00', deductions: '$360.00', net: '$1,240.00', date: 'Jan 20, 2025', status: 'Paid' }
    ];
    
    // Populate history table
    const historyTableBody = document.getElementById('history-table-body');
    if (historyTableBody) {
        let html = '';
        historyData.forEach(payment => {
            html += `
                <tr>
                    <td>${payment.period}</td>
                    <td>${payment.gross}</td>
                    <td>${payment.deductions}</td>
                    <td>${payment.net}</td>
                    <td>${payment.date}</td>
                    <td><span class="status-badge ${payment.status.toLowerCase()}">${payment.status}</span></td>
                    <td>
                        <span class="payroll-action view">View</span>
                        <span class="payroll-action download">Download</span>
                    </td>
                </tr>
            `;
        });
        historyTableBody.innerHTML = html;
    }
}

// Function to switch between tabs
function switchTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-header .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active class to selected tab
    const selectedTab = document.querySelector(`.tab-header .tab[data-tab="${tabId}"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Hide all tab panes
    document.querySelectorAll('.tab-content .tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // Show selected tab pane
    const selectedPane = document.getElementById(`${tabId}-tab`);
    if (selectedPane) {
        selectedPane.classList.add('active');
        
        // Initialize charts if needed
        if (tabId === 'earnings') {
            createEarningsChart();
        } else if (tabId === 'deductions') {
            createDeductionsChart();
        }
    }
}

// Function to update payroll data based on selected period
function updatePayrollData(period) {
    console.log('Updating payroll data for period:', period);
    
    let payPeriod, totalHours, regularHours, overtimeHours, hourlyRate;
    let regularPay, overtimePay, bonusPay, grossPay;
    let taxDeduction, insuranceDeduction, otherDeduction, totalDeduction, netPay;
    
    // Set sample data based on the selected period
    switch(period) {
        case 'current':
            payPeriod = 'March 1 - March 15, 2025';
            totalHours = 80.0;
            regularHours = 76.5;
            overtimeHours = 3.5;
            hourlyRate = '$20.00';
            regularPay = '$1,530.00';
            overtimePay = '$105.00';
            bonusPay = '$0.00';
            grossPay = '$1,635.00';
            taxDeduction = '$245.25';
            insuranceDeduction = '$75.00';
            otherDeduction = '$50.00';
            totalDeduction = '$370.25';
            netPay = '$1,264.75';
            break;
            
        case 'previous':
            payPeriod = 'February 15 - February 28, 2025';
            totalHours = 78.0;
            regularHours = 76.0;
            overtimeHours = 2.0;
            hourlyRate = '$20.00';
            regularPay = '$1,520.00';
            overtimePay = '$60.00';
            bonusPay = '$40.00';
            grossPay = '$1,620.00';
            taxDeduction = '$243.00';
            insuranceDeduction = '$75.00';
            otherDeduction = '$47.50';
            totalDeduction = '$365.50';
            netPay = '$1,254.50';
            break;
            
        case 'custom':
            // This would normally open a date picker, but for demo we'll use fixed data
            payPeriod = 'Custom Date Range';
            totalHours = 75.0;
            regularHours = 75.0;
            overtimeHours = 0.0;
            hourlyRate = '$20.00';
            regularPay = '$1,500.00';
            overtimePay = '$0.00';
            bonusPay = '$0.00';
            grossPay = '$1,500.00';
            taxDeduction = '$225.00';
            insuranceDeduction = '$75.00';
            otherDeduction = '$45.00';
            totalDeduction = '$345.00';
            netPay = '$1,155.00';
            break;
            
        default:
            payPeriod = 'March 1 - March 15, 2025';
            totalHours = 80.0;
            regularHours = 76.5;
            overtimeHours = 3.5;
            hourlyRate = '$20.00';
            regularPay = '$1,530.00';
            overtimePay = '$105.00';
            bonusPay = '$0.00';
            grossPay = '$1,635.00';
            taxDeduction = '$245.25';
            insuranceDeduction = '$75.00';
            otherDeduction = '$50.00';
            totalDeduction = '$370.25';
            netPay = '$1,264.75';
    }
    
    // Update UI with the new data
    document.getElementById('pay-period-date').textContent = payPeriod;
    document.getElementById('total-hours').textContent = totalHours;
    document.getElementById('regular-hours').textContent = regularHours;
    document.getElementById('overtime-hours').textContent = overtimeHours;
    document.getElementById('hourly-rate').textContent = hourlyRate;
    document.getElementById('regular-pay').textContent = regularPay;
    document.getElementById('overtime-pay').textContent = overtimePay;
    document.getElementById('bonus-pay').textContent = bonusPay;
    document.getElementById('gross-pay').textContent = grossPay;
    document.getElementById('tax-deduction').textContent = taxDeduction;
    document.getElementById('insurance-deduction').textContent = insuranceDeduction;
    document.getElementById('other-deduction').textContent = otherDeduction;
    document.getElementById('total-deduction').textContent = totalDeduction;
    document.getElementById('net-pay').textContent = netPay;
    
    // Update charts
    initializePayrollCharts();
}

// Function to calculate payroll (simulate calculation)
function calculatePayroll() {
    // In a real app, this would calculate based on actual data
    // For demo, we'll just show an alert and update to the "current" period
    alert('Payroll calculation completed!');
    updatePayrollData('current');
}

// Function to initialize payroll charts
function initializePayrollCharts() {
    // Clean up any existing charts first
    destroyPayrollCharts();
    
    // Create new charts with a slight delay to ensure DOM is ready
    setTimeout(() => {
        if (document.querySelector('.tab-header .tab[data-tab="earnings"]').classList.contains('active')) {
            createEarningsChart();
        }
        
        if (document.querySelector('.tab-header .tab[data-tab="deductions"]').classList.contains('active')) {
            createDeductionsChart();
        }
    }, 100);
}

// Function to destroy existing chart instances
function destroyPayrollCharts() {
    console.log('Destroying existing payroll charts');
    
    // Destroy each chart instance if it exists
    Object.keys(payrollChartInstances).forEach(key => {
        try {
            if (payrollChartInstances[key]) {
                console.log(`Destroying chart: ${key}`);
                payrollChartInstances[key].destroy();
            }
        } catch (err) {
            console.warn(`Error destroying chart ${key}:`, err);
        } finally {
            payrollChartInstances[key] = null;
        }
    });
}

// Function to create earnings chart
function createEarningsChart() {
    try {
        const canvas = document.getElementById('earningsChart');
        if (!canvas) {
            console.error('Earnings chart canvas not found');
            return;
        }
        
        // Get current period data
        const regularPay = parseFloat(document.getElementById('regular-pay').textContent.replace(/[$,]/g, ''));
        const overtimePay = parseFloat(document.getElementById('overtime-pay').textContent.replace(/[$,]/g, ''));
        const bonusPay = parseFloat(document.getElementById('bonus-pay').textContent.replace(/[$,]/g, ''));
        
        const ctx = canvas.getContext('2d');
        
        // Create chart
        payrollChartInstances.earningsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Regular Pay', 'Overtime Pay', 'Bonus'],
                datasets: [{
                    data: [regularPay, overtimePay, bonusPay],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Earnings chart created');
    } catch (error) {
        console.error('Error creating earnings chart:', error);
    }
}

// Function to create deductions chart
function createDeductionsChart() {
    try {
        const canvas = document.getElementById('deductionsChart');
        if (!canvas) {
            console.error('Deductions chart canvas not found');
            return;
        }
        
        // Get current period data
        const taxDeduction = parseFloat(document.getElementById('tax-deduction').textContent.replace(/[$,]/g, ''));
        const insuranceDeduction = parseFloat(document.getElementById('insurance-deduction').textContent.replace(/[$,]/g, ''));
        const otherDeduction = parseFloat(document.getElementById('other-deduction').textContent.replace(/[$,]/g, ''));
        
        const ctx = canvas.getContext('2d');
        
        // Create chart
        payrollChartInstances.deductionsChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Tax', 'Insurance', 'Other'],
                datasets: [{
                    data: [taxDeduction, insuranceDeduction, otherDeduction],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Deductions chart created');
    } catch (error) {
        console.error('Error creating deductions chart:', error);
    }
}

// Helper function to format date for display
function formatDate(dateString) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
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