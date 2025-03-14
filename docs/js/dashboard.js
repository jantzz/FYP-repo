// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

function toggleDropdown() {
    document.getElementById("settingsDropdown").classList.toggle("show");
}

// Initialize calendar and page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication when page loads
    checkAuth();
    
    // Set up all modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        };
    });
    
    // Make existing shift cards clickable
    document.querySelectorAll('.shift-card:not(.add-shift-card)').forEach(card => {
        card.onclick = function() {
            openEditShiftModal(this);
        };
    });
    
    // Initialize calendar
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        selectable: true,
        editable: true,
        select: function(selectInfo) {
            handleDateSelect(selectInfo, calendar);
        },
        eventClick: function(clickInfo) {
            handleEventClick(clickInfo.event);
        }
    });
    
    calendar.render();
    
    // Add click handlers for navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            // Hide all sections first
            document.querySelector('.upcoming-shifts-section').style.display = 'none';
            document.querySelector('.calendar-section').style.display = 'none';
            document.querySelector('.employee-section').style.display = 'none';
            document.querySelector('.time-off-section').style.display = 'none';
            document.querySelector('.schedule-section').style.display = 'none';
            document.querySelector('.report-section').style.display = 'none';
            
            // Show appropriate section based on clicked item
            if (this.textContent.trim() === 'Dashboard') {
                document.querySelector('.upcoming-shifts-section').style.display = 'block';
                document.querySelector('.calendar-section').style.display = 'block';
                document.querySelector('.report-section').style.display = 'block';
                // Refresh calendar when switching back to dashboard
                calendar.render();
            } else if (this.textContent.trim() === 'Employee Management') {
                document.querySelector('.employee-section').style.display = 'block';
            } else if (this.textContent.trim() === 'Time Off') {
                document.querySelector('.time-off-section').style.display = 'block';
                // Load time off history
                loadTimeOffHistory();
            } else if (this.textContent.trim() === 'Schedule') {
                document.querySelector('.schedule-section').style.display = 'block';
                // Initialize employee calendar if not already done
                if (!employeeCalendar) {
                    initEmployeeCalendar();
                } else {
                    employeeCalendar.render();
                }
                // Load availability data
                loadAvailabilityData();
                // Load roster data
                loadRosterData();
            }
        });
    });
    
    // Tab switching functionality
    document.querySelectorAll('.schedule-tabs .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            document.querySelectorAll('.schedule-tabs .tab').forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            // Show the corresponding tab pane
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Refresh calendar if showing the roster tab
            if (tabId === 'my-roster' && employeeCalendar) {
                employeeCalendar.render();
            }
        });
    });
    
    // Function to handle date selection
    function handleDateSelect(selectInfo, calendar) {
        // Show the add shift modal
        const addShiftModal = document.getElementById('addShiftModal');
        addShiftModal.style.display = 'block';
        
        // Set default values from the selected date range
        const startDate = selectInfo.start;
        const endDate = selectInfo.end;
        
        // Format dates for the inputs
        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];
        
        // Format times
        let startTime, endTime;
        
        if (selectInfo.allDay) {
            // For all-day events, set default times (9 AM to 5 PM)
            startTime = '09:00';
            endTime = '17:00';
        } else {
            // For time-specific selections, use the selected times
            startTime = startDate.toTimeString().substring(0, 5);
            endTime = endDate.toTimeString().substring(0, 5);
        }
        
        // Set form values
        document.getElementById('add-shift-start-date').value = formattedStartDate;
        document.getElementById('add-shift-start-time').value = startTime;
        document.getElementById('add-shift-end-date').value = formattedEndDate;
        document.getElementById('add-shift-end-time').value = endTime;
        
        // Store the calendar reference to unselect after submission
        window.tempCalendarRef = calendar;
        
        calendar.unselect();
    }
    
    // Function to handle event click
    function handleEventClick(event) {
        // Find or create a shift card for this event
        const shiftsContainer = document.querySelector('.shifts-container');
        let shiftCard = null;
        
        // Try to find an existing card
        const allShiftCards = document.querySelectorAll('.shift-card:not(.add-shift-card)');
        for (let card of allShiftCards) {
            const title = card.querySelector('.shift-department').textContent;
            if (title === event.title) {
                shiftCard = card;
                break;
            }
        }
        
        // If no card exists, create one
        if (!shiftCard) {
            shiftCard = document.createElement('div');
            shiftCard.className = 'shift-card';
            shiftCard.onclick = function() {
                openEditShiftModal(this, event);
            };
            
            const dateText = formatDateForDisplay(event.start);
            const startTime = event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const endTime = event.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            
            shiftCard.innerHTML = `
                <div class="shift-date">${dateText}</div>
                <div class="shift-time">${startTime} - ${endTime}</div>
                <div class="shift-details">
                    <span class="shift-department">${event.title}</span>
                    <span class="shift-status">Pending</span>
                </div>
            `;
            
            const addShiftCard = document.querySelector('.add-shift-card');
            shiftsContainer.insertBefore(shiftCard, addShiftCard);
        }
        
        // Open the edit modal
        openEditShiftModal(shiftCard, event);
    }
    
    // Function to add new shift
    window.addShift = function() {
        // Show the add shift modal
        const addShiftModal = document.getElementById('addShiftModal');
        addShiftModal.style.display = 'block';
        
        // Set default values
        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0];
        const formattedTime = now.toTimeString().substring(0, 5);
        
        document.getElementById('add-shift-start-date').value = formattedDate;
        document.getElementById('add-shift-start-time').value = formattedTime;
        
        // Set end time to 1 hour later
        const endTime = new Date(now.getTime() + 3600000);
        document.getElementById('add-shift-end-date').value = formattedDate; // Same day by default
        document.getElementById('add-shift-end-time').value = endTime.toTimeString().substring(0, 5);
    }
    
    // Function to close add shift modal
    function closeAddShiftModal() {
        document.getElementById('addShiftModal').style.display = 'none';
    }
    
    // Handle add shift form submission
    document.getElementById('addShiftForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const title = document.getElementById('add-shift-title').value;
        const startDateStr = document.getElementById('add-shift-start-date').value;
        const startTimeStr = document.getElementById('add-shift-start-time').value;
        const endDateStr = document.getElementById('add-shift-end-date').value;
        const endTimeStr = document.getElementById('add-shift-end-time').value;
        const status = document.getElementById('add-shift-status').value;
        
        // Create date objects
        const startDate = new Date(`${startDateStr}T${startTimeStr}`);
        const endDate = new Date(`${endDateStr}T${endTimeStr}`);
        
        // Validate that end date is not before start date
        if (endDate < startDate) {
            alert('End date/time cannot be before start date/time');
            return;
        }
        
        // Add to calendar
        calendar.addEvent({
            title: title,
            start: startDate,
            end: endDate
        });
        
        // Also add to upcoming shifts section
        addShiftToUpcomingSection(title, startDate, endDate, status);
        
        // Close the modal
        closeAddShiftModal();
        
        // Unselect any selection in the calendar
        if (window.tempCalendarRef) {
            window.tempCalendarRef.unselect();
            window.tempCalendarRef = null;
        }
    });
    
    // Function to add a shift to the upcoming shifts section
    function addShiftToUpcomingSection(title, start, end, status = 'Pending') {
        // Format date and time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let dateText;
        if (start.setHours(0, 0, 0, 0) === today.getTime()) {
            dateText = 'Today';
        } else if (start.setHours(0, 0, 0, 0) === tomorrow.getTime()) {
            dateText = 'Tomorrow';
        } else {
            dateText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        // Reset hours after comparison
        start.setHours(start.getHours(), start.getMinutes(), 0, 0);
        
        // Format time
        const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        // Create new shift card
        const shiftCard = document.createElement('div');
        shiftCard.className = 'shift-card';
        shiftCard.onclick = function() {
            openEditShiftModal(this);
        };
        shiftCard.innerHTML = `
            <div class="shift-date">${dateText}</div>
            <div class="shift-time">${startTime} - ${endTime}</div>
            <div class="shift-details">
                <span class="shift-department">${title}</span>
                <span class="shift-status">${status}</span>
            </div>
        `;
        
        // Get the shifts container and add the new card before the "Add Shift" card
        const shiftsContainer = document.querySelector('.shifts-container');
        const addShiftCard = document.querySelector('.add-shift-card');
        shiftsContainer.insertBefore(shiftCard, addShiftCard);
    }
});

// Close dropdown when clicking outside
window.onclick = function(event) {
    if (!event.target.matches('.fa-cog')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let dropdown of dropdowns) {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    }
    
    // Handle modal clicks
    if (event.target == document.getElementById('createEmployeeModal')) {
        document.getElementById('createEmployeeModal').style.display = 'none';
    }
    if (event.target == document.getElementById('profileModal')) {
        document.getElementById('profileModal').style.display = 'none';
    }
    if (event.target == document.getElementById('editProfileModal')) {
        document.getElementById('editProfileModal').style.display = 'none';
    }
    if (event.target == document.getElementById('editShiftModal')) {
        document.getElementById('editShiftModal').style.display = 'none';
    }
    if (event.target == document.getElementById('addShiftModal')) {
        document.getElementById('addShiftModal').style.display = 'none';
    }
}

// Employee Management Functions
function showCreateEmployeeModal() {
    document.getElementById('createEmployeeModal').style.display = 'block';
    
    // Make sure the close button works
    document.querySelector('#createEmployeeModal .close').onclick = function() {
        document.getElementById('createEmployeeModal').style.display = 'none';
    };
}

// Handle employee creation
document.getElementById('createEmployeeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        birthday: document.getElementById('birthday').value,
        gender: document.getElementById('gender').value,
        role: document.getElementById('role').value,
        department: document.getElementById('department').value
    };

    try {
        // First create the role if it doesn't exist
        await fetch(
            '/api/role/createRole',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roleName: formData.role,
                    description: `${formData.role} role`
                })
            }
        );

        // Then create the user
        const response = await fetch(
            '/api/user/createUser',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            }
        );

        if (response.ok) {
            alert('Employee created successfully');
            document.getElementById('createEmployeeModal').style.display = 'none';
            document.getElementById('createEmployeeForm').reset();
            loadEmployees();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to create employee');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create employee');
    }
});

// Load employees
async function loadEmployees() {
    try {
        const response = await fetch('/api/user/getAllUsers', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const employees = await response.json();
            const tbody = document.getElementById('employeeTableBody');
            tbody.innerHTML = '';

            employees.forEach(emp => {
                tbody.innerHTML += `
                    <tr>
                        <td>${emp.name}</td>
                        <td>${emp.email}</td>
                        <td>${emp.role}</td>
                        <td>${emp.department || '-'}</td>
                        <td>
                            <button onclick="editEmployee(${emp.userId})">Edit</button>
                            <button onclick="deleteEmployee(${emp.userId})">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

// Profile Modal Functions
const profileModal = document.getElementById('profileModal');
const editProfileModal = document.getElementById('editProfileModal');

function toggleProfileModal() {
    profileModal.style.display = 'block';
    loadUserProfile();
}

function closeProfileModal() {
    profileModal.style.display = 'none';
}

function showEditProfileModal() {
    profileModal.style.display = 'none';
    editProfileModal.style.display = 'block';
    
    // Pre-fill the edit form with current values
    document.getElementById('edit-name').value = document.getElementById('profile-name').textContent;
    document.getElementById('edit-email').value = document.getElementById('profile-email').textContent;
    document.getElementById('edit-department').value = document.getElementById('profile-department').textContent;
    document.getElementById('edit-birthday').value = formatDateForInput(document.getElementById('profile-birthday').textContent);
    document.getElementById('edit-gender').value = document.getElementById('profile-gender').textContent;
}

function closeEditProfileModal() {
    editProfileModal.style.display = 'none';
}

// Format date from DD/MM/YYYY to YYYY-MM-DD for input field
function formatDateForInput(dateStr) {
    if (!dateStr || dateStr === 'Loading...' || dateStr === '-') return '';
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// Load user profile data
async function loadUserProfile() {
    try {
        // Get the user info from localStorage if available
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        document.getElementById('profile-name').textContent = userInfo.name || '-';
        document.getElementById('profile-email').textContent = userInfo.email || '-';
        document.getElementById('profile-role').textContent = userInfo.role || '-';
        document.getElementById('profile-department').textContent = userInfo.department || '-';
        
        // Format date as DD/MM/YYYY if available
        const birthday = userInfo.birthday ? new Date(userInfo.birthday) : null;
        document.getElementById('profile-birthday').textContent = birthday ? 
            `${birthday.getDate()}/${birthday.getMonth() + 1}/${birthday.getFullYear()}` : '-';
        
        document.getElementById('profile-gender').textContent = userInfo.gender || '-';
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Handle profile update
document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('edit-name').value,
        email: document.getElementById('edit-email').value,
        department: document.getElementById('edit-department').value,
        birthday: document.getElementById('edit-birthday').value,
        gender: document.getElementById('edit-gender').value
    };
    
    try {
        const response = await fetch('/api/user/updateUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            alert('Profile updated successfully');
            closeEditProfileModal();
            toggleProfileModal(); // Reload profile data
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('An error occurred while updating your profile');
    }
});

// Shift Modal Functions
const editShiftModal = document.getElementById('editShiftModal');
let currentShiftElement = null;
let currentCalendarEvent = null;

function openEditShiftModal(shiftCard, calendarEvent = null) {
    currentShiftElement = shiftCard;
    currentCalendarEvent = calendarEvent;
    
    // Get shift data from the card
    const dateText = shiftCard.querySelector('.shift-date').textContent;
    const timeText = shiftCard.querySelector('.shift-time').textContent;
    const title = shiftCard.querySelector('.shift-department').textContent;
    const status = shiftCard.querySelector('.shift-status').textContent;
    
    let shiftDate = new Date();
    if (dateText === 'Today') {
        // Use today's date
    } else if (dateText === 'Tomorrow') {
        shiftDate.setDate(shiftDate.getDate() + 1);
    } else {
        shiftDate = new Date(dateText);
    }
    
    // Format date for input
    const formattedStartDate = shiftDate.toISOString().split('T')[0];
    const [startTime, endTime] = timeText.split(' - ');
    
    // Convert from "00:00 AM" format to "00:00" format
    function convertTimeFormat(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        
        if (period === 'PM' && hours !== '12') {
            hours = String(parseInt(hours) + 12);
        }
        if (period === 'AM' && hours === '12') {
            hours = '00';
        }
        
        // Ensure hours is a string before using padStart
        hours = String(hours);
        return `${hours.padStart(2, '0')}:${minutes}`;
    }
    
    // Parse start and end times
    const startTimeFormatted = convertTimeFormat(startTime);
    const endTimeFormatted = convertTimeFormat(endTime);
    
    // For multi-day shifts, we need to determine the end date
    // If we have a calendar event, use its end date
    let formattedEndDate = formattedStartDate; // Default to same day
    if (calendarEvent) {
        formattedEndDate = calendarEvent.end.toISOString().split('T')[0];
    }
    
    // Set form values
    document.getElementById('edit-shift-title').value = title;
    document.getElementById('edit-shift-start-date').value = formattedStartDate;
    document.getElementById('edit-shift-start-time').value = startTimeFormatted;
    document.getElementById('edit-shift-end-date').value = formattedEndDate;
    document.getElementById('edit-shift-end-time').value = endTimeFormatted;
    document.getElementById('edit-shift-status').value = status;
    
    // Show modal
    editShiftModal.style.display = 'block';
}

function closeEditShiftModal() {
    editShiftModal.style.display = 'none';
    currentShiftElement = null;
    currentCalendarEvent = null;
}

function deleteShift() {
    if (confirm('Are you sure you want to delete this shift?')) {
        // Remove from UI
        if (currentShiftElement) {
            currentShiftElement.remove();
        }
        
        // Remove from calendar
        if (currentCalendarEvent) {
            currentCalendarEvent.remove();
        }
        
        closeEditShiftModal();
    }
}

// Handle shift form submission
document.getElementById('editShiftForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = document.getElementById('edit-shift-title').value;
    const startDateStr = document.getElementById('edit-shift-start-date').value;
    const startTimeStr = document.getElementById('edit-shift-start-time').value;
    const endDateStr = document.getElementById('edit-shift-end-date').value;
    const endTimeStr = document.getElementById('edit-shift-end-time').value;
    const status = document.getElementById('edit-shift-status').value;
    
    // Create date objects
    const startDate = new Date(`${startDateStr}T${startTimeStr}`);
    const endDate = new Date(`${endDateStr}T${endTimeStr}`);
    
    // Validate that end date is not before start date
    if (endDate < startDate) {
        alert('End date/time cannot be before start date/time');
        return;
    }
    
    // Update shift card
    if (currentShiftElement) {
        currentShiftElement.querySelector('.shift-date').textContent = formatDateForDisplay(startDate);
        currentShiftElement.querySelector('.shift-time').textContent = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        currentShiftElement.querySelector('.shift-department').textContent = title;
        currentShiftElement.querySelector('.shift-status').textContent = status;
    }
    
    // Update calendar event
    if (currentCalendarEvent) {
        currentCalendarEvent.setProp('title', title);
        currentCalendarEvent.setStart(startDate);
        currentCalendarEvent.setEnd(endDate);
    }
    
    closeEditShiftModal();
});

// Helper function to format date for display
function formatDateForDisplay(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    if (dateToCheck.getTime() === today.getTime()) {
        return 'Today';
    } else if (dateToCheck.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// Time Off variables
let currentTimeOffRequest = null;

// Function to show the Time Off section
function showTimeOffSection() {
    // Hide all sections first
    document.querySelector('.upcoming-shifts-section').style.display = 'none';
    document.querySelector('.calendar-section').style.display = 'none';
    document.querySelector('.employee-section').style.display = 'none';
    document.querySelector('.report-section').style.display = 'none';
    document.querySelector('.time-off-section').style.display = 'none';
    
    // Show Time Off section
    document.querySelector('.time-off-section').style.display = 'block';
    
    // Load time off history
    loadTimeOffHistory();
}

// Function to load time off history
function loadTimeOffHistory() {
    // This would typically fetch from an API
    // For now, we'll use sample data
    const sampleRequests = [
        {
            id: 1,
            dateRequested: '2023-05-10',
            type: 'PL',
            startDate: '2023-06-01',
            endDate: '2023-06-05',
            status: 'Approved',
            notes: 'Annual vacation'
        },
        {
            id: 2,
            dateRequested: '2023-07-15',
            type: 'MC',
            startDate: '2023-07-16',
            endDate: '2023-07-17',
            status: 'Approved',
            notes: 'Doctor appointment'
        },
        {
            id: 3,
            dateRequested: '2023-08-20',
            type: 'NPL',
            startDate: '2023-09-10',
            endDate: '2023-09-12',
            status: 'Pending',
            notes: 'Personal matters'
        }
    ];
    
    const tableBody = document.getElementById('timeOffHistoryBody');
    tableBody.innerHTML = '';
    
    sampleRequests.forEach(request => {
        const row = document.createElement('tr');
        
        // Format dates for display
        const dateRequested = new Date(request.dateRequested).toLocaleDateString();
        const startDate = new Date(request.startDate).toLocaleDateString();
        const endDate = new Date(request.endDate).toLocaleDateString();
        
        // Determine status class
        let statusClass = '';
        if (request.status === 'Approved') {
            statusClass = 'status-approved';
        } else if (request.status === 'Rejected') {
            statusClass = 'status-rejected';
        } else {
            statusClass = 'status-pending';
        }
        
        row.innerHTML = `
            <td>${dateRequested}</td>
            <td>${request.type}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td><span class="request-status ${statusClass}">${request.status}</span></td>
            <td class="request-actions">
                <button class="action-btn view-btn" onclick="viewTimeOffRequest(${request.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteTimeOffRequest(${request.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Function to show the request time off modal
function showRequestTimeOffModal() {
    const modal = document.getElementById('requestTimeOffModal');
    modal.style.display = 'block';
    
    // Set default values
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('time-off-start-date').value = today;
    document.getElementById('time-off-end-date').value = today;
    document.getElementById('time-off-notes').value = '';
    document.getElementById('time-off-policy').selectedIndex = 0;
}

// Function to close the request time off modal
function closeRequestTimeOffModal() {
    document.getElementById('requestTimeOffModal').style.display = 'none';
}

// Function to view a time off request
function viewTimeOffRequest(requestId) {
    // This would typically fetch the request details from an API
    // For now, we'll use sample data
    const request = {
        id: requestId,
        employeeName: 'John Doe',
        dateRequested: '2023-08-20',
        type: 'PL',
        startDate: '2023-09-10',
        endDate: '2023-09-12',
        status: 'Pending',
        notes: 'Taking some time off for personal matters.'
    };
    
    currentTimeOffRequest = request;
    
    // Populate the details modal
    document.getElementById('request-employee-name').textContent = request.employeeName;
    
    const detailsContainer = document.getElementById('request-details-container');
    detailsContainer.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Request ID:</span>
            <span class="detail-value">${request.id}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date Requested:</span>
            <span class="detail-value">${new Date(request.dateRequested).toLocaleDateString()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${request.type}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">From:</span>
            <span class="detail-value">${new Date(request.startDate).toLocaleDateString()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">To:</span>
            <span class="detail-value">${new Date(request.endDate).toLocaleDateString()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${request.status}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Notes:</span>
            <span class="detail-value">${request.notes}</span>
        </div>
    `;
    
    // Show or hide manager actions based on user role
    const userRole = localStorage.getItem('userRole') || 'Employee';
    const managerActions = document.querySelector('.manager-actions');
    if (userRole === 'Manager' || userRole === 'Admin') {
        managerActions.style.display = 'flex';
    } else {
        managerActions.style.display = 'none';
    }
    
    // Show the modal
    document.getElementById('timeOffDetailsModal').style.display = 'block';
}

// Function to close the time off details modal
function closeTimeOffDetailsModal() {
    document.getElementById('timeOffDetailsModal').style.display = 'none';
    currentTimeOffRequest = null;
}

// Function to approve a time off request
function approveTimeOff() {
    if (currentTimeOffRequest) {
        alert(`Time off request #${currentTimeOffRequest.id} has been approved.`);
        closeTimeOffDetailsModal();
        loadTimeOffHistory(); // Refresh the list
    }
}

// Function to reject a time off request
function rejectTimeOff() {
    if (currentTimeOffRequest) {
        alert(`Time off request #${currentTimeOffRequest.id} has been rejected.`);
        closeTimeOffDetailsModal();
        loadTimeOffHistory(); // Refresh the list
    }
}

// Function to delete a time off request
function deleteTimeOffRequest(requestId) {
    if (confirm('Are you sure you want to delete this time off request?')) {
        alert(`Time off request #${requestId} has been deleted.`);
        loadTimeOffHistory(); // Refresh the list
    }
}

// Handle time off request form submission
document.getElementById('requestTimeOffForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const policy = document.getElementById('time-off-policy').value;
    const startDate = document.getElementById('time-off-start-date').value;
    const endDate = document.getElementById('time-off-end-date').value;
    const notes = document.getElementById('time-off-notes').value;
    
    // Validate that end date is not before start date
    if (new Date(endDate) < new Date(startDate)) {
        alert('End date cannot be before start date');
        return;
    }
    
    // This would typically send the request to an API
    // For now, we'll just show a success message
    alert('Time off request submitted successfully!');
    
    // Close the modal and refresh the list
    closeRequestTimeOffModal();
    loadTimeOffHistory();
});

// Schedule variables
let employeeCalendar = null;

// Function to show the Schedule section
function showScheduleSection() {
    // Hide all sections first
    document.querySelector('.upcoming-shifts-section').style.display = 'none';
    document.querySelector('.calendar-section').style.display = 'none';
    document.querySelector('.employee-section').style.display = 'none';
    document.querySelector('.time-off-section').style.display = 'none';
    document.querySelector('.report-section').style.display = 'none';
    
    // Show Schedule section
    document.querySelector('.schedule-section').style.display = 'block';
    
    // Initialize employee calendar if not already done
    if (!employeeCalendar) {
        initEmployeeCalendar();
    } else {
        employeeCalendar.render();
    }
    
    // Load availability data
    loadAvailabilityData();
    
    // Load roster data
    loadRosterData();
}

// Function to initialize the employee calendar
function initEmployeeCalendar() {
    const calendarEl = document.getElementById('employee-calendar');
    employeeCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        height: 'auto',
        events: [
            // Sample events - would be fetched from API in real app
            {
                title: 'Front Desk',
                start: '2023-05-15T09:00:00',
                end: '2023-05-15T17:00:00',
                color: '#4caf50'
            },
            {
                title: 'Back Office',
                start: '2023-05-16T10:00:00',
                end: '2023-05-16T18:00:00',
                color: '#2196f3'
            },
            {
                title: 'Front Desk',
                start: '2023-05-17T08:00:00',
                end: '2023-05-17T16:00:00',
                color: '#4caf50'
            }
        ]
    });
    
    employeeCalendar.render();
}

// Function to load availability data
function loadAvailabilityData() {
    // This would typically fetch from an API
    // For now, we'll use sample data
    const sampleAvailability = [
        {
            id: 1,
            date: '2023-05-20',
            startTime: '09:00',
            endTime: '17:00',
            type: 'unavailable',
            note: 'Personal appointment'
        },
        {
            id: 2,
            date: '2023-05-22',
            startTime: '14:00',
            endTime: '18:00',
            type: 'prefer',
            note: 'Available for extra shifts'
        },
        {
            id: 3,
            date: '2023-05-24',
            allDay: true,
            type: 'unavailable',
            note: 'Out of town'
        }
    ];
    
    const tableBody = document.getElementById('availabilityTableBody');
    tableBody.innerHTML = '';
    
    sampleAvailability.forEach(item => {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(item.date).toLocaleDateString();
        
        // Format time
        let timeText;
        if (item.allDay) {
            timeText = 'All Day';
        } else {
            const startTime = formatTime(item.startTime);
            const endTime = formatTime(item.endTime);
            timeText = `${startTime} - ${endTime}`;
        }
        
        // Determine status class
        const statusClass = item.type === 'unavailable' ? 'status-unavailable' : 'status-prefer';
        const statusText = item.type === 'unavailable' ? 'Unavailable' : 'Prefer to Work';
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${timeText}</td>
            <td><span class="availability-status ${statusClass}">${statusText}</span></td>
            <td>${item.note || '-'}</td>
            <td class="request-actions">
                <button class="action-btn view-btn" onclick="editAvailability(${item.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteAvailability(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Function to load roster data
function loadRosterData() {
    // This would typically fetch from an API
    // For now, we'll use sample data
    const sampleRoster = [
        {
            name: 'John Doe',
            shifts: {
                tue: { time: '11:00 - 2:00 PM', type: 'shift' },
                fri: { time: '10:00 AM - 4:00 PM', type: 'unavailable' }
            }
        },
        {
            name: 'Mary Smith',
            shifts: {
                tue: { time: 'Time Off', type: 'timeoff' },
                wed: { time: '12:00 - 3:00 PM', type: 'shift' }
            }
        },
        {
            name: 'Tim Johnson',
            shifts: {
                wed: { time: 'All Day', type: 'unavailable' }
            }
        }
    ];
    
    const tableBody = document.getElementById('rosterTableBody');
    tableBody.innerHTML = '';
    
    sampleRoster.forEach(employee => {
        const row = document.createElement('tr');
        
        // Create employee name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = employee.name;
        row.appendChild(nameCell);
        
        // Create cells for each day
        const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
        days.forEach(day => {
            const cell = document.createElement('td');
            
            if (employee.shifts[day]) {
                const shift = employee.shifts[day];
                const blockClass = shift.type === 'unavailable' ? 'unavailable-block' : 'shift-block';
                
                const block = document.createElement('div');
                block.className = blockClass;
                block.textContent = shift.time;
                
                cell.appendChild(block);
            }
            
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
}

// Function to show the availability modal
function showAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    modal.style.display = 'block';
    
    // Set default values
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('availability-date').value = today;
    document.getElementById('availability-start-time').value = '09:00';
    document.getElementById('availability-end-time').value = '17:00';
    document.getElementById('availability-note').value = '';
    document.getElementById('all-day-checkbox').checked = false;
    document.getElementById('repeat-checkbox').checked = false;
    
    // Set default radio button
    document.querySelector('input[name="availability-type"][value="unavailable"]').checked = true;
    
    // Show time selection by default
    document.getElementById('time-selection').style.display = 'flex';
    
    // Add event listener for all-day checkbox
    document.getElementById('all-day-checkbox').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('time-selection').style.display = 'none';
        } else {
            document.getElementById('time-selection').style.display = 'flex';
        }
    });
}

// Function to close the availability modal
function closeAvailabilityModal() {
    document.getElementById('availabilityModal').style.display = 'none';
}

// Function to edit availability
function editAvailability(id) {
    // This would typically fetch the availability details from an API
    // For now, we'll just show the modal with some default values
    showAvailabilityModal();
    alert(`Editing availability #${id}`);
}

// Function to delete availability
function deleteAvailability(id) {
    if (confirm('Are you sure you want to delete this availability setting?')) {
        alert(`Availability #${id} has been deleted.`);
        loadAvailabilityData(); // Refresh the list
    }
}

// Helper function to format time
function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${formattedHour}:${minutes} ${period}`;
}

// Handle availability form submission
document.getElementById('availabilityForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="availability-type"]:checked').value;
    const date = document.getElementById('availability-date').value;
    const allDay = document.getElementById('all-day-checkbox').checked;
    const startTime = allDay ? null : document.getElementById('availability-start-time').value;
    const endTime = allDay ? null : document.getElementById('availability-end-time').value;
    const note = document.getElementById('availability-note').value;
    const repeat = document.getElementById('repeat-checkbox').checked;
    
    // Validate times if not all day
    if (!allDay && new Date(`2000-01-01T${endTime}`) <= new Date(`2000-01-01T${startTime}`)) {
        alert('End time must be after start time');
        return;
    }
    
    // This would typically send the request to an API
    // For now, we'll just show a success message
    alert('Availability saved successfully!');
    
    // Close the modal and refresh the list
    closeAvailabilityModal();
    loadAvailabilityData();
    
    // Also update the calendar with the new availability
    if (employeeCalendar) {
        const eventColor = type === 'unavailable' ? '#f44336' : '#4caf50';
        const eventTitle = type === 'unavailable' ? 'Unavailable' : 'Prefer to Work';
        
        if (allDay) {
            employeeCalendar.addEvent({
                title: eventTitle,
                start: date,
                allDay: true,
                color: eventColor
            });
        } else {
            employeeCalendar.addEvent({
                title: eventTitle,
                start: `${date}T${startTime}`,
                end: `${date}T${endTime}`,
                color: eventColor
            });
        }
    }
}); 