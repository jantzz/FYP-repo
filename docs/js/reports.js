// Reports and Analytics functionality
// Store chart instances so they can be destroyed before recreating
const chartInstances = {
    performanceChart: null,
    feedbackChart: null,
    trendsChart: null,
    goalsChart: null
};

document.addEventListener('DOMContentLoaded', function() {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded! Please ensure the script is included correctly.');
        // Try to add it dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js loaded dynamically');
            initializeReportsIfNeeded();
        };
        script.onerror = function() {
            console.error('Failed to load Chart.js dynamically');
        };
        document.head.appendChild(script);
    } else {
        console.log('Chart.js is available:', typeof Chart);
        initializeReportsIfNeeded();
    }
    
    function initializeReportsIfNeeded() {
        // Check if we're on the dashboard page
        if (!document.querySelector('.sidebar')) return;

        // Add event listener to the Reports nav item - using direct text content check
        let reportNavItem = findElementByText('.sidebar .nav-item', 'Reports');
        
        // Fallback to position-based selector if text search fails
        if (!reportNavItem) {
            reportNavItem = document.querySelector('.sidebar .nav-item:nth-child(5)');
        }
        
        if (reportNavItem) {
            console.log('Found Reports nav item, adding click listener');
            reportNavItem.addEventListener('click', function() {
                console.log('Reports nav item clicked');
                showReportSection();
            });
        } else {
            console.error('Reports nav item not found');
        }

        // Check if Reports is already active on page load
        const activeItems = document.querySelectorAll('.sidebar .nav-item.active');
        for (let i = 0; i < activeItems.length; i++) {
            if (activeItems[i].textContent.trim() === 'Reports') {
                console.log('Reports is active on page load');
                showReportSection();
                break;
            }
        }
    }
});

// Function to show the report section
function showReportSection() {
    console.log('Showing report section');
    
    // Get the report section
    const reportSection = document.querySelector('.report-section');
    if (!reportSection) {
        console.error('Report section not found in the DOM');
        return;
    }
    
    // Log the initial display state
    console.log('Initial report section display:', reportSection.style.display);
    
    // Check computed style
    const computedStyle = window.getComputedStyle(reportSection);
    console.log('Computed display style:', computedStyle.display);
    
    // Force visibility
    reportSection.style.display = 'block';
    reportSection.style.visibility = 'visible';
    reportSection.style.opacity = '1';
    
    // Print dimensions
    console.log('Report section dimensions:', {
        width: reportSection.offsetWidth,
        height: reportSection.offsetHeight,
        scrollWidth: reportSection.scrollWidth,
        scrollHeight: reportSection.scrollHeight
    });
    
    // Hide all other sections
    const sections = document.querySelectorAll('.main-content > div');
    sections.forEach(section => {
        if (section.classList.contains('report-section')) {
            section.style.display = 'block';
            console.log('Made report section visible');
        } else {
            section.style.display = 'none';
        }
    });

    // Remove active class from all nav items
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to Reports nav item
    let reportsNavItem = findElementByText('.sidebar .nav-item', 'Reports');
    
    // Fallback to position-based selector if text search fails
    if (!reportsNavItem) {
        reportsNavItem = document.querySelector('.sidebar .nav-item:nth-child(5)');
    }
    
    if (reportsNavItem) {
        reportsNavItem.classList.add('active');
    }

    // Initialize the report content with a slight delay to ensure DOM rendering
    setTimeout(() => {
        console.log('Starting chart initialization after delay');
        initializeReports();
    }, 50);
}

// Function to initialize the reports
function initializeReports() {
    console.log('Initializing reports');
    const reportSection = document.querySelector('.report-section');
    
    if (!reportSection) {
        console.error('Report section not found');
        return;
    }
    
    // Clean up any existing charts first
    destroyExistingCharts();
    
    // Check if canvas elements exist and recreate them if necessary
    const chartContainers = reportSection.querySelectorAll('.chart-container');
    console.log(`Found ${chartContainers.length} chart containers`);
    
    chartContainers.forEach(container => {
        // Get the expected canvas ID based on the parent report card
        let canvasId = '';
        if (container.closest('.performance-metrics')) canvasId = 'performanceChart';
        else if (container.closest('.feedback-integration')) canvasId = 'feedbackChart';
        else if (container.closest('.managerial-insights')) canvasId = 'trendsChart';
        else if (container.closest('.goal-setting')) canvasId = 'goalsChart';
        else return;
        
        // Check if the canvas exists
        let canvas = container.querySelector(`canvas#${canvasId}`);
        if (!canvas) {
            console.log(`Canvas #${canvasId} not found, creating it`);
            // Create new canvas
            canvas = document.createElement('canvas');
            canvas.id = canvasId;
            // Clear container and add new canvas
            container.innerHTML = '';
            container.appendChild(canvas);
        } else {
            console.log(`Canvas #${canvasId} found`);
        }
    });
    
    // Create charts after DOM is fully loaded
    setTimeout(() => {
        try {
            // Debug info
            const canvases = reportSection.querySelectorAll('canvas');
            console.log(`Found ${canvases.length} canvas elements:`, Array.from(canvases).map(c => c.id));
            
            // Check if canvas elements exist
            const performanceCanvas = document.getElementById('performanceChart');
            const feedbackCanvas = document.getElementById('feedbackChart');
            const trendsCanvas = document.getElementById('trendsChart');
            const goalsCanvas = document.getElementById('goalsChart');
            
            console.log('Canvas elements found:', {
                performance: !!performanceCanvas,
                feedback: !!feedbackCanvas,
                trends: !!trendsCanvas,
                goals: !!goalsCanvas
            });
            
            // Create each chart if the canvas exists
            if (performanceCanvas) {
                createPerformanceChart();
            } else {
                console.error('Performance chart canvas not found');
            }
            
            if (feedbackCanvas) {
                createFeedbackChart();
            } else {
                console.error('Feedback chart canvas not found');
            }
            
            if (trendsCanvas) {
                createTrendsChart();
            } else {
                console.error('Trends chart canvas not found');
            }
            
            if (goalsCanvas) {
                createGoalsChart();
            } else {
                console.error('Goals chart canvas not found');
            }
            
            // Add event listeners for export buttons
            const pdfBtn = document.getElementById('export-pdf');
            if (pdfBtn) {
                pdfBtn.removeEventListener('click', exportPDF); // Remove existing listener
                pdfBtn.addEventListener('click', exportPDF); // Add fresh listener
            }
            
            const csvBtn = document.getElementById('export-csv');
            if (csvBtn) {
                csvBtn.removeEventListener('click', exportCSV); // Remove existing listener
                csvBtn.addEventListener('click', exportCSV); // Add fresh listener
            }
            
            console.log('Charts created successfully');
        } catch (error) {
            console.error('Error creating charts:', error);
        }
    }, 300); // Increased timeout to ensure DOM is fully rendered
}

// Function to destroy existing chart instances
function destroyExistingCharts() {
    console.log('Destroying existing charts');
    
    // Destroy each chart instance if it exists
    Object.keys(chartInstances).forEach(key => {
        try {
            if (chartInstances[key]) {
                console.log(`Destroying chart: ${key}`);
                chartInstances[key].destroy();
            }
        } catch (err) {
            console.warn(`Error destroying chart ${key}:`, err);
        } finally {
            chartInstances[key] = null;
        }
    });
}

// Function to create performance metrics chart
function createPerformanceChart() {
    try {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) {
            console.error('Performance chart canvas not found');
            return;
        }
        
        // Ensure the canvas has proper dimensions
        if (canvas.parentElement) {
            canvas.parentElement.style.backgroundColor = 'white';
            canvas.style.height = '300px';
            canvas.style.width = '100%';
        }
        
        // Make sure we have a clean canvas
        if (chartInstances.performanceChart) {
            chartInstances.performanceChart.destroy();
            chartInstances.performanceChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Sample data
        const data = {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [
                {
                    label: 'Attendance Rate',
                    data: [95, 92, 96, 98],
                    backgroundColor: 'rgba(191, 85, 178, 0.5)',
                    borderColor: 'rgba(191, 85, 178, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Task Completion',
                    data: [87, 90, 85, 92],
                    backgroundColor: 'rgba(132, 70, 123, 0.5)',
                    borderColor: 'rgba(132, 70, 123, 1)',
                    borderWidth: 2
                }
            ]
        };
        
        // Create and store the chart instance
        chartInstances.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        console.log('Performance chart created');
    } catch(error) {
        console.error('Error creating performance chart:', error);
    }
}

// Function to create feedback integration chart
function createFeedbackChart() {
    try {
        const canvas = document.getElementById('feedbackChart');
        if (!canvas) {
            console.error('Feedback chart canvas not found');
            return;
        }
        
        // Ensure the canvas has proper dimensions
        if (canvas.parentElement) {
            canvas.parentElement.style.backgroundColor = 'white';
            canvas.style.height = '300px';
            canvas.style.width = '100%';
        }
        
        // Make sure we have a clean canvas
        if (chartInstances.feedbackChart) {
            chartInstances.feedbackChart.destroy();
            chartInstances.feedbackChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Sample data
        const data = {
            labels: ['Communication', 'Teamwork', 'Problem Solving', 'Technical Skills', 'Leadership'],
            datasets: [{
                label: 'Average Peer Rating',
                data: [4.2, 3.8, 4.5, 4.0, 3.7],
                backgroundColor: 'rgba(191, 85, 178, 0.8)',
                borderWidth: 0
            }]
        };
        
        // Create and store the chart instance
        chartInstances.feedbackChart = new Chart(ctx, {
            type: 'polarArea',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0,
                        max: 5
                    }
                }
            }
        });
        
        console.log('Feedback chart created');
    } catch (error) {
        console.error('Error creating feedback chart:', error);
    }
}

// Function to create managerial insights chart
function createTrendsChart() {
    try {
        const canvas = document.getElementById('trendsChart');
        if (!canvas) {
            console.error('Trends chart canvas not found');
            return;
        }
        
        // Ensure the canvas has proper dimensions
        if (canvas.parentElement) {
            canvas.parentElement.style.backgroundColor = 'white';
            canvas.style.height = '300px';
            canvas.style.width = '100%';
        }
        
        // Make sure we have a clean canvas
        if (chartInstances.trendsChart) {
            chartInstances.trendsChart.destroy();
            chartInstances.trendsChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Sample data - monthly performance score trends
        const data = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Performance Score',
                data: [75, 78, 74, 79, 80, 82, 86, 85, 83, 88, 89, 91],
                fill: false,
                borderColor: 'rgba(191, 85, 178, 1)',
                tension: 0.4,
                pointBackgroundColor: 'rgba(191, 85, 178, 1)',
                pointRadius: 4
            }]
        };
        
        // Create and store the chart instance
        chartInstances.trendsChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 70,
                        max: 100
                    }
                }
            }
        });
        
        console.log('Trends chart created');
    } catch (error) {
        console.error('Error creating trends chart:', error);
    }
}

// Function to create goal setting and progress chart
function createGoalsChart() {
    try {
        const canvas = document.getElementById('goalsChart');
        if (!canvas) {
            console.error('Goals chart canvas not found');
            return;
        }
        
        // Ensure the canvas has proper dimensions
        if (canvas.parentElement) {
            canvas.parentElement.style.backgroundColor = 'white';
            canvas.style.height = '300px';
            canvas.style.width = '100%';
        }
        
        // Make sure we have a clean canvas
        if (chartInstances.goalsChart) {
            chartInstances.goalsChart.destroy();
            chartInstances.goalsChart = null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Sample data - scatter plot of goals vs achievement
        const data = {
            datasets: [{
                label: 'Team Goals',
                data: [
                    { x: 30, y: 25 },
                    { x: 50, y: 45 },
                    { x: 70, y: 75 },
                    { x: 85, y: 80 },
                    { x: 90, y: 95 },
                    { x: 40, y: 35 },
                    { x: 60, y: 65 },
                    { x: 75, y: 70 },
                    { x: 95, y: 85 },
                    { x: 25, y: 20 },
                    { x: 45, y: 40 },
                    { x: 65, y: 60 },
                    { x: 80, y: 75 },
                    { x: 20, y: 15 },
                    { x: 55, y: 50 },
                    { x: 35, y: 30 },
                    { x: 15, y: 10 },
                    { x: 10, y: 5 },
                    { x: 5, y: 3 },
                    { x: 98, y: 99 }
                ],
                backgroundColor: 'rgba(191, 85, 178, 0.7)',
                pointRadius: 6
            }]
        };
        
        // Create and store the chart instance
        chartInstances.goalsChart = new Chart(ctx, {
            type: 'scatter',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Goal Target'
                        },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Actual Achievement'
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
        
        console.log('Goals chart created');
    } catch (error) {
        console.error('Error creating goals chart:', error);
    }
}

// Function to export as PDF
function exportPDF() {
    alert('Exporting report as PDF...');
}

// Function to export as CSV
function exportCSV() {
    alert('Exporting data as CSV...');
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