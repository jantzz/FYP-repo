// Manager functionality for handling availability requests
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is manager or admin
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.role !== 'manager' && userInfo.role !== 'admin') {
        // Hide manager sections if not a manager
        const managerSections = document.querySelectorAll('.manager-only');
        managerSections.forEach(section => {
            section.style.display = 'none';
        });
        return;
    }

    // Initialize the pending requests tab
    initPendingRequestsTab();
    
    // Load pending requests when the tab is clicked
    document.getElementById('pending-requests-tab').addEventListener('click', loadPendingRequests);
});

// Initialize the pending requests tab
function initPendingRequestsTab() {
    // Create the tab if it doesn't exist
    let tabContainer = document.querySelector('.schedule-tabs');
    if (!tabContainer) {
        console.error('Schedule tabs container not found!');
        return;
    }
    
    if (!document.getElementById('pending-requests-tab')) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab manager-only';
        tabItem.id = 'pending-requests-tab';
        tabItem.textContent = 'Pending Requests';
        tabContainer.appendChild(tabItem);
    }
    
    // Create the content section if it doesn't exist
    let scheduleSection = document.querySelector('.schedule-section');
    if (!scheduleSection) {
        console.error('Schedule section not found!');
        return;
    }
    
    if (!document.getElementById('pending-requests-content')) {
        const contentSection = document.createElement('div');
        contentSection.className = 'tab-content manager-only';
        contentSection.id = 'pending-requests-content';
        contentSection.style.display = 'none';
        
        contentSection.innerHTML = `
            <div class="section-header">
                <h2>Pending Availability Requests</h2>
                <div class="filter-options">
                    <select id="department-filter">
                        <option value="">All Departments</option>
                        <option value="Front Desk">Front Desk</option>
                        <option value="Housekeeping">Housekeeping</option>
                        <option value="Kitchen">Kitchen</option>
                    </select>
                    <select id="date-range-filter">
                        <option value="7">Next 7 Days</option>
                        <option value="14">Next 14 Days</option>
                        <option value="30">Next 30 Days</option>
                        <option value="all">All Pending</option>
                    </select>
                </div>
            </div>
            
            <div class="requests-container">
                <div class="requests-loading">Loading requests...</div>
                <div class="requests-empty" style="display: none;">No pending requests found.</div>
                <div class="requests-list"></div>
            </div>
        `;
        
        scheduleSection.appendChild(contentSection);
        
        // Add event listeners for filter changes
        document.getElementById('department-filter')?.addEventListener('change', loadPendingRequests);
        document.getElementById('date-range-filter')?.addEventListener('change', loadPendingRequests);
    }
    
    // Add tab switching logic
    const tabs = document.querySelectorAll('.schedule-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Hide all content sections
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            if (this.id === 'pending-requests-tab') {
                document.getElementById('pending-requests-content').style.display = 'block';
                loadPendingRequests();
            } else if (this.id === 'availability-tab') {
                document.getElementById('availability-content').style.display = 'block';
            } else if (this.id === 'roster-tab') {
                document.getElementById('roster-content').style.display = 'block';
            }
        });
    });
}

// Load pending availability requests
async function loadPendingRequests() {
    const requestsContainer = document.querySelector('.requests-list');
    const loadingElement = document.querySelector('.requests-loading');
    const emptyElement = document.querySelector('.requests-empty');
    
    if (!requestsContainer || !loadingElement || !emptyElement) {
        console.error('Required elements not found!');
        return;
    }
    
    // Show loading indicator
    loadingElement.style.display = 'block';
    emptyElement.style.display = 'none';
    requestsContainer.innerHTML = '';
    
    try {
        // Get filter values
        const departmentFilter = document.getElementById('department-filter')?.value || '';
        const dateRangeFilter = document.getElementById('date-range-filter')?.value || '7';
        
        // Construct query parameters
        let queryParams = new URLSearchParams();
        if (departmentFilter) {
            queryParams.append('department', departmentFilter);
        }
        if (dateRangeFilter && dateRangeFilter !== 'all') {
            queryParams.append('days', dateRangeFilter);
        }
        
        // Make API request
        const response = await fetch(`/api/availability/pending?${queryParams.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch pending requests: ${response.status}`);
        }
        
        const pendingRequests = await response.json();
        console.log('Pending requests:', pendingRequests);
        
        // Hide loading indicator
        loadingElement.style.display = 'none';
        
        // Check if there are any requests
        if (!pendingRequests || pendingRequests.length === 0) {
            emptyElement.style.display = 'block';
            return;
        }
        
        // Group requests by employee
        const groupedRequests = {};
        pendingRequests.forEach(request => {
            if (!groupedRequests[request.employeeId]) {
                groupedRequests[request.employeeId] = {
                    employee: {
                        id: request.employeeId,
                        name: request.employeeName || 'Unknown',
                        department: request.department || 'Unassigned',
                    },
                    requests: []
                };
            }
            groupedRequests[request.employeeId].requests.push(request);
        });
        
        // Build the UI for requests
        Object.values(groupedRequests).forEach(group => {
            const employeeCard = document.createElement('div');
            employeeCard.className = 'employee-requests-card';
            
            // Create header with employee info
            const header = document.createElement('div');
            header.className = 'employee-header';
            header.innerHTML = `
                <div class="employee-info">
                    <div class="employee-name">${group.employee.name}</div>
                    <div class="employee-department">${group.employee.department}</div>
                </div>
                <div class="request-count">${group.requests.length} pending</div>
            `;
            employeeCard.appendChild(header);
            
            // Create request list
            const requestsList = document.createElement('div');
            requestsList.className = 'employee-requests-list';
            
            group.requests.forEach(request => {
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.dataset.id = request.id;
                
                // Format dates and times
                const startDate = new Date(request.startDate);
                const endDate = new Date(request.endDate);
                const dateDisplay = startDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                });
                const timeDisplay = `${startDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })} - ${endDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })}`;
                
                requestItem.innerHTML = `
                    <div class="request-details">
                        <div class="request-date">${dateDisplay}</div>
                        <div class="request-time">${timeDisplay}</div>
                        <div class="request-shift">${request.preferredShift}</div>
                        ${request.note ? `<div class="request-note">${request.note}</div>` : ''}
                    </div>
                    <div class="request-actions">
                        <button class="btn-approve" data-id="${request.id}">Approve</button>
                        <button class="btn-reject" data-id="${request.id}">Reject</button>
                    </div>
                `;
                
                requestsList.appendChild(requestItem);
            });
            
            employeeCard.appendChild(requestsList);
            requestsContainer.appendChild(employeeCard);
        });
        
        // Add event listeners for approve/reject buttons
        document.querySelectorAll('.btn-approve').forEach(button => {
            button.addEventListener('click', function() {
                updateAvailabilityStatus(this.dataset.id, 'approved');
            });
        });
        
        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', function() {
                updateAvailabilityStatus(this.dataset.id, 'rejected');
            });
        });
        
    } catch (error) {
        console.error('Error loading pending requests:', error);
        loadingElement.style.display = 'none';
        requestsContainer.innerHTML = `<div class="error-message">Failed to load pending requests: ${error.message}</div>`;
    }
}

// Update availability status (approve/reject)
async function updateAvailabilityStatus(requestId, status) {
    // Show loading indicator on the button
    const button = document.querySelector(`button[data-id="${requestId}"]`);
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Processing...';
    
    try {
        // Make API request to update status
        const response = await fetch('/api/availability/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                id: requestId,
                status: status
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update status: ${response.status}`);
        }
        
        // Remove the request item from the UI
        const requestItem = document.querySelector(`.request-item[data-id="${requestId}"]`);
        if (requestItem) {
            requestItem.classList.add(status);
            requestItem.innerHTML = `
                <div class="request-status">
                    <div class="status-icon ${status}"></div>
                    <div class="status-text">Request ${status}</div>
                </div>
            `;
            
            // Fade out and remove after animation
            setTimeout(() => {
                requestItem.style.opacity = '0';
                setTimeout(() => {
                    requestItem.remove();
                    
                    // Check if this was the last request for the employee
                    const parentList = requestItem.closest('.employee-requests-list');
                    if (parentList && parentList.children.length === 0) {
                        const employeeCard = parentList.closest('.employee-requests-card');
                        if (employeeCard) {
                            employeeCard.remove();
                        }
                    }
                    
                    // Check if there are any requests left
                    if (document.querySelectorAll('.request-item').length === 0) {
                        document.querySelector('.requests-empty').style.display = 'block';
                    }
                }, 500);
            }, 1000);
        }
        
    } catch (error) {
        console.error(`Error updating availability status to ${status}:`, error);
        alert(`Failed to ${status} request: ${error.message}`);
        
        // Reset button
        button.textContent = originalText;
        button.disabled = false;
    }
} 