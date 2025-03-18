// Manager functionality for handling availability requests
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is manager or admin
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    
    // Add debug logging
    console.log('Current user info:', userInfo);
    console.log('User role (lowercase):', userRole);
    console.log('Is manager or admin?:', userRole === 'manager' || userRole === 'admin');

    // Add manager-visible class to body if user is manager or admin
    if (userRole === 'manager' || userRole === 'admin') {
        document.body.classList.add('manager-visible');
        console.log('Added manager-visible class to body');
        
        // Initialize the pending requests tab
        initPendingRequestsTab();
        
        // Set up tab switching
        setupTabSwitching();
        
        // Always fetch the pending count to ensure accurate badge
        fetchPendingCount().then(count => {
            console.log(`Initialized with ${count} pending requests`);
        });
        
        // Setup a global event listener for availability updates
        window.addEventListener('availability-updated', function(e) {
            console.log('Availability update event received');
            fetchPendingCount();
        });
    } else {
        // Hide manager sections if not a manager
        document.body.classList.remove('manager-visible');
        console.log('Removed manager-visible class from body');
    }
});

// Initialize the pending requests tab
function initPendingRequestsTab() {
    console.log('Initializing pending requests tab');
    // Create the tab if it doesn't exist
    let tabContainer = document.querySelector('.schedule-tabs');
    if (!tabContainer) {
        console.error('Schedule tabs container not found!');
        return;
    }
    
    console.log('Found schedule tabs container');
    
    // Check if tab already exists
    let pendingTab = document.querySelector('.schedule-tabs .tab[data-tab="pending-requests"]');
    
    // Only create a new tab if one doesn't already exist
    if (!pendingTab) {
        console.log('Creating new pending requests tab');
        const tabItem = document.createElement('div');
        tabItem.className = 'tab manager-only';
        tabItem.id = 'pending-requests-tab-btn';
        tabItem.setAttribute('data-tab', 'pending-requests');
        tabItem.textContent = 'Pending Requests';
        tabContainer.appendChild(tabItem);
        pendingTab = tabItem;
    } else {
        console.log('Pending requests tab already exists, skipping creation');
    }
    
    // Get the pending requests tab content pane
    const pendingRequestsPane = document.getElementById('pending-requests-tab');
    if (pendingRequestsPane) {
        // Hide the "Pending Availability Requests" section by default
        // It will only be shown when the Pending Requests tab is active
        pendingRequestsPane.style.display = 'none';
        
        // Check if we're currently on the pending requests tab
        const activeTab = document.querySelector('.schedule-tabs .tab.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'pending-requests') {
            // If we're on the pending requests tab, make it visible
            pendingRequestsPane.style.display = 'block';
        }
    }
    
    // NOTE: The actual content is already defined in HTML with id="pending-requests-tab"
    // Add event listeners for filter changes if they exist
    document.getElementById('department-filter')?.addEventListener('change', loadPendingRequests);
    document.getElementById('date-range-filter')?.addEventListener('change', loadPendingRequests);
}

// Fetch just the count of pending requests to update the badge
async function fetchPendingCount() {
    try {
        console.log('Fetching pending count');
        
        // Make API request - Same endpoint but we just need the count
        const response = await fetch('http://localhost:8800/api/availability/pending', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            console.error('Error fetching pending count:', response.status);
            return;
        }
        
        const pendingRequests = await response.json();
        const count = pendingRequests.length;
        console.log(`Server reports ${count} pending requests`);
        
        // Update the badge with the count
        updatePendingCountBadge(count);
        
        // Also update any pending counts in employee cards if we're in the pending tab
        const isPendingTabActive = document.querySelector('.tab[data-tab="pending-requests"].active') !== null;
        if (isPendingTabActive && count === 0) {
            // If we're in the pending tab and no requests, show empty message
            document.querySelector('.requests-empty').style.display = 'block';
        }
        
        return count;
    } catch (error) {
        console.error('Error fetching pending count:', error);
        return 0;
    }
}

// Load pending availability requests
async function loadPendingRequests() {
    console.log('Starting to load pending requests...');
    
    // Make sure we're in the right tab (using the data-tab attribute now)
    const pendingTab = document.querySelector('.tab[data-tab="pending-requests"]');
    if (!pendingTab) {
        console.error('Pending requests tab not found!');
        return;
    }
    
    // Find the container within the tab pane
    const requestsContainer = document.querySelector('#pending-requests-tab .requests-list');
    const loadingElement = document.querySelector('#pending-requests-tab .requests-loading');
    const emptyElement = document.querySelector('#pending-requests-tab .requests-empty');
    
    if (!requestsContainer) {
        console.error('Request container not found!');
        // Create the needed containers if they don't exist
        const tabPane = document.querySelector('#pending-requests-tab');
        if (tabPane) {
            // Append the requests container structure
            const requestsContainerDiv = document.createElement('div');
            requestsContainerDiv.className = 'requests-container';
            requestsContainerDiv.innerHTML = `
                <div class="requests-loading">Loading requests...</div>
                <div class="requests-empty" style="display: none;">No pending requests found.</div>
                <div class="requests-list"></div>
            `;
            tabPane.appendChild(requestsContainerDiv);
            
            // Get the newly created elements
            const requestsContainer = document.querySelector('#pending-requests-tab .requests-list');
            const loadingElement = document.querySelector('#pending-requests-tab .requests-loading');
            const emptyElement = document.querySelector('#pending-requests-tab .requests-empty');
            
            if (!requestsContainer || !loadingElement || !emptyElement) {
                console.error('Failed to create required elements');
                return;
            }
        } else {
            console.error('Tab pane not found!');
            return;
        }
    }
    
    // Show loading indicator
    if (loadingElement) loadingElement.style.display = 'block';
    if (emptyElement) emptyElement.style.display = 'none';
    if (requestsContainer) requestsContainer.innerHTML = '';
    
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
        
        console.log('Fetching pending requests with params:', queryParams.toString());
        
        // Make API request
        const response = await fetch(`http://localhost:8800/api/availability/pending?${queryParams.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || `Failed to fetch pending requests: ${response.status}`);
            } catch (e) {
                throw new Error(`Failed to fetch pending requests: ${response.status}`);
            }
        }
        
        const pendingRequests = await response.json();
        console.log('Received pending requests:', pendingRequests);
        
        // Hide loading indicator
        if (loadingElement) loadingElement.style.display = 'none';
        
        // Check if there are any requests
        if (!pendingRequests || pendingRequests.length === 0) {
            console.log('No pending requests found');
            if (emptyElement) emptyElement.style.display = 'block';
            
            // Update the count badge in the tab - show 0 or remove badge
            updatePendingCountInTab();
            return;
        }
        
        console.log(`Found ${pendingRequests.length} pending requests`);
        
        // Update the count badge in the tab
        updatePendingCountBadge(pendingRequests.length);
        
        // Group requests by employee
        const groupedRequests = {};
        pendingRequests.forEach(request => {
            console.log('Processing request:', request);
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
        
        console.log('Grouped requests by employee:', groupedRequests);
        
        // Build the UI for requests
        Object.values(groupedRequests).forEach(group => {
            console.log(`Building UI for employee ${group.employee.name} with ${group.requests.length} requests`);
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
                console.log('Creating request item:', request);
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.dataset.id = request.availabilityId;
                requestItem.dataset.employeeId = request.employeeId;
                
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
                        <button class="btn-approve" data-id="${request.availabilityId}">Approve</button>
                        <button class="btn-reject" data-id="${request.availabilityId}">Reject</button>
                    </div>
                `;
                
                requestsList.appendChild(requestItem);
            });
            
            employeeCard.appendChild(requestsList);
            if (requestsContainer) requestsContainer.appendChild(employeeCard);
            console.log('Added employee card to container');
        });
        
        // Add event listeners for approve/reject buttons
        document.querySelectorAll('.btn-approve').forEach(button => {
            button.addEventListener('click', function() {
                const requestId = this.dataset.id;
                console.log('Approve button clicked for request:', requestId);
                if (!requestId) {
                    console.error('No request ID found for approve button');
                    return;
                }
                updateAvailabilityStatus(requestId, 'Approved');
            });
        });
        
        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', function() {
                const requestId = this.dataset.id;
                console.log('Reject button clicked for request:', requestId);
                if (!requestId) {
                    console.error('No request ID found for reject button');
                    return;
                }
                updateAvailabilityStatus(requestId, 'Declined');
            });
        });
        
        console.log('Finished loading pending requests');
        
    } catch (error) {
        console.error('Error loading pending requests:', error);
        if (loadingElement) loadingElement.style.display = 'none';
        if (requestsContainer) requestsContainer.innerHTML = `<div class="error-message">Failed to load pending requests: ${error.message}</div>`;
    }
}

// Update availability status (approve/reject)
async function updateAvailabilityStatus(availabilityId, status) {
    // Show loading indicator on the button
    const button = document.querySelector(`button[data-id="${availabilityId}"]`);
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Processing...';
    
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.userId) {
            throw new Error('User not logged in');
        }

        // Make API request - Update the URL to match backend route
        const response = await fetch('http://localhost:8800/api/availability/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                availabilityId: availabilityId,
                managerId: userInfo.userId,
                status: status
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to update status: ${response.status}`);
        }
        
        // Get the data about the request that was just updated
        const requestItem = document.querySelector(`.request-item[data-id="${availabilityId}"]`);
        const employeeId = requestItem?.dataset?.employeeId;
        
        // Find and update the request item in the UI
        if (requestItem) {
            // Get the parent employee card and request list BEFORE modifying the item
            const employeeCard = requestItem.closest('.employee-requests-card');
            const requestsList = requestItem.closest('.employee-requests-list');
            
            // Count all requests in this employee's list
            const totalRequests = requestsList ? requestsList.querySelectorAll('.request-item').length : 0;
            // This request is being processed, so remaining = total - 1
            const remainingRequests = Math.max(0, totalRequests - 1);
            
            console.log('Request counts:', {
                totalRequests,
                remainingRequests,
                employeeId: requestItem.dataset.employeeId
            });
            
            // Update the count in the employee card header
            if (employeeCard) {
                const requestCountElement = employeeCard.querySelector('.request-count');
                if (requestCountElement) {
                    requestCountElement.textContent = `${remainingRequests} pending`;
                }
            }
            
            // Now update the UI for this request item
            requestItem.classList.add(status.toLowerCase());
            requestItem.innerHTML = `
                <div class="request-status">
                    <div class="status-icon ${status.toLowerCase()}"></div>
                    <div class="status-text">Request ${status.toLowerCase()}</div>
                </div>
            `;
            
            // If we're rejecting the request, we need to update the progress bar
            // because the hours are returned to the employee's available hours
            if (status === 'Declined') {
                // Update the employee's availability data and progress bar
                refreshEmployeeAvailability();
            }
            
            // Fade out and remove after animation
            setTimeout(() => {
                requestItem.style.opacity = '0';
                setTimeout(() => {
                    // Remove the request item
                    requestItem.remove();
                    
                    // Check if this was the last request for the employee
                    if (requestsList && requestsList.children.length === 0) {
                        if (employeeCard) {
                            employeeCard.remove();
                        }
                    }
                    
                    // Check if there are any requests left at all
                    const anyRequestsLeft = document.querySelectorAll('.request-item').length > 0;
                    if (!anyRequestsLeft) {
                        document.querySelector('.requests-empty').style.display = 'block';
                    }
                    
                    // Trigger a refresh of the pending count in the tab
                    fetchPendingCount();
                }, 500);
            }, 1000);
        }
        
    } catch (error) {
        console.error(`Error updating availability status to ${status}:`, error);
        alert(`Failed to ${status.toLowerCase()} request: ${error.message}`);
        
        // Reset button
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Function to refresh the employee's availability data and update the progress bar
async function refreshEmployeeAvailability() {
    try {
        console.log('Refreshing employee availability data...');
        
        // Get the current user info
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.userId) {
            console.warn('No user info found, cannot refresh availability');
            return;
        }
        
        // Directly call the API to get the latest availability data
        const response = await fetch(`http://localhost:8800/api/availability/employee/${userInfo.userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reload availability data');
        }
        
        const data = await response.json();
        
        // Update the UI with the new data
        if (typeof window.updateEmployeeAvailability === 'function') {
            window.updateEmployeeAvailability(data);
            console.log('Successfully updated employee availability data');
        } else {
            console.warn('updateEmployeeAvailability function not found - fallback to page refresh');
            
            // Dispatch an event that availability.js can listen for
            const event = new CustomEvent('manager-update-availability', {
                detail: { data }
            });
            document.dispatchEvent(event);
            
            // As a final fallback, try calling the function from window if it exists
            if (typeof window.loadEmployeeAvailability === 'function') {
                window.loadEmployeeAvailability();
            }
        }
    } catch (error) {
        console.error('Error refreshing employee availability:', error);
    }
}

// Function to update the pending count in the tab (if it exists)
function updatePendingCountInTab() {
    // Count all remaining request items
    const totalPendingRequests = document.querySelectorAll('.request-item:not(.approved):not(.declined)').length;
    
    // Find the pending requests tab and update it if it exists
    const pendingTab = document.querySelector('.tab[data-tab="pending-requests"]');
    if (pendingTab) {
        // Check if tab already has a count badge
        let countBadge = pendingTab.querySelector('.count-badge');
        if (!countBadge && totalPendingRequests > 0) {
            // Create count badge if it doesn't exist
            countBadge = document.createElement('span');
            countBadge.className = 'count-badge';
            pendingTab.appendChild(countBadge);
        }
        
        // Update or remove the badge
        if (countBadge) {
            if (totalPendingRequests > 0) {
                countBadge.textContent = totalPendingRequests;
                countBadge.style.display = 'inline-block';
            } else {
                countBadge.style.display = 'none';
            }
        }
    }
}

// Update pending count badge in tab
function updatePendingCountBadge(count) {
    const pendingTab = document.querySelector('.tab[data-tab="pending-requests"]');
    if (!pendingTab) return;
    
    // Remove existing badge if it exists
    const existingBadge = pendingTab.querySelector('.count-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Only add badge if count > 0
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'count-badge';
        badge.textContent = count;
        pendingTab.appendChild(badge);
    }
}

// Set up tab switching functionality
function setupTabSwitching() {
    console.log('Setting up tab switching');
    const tabs = document.querySelectorAll('.schedule-tabs .tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            console.log('Tab clicked:', tabId);
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });
            
            // Show the selected tab pane
            const selectedPane = document.getElementById(`${tabId}-tab`);
            
            if (selectedPane) {
                console.log('Showing tab pane:', tabId);
                selectedPane.classList.add('active');
                selectedPane.style.display = 'block';
                
                // If pending requests tab is selected, load the requests
                if (tabId === 'pending-requests') {
                    console.log('Loading pending requests for tab');
                    loadPendingRequests();
                    
                    // Make sure pending requests tab content is visible for managers/admins
                    if (document.body.classList.contains('manager-visible')) {
                        selectedPane.style.display = 'block';
                    }
                } else {
                    // Hide the pending requests section when other tabs are selected
                    const pendingTab = document.getElementById('pending-requests-tab');
                    if (pendingTab) {
                        pendingTab.style.display = 'none';
                    }
                }
            } else {
                console.error(`Tab pane not found for ${tabId}`);
            }
        });
    });
    
    // Initial setup - make sure pending requests section is only visible when its tab is active
    const pendingTab = document.getElementById('pending-requests-tab');
    const activeTab = document.querySelector('.schedule-tabs .tab.active');
    
    if (pendingTab && activeTab) {
        const activeTabId = activeTab.getAttribute('data-tab');
        if (activeTabId !== 'pending-requests') {
            pendingTab.style.display = 'none';
        } else if (document.body.classList.contains('manager-visible')) {
            // If pending tab is active and user is manager, show it and load requests
            pendingTab.style.display = 'block';
            loadPendingRequests();
        }
    }
} 