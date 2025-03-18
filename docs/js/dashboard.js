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

// Function to check if a shift is scheduled for today or tomorrow
function isShiftInNearFuture(shiftDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    const shiftDateOnly = new Date(shiftDate);
    shiftDateOnly.setHours(0, 0, 0, 0);
    
    // Return true if shift is today or tomorrow
    return shiftDateOnly >= today && shiftDateOnly < dayAfterTomorrow;
}

// Initialize calendar and page functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication when page loads
    checkAuth();
    
    // Get user info to check permissions
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    
    // Hide Employee Management section for non-admin/manager users
    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    console.log('User role:', userRole, 'Is admin or manager:', isAdminOrManager);
    
    // Add admin-visible class to body if user is admin/manager
    if (isAdminOrManager) {
        document.body.classList.add('admin-visible');
    } else {
        document.body.classList.remove('admin-visible');
    }
    
    // Show/hide Employee Management based on role
    const employeeManagementItem = document.getElementById('employee-management');
    if (employeeManagementItem) {
        if (!isAdminOrManager) {
            employeeManagementItem.style.display = 'none';
        } else {
            employeeManagementItem.style.display = 'flex';
        }
    }
    
    // Set up all modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        };
    });

    // Clear existing shift cards
    const shiftsContainer = document.querySelector('.shifts-container');
    if (shiftsContainer) {
    shiftsContainer.innerHTML = '';
    }
    
    // Create a "Show More" button
    const showMoreButton = document.createElement('div');
    showMoreButton.className = 'show-more-shifts';
    showMoreButton.innerHTML = '<span>Show More Shifts</span>';
    showMoreButton.style.display = 'none'; // Hide initially
    showMoreButton.addEventListener('click', function() {
        document.querySelectorAll('.shift-card.future-shift').forEach(card => {
            card.style.display = 'block';
        });
        this.style.display = 'none';
    });
    
    // Add the Show More button after the shifts container
    if (shiftsContainer) {
    shiftsContainer.parentNode.insertBefore(showMoreButton, shiftsContainer.nextSibling);
    }

    // Load initial shifts
    try {
        const shifts = await fetchShifts();
        console.log('Initial shifts loaded:', shifts);
        
        // Track if we have future shifts
        let hasFutureShifts = false;
        
        // Add shifts to the upcoming shifts section
        shifts.forEach(shift => {
            const isNearFuture = isShiftInNearFuture(new Date(shift.start));
            
            // Use the global addShiftToUpcomingSection function
            addShiftToUpcomingSection(
                shift.title,
                new Date(shift.start),
                new Date(shift.end),
                shift.extendedProps.status,
                !isNearFuture // Hide if not today/tomorrow
            );
            
            if (!isNearFuture) {
                hasFutureShifts = true;
            }
        });
        
        // Show the "Show More" button if we have future shifts
        if (hasFutureShifts) {
            showMoreButton.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading initial shifts:', error);
    }
    
    // Initialize calendar
    const calendarEl = document.getElementById('calendar');
    window.calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: async function(info, successCallback, failureCallback) {
            try {
                console.log('Calendar requesting events for:', {
                    start: info.start,
                    end: info.end,
                    startStr: info.startStr,
                    endStr: info.endStr
                });
                
                const events = await fetchShifts();
                console.log('Calendar received events:', events);
                successCallback(events);
            } catch (error) {
                console.error('Calendar failed to fetch events:', error);
                failureCallback(error);
            }
        },
        eventDidMount: function(info) {
            console.log('Event mounted:', {
                id: info.event.id,
                title: info.event.title,
                start: info.event.start,
                end: info.event.end
            });
            info.el.style.backgroundColor = getStatusColor(info.event.extendedProps.status);
        },
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        select: function(arg) {
            console.log('Date range selected:', {
                start: arg.start,
                end: arg.end,
                allDay: arg.allDay
            });
            
            // Pre-fill the add shift form with selected dates
            document.getElementById('add-shift-start-date').value = arg.start.toISOString().split('T')[0];
            document.getElementById('add-shift-end-date').value = arg.end.toISOString().split('T')[0];
            
            // Set default times (9 AM to 5 PM) if all-day selection
            if (arg.allDay) {
                document.getElementById('add-shift-start-time').value = '09:00';
                document.getElementById('add-shift-end-time').value = '17:00';
            } else {
                document.getElementById('add-shift-start-time').value = arg.start.toTimeString().slice(0, 5);
                document.getElementById('add-shift-end-time').value = arg.end.toTimeString().slice(0, 5);
            }
            
            // Open the modal
            openAddShiftModal();
            calendar.unselect();
        },
        eventClick: function(arg) {
            console.log('Event clicked:', {
                id: arg.event.id,
                title: arg.event.title,
                start: arg.event.start,
                end: arg.event.end,
                extendedProps: arg.event.extendedProps
            });
            openEditShiftModal(arg.event);
        }
    });
    
    calendar.render();
    
    // Add click handlers for navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            // Get the item text for identifying which section to show
            const itemText = this.textContent.trim();
            
            // Check if employee management was clicked but user doesn't have permissions
            if (itemText === 'Employee Management' && !isAdminOrManager) {
                alert('You do not have permission to access Employee Management. Please contact your administrator.');
                return; // Exit early - don't activate this section
            }
            
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
            if (itemText === 'Dashboard') {
                document.querySelector('.upcoming-shifts-section').style.display = 'block';
                document.querySelector('.calendar-section').style.display = 'block';
                document.querySelector('.report-section').style.display = 'block';
                // Refresh calendar when switching back to dashboard
                if (window.calendar) {
                    window.calendar.render();
                }
            } else if (itemText === 'Employee Management') {
                document.querySelector('.employee-section').style.display = 'block';
                // Only load employee data for admin/manager
                if (isAdminOrManager) {
                    loadEmployees();
                }
            } else if (itemText === 'Time Off') {
                document.querySelector('.time-off-section').style.display = 'block';
                // Load time off history
                loadTimeOffHistory();
            } else if (itemText === 'Schedule') {
                document.querySelector('.schedule-section').style.display = 'block';
                // Initialize employee calendar if not already done
                if (!employeeCalendar) {
                    initEmployeeCalendar();
                } else {
                    employeeCalendar.render();
                }
                
                try {
                    // Load availability data (only if the table exists)
                    loadAvailabilityData();
                    // Load roster data (only if the table exists)
                    loadRosterData();
                } catch (error) {
                    console.error('Error loading schedule data:', error);
                }
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
            
            // Load appropriate data based on tab
            if (tabId === 'my-roster' && employeeCalendar) {
                employeeCalendar.render();
            } else if (tabId === 'availability') {
                loadAvailabilityData();
            }
            
            // Update URL hash to maintain tab state on page reload
            window.location.hash = tabId;
        });
    });
    
    // On page load, check for hash and set active tab accordingly
    if (window.location.hash) {
        const tabId = window.location.hash.substring(1); // Remove the # character
        const tabElement = document.querySelector(`.schedule-tabs .tab[data-tab="${tabId}"]`);
        
        if (tabElement) {
            // Trigger a click on the tab to activate it
            tabElement.click();
        }
    }
    
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
    
    // This function is kept for backward compatibility, but shifts are now created automatically when availabilities are approved
    window.addShift = function() {
        console.log('Add shift functionality has been disabled. Shifts are now created automatically when availabilities are approved by managers.');
        alert('Shifts are now created automatically when availabilities are approved by managers. Please use the availability feature instead.');
    }
    
    // Function to close add shift modal
    function closeAddShiftModal() {
        console.log('closeAddShiftModal called - this function is maintained for backward compatibility');
    }
    
    // Set up the form submission handler for backward compatibility
    const addShiftForm = document.getElementById('addShiftForm');
    if (addShiftForm) {
        addShiftForm.addEventListener('submit', function(e) {
        e.preventDefault();
            alert('Direct shift creation has been disabled. Shifts are now created automatically when managers approve availability requests.');
            document.getElementById('addShiftModal').style.display = 'none';
        });
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
    // Check user permissions
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    
    if (!isAdminOrManager) {
        alert('Only administrators and managers can create new employees.');
        return;
    }
    
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
        const API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'http://localhost:8800/api';
        
        // Show loading indicator
        const tableBody = document.getElementById('employeeTableBody');
        tableBody.innerHTML = '<tr><td colspan="5">Loading employees...</td></tr>';
        
        // Get current user info for role check
        const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (currentUserInfo.role || '').toLowerCase();
        
        // Only allow managers and admins to manage employees
        const canManageEmployees = ['manager', 'admin'].includes(currentUserRole);
        
        const response = await fetch(`${API_BASE_URL}/user/getUsers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}`);
        }
        
            const employees = await response.json();
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        if (employees.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No employees found</td></tr>';
            return;
        }
        
        employees.forEach(employee => {
            const row = document.createElement('tr');
            
            // Format employee data, ensure properties exist with default values
            const name = employee.name || 'N/A';
            const email = employee.email || 'N/A';
            const role = employee.role || 'N/A';
            const department = employee.department || 'N/A';
            
            // Determine if current user can edit/delete this employee based on roles
            const isAdmin = currentUserRole === 'admin';
            const isManager = currentUserRole === 'manager';
            const targetIsAdmin = (employee.role || '').toLowerCase() === 'admin';
            
            // Managers cannot edit/delete admins, but admins can edit/delete anyone
            const canEditThisEmployee = (isAdmin) || (isManager && !targetIsAdmin);
            
            row.innerHTML = `
                <td>${name}</td>
                <td>${email}</td>
                <td><span class="role-badge ${role.toLowerCase()}">${role}</span></td>
                <td>${department}</td>
                <td class="action-buttons">
                    ${canManageEmployees && canEditThisEmployee ? 
                        `<button class="edit-btn" onclick="editEmployee(${employee.userId})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteEmployee(${employee.userId})">
                            <i class="fas fa-trash"></i>
                        </button>` 
                    : ''}
                        </td>
                `;
            
            tableBody.appendChild(row);
            });
        
    } catch (error) {
        console.error('Error loading employees:', error);
        const tableBody = document.getElementById('employeeTableBody');
        tableBody.innerHTML = `<tr><td colspan="5">Error loading employees: ${error.message}</td></tr>`;
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

function openEditShiftModal(source, calendarEvent = null) {
    // First check if the user is a manager or admin
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    
    // Only allow managers and admins to edit shifts
    if (userRole !== 'manager' && userRole !== 'admin') {
        console.log('View-only mode: Only managers and admins can edit shifts');
        alert('Only managers and admins can edit shifts. Contact your manager for any changes.');
        return;
    }

    const editShiftModal = document.getElementById('editShiftModal');
    if (!editShiftModal) {
        console.error('Edit shift modal not found');
        return;
    }

    // Convert from "00:00 AM" format to "00:00" format
    function convertTimeFormat(timeStr) {
        if (!timeStr) return '';
        
        // Check if time is already in 24-hour format
        if (!timeStr.toLowerCase().includes('am') && !timeStr.toLowerCase().includes('pm')) {
            return timeStr; // Already in 24-hour format
        }
        
        try {
            const isPM = timeStr.toLowerCase().includes('pm');
            const isAM = timeStr.toLowerCase().includes('am');
            
            // Extract hours and minutes
            let timePart = timeStr.replace(/\s*[ap]m\s*/i, '').trim();
            let [hours, minutes] = timePart.split(':').map(part => parseInt(part, 10));
            
            // Convert to 24-hour format
            if (isPM && hours < 12) {
                hours += 12;
            } else if (isAM && hours === 12) {
                hours = 0;
            }
            
            // Format with leading zeros
            const formattedHours = hours.toString().padStart(2, '0');
            const formattedMinutes = minutes.toString().padStart(2, '0');
            
            return `${formattedHours}:${formattedMinutes}`;
        } catch (error) {
            console.error('Error converting time format:', error);
            return '00:00'; // Default fallback
        }
    }

    // If source is a calendar event (from eventClick handler)
    if (source && source.title !== undefined) {
        currentCalendarEvent = source;
        currentShiftElement = null;
        
        // Set form values directly from calendar event
        document.getElementById('edit-shift-id').value = source.id || '';
        document.getElementById('edit-shift-title').value = source.title || '';
        
        try {
            // Safety check for start date
            let safeStartDate;
        if (source.start && typeof source.start.toISOString === 'function') {
                safeStartDate = source.start;
        } else {
                // Default to current date if start date is invalid
                safeStartDate = new Date();
                console.warn('Invalid or missing start date in event object, using current date');
            }
                
            // Safety check for end date
            let safeEndDate;
        if (source.end && typeof source.end.toISOString === 'function') {
                safeEndDate = source.end;
        } else {
                // Create a default end date 1 hour after start if not available
                safeEndDate = new Date(safeStartDate);
                safeEndDate.setHours(safeEndDate.getHours() + 1);
                console.warn('Invalid or missing end date in event object, using default (start + 1 hour)');
            }
            
            // Set the start date/time values
            document.getElementById('edit-shift-start-date').value = safeStartDate.toISOString().split('T')[0];
            document.getElementById('edit-shift-start-time').value = safeStartDate.toTimeString().slice(0, 5);
            
            // Set the end date/time values
            document.getElementById('edit-shift-end-date').value = safeEndDate.toISOString().split('T')[0];
            document.getElementById('edit-shift-end-time').value = safeEndDate.toTimeString().slice(0, 5);
        
        // Set status if available
        document.getElementById('edit-shift-status').value = source.extendedProps?.status || 'Pending';
        } catch (error) {
            console.error('Error processing event dates:', error);
            // Set default values if there's an error
            const today = new Date();
            document.getElementById('edit-shift-start-date').value = today.toISOString().split('T')[0];
            document.getElementById('edit-shift-start-time').value = '09:00';
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('edit-shift-end-date').value = tomorrow.toISOString().split('T')[0];
            document.getElementById('edit-shift-end-time').value = '17:00';
            document.getElementById('edit-shift-status').value = 'Pending';
        }
    }
    
    // If source is a shift card element
    else if (source && source.classList.contains('shift-card')) {
        currentShiftElement = source;
        currentCalendarEvent = calendarEvent;
        
        // Get shift data from the card
        const dateText = source.querySelector('.shift-date')?.textContent || '';
        const timeText = source.querySelector('.shift-time')?.textContent || '';
        const title = source.querySelector('.shift-department')?.textContent || '';
        const status = source.querySelector('.shift-status')?.textContent || 'Pending';
        
        try {
            let shiftDate = new Date();
            if (dateText === 'Today') {
                // Use today's date
            } else if (dateText === 'Tomorrow') {
                shiftDate.setDate(shiftDate.getDate() + 1);
            } else if (dateText) {
                // Try to parse the date, fall back to today if invalid
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                    shiftDate = parsedDate;
                }
            }
            
            // Format date for input
            const formattedStartDate = shiftDate.toISOString().split('T')[0];
            
            // Set initial form values
            document.getElementById('edit-shift-id').value = currentCalendarEvent?.id || '';
            document.getElementById('edit-shift-title').value = title;
            document.getElementById('edit-shift-start-date').value = formattedStartDate;
            document.getElementById('edit-shift-end-date').value = formattedStartDate;
            document.getElementById('edit-shift-status').value = status;
            
            // Handle time information if available
            if (timeText && timeText.includes(' - ')) {
                const [startTime, endTime] = timeText.split(' - ');
                
                // Convert from "00:00 AM" format to "00:00" format
                if (startTime) {
                    const convertedStartTime = convertTimeFormat(startTime.trim());
                    document.getElementById('edit-shift-start-time').value = convertedStartTime;
                }
                
                if (endTime) {
                    const convertedEndTime = convertTimeFormat(endTime.trim());
                    document.getElementById('edit-shift-end-time').value = convertedEndTime;
                }
            }
        } catch (error) {
            console.error('Error processing shift card data:', error);
            // Set default values if there's an error
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('edit-shift-start-date').value = today;
            document.getElementById('edit-shift-end-date').value = today;
            document.getElementById('edit-shift-start-time').value = '09:00';
            document.getElementById('edit-shift-end-time').value = '17:00';
        }
    }
    
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
    console.log('Loading availability data in dashboard');

    // Check if the table body exists
    const tableBody = document.getElementById('availabilityTableBody');
    if (!tableBody) {
        console.error('Availability table body not found!');
        return; // Exit early if element doesn't exist
    }
    
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
    console.log('Loading roster data');
    const rosterTableBody = document.getElementById('rosterTableBody');
    
    if (!rosterTableBody) {
        console.error('Roster table body not found');
        return;
    }
    
    // Clear existing data
    rosterTableBody.innerHTML = '';
    
    // Sample data - in a real application, this would come from an API
    const employees = [
        { id: 1, name: 'John Smith', department: 'Front Desk', availability: ['Available', 'Unavailable', 'Pending', 'Available', 'Available'] },
        { id: 2, name: 'Jane Doe', department: 'Housekeeping', availability: ['Unavailable', 'Available', 'Available', 'Available', 'Pending'] },
        { id: 3, name: 'Mark Johnson', department: 'Front Desk', availability: ['Pending', 'Available', 'Available', 'Unavailable', 'Available'] },
        { id: 4, name: 'Sarah Williams', department: 'Kitchen', availability: ['Available', 'Available', 'Unavailable', 'Pending', 'Available'] },
        { id: 5, name: 'Robert Brown', department: 'Maintenance', availability: ['Available', 'Pending', 'Available', 'Available', 'Unavailable'] }
    ];
    
    // Add employees to the table
    employees.forEach(employee => {
        const row = document.createElement('tr');
        
        // Add employee name and department
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `
            <div>
                <strong>${employee.name}</strong><br>
                <small>${employee.department}</small>
            </div>
        `;
        row.appendChild(nameCell);
        
        // Add availability status for each day
        employee.availability.forEach(status => {
            const cell = document.createElement('td');
            cell.innerHTML = `<span class="status-${status.toLowerCase()}">${status}</span>`;
            row.appendChild(cell);
        });
        
        rosterTableBody.appendChild(row);
    });
}

// Function to show the availability modal
function showAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    modal.style.display = 'block';
    
    // Set default values with null checks
    const today = new Date().toISOString().split('T')[0];
    
    const dateEl = document.getElementById('availability-date');
    const startTimeEl = document.getElementById('availability-start-time');
    const endTimeEl = document.getElementById('availability-end-time');
    const noteEl = document.getElementById('availability-note');
    const allDayEl = document.getElementById('all-day-checkbox');
    const repeatEl = document.getElementById('repeat-checkbox');
    const timeSelectionEl = document.getElementById('time-selection');
    
    if (dateEl) dateEl.value = today;
    if (startTimeEl) startTimeEl.value = '09:00';
    if (endTimeEl) endTimeEl.value = '17:00';
    if (noteEl) noteEl.value = '';
    if (allDayEl) allDayEl.checked = false;
    if (repeatEl) repeatEl.checked = false;
    
    // Set default radio button - check for both availability-type and shift-type
    const defaultRadio = document.querySelector('input[name="availability-type"][value="unavailable"]') || 
                         document.querySelector('input[name="shift-type"][value="MORNING"]');
    if (defaultRadio) {
        defaultRadio.checked = true;
    }
    
    // Show time selection by default if it exists
    if (timeSelectionEl) timeSelectionEl.style.display = 'flex';
    
    // Add event listener for all-day checkbox if it exists
    const allDayCheckbox = document.getElementById('all-day-checkbox');
    if (allDayCheckbox) {
        // Remove existing listener to avoid duplicates (by cloning)
        const newAllDayCheckbox = allDayCheckbox.cloneNode(true);
        allDayCheckbox.parentNode.replaceChild(newAllDayCheckbox, allDayCheckbox);
        
        newAllDayCheckbox.addEventListener('change', function() {
            const timeSelectionEl = document.getElementById('time-selection');
            if (timeSelectionEl) {
                timeSelectionEl.style.display = this.checked ? 'none' : 'flex';
            }
        });
    }
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

// function to format time
function formatTime(time) {
    // Guard against null or undefined values
    if (!time) return "Unknown time";
    
    try {
        // Log the input for debugging
        console.log('formatTime input:', {
            time: time,
            type: typeof time,
            isDate: time instanceof Date
        });
        
        if (time instanceof Date) {
            // If time is a Date object, format it properly, first check if valid
            if (isNaN(time.getTime())) {
                console.warn('Invalid Date object passed to formatTime:', time);
                return "Unknown time";
            }
            
            // Format using the date object's hours and minutes directly to avoid timezone issues
            const hours = time.getHours();
            const minutes = time.getMinutes();
            
            // Convert to 12-hour format
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
            const displayMinutes = minutes.toString().padStart(2, '0');
            
            const formattedTime = `${displayHours}:${displayMinutes} ${period}`;
            console.log('Formatted time from Date object:', formattedTime);
            return formattedTime;
        } else if (typeof time === 'string') {
            // Log the string value for debugging
            console.log('Formatting string time:', time);
            
            // Try to parse as a full date-time string first
            // This handles ISO strings, MySQL datetime strings, etc.
            if (time.includes('T') || time.includes(' ')) {
                // Extract just the time portion
                let timePart;
                if (time.includes('T')) {
                    // ISO format: 2023-01-01T09:00:00.000Z
                    timePart = time.split('T')[1].split('.')[0];
                } else {
                    // MySQL format: 2023-01-01 09:00:00
                    timePart = time.split(' ')[1];
                }
                
                if (timePart && timePart.includes(':')) {
                    // Parse hours and minutes
                    const [hoursStr, minutesStr] = timePart.split(':');
                    const hours = parseInt(hoursStr, 10);
                    const minutes = parseInt(minutesStr, 10);
                    
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        // Convert to 12-hour format
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const displayHours = hours % 12 || 12;
                        const displayMinutes = minutes.toString().padStart(2, '0');
                        
                        const formattedTime = `${displayHours}:${displayMinutes} ${period}`;
                        console.log('Formatted time from datetime string:', formattedTime);
                        return formattedTime;
                    }
                }
                
                // If we couldn't parse the time part, create a date object and try again
                const dateObj = new Date(time);
                if (!isNaN(dateObj.getTime())) {
                    const hours = dateObj.getHours();
                    const minutes = dateObj.getMinutes();
                    
                    // Convert to 12-hour format
                    const period = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    const displayMinutes = minutes.toString().padStart(2, '0');
                    
                    const formattedTime = `${displayHours}:${displayMinutes} ${period}`;
                    console.log('Formatted time from parsed datetime string:', formattedTime);
                    return formattedTime;
                }
            }
            
            // Handle simple HH:MM format
            if (time.includes(':')) {
                const [hours, minutes] = time.split(':').map(part => parseInt(part, 10));
                
                // Validate parsed values
                if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    console.warn('Invalid time string format:', time);
                    return "Unknown time";
                }
                
                // Convert to 12-hour format
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                const displayMinutes = minutes.toString().padStart(2, '0');
                
                const formattedTime = `${displayHours}:${displayMinutes} ${period}`;
                console.log('Formatted time from HH:MM string:', formattedTime);
                return formattedTime;
            }
        }
        
        console.warn('Unrecognized time format:', time, typeof time);
        return "Unknown time";
    } catch (error) {
        console.error('Error formatting time:', error, time);
        return "Unknown time";
    }
}

// Handle availability form submission
document.addEventListener('DOMContentLoaded', function() {
    // Get the availability form
    const availabilityForm = document.getElementById('availabilityForm');
    
    // Only add the event listener if the form exists in this page
    if (availabilityForm) {
        availabilityForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Check if required elements exist
            const typeElement = document.querySelector('input[name="availability-type"]:checked') || 
                               document.querySelector('input[name="shift-type"]:checked');
            const dateElement = document.getElementById('availability-date');
            const allDayElement = document.getElementById('all-day-checkbox');
            const startTimeElement = document.getElementById('availability-start-time');
            const endTimeElement = document.getElementById('availability-end-time');
            const noteElement = document.getElementById('availability-note');
            
            // Exit if required elements don't exist
            if (!typeElement || !dateElement) {
                console.error('Required form elements not found:', { 
                    typeElement, 
                    dateElement 
                });
                return;
            }
            
            // Safely access values
            const type = typeElement.value;
            const date = dateElement.value;
            const allDay = allDayElement ? allDayElement.checked : false;
            const startTime = (allDay || !startTimeElement) ? null : startTimeElement.value;
            const endTime = (allDay || !endTimeElement) ? null : endTimeElement.value;
            const note = noteElement ? noteElement.value : '';
            
            // Add validation
            if (!date) {
                alert('Please select a date');
                return;
            }
            
            if (!allDay && (!startTime || !endTime)) {
                alert('Please specify both start time and end time');
                return;
            }
        });
    }
});

// Function to fetch all shifts
async function fetchShifts() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        if (!userInfo || !userInfo.userId) {
            throw new Error('User information not found');
        }

        console.log('Fetching shifts for user:', userInfo.userId);

        const response = await fetch(`http://localhost:8800/api/shift/${userInfo.userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch shifts:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            throw new Error('Failed to fetch shifts');
        }

        const shifts = await response.json();
        console.log('Raw shifts from server:', shifts);
        
        // Debug output to check date formats
        shifts.forEach(shift => {
            console.log('Shift dates from server:', {
                shiftId: shift.shiftId,
                startDate: shift.startDate,
                endDate: shift.endDate,
                startDateObject: new Date(shift.startDate),
                endDateObject: new Date(shift.endDate)
            });
        });

        const calendarEvents = shifts.map(shift => {
            // Provide a default title if none exists
            const shiftTitle = shift.title || shift.preferredShift || 'Scheduled Shift';
            
            // Convert MySQL datetime to proper JS Date objects
            // MySQL format: YYYY-MM-DD HH:MM:SS
            let startDate, endDate;
            
            try {
                // For MySQL datetime format, ensure proper parsing
                if (typeof shift.startDate === 'string') {
                    // Replace any 'T' format with space for consistency
                    const startStr = shift.startDate.replace('T', ' ').replace('Z', '');
                    // Parse the date properly preserving hours/minutes
                    const [datePart, timePart] = startStr.split(' ');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(num => parseInt(num, 10));
                        const [hours, minutes, seconds] = timePart.split(':').map(num => parseInt(num, 10));
                        
                        // Create date with correct timezone handling (months are 0-indexed in JS)
                        startDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                    } else {
                        startDate = new Date(shift.startDate);
                    }
                } else {
                    startDate = new Date(shift.startDate);
                }
                
                // Do the same for end date
                if (typeof shift.endDate === 'string') {
                    const endStr = shift.endDate.replace('T', ' ').replace('Z', '');
                    const [datePart, timePart] = endStr.split(' ');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(num => parseInt(num, 10));
                        const [hours, minutes, seconds] = timePart.split(':').map(num => parseInt(num, 10));
                        
                        // Create date with correct timezone handling
                        endDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                    } else {
                        endDate = new Date(shift.endDate);
                    }
                } else {
                    endDate = new Date(shift.endDate);
                }
                
                console.log('Parsed dates for shift:', {
                    shiftId: shift.shiftId,
                    startDate: startDate,
                    endDate: endDate,
                    startTime: startDate.toTimeString(),
                    endTime: endDate.toTimeString()
                });
                
                // Validate dates after parsing
                if (isNaN(startDate.getTime())) {
                    console.warn(`Invalid start date for shift ${shift.shiftId} after parsing:`, shift.startDate);
                    startDate = new Date(); // Default to current date if invalid
                }
                
                if (!endDate || isNaN(endDate.getTime())) {
                    console.warn(`Invalid or missing end date for shift ${shift.shiftId} after parsing:`, shift.endDate);
                    endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + 1);
                }
                
                // Ensure end is after start
                if (endDate <= startDate) {
                    console.warn(`End date is not after start date for shift ${shift.shiftId}, adjusting`);
                    endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + 1);
                }
            } catch (error) {
                console.error(`Error processing dates for shift ${shift.shiftId}:`, error);
                // Set safe defaults
                startDate = new Date();
                endDate = new Date(startDate);
                endDate.setHours(endDate.getHours() + 1);
            }
            
            const event = {
                id: shift.shiftId,
                title: shiftTitle,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                status: shift.status,
                extendedProps: {
                    status: shift.status,
                    employeeId: shift.employeeId,
                    employeeName: shift.employeeName
                }
            };
            
            console.log('Converted shift to calendar event:', event);
            return event;
        });

        console.log('Final calendar events:', calendarEvents);
        return calendarEvents;
    } catch (error) {
        console.error('Error in fetchShifts:', error);
        return [];
    }
}

// Function to get color based on shift status
function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'pending':
            return '#F59E0B'; // Amber
        case 'approved':
            return '#10B981'; // Green
        case 'rejected':
            return '#EF4444'; // Red
        case 'completed':
            return '#3B82F6'; // Blue
        default:
            return '#6B7280'; // Gray
    }
}

// Function to create a new shift
async function createShift(shiftData) {
    try {
        console.log('Starting shift creation with data:', shiftData);
        
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        console.log('Authentication token found');

        // Get user info from localStorage
        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        console.log('Retrieved user info:', userInfo);
        
        if (!userInfo || !userInfo.userId) {
            throw new Error('User information not found');
        }

        // Format data to match the controller's expected fields
        const shiftRequestData = {
            employeeId: userInfo.userId,
            title: shiftData.title,
            startDate: shiftData.start_time, // Send the full datetime string
            endDate: shiftData.end_time,     // Send the full datetime string
            status: shiftData.status
        };

        console.log('Formatted shift request data:', shiftRequestData);

        // Changed endpoint to match backend route
        const response = await fetch('http://localhost:8800/api/shift/add', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(shiftRequestData)
        });

        console.log('Server response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText
            });
            throw new Error(`Failed to create shift: ${errorText}`);
        }

        const result = await response.json();
        console.log('Shift created successfully:', result);
        return result;
    } catch (error) {
        console.error('Error in createShift:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Function to open add shift modal
function openAddShiftModal() {
    console.log('Add shift functionality has been disabled. Shifts are now created automatically when availabilities are approved by managers.');
    alert('Shifts are now created automatically when availabilities are approved by managers. Please use the availability feature instead.');
}

// Function to close add shift modal
function closeAddShiftModal() {
    console.log('closeAddShiftModal called - this function is maintained for backward compatibility');
}

// Function to add a shift to the upcoming shifts section
function addShiftToUpcomingSection(title, start, end, status = 'Pending', hide = false) {
    const shiftsContainer = document.querySelector('.shifts-container');
    if (!shiftsContainer) return;
    
    try {
        console.log('Adding shift to upcoming section:', {
            title, 
            start: start instanceof Date ? start.toString() : start,
            end: end instanceof Date ? end.toString() : end,
            status,
            hide
        });
        
        // Create date objects and validate them
        let startDate, endDate;
        
        // Handle different input types for start date
        if (start instanceof Date) {
            if (isNaN(start.getTime())) {
                console.warn('Invalid start Date object:', start);
                startDate = new Date(); // Use current date as fallback
            } else {
                startDate = start;
            }
        } else {
            try {
                // Try more detailed parsing for ISO or MySQL format
                if (typeof start === 'string') {
                    if (start.includes('T') || start.includes(' ')) {
                        // ISO or MySQL datetime format
                        const dateStr = start.replace('T', ' ').replace('Z', '');
                        const [datePart, timePart] = dateStr.split(/[ T]/);
                        
                        if (datePart && timePart) {
                            const [year, month, day] = datePart.split('-').map(num => parseInt(num, 10));
                            const [hours, minutes, seconds] = timePart.split(':').map(num => parseInt(num, 10));
                            
                            // Correctly create the date (months are 0-indexed in JS)
                            startDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                            console.log('Custom parsed start date:', startDate.toString());
                        } else {
                            startDate = new Date(start);
                        }
                    } else {
                        startDate = new Date(start);
                    }
                } else {
                    startDate = new Date(start);
                }
                
                if (isNaN(startDate.getTime())) {
                    console.warn('Could not parse start date:', start);
                    startDate = new Date(); // Use current date as fallback
                }
            } catch (error) {
                console.error('Error parsing start date:', error);
                startDate = new Date(); // Use current date as fallback
            }
        }
        
        // Handle different input types for end date using the same approach
        if (end instanceof Date) {
            if (isNaN(end.getTime())) {
                console.warn('Invalid end Date object:', end);
                // Default to start date + 1 hour
                endDate = new Date(startDate);
                endDate.setHours(endDate.getHours() + 1);
            } else {
                endDate = end;
            }
        } else {
            try {
                // Try more detailed parsing for ISO or MySQL format
                if (typeof end === 'string') {
                    if (end.includes('T') || end.includes(' ')) {
                        // ISO or MySQL datetime format
                        const dateStr = end.replace('T', ' ').replace('Z', '');
                        const [datePart, timePart] = dateStr.split(/[ T]/);
                        
                        if (datePart && timePart) {
                            const [year, month, day] = datePart.split('-').map(num => parseInt(num, 10));
                            const [hours, minutes, seconds] = timePart.split(':').map(num => parseInt(num, 10));
                            
                            // Correctly create the date (months are 0-indexed in JS)
                            endDate = new Date(year, month - 1, day, hours, minutes, seconds || 0);
                            console.log('Custom parsed end date:', endDate.toString());
                        } else {
                            endDate = new Date(end);
                        }
                    } else {
                        endDate = new Date(end);
                    }
                } else {
                    endDate = new Date(end);
                }
                
                if (isNaN(endDate.getTime())) {
                    console.warn('Could not parse end date:', end);
                    // Default to start date + 1 hour
                    endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + 1);
                }
            } catch (error) {
                console.error('Error parsing end date:', error);
                // Default to start date + 1 hour
                endDate = new Date(startDate);
                endDate.setHours(endDate.getHours() + 1);
            }
        }
        
        // Ensure end date is after start date
        if (endDate <= startDate) {
            console.warn('End date is not after start date, adjusting');
            endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
        }
        
        // Log the parsed dates for debugging
        console.log('Final parsed dates:', {
            startDate: startDate.toString(),
            endDate: endDate.toString(),
            startHours: startDate.getHours(),
            startMinutes: startDate.getMinutes(),
            endHours: endDate.getHours(),
            endMinutes: endDate.getMinutes()
        });
        
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
        // Format date display
        let dateDisplay;
        const startDateNormalized = new Date(startDate);
        startDateNormalized.setHours(0, 0, 0, 0); // Normalize for comparison
        
        if (startDateNormalized.getTime() === today.getTime()) {
            dateDisplay = 'Today';
        } else if (startDateNormalized.getTime() === tomorrow.getTime()) {
            dateDisplay = 'Tomorrow';
        } else {
            dateDisplay = startDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        
        // Format time directly using explicit hours/minutes
        const startTimeStr = formatTime(startDate);
        const endTimeStr = formatTime(endDate);
        const timeDisplay = `${startTimeStr} - ${endTimeStr}`;
        
        console.log('Formatted display values:', {
            dateDisplay,
            timeDisplay,
            startTimeStr,
            endTimeStr
        });
        
        // Create shift card
        const shiftCard = document.createElement('div');
        shiftCard.className = 'shift-card';
        if (hide) {
            shiftCard.classList.add('future-shift');
            shiftCard.style.display = 'none';
        }
        
        shiftCard.innerHTML = `
            <div class="shift-date">${dateDisplay}</div>
            <div class="shift-time">${timeDisplay}</div>
            <div class="shift-details">
                <span class="shift-department">${title || 'Unassigned'}</span>
                <span class="shift-status">${status}</span>
            </div>
        `;
        
        // Add click event to view/edit the shift
        shiftCard.addEventListener('click', function() {
            // Create a simple event object for the edit modal
            const eventObj = {
                title: title || 'Unassigned',
                start: startDate,
                end: endDate,
                extendedProps: {
                    status: status
                }
            };
            openEditShiftModal(this, eventObj);
        });
        
        // Add to container
        shiftsContainer.appendChild(shiftCard);
    } catch (error) {
        console.error('Error adding shift to upcoming section:', error);
    }
}

// Function to refresh the calendar when a new shift is added
window.refreshCalendar = async function() {
    console.log('Refreshing calendar to show newly created shift');
    try {
        // Fetch updated shifts
        const shifts = await fetchShifts();
        console.log('Refreshed shifts:', shifts);
        
        // Refresh the calendar
        if (window.calendar) {
            window.calendar.refetchEvents();
            console.log('Calendar events refreshed');
        }
        
        // Refresh the upcoming shifts section
        const shiftsContainer = document.querySelector('.shifts-container');
        if (shiftsContainer) {
            // Remove existing shift cards
            const shiftCards = shiftsContainer.querySelectorAll('.shift-card');
            shiftCards.forEach(card => card.remove());
            
            // Track if we have future shifts
            let hasFutureShifts = false;
            
            if (shifts && shifts.length > 0) {
                console.log('Adding shifts to upcoming section');
                
                // Add shifts to the upcoming shifts section
                shifts.forEach(shift => {
                    try {
                        const startDate = new Date(shift.start);
                        const endDate = new Date(shift.end);
                        
                        // Validate dates
                        if (isNaN(startDate.getTime())) {
                            console.warn('Invalid start date in shift:', shift);
                            return; // Skip this shift
                        }
                        
                        const isNearFuture = isShiftInNearFuture(startDate);
                        
                        addShiftToUpcomingSection(
                            shift.title,
                            startDate,
                            endDate,
                            shift.extendedProps?.status || 'Pending',
                            !isNearFuture // Hide if not today/tomorrow
                        );
                        
                        if (!isNearFuture) {
                            hasFutureShifts = true;
                        }
                    } catch (error) {
                        console.error('Error processing shift for upcoming section:', error, shift);
                    }
                });
            } else {
                console.log('No shifts to display in upcoming section');
            }
            
            // Show the "Show More" button if we have future shifts
            const showMoreButton = document.querySelector('.show-more-shifts');
            if (showMoreButton) {
                showMoreButton.style.display = hasFutureShifts ? 'block' : 'none';
            }
        } else {
            console.warn('Shifts container not found, cannot update upcoming shifts');
        }
    } catch (error) {
        console.error('Error refreshing calendar:', error);
    }
};

// Add event listener to load roster data when the replacement tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.schedule-tabs .tab[data-tab="replacement"]').forEach(tab => {
        tab.addEventListener('click', function() {
                loadRosterData();
        });
    });
    
    // If the URL has a hash for replacement tab, load the data
    if (window.location.hash === '#replacement') {
        loadRosterData();
    }
}); 

// Function to update notification badges for tabs
function updateTabBadges() {
    const pendingAvailabilityCount = document.querySelectorAll('#availabilityTableBody tr[data-status="Pending"]').length;
    const pendingReplacementsCount = document.querySelectorAll('#rosterTableBody tr[data-status="Pending"]').length;
    
    // Update availability tab badge
    updateBadge('availability', pendingAvailabilityCount);
    
    // Update replacement tab badge
    updateBadge('replacement', pendingReplacementsCount);
}

// Helper function to update a single badge
function updateBadge(tabId, count) {
    const tab = document.querySelector(`.schedule-tabs .tab[data-tab="${tabId}"]`);
    if (!tab) return;
    
    // Get or create badge element
    let badge = tab.querySelector('.notification-badge');
    if (!badge && count > 0) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        tab.appendChild(badge);
    }
    
    // Update badge content or remove if count is zero
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

// Call updateTabBadges after data loads
const originalLoadAvailabilityData = loadAvailabilityData;
loadAvailabilityData = function() {
    originalLoadAvailabilityData.apply(this, arguments);
    updateTabBadges();
};

const originalLoadRosterData = loadRosterData;
loadRosterData = function() {
    originalLoadRosterData.apply(this, arguments);
    updateTabBadges();
};

// Function to handle availability approval
async function handleAvailabilityApproval(id, action) {
    try {
        const response = await fetch(`${API_BASE_URL}/availability/${id}/${action}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${action} availability: ${response.statusText}`);
        }
        
        // Refresh availability data
        loadAvailabilityData();
        
        // Update notification badges
        updateTabBadges();
        
        // If approved and auto-creation of shifts is enabled, create a shift
        if (action === 'approve') {
        }
    } catch (error) {
        console.error(`Error ${action} availability:`, error);
        showNotification(`Error ${action} availability: ${error.message}`, 'error');
    }
}

// Function to handle replacement request approval
async function handleReplacementApproval(id, action) {
    try {
        const response = await fetch(`${API_BASE_URL}/replacement/${id}/${action}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${action} replacement request: ${response.statusText}`);
        }
        
        showNotification(`Replacement request ${action}d successfully`, 'success');
        
        // Refresh roster data
        loadRosterData();
        
        // Update notification badges
        updateTabBadges();
    } catch (error) {
        console.error(`Error ${action} replacement request:`, error);
        showNotification(`Error ${action} replacement request: ${error.message}`, 'error');
    }
}

// Delete employee function
async function deleteEmployee(userId) {
    try {
        // Get current user info for role check
        const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (currentUserInfo.role || '').toLowerCase();
        
        // Only allow managers and admins to delete employees
        if (!['manager', 'admin'].includes(currentUserRole)) {
            alert('Only managers and admins can delete employees');
            return;
        }
        
        // Get API base URL from localStorage or use default
        const API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'http://localhost:8800/api';
        
        // Fetch all users and find the one we want to edit
        const response = await fetch(`${API_BASE_URL}/user/getUsers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}`);
        }
        
        const employees = await response.json();
        const employee = employees.find(emp => emp.userId === userId);
        
        if (!employee) {
            throw new Error(`Employee with ID ${userId} not found`);
        }
        
        const employeeRole = (employee.role || '').toLowerCase();
        
        // Managers cannot delete admins
        if (currentUserRole === 'manager' && employeeRole === 'admin') {
            alert('Managers cannot delete admin users');
            return;
        }
        
        // Confirm before delete
        if (!confirm(`Are you sure you want to delete employee ${employee.name} (${employee.email})?\nThis action cannot be undone.`)) {
            return;
        }
        
        // For this example, we'll just show a message since actual deletion is not implemented in the backend yet
        alert(`This would delete the employee ${employee.name} (${employee.email}). Backend endpoint for deletion needs to be implemented.`);
        
        loadEmployees();
        
    } catch (error) {
        console.error('Error deleting employee:', error);
        alert(`Error deleting employee: ${error.message}`);
    }
}

// Edit employee function 
async function editEmployee(userId) {
    try {
        // Get current user info for role check
        const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (currentUserInfo.role || '').toLowerCase();
        
        // Only allow managers and admins to edit employees
        if (!['manager', 'admin'].includes(currentUserRole)) {
            alert('Only managers and admins can edit employees');
            return;
        }
        
        // Get API base URL from localStorage or use default
        const API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'http://localhost:8800/api';
        
        // Fetch all users and find the one we want to edit
        const response = await fetch(`${API_BASE_URL}/user/getUsers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}`);
        }
        
        const employees = await response.json();
        const employee = employees.find(emp => emp.userId === userId);
        
        if (!employee) {
            throw new Error(`Employee with ID ${userId} not found`);
        }
        
        const employeeRole = (employee.role || '').toLowerCase();
        
        // Managers cannot edit admins
        if (currentUserRole === 'manager' && employeeRole === 'admin') {
            alert('Managers cannot edit admin users');
            return;
        }
        
        // Generate role options based on current user's role
        let roleOptions = '';
        if (currentUserRole === 'admin') {
            // Admins can assign any role
            roleOptions = `
                <option value="Employee" ${employee.role === 'Employee' ? 'selected' : ''}>Employee</option>
                <option value="Manager" ${employee.role === 'Manager' ? 'selected' : ''}>Manager</option>
                <option value="Admin" ${employee.role === 'Admin' ? 'selected' : ''}>Admin</option>
            `;
        } else if (currentUserRole === 'manager') {
            // Managers can only assign Employee role
            roleOptions = `
                <option value="Employee" ${employee.role === 'Employee' ? 'selected' : ''}>Employee</option>
            `;
            
            // If the employee is already a Manager, add that option but it will be disabled for editing
            if (employee.role === 'Manager') {
                roleOptions = `
                    <option value="Employee">Employee</option>
                    <option value="Manager" selected>Manager</option>
                `;
            }
        }
        
        // Create a modal for editing
        const editModal = document.createElement('div');
        editModal.className = 'modal';
        editModal.style.display = 'block';
        
        // Generate a form with the employee's current details
        editModal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentNode.parentNode.remove()">&times;</span>
                <h2>Edit Employee</h2>
                <form id="editEmployeeForm">
                    <div class="form-group">
                        <label for="edit-name">Full Name</label>
                        <input type="text" id="edit-name" value="${employee.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-email">Email</label>
                        <input type="email" id="edit-email" value="${employee.email || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-role">Role</label>
                        <select id="edit-role" required>
                            ${roleOptions}
                        </select>
                        ${currentUserRole === 'manager' ? '<small>Managers can only assign Employee role</small>' : ''}
                    </div>
                    <div class="form-group">
                        <label for="edit-department">Department</label>
                        <input type="text" id="edit-department" value="${employee.department || ''}">
                    </div>
                    <div class="form-group">
                        <label for="edit-birthday">Birthday</label>
                        <input type="date" id="edit-birthday" value="${formatDateForInput(employee.birthday)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-gender">Gender</label>
                        <select id="edit-gender" required>
                            <option value="Male" ${employee.gender === 'Male' ? 'selected' : ''}>Male</option>
                            <option value="Female" ${employee.gender === 'Female' ? 'selected' : ''}>Female</option>
                            <option value="Other" ${employee.gender === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="save-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(editModal);
        
        // Handle form submission
        const form = document.getElementById('editEmployeeForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get new role value
            const newRole = document.getElementById('edit-role').value;
            
            // Enforce role-based restrictions
            if (currentUserRole === 'manager') {
                // Managers can only assign Employee role
                if (newRole !== 'Employee' && employee.role !== newRole) {
                    alert('Managers can only assign Employee role');
                    return;
                }
            }
            
            const updatedEmployee = {
                email: document.getElementById('edit-email').value,
                data: {
                    name: document.getElementById('edit-name').value,
                    role: newRole,
                    department: document.getElementById('edit-department').value,
                    birthday: document.getElementById('edit-birthday').value,
                    gender: document.getElementById('edit-gender').value
                }
            };
            
            try {
                const updateResponse = await fetch(`${API_BASE_URL}/user/updateUser`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedEmployee)
                });
                
                if (!updateResponse.ok) {
                    throw new Error(`Failed to update employee: ${updateResponse.status} ${updateResponse.statusText}`);
                }
                
                alert('Employee updated successfully');
                editModal.remove();
                loadEmployees();
                
            } catch (error) {
                console.error('Error updating employee:', error);
                alert(`Error updating employee: ${error.message}`);
            }
        });
        
    } catch (error) {
        console.error('Error setting up employee edit:', error);
        alert(`Error: ${error.message}`);
    }
} 