// Helper function to get authentication token
function getToken() {
    return localStorage.getItem("token");
}

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
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
    
    // Create a new date object from the shift date, but only use year, month, day
    // This will ignore timezone issues by just comparing the date part
    let shiftDateOnly;
    if (shiftDate instanceof Date) {
        shiftDateOnly = new Date(
            shiftDate.getFullYear(),
            shiftDate.getMonth(),
            shiftDate.getDate(),
            0, 0, 0, 0
        );
    } else {
        // If it's a string, extract just the date part before creating Date object
        const dateStr = typeof shiftDate === 'string' ? shiftDate.split('T')[0] : shiftDate;
        shiftDateOnly = new Date(dateStr);
        shiftDateOnly.setHours(0, 0, 0, 0);
    }
    
    console.log('Comparing dates:', {
        today: today.toISOString(),
        shiftDateOnly: shiftDateOnly.toISOString(),
        isToday: shiftDateOnly.getTime() === today.getTime()
    });
    
    // Return true if shift is today or tomorrow
    return shiftDateOnly >= today && shiftDateOnly < dayAfterTomorrow;
}

// Function to show the Generate Shifts section
function showGenerateShiftsModal() {
    // Hide all sections first
    const mainContentSections = document.querySelectorAll('.main-content > div[class$="-section"]');
    mainContentSections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Show generate shifts section
    const generateShiftsSection = document.querySelector('.generate-shifts-section');
    if (generateShiftsSection) {
        generateShiftsSection.style.display = 'block';
        setupGenerateShiftsSection();
    }
    
    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const generateShiftsNav = document.getElementById('generate-shifts-nav');
    if (generateShiftsNav) {
        generateShiftsNav.classList.add('active');
    }
}

// Initialize calendar and page functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Define API base URL globally at the top level
    window.API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'http://localhost:8800/api';
    console.log('Using API base URL:', window.API_BASE_URL);
    
    // Check authentication when page loads
    checkAuth();
    
    // Load time off balances from localStorage
    loadTimeOffBalances();
    
    // Get user info to check permissions
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    
    // Hide Employee Management section for non-admin/manager users
    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    console.log('User role:', userRole, 'Is admin or manager:', isAdminOrManager);
    
    // Add admin-visible class to body if user is admin/manager
    if (isAdminOrManager) {
        document.body.classList.add('admin-visible');
        document.body.classList.add('manager-visible');
    } else {
        document.body.classList.remove('admin-visible');
        document.body.classList.remove('manager-visible');
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
    
    // Set up event listeners for sidebar navigation
    document.querySelector('.nav-item:has(i.fa-clock)').addEventListener('click', showTimeOffSection);
    
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
    showMoreButton.innerHTML = '<span></span>';
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
            // Enhanced logging to show more details about each event
            console.log('Event mounted in calendar:', {
                id: info.event.id,
                title: info.event.title,
                start: info.event.start,
                end: info.event.end,
                type: info.event.extendedProps.type,
                status: info.event.extendedProps.status,
                originalStatus: info.event.extendedProps.originalStatus,
                allExtendedProps: info.event.extendedProps,
                element: info.el
            });
            
            // Log when the event is not visible to help debug display issues
            if (info.el.style.display === 'none') {
                console.warn('Event is not visible:', info.event.title);
            }
            
            // Get the event type and status for color determination
            const type = info.event.extendedProps.type || 'regular';
            const status = info.event.extendedProps.status || 'pending';
            const employeeId = info.event.extendedProps.employeeId;
            
            // Add data-event-type attribute for CSS targeting
            info.el.setAttribute('data-event-type', type);
            
            // Also add data-status attribute for CSS targeting
            info.el.setAttribute('data-status', status);
            
            // Handle time off events differently
            if (type === 'timeoff') {
                // Use orange for time off events
                info.el.style.backgroundColor = '#FF9800';
                info.el.style.borderLeft = '4px solid #FF5722';
                info.el.style.borderRadius = '4px';
                info.el.style.fontStyle = 'italic';
                
                // Add an icon to indicate time off
                const titleEl = info.el.querySelector('.fc-event-title');
                if (titleEl) {
                    titleEl.innerHTML = `<i class="fas fa-clock mr-1"></i> ${titleEl.innerHTML}`;
                }
                
                // Add tooltip with reason if available
                const reason = info.event.extendedProps.reason;
                const timeOffType = info.event.extendedProps.timeOffType;
                if (reason) {
                    info.el.title = `${timeOffType} Leave: ${reason}`;
                } else {
                    info.el.title = `${timeOffType} Leave`;
                }
                
                return; // Exit early as we've handled time off events specifically
            }
            
            // Apply appropriate color based on type and status for regular shifts
            info.el.style.backgroundColor = getStatusColor(status, type);
            
            // Add special styling for pending shifts
            if (type === 'pending') {
                info.el.style.borderLeft = '4px solid #673ab7';
                info.el.style.fontStyle = 'italic';
                
                // Add "Pending" badge to title
                const titleEl = info.el.querySelector('.fc-event-title');
                if (titleEl) {
                    titleEl.innerHTML = `${titleEl.innerHTML} <span class="pending-badge">Generated</span>`;
                }
            }
            
            // Add a data attribute for employee ID to enable filtering
            if (employeeId) {
                info.el.setAttribute('data-employee-id', employeeId);
                
                // Add a small indicator to show which employee the shift belongs to
                // Use a subtle left border with a unique color based on employee ID
                // This creates a visual cue to distinguish different employees
                const colorIndex = parseInt(employeeId) % 10; // Get a number between 0-9 based on employee ID
                const employeeColors = [
                    '#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33A6',
                    '#33FFF6', '#F6FF33', '#FF8C33', '#8C33FF', '#33FF8C'
                ];
                const employeeColor = employeeColors[colorIndex];
                
                // Add a colored border on the right side to indicate employee
                info.el.style.borderRight = `4px solid ${employeeColor}`;
                
                // Add employee name as tooltip
                if (info.event.extendedProps.employeeName) {
                    info.el.title = `Employee: ${info.event.extendedProps.employeeName}`;
                }
            }
        },
        eventContent: function(eventInfo) {
            // Check if it's a time off event
            const type = eventInfo.event.extendedProps.type || 'regular';
            
            if (type === 'timeoff') {
                const timeOffType = eventInfo.event.extendedProps.timeOffType || 'Leave';
                const employeeName = eventInfo.event.extendedProps.employeeName || 'Employee';
                
                return {
                    html: `
                    <div class="fc-event-time"><i class="fas fa-clock"></i> Time Off</div>
                    <div class="fc-event-title">${employeeName}</div>
                    <div class="fc-event-subtitle">${timeOffType}</div>
                    `
                };
            }
            
            // Handle regular shifts as before
            // Get the shift title
            const shiftTitle = eventInfo.event.title;
            
            // Format the time display based on shift name
            let timeDisplay;
            if (shiftTitle.includes('Morning')) {
                timeDisplay = '6:00 AM - 2:00 PM';
            } else if (shiftTitle.includes('Afternoon')) {
                timeDisplay = '2:00 PM - 10:00 PM';
            } else if (shiftTitle.includes('Night')) {
                timeDisplay = '10:00 PM - 6:00 AM';
            } else {
                // Default to using the event times
                const start = eventInfo.event.start;
                const end = eventInfo.event.end;
                timeDisplay = `${formatTime(start)} - ${formatTime(end)}`;
            }
            
            return {
                html: `
                <div class="fc-event-title">${shiftTitle}</div>
                <div class="fc-event-time">${timeDisplay}</div>
                `
            };
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
            
            // Check if this is a time off event
            if (arg.event.extendedProps.type === 'timeoff') {
                // Extract the time off ID from the event ID (which has format 'timeoff-{id}')
                const timeOffId = arg.event.id.replace('timeoff-', '');
                // Show time off details
                viewTimeOffRequest(timeOffId);
                return;
            }
            
            // Regular shift handling
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
            document.querySelector('.attendance-section').style.display = 'none';
            document.querySelector('.payroll-section').style.display = 'none';
            
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
            } else if (itemText === 'Reports') {
                document.querySelector('.report-section').style.display = 'block';
                // Initialize reports if the function exists
                if (typeof initializeReports === 'function') {
                    initializeReports();
                }
            } else if (itemText === 'Attendance Rate') {
                document.querySelector('.attendance-section').style.display = 'block';
                // Initialize attendance if the function exists
                if (typeof initializeAttendance === 'function') {
                    initializeAttendance();
                }
            } else if (itemText === 'Payroll') {
                document.querySelector('.payroll-section').style.display = 'block';
                // Initialize payroll if the function exists
                if (typeof initializePayroll === 'function') {
                    initializePayroll();
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

    // Add click handler for Generate Shifts sidebar item
    const generateShiftsNav = document.getElementById('generate-shifts-nav');
    if (generateShiftsNav) {
        generateShiftsNav.addEventListener('click', function() {
            showGenerateShiftsModal();
        });
    }

    // Initialize filters after calendar is set up
    populateEmployeeFilter();

    // After calendar initialization, populate employee filter for admins/managers
    if (isAdminOrManager) {
        populateEmployeeFilter();
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

    // Load clinics for dropdown
    loadClinicsForDropdown();
}

// Function to load clinics for dropdown
async function loadClinicsForDropdown() {
    try {
        const clinicDropdown = document.getElementById('clinic');
        if (!clinicDropdown) return;
        
        // Clear existing options except the first one
        while (clinicDropdown.options.length > 1) {
            clinicDropdown.remove(1);
        }
        
        // Add loading option
        const loadingOption = document.createElement('option');
        loadingOption.text = 'Loading clinics...';
        loadingOption.disabled = true;
        clinicDropdown.add(loadingOption);
        
        // Fetch clinics
        const response = await fetch(`${window.API_BASE_URL}/clinic/getClinics`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch clinics');
        }
        
        const clinics = await response.json();
        
        // Remove loading option
        clinicDropdown.remove(clinicDropdown.options.length - 1);
        
        // Add clinic options
        clinics.forEach(clinic => {
            const option = document.createElement('option');
            option.value = clinic.clinicId;
            option.text = clinic.clinicName;
            clinicDropdown.add(option);
        });
    } catch (error) {
        console.error('Error loading clinics:', error);
        // Handle error in dropdown
        const clinicDropdown = document.getElementById('clinic');
        if (clinicDropdown) {
            // Remove loading option if it exists
            if (clinicDropdown.options.length > 1) {
                clinicDropdown.remove(clinicDropdown.options.length - 1);
            }
            
            // Add error option
            const errorOption = document.createElement('option');
            errorOption.text = 'Error loading clinics';
            errorOption.disabled = true;
            clinicDropdown.add(errorOption);
        }
    }
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
        department: document.getElementById('department').value,
        clinicId: document.getElementById('clinic').value || null
    };

    try {
        // Try to create the role, but don't fail if it already exists
        try {
            await fetch(
                `${window.API_BASE_URL}/role/createRole`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        roleName: formData.role,
                        description: "User role"
                    })
                }
            );
            console.log(`Role '${formData.role}' created or already exists`);
        } catch (roleError) {
            // If role creation fails because it already exists, we can continue
            console.warn('Role creation error (might already exist):', roleError);
            // Don't throw error - continue with user creation
        }

        // Then create the user
        const response = await fetch(
            `${window.API_BASE_URL}/user/createUser`,
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
        alert('Failed to create employee. Please make sure the backend server is running.');
    }
});

// Load employees
async function loadEmployees() {
    try {
        // Show loading indicator
        const tableBody = document.getElementById('employeeTableBody');
        tableBody.innerHTML = '<tr><td colspan="6">Loading employees...</td></tr>';
        
        // Get current user info for role check
        const currentUserInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (currentUserInfo.role || '').toLowerCase();
        
        const canManageEmployees = ['manager', 'admin'].includes(currentUserRole);
        
        const response = await fetch(`${window.API_BASE_URL}/user/getUsers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch employees');
        }
        
        const employees = await response.json();
        
        // Fetch clinics to get clinic names
        let clinics = [];
        try {
            const clinicsResponse = await fetch(`${window.API_BASE_URL}/clinic/getClinics`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (clinicsResponse.ok) {
                clinics = await clinicsResponse.json();
            }
        } catch (error) {
            console.warn('Failed to fetch clinics:', error);
        }
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Populate table with employee data
        employees.forEach(employee => {
            const row = document.createElement('tr');
            
            // Find clinic name if clinicId exists
            let clinicName = '-';
            if (employee.clinicId && clinics.length) {
                const clinic = clinics.find(c => c.clinicId == employee.clinicId);
                if (clinic) {
                    clinicName = clinic.clinicName;
                }
            }
            
            row.innerHTML = `
                <td>${employee.name || '-'}</td>
                <td>${employee.email || '-'}</td>
                <td>${employee.role || '-'}</td>
                <td>${employee.department || '-'}</td>
                <td>${clinicName}</td>
                <td>
                    ${canManageEmployees ? `
                        <button onclick="editEmployee(${employee.userId})" class="edit-btn">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteEmployee(${employee.userId})" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                        </td>
                `;
            
            tableBody.appendChild(row);
            });
    } catch (error) {
        console.error('Error loading employees:', error);
        document.getElementById('employeeTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="error-message">Error loading employees: ${error.message}</td>
            </tr>
        `;
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
    
    // Get user info from localStorage
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    // Pre-fill the edit form with current values
    document.getElementById('edit-name').value = document.getElementById('profile-name').textContent;
    document.getElementById('edit-email').value = userInfo.email || document.getElementById('profile-email').textContent;
    document.getElementById('edit-department').value = userInfo.department || document.getElementById('profile-department').textContent;
    document.getElementById('edit-birthday').value = formatDateForInput(document.getElementById('profile-birthday').textContent);
    document.getElementById('edit-gender').value = document.getElementById('profile-gender').textContent;
}

function closeEditProfileModal() {
    editProfileModal.style.display = 'none';
}

// Format date for input field (handles multiple formats)
function formatDateForInput(dateStr) {
    if (!dateStr || dateStr === 'Loading...' || dateStr === '-') {
        return '';
    }
    
    try {
        // Handle MySQL date format which can be YYYY-MM-DD
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateStr;
        }
        
        // Try to create a Date object (handles ISO format or MySQL date objects)
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return formatted;
        }
    } catch (e) {
        console.error('Error parsing date:', e);
    }
    
    // If the above fails, try to parse DD/MM/YYYY format
    if (typeof dateStr === 'string') {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            return formatted;
        }
    }
    
    return '';
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
    
    const birthdayValue = document.getElementById('edit-birthday').value;
    console.log('Profile update - birthday value:', birthdayValue);
    
    // Get user info from localStorage to get userId
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    const formData = {
        name: document.getElementById('edit-name').value,
        email: document.getElementById('edit-email').value || userInfo.email, // Ensure email is included
        department: document.getElementById('edit-department').value,
        birthday: birthdayValue,
        gender: document.getElementById('edit-gender').value,
        userId: userInfo.userId // Add userId to the request
    };
    
    console.log('Profile update - formData:', JSON.stringify(formData));
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/user/updateUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            // Update the local storage user info with new values
            userInfo.name = formData.name;
            userInfo.email = formData.email;
            userInfo.department = formData.department;
            userInfo.birthday = formData.birthday;
            userInfo.gender = formData.gender;
            
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            
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
// Store time off balances
let timeOffBalances = {
    Paid: 10,
    Unpaid: 5,
    Medical: 14
};

// Function to save time off balances to localStorage
function saveTimeOffBalances() {
    localStorage.setItem('timeOffBalances', JSON.stringify(timeOffBalances));
}

// Function to load time off balances from localStorage
function loadTimeOffBalances() {
    const savedBalances = localStorage.getItem('timeOffBalances');
    if (savedBalances) {
        timeOffBalances = JSON.parse(savedBalances);
    }
}

// Function to update time off policy display
function updateTimeOffPolicyDisplay() {
    const policyCards = document.querySelectorAll('.policy-card');
    if (policyCards.length >= 3) {
        // Update Paid Leave (PL)
        policyCards[0].querySelector('.policy-amount').textContent = `${timeOffBalances.Paid} days`;
        
        // Update Non-Paid Leave (NPL)
        policyCards[1].querySelector('.policy-amount').textContent = `${timeOffBalances.Unpaid} days`;
        
        // Update Medical Certificate (MC)
        policyCards[2].querySelector('.policy-amount').textContent = `${timeOffBalances.Medical} days`;
    }
}

// Function to calculate days between two dates
function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
    return diffDays;
}

// Function to show the Time Off section
function showTimeOffSection() {
    // Hide all sections first
    document.querySelector('.upcoming-shifts-section').style.display = 'none';
    document.querySelector('.calendar-section').style.display = 'none';
    document.querySelector('.employee-section').style.display = 'none';
    document.querySelector('.report-section').style.display = 'none';
    document.querySelector('.time-off-section').style.display = 'none';
    document.querySelector('.availability-section').style.display = 'none';
    document.querySelector('.schedule-section').style.display = 'none';
    document.querySelector('.generate-shifts-section').style.display = 'none';
    document.querySelector('.approve-timeoff-section').style.display = 'none';
    
    // Show Time Off section
    document.querySelector('.time-off-section').style.display = 'block';
    
    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item:has(i.fa-clock)').classList.add('active');
    
    // Update time off policy display
    updateTimeOffPolicyDisplay();
    
    // Load time off history
    loadTimeOffHistory();
}

// Function to load time off history
async function loadTimeOffHistory() {
    const tableBody = document.getElementById('timeOffHistoryBody');
    tableBody.innerHTML = '<tr><td colspan="6" class="loading-message">Loading time off requests...</td></tr>';
    
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userId = userInfo.userId;
        
        // Determine if user is manager/admin to show all requests or just their own
        const isAdminOrManager = userInfo.role === 'admin' || userInfo.role === 'manager';
        
        let endpoint = `${window.API_BASE_URL}/timeoff/`;
        if (!isAdminOrManager) {
            endpoint += `employee/${userId}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load time off requests');
        }
        
        const requests = await response.json();
    tableBody.innerHTML = '';
    
        if (requests.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-message">No time off requests found</td></tr>';
            return;
        }
        
        requests.forEach(request => {
        const row = document.createElement('tr');
        
        // Format dates for display
            const dateRequested = new Date(request.requestedAt).toLocaleDateString();
        const startDate = new Date(request.startDate).toLocaleDateString();
        const endDate = new Date(request.endDate).toLocaleDateString();
        
        // Determine status class
        let statusClass = '';
        if (request.status === 'Approved') {
            statusClass = 'status-approved';
            } else if (request.status === 'Declined') {
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
                    <button class="action-btn view-btn" onclick="viewTimeOffRequest(${request.timeOffId})">
                    <i class="fas fa-eye"></i>
                </button>
                    ${request.status === 'Pending' ? 
                    `<button class="action-btn delete-btn" onclick="deleteTimeOffRequest(${request.timeOffId})">
                    <i class="fas fa-trash"></i>
                    </button>` : ''}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    } catch (error) {
        console.error('Error loading time off history:', error);
        tableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading time off requests: ${error.message}</td></tr>`;
    }
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
    
    // Make sure the form has an event listener
    const form = document.getElementById('requestTimeOffForm');
    
    // Remove any existing listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', submitTimeOffRequest);
}

// Function to close the request time off modal
function closeRequestTimeOffModal() {
    document.getElementById('requestTimeOffModal').style.display = 'none';
}

// Function to submit a time off request
async function submitTimeOffRequest(event) {
    event.preventDefault();
    
    const typeSelect = document.getElementById('time-off-policy');
    const type = typeSelect.value;
    const startDate = document.getElementById('time-off-start-date').value;
    const endDate = document.getElementById('time-off-end-date').value;
    const reason = document.getElementById('time-off-notes').value;
    
    // Validate inputs
    if (!type || !startDate || !endDate) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
        showNotification('End date cannot be before start date', 'error');
        return;
    }
    
    // Calculate the number of days being requested
    const daysRequested = calculateDaysBetween(startDate, endDate);
    
    // Map the UI type value to our balance type
    let balanceType;
    switch(type) {
        case 'Paid':
            balanceType = 'Paid';
            break;
        case 'Unpaid':
            balanceType = 'Unpaid';
            break;
        case 'Medical':
            balanceType = 'Medical';
            break;
        default:
            balanceType = 'Paid';
    }
    
    // Check if there are enough days in the balance
    if (timeOffBalances[balanceType] < daysRequested) {
        showNotification(`Cannot submit request: Insufficient ${balanceType} Leave balance. Available: ${timeOffBalances[balanceType]} days, Requested: ${daysRequested} days`, 'error');
        return; // Stop the submission process
    }
    
    // Get user info for employeeId
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const employeeId = userInfo.userId;
    
    try {
        const token = getToken();
        const response = await fetch(`${window.API_BASE_URL}/timeoff/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                employeeId,
                type,
                startDate,
                endDate,
                reason
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit time off request');
        }
        
        const result = await response.json();
        
        // Close modal and refresh time off history
        closeRequestTimeOffModal();
        showNotification('Time off request submitted successfully', 'success');
        loadTimeOffHistory();
        
    } catch (error) {
        console.error('Error submitting time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}


// Function to view a time off request
async function viewTimeOffRequest(requestId) {
    try {
        const token = getToken();
        const response = await fetch(`${window.API_BASE_URL}/timeoff/${requestId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load time off request details');
        }
        
        const request = await response.json();
    currentTimeOffRequest = request;
    
    // Populate the details modal
        document.getElementById('request-employee-name').textContent = request.employeeName || 'Employee Name';
    
    const detailsContainer = document.getElementById('request-details-container');
    detailsContainer.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Request ID:</span>
                <span class="detail-value">${request.timeOffId}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date Requested:</span>
                <span class="detail-value">${new Date(request.requestedAt).toLocaleDateString()}</span>
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
            ${request.approvedBy ? `
            <div class="detail-row">
                <span class="detail-label">Approved By:</span>
                <span class="detail-value">${request.approverName || request.approvedBy}</span>
            </div>` : ''}
        <div class="detail-row">
            <span class="detail-label">Notes:</span>
                <span class="detail-value">${request.reason || 'No notes provided'}</span>
        </div>
    `;
    
        // Show or hide manager actions based on user role and request status
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const isAdminOrManager = userInfo.role === 'admin' || userInfo.role === 'manager';
    const managerActions = document.querySelector('.manager-actions');
        
        if (isAdminOrManager && request.status === 'Pending') {
        managerActions.style.display = 'flex';
    } else {
        managerActions.style.display = 'none';
    }
    
    // Show the modal
    document.getElementById('timeOffDetailsModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading time off request details:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Function to close the time off details modal
function closeTimeOffDetailsModal() {
    document.getElementById('timeOffDetailsModal').style.display = 'none';
    currentTimeOffRequest = null;
}

// Function to approve a time off request directly from the list
async function approveTimeOffRequest(requestId) {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const approvedBy = userInfo.userId;
        
        // Fetch the time off request details first to get type and dates
        const detailsResponse = await fetch(`${window.API_BASE_URL}/timeoff/${requestId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!detailsResponse.ok) {
            throw new Error('Failed to fetch time off request details');
        }
        
        const requestDetails = await detailsResponse.json();
        
        // Calculate days used
        const daysUsed = calculateDaysBetween(requestDetails.startDate, requestDetails.endDate);
        
        // Map the request type to our balance type
        let balanceType;
        switch(requestDetails.type) {
            case 'Paid':
                balanceType = 'Paid';
                break;
            case 'Unpaid':
                balanceType = 'Unpaid';
                break;
            case 'Medical':
                balanceType = 'Medical';
                break;
            default:
                balanceType = 'Paid'; // Default to paid leave if type is unknown
        }
        
        // Check if there are enough days in the balance
        if (timeOffBalances[balanceType] < daysUsed) {
            showNotification(`Cannot approve request: Insufficient ${balanceType} Leave balance. Available: ${timeOffBalances[balanceType]} days, Requested: ${daysUsed} days`, 'error');
            return; // Stop the approval process
        }
        
        // If sufficient balance, update the status to approved
        const response = await fetch(`${window.API_BASE_URL}/timeoff/update/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status: 'Approved',
                approvedBy
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to approve time off request');
        }
        
        // Deduct days from balance
        timeOffBalances[balanceType] -= daysUsed;
        
        // Save updated balances to localStorage
        saveTimeOffBalances();
        
        // Update policy display if time off section is visible
        if (document.querySelector('.time-off-section').style.display === 'block') {
            updateTimeOffPolicyDisplay();
        }
        
        showNotification(`Time off request approved successfully. ${daysUsed} day(s) deducted from ${balanceType} Leave balance.`, 'success');
        loadPendingTimeOffRequests();
        
    } catch (error) {
        console.error('Error approving time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Function to reject a time off request directly from the list
async function rejectTimeOffRequest(requestId) {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const approvedBy = userInfo.userId;
        
        const response = await fetch(`${window.API_BASE_URL}/timeoff/update/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status: 'Declined',
                approvedBy
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reject time off request');
        }
        
        // No deduction from balance when rejecting a request
        
        showNotification('Time off request rejected. No days deducted from balance.', 'info');
        loadPendingTimeOffRequests();
        
    } catch (error) {
        console.error('Error rejecting time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Function to delete a time off request
async function deleteTimeOffRequest(requestId) {
    if (!confirm('Are you sure you want to delete this time off request?')) {
        return;
    }
    
    try {
        const token = getToken();
        const response = await fetch(`${window.API_BASE_URL}/timeoff/${requestId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete time off request');
        }
        
        showNotification('Time off request deleted successfully', 'success');
    loadTimeOffHistory();
        
    } catch (error) {
        console.error('Error deleting time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

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
    
    // Determine if we're on a small screen (mobile)
    const isSmallScreen = window.innerWidth < 768;
    const isMediumScreen = window.innerWidth >= 768 && window.innerWidth < 992;
    
    employeeCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: isSmallScreen ? 'timeGridDay' : 'timeGridWeek',
        headerToolbar: {
            left: isSmallScreen ? 'prev,next' : 'prev,next today',
            center: 'title',
            right: isSmallScreen ? 'timeGridDay,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: '05:00:00',
        slotMaxTime: '23:00:00',
        allDaySlot: false,
        height: 'auto',
        aspectRatio: isSmallScreen ? 1.2 : (isMediumScreen ? 1.5 : 1.8), // Adjust aspect ratio for screen size
        slotDuration: isSmallScreen ? '01:00:00' : '00:30:00', // Use 1-hour slots on mobile for simplicity
        slotLabelInterval: '01:00:00', // Show hour labels
        expandRows: true, // Make sure the rows expand to fill the available height
        events: async function(info, successCallback, failureCallback) {
            try {
                const events = await fetchShifts();
                successCallback(events);
            } catch (error) {
                console.error('Employee calendar failed to fetch events:', error);
                failureCallback(error);
            }
        },
        eventDidMount: function(info) {
            console.log('Event mounted:', {
                id: info.event.id,
                title: info.event.title,
                start: info.event.start,
                end: info.event.end,
                type: info.event.extendedProps.type,
                status: info.event.extendedProps.status
            });
            
            // Get the event type and status for color determination
            const type = info.event.extendedProps.type || 'regular';
            const status = info.event.extendedProps.status || 'pending';
            const employeeId = info.event.extendedProps.employeeId;
            
            // Apply appropriate color based on type and status
            info.el.style.backgroundColor = getStatusColor(status, type);
            
            // Add special styling for pending shifts
            if (type === 'pending') {
                info.el.style.borderLeft = '4px solid #673ab7';
                info.el.style.fontStyle = 'italic';
                
                // Add "Pending" badge to title
                const titleEl = info.el.querySelector('.fc-event-title');
                if (titleEl) {
                    titleEl.innerHTML = `${titleEl.innerHTML} <span class="pending-badge">Pending</span>`;
                }
            }
            
            // Add a data attribute for employee ID to enable filtering
            if (employeeId) {
                info.el.setAttribute('data-employee-id', employeeId);
                
                // Add a small indicator to show which employee the shift belongs to
                // Use a subtle left border with a unique color based on employee ID
                // This creates a visual cue to distinguish different employees
                const colorIndex = parseInt(employeeId) % 10; // Get a number between 0-9 based on employee ID
                const employeeColors = [
                    '#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33A6',
                    '#33FFF6', '#F6FF33', '#FF8C33', '#8C33FF', '#33FF8C'
                ];
                const employeeColor = employeeColors[colorIndex];
                
                // Add a colored border on the right side to indicate employee
                info.el.style.borderRight = `4px solid ${employeeColor}`;
                
                // Add employee name as tooltip
                if (info.event.extendedProps.employeeName) {
                    info.el.title = `Employee: ${info.event.extendedProps.employeeName}`;
                }
            }
        },
        eventClick: function(info) {
            // Check if this is a pending shift
            if (info.event.extendedProps.type === 'pending') {
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const isManager = ['Manager', 'Admin'].includes(userInfo.role);
                
                if (isManager) {
                    // For managers, show a confirmation dialog to approve the shift
                    const pendingShiftId = info.event.id.replace('pending-', '');
                    const employeeName = info.event.extendedProps.employeeName || 'Unknown employee';
                    
                    if (confirm(`Do you want to approve this pending shift for ${employeeName}?`)) {
                        handlePendingShiftApproval(pendingShiftId)
                            .then(() => {
                                // Refresh the calendar after approval
                                employeeCalendar.refetchEvents();
                            })
                            .catch(error => {
                                console.error('Failed to approve shift:', error);
                            });
                    }
                } else {
                    // For non-managers, just show info that this is a pending shift
                    alert('This shift is pending manager approval.');
                }
            } else {
                // For regular shifts, use the normal edit shift modal
                openEditShiftModal(info.event);
            }
        },
        eventContent: function(eventInfo) {
            // Check if it's a time off event
            const type = eventInfo.event.extendedProps.type || 'regular';
            
            if (type === 'timeoff') {
                const timeOffType = eventInfo.event.extendedProps.timeOffType || 'Leave';
                const employeeName = eventInfo.event.extendedProps.employeeName || 'Employee';
                
                return {
                    html: `
                    <div class="fc-event-time"><i class="fas fa-clock"></i> Time Off</div>
                    <div class="fc-event-title">${employeeName}</div>
                    <div class="fc-event-subtitle">${timeOffType}</div>
                    `
                };
            }
            
            // Handle regular shifts as before
            // Get the shift title
            const shiftTitle = eventInfo.event.title;
            
            // Format the time display based on shift name
            let timeDisplay;
            if (shiftTitle.includes('Morning')) {
                timeDisplay = '6:00 AM - 2:00 PM';
            } else if (shiftTitle.includes('Afternoon')) {
                timeDisplay = '2:00 PM - 10:00 PM';
            } else if (shiftTitle.includes('Night')) {
                timeDisplay = '10:00 PM - 6:00 AM';
            } else {
                // Default to using the event times
                const start = eventInfo.event.start;
                const end = eventInfo.event.end;
                timeDisplay = `${formatTime(start)} - ${formatTime(end)}`;
            }
            
            return {
                html: `
                <div class="fc-event-title">${shiftTitle}</div>
                <div class="fc-event-time">${timeDisplay}</div>
                `
            };
        }
    });
    
    // Add window resize handler to adjust calendar view when screen size changes
    window.addEventListener('resize', debounce(function() {
        const newIsSmallScreen = window.innerWidth < 768;
        const newIsMediumScreen = window.innerWidth >= 768 && window.innerWidth < 992;
        
        // Only update if the screen size category changed
        if (newIsSmallScreen !== isSmallScreen || newIsMediumScreen !== isMediumScreen) {
            employeeCalendar.setOption('initialView', newIsSmallScreen ? 'timeGridDay' : 'timeGridWeek');
            employeeCalendar.setOption('aspectRatio', newIsSmallScreen ? 1.2 : (newIsMediumScreen ? 1.5 : 1.8));
            employeeCalendar.setOption('slotDuration', newIsSmallScreen ? '01:00:00' : '00:30:00');
            employeeCalendar.setOption('headerToolbar', {
                left: newIsSmallScreen ? 'prev,next' : 'prev,next today',
                center: 'title',
                right: newIsSmallScreen ? 'timeGridDay,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
            });
        }
    }, 250)); // Debounce to prevent too many updates
    
    employeeCalendar.render();
}
// Helper function to debounce resize events
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
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
    
    // Clear existing data
    tableBody.innerHTML = '';
    
    // Get user info from localStorage
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    // Try to fetch real data from API
    fetch(`${window.API_BASE_URL}/availability/employee/${userInfo.userId || 0}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch availability data');
        }
        return response.json();
    })
    .then(data => {
        console.log('Fetched availability data:', data);
        
        // If data is available and has availability array, render it
        if (data && data.availability && data.availability.length > 0) {
            renderAvailabilityData(data.availability);
        } else {
            console.log('No availability data found');
            // If no data, the table will remain empty
        }
    })
    .catch(error => {
        console.error('Error fetching availability data:', error);
        // Create default availability entries to show in the UI
        createDefaultAvailabilityDisplay();
    });
}

// Function to render availability data
function renderAvailabilityData(availabilityItems) {
    const tableBody = document.getElementById('availabilityTableBody');
    if (!tableBody) return;
    
    availabilityItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(item.startDate).toLocaleDateString();
        
        // Determine shift type and set display properties
        let shiftType = item.preferredShift || 'Unknown';
        let statusClass = '';
        let timeDisplay = '';
        
        // Set formatted time based on shift type
        if (shiftType.includes('Morning')) {
            statusClass = 'status-morning';
            timeDisplay = '6:00 AM - 2:00 PM';
        } else if (shiftType.includes('Afternoon')) {
            statusClass = 'status-afternoon';
            timeDisplay = '2:00 PM - 10:00 PM';
        } else if (shiftType.includes('Night')) {
            statusClass = 'status-night';
            timeDisplay = '10:00 PM - 6:00 AM';
        } else {
            // Generic format for unknown shift types
            statusClass = 'status-prefer';
            timeDisplay = `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`;
        }
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${timeDisplay}</td>
            <td><span class="availability-status ${statusClass}">${shiftType}</span></td>
            <td>${item.note || '-'}</td>
            <td><span class="availability-status status-approved">Approved</span></td>
            <td class="request-actions">
                <button class="action-btn view-btn" onclick="editAvailability(${item.availabilityId})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteAvailability(${item.availabilityId})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Function to create default availability display if API fails
function createDefaultAvailabilityDisplay() {
    const tableBody = document.getElementById('availabilityTableBody');
    if (!tableBody) return;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toLocaleDateString();
    
    // Show a message explaining these are sample items
    const noteRow = document.createElement('tr');
    noteRow.innerHTML = `
        <td colspan="6" class="api-note" style="text-align: center; padding: 10px; background-color: #f8f9fa;">
            <i class="fas fa-info-circle"></i> 
            Showing sample data because server connection failed. Please reload to try again.
        </td>
    `;
    tableBody.appendChild(noteRow);
    
    // Create sample data with hardcoded times - limit to just 1 of each type
    const defaultItems = [
        {
            id: 1,
            date: todayStr,
            type: 'Morning Shift',
            note: 'Sample morning shift',
            status: 'Approved'
        },
        {
            id: 2,
            date: todayStr,
            type: 'Afternoon Shift',
            note: 'Sample afternoon shift',
            status: 'Approved'
        },
        {
            id: 3,
            date: todayStr,
            type: 'Night Shift',
            note: 'Sample night shift',
            status: 'Approved'
        }
    ];
    
    defaultItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Determine status class and time display based on shift type
        let statusClass, timeDisplay;
        
        if (item.type === 'Morning Shift') {
            statusClass = 'status-morning';
            timeDisplay = '6:00 AM - 2:00 PM';
        } else if (item.type === 'Afternoon Shift') {
            statusClass = 'status-afternoon';
            timeDisplay = '2:00 PM - 10:00 PM';
        } else if (item.type === 'Night Shift') {
            statusClass = 'status-night';
            timeDisplay = '10:00 PM - 6:00 AM';
        }
        
        row.innerHTML = `
            <td>${item.date}</td>
            <td>${timeDisplay}</td>
            <td><span class="availability-status ${statusClass}">${item.type}</span></td>
            <td>${item.note || '-'}</td>
            <td><span class="availability-status status-approved">Approved</span></td>
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
    const calendarContainer = document.getElementById('employee-calendar');
    
    if (!calendarContainer) {
        console.error('Employee calendar container not found');
        return;
    }
    
    // The employee-calendar is using fullCalendar so we don't need to manually populate it
    // If the calendar is already initialized, we just need to refetch events
    if (window.employeeCalendar) {
        window.employeeCalendar.refetchEvents();
        return;
    }
    
    // If the calendar isn't initialized yet, we'll initialize it in initEmployeeCalendar()
    // which should be called elsewhere in the code
    initEmployeeCalendar();
}

// Function to show the availability modal
function showAvailabilityModal() {
    // Deprecated - Availability functionality moved to availability.js
    console.warn('Availability functionality has been moved to availability.js');
}

function closeAvailabilityModal() {
    // Deprecated - Availability functionality moved to availability.js
    console.warn('Availability functionality has been moved to availability.js');
}

function editAvailability(id) {
    // Deprecated - Availability functionality moved to availability.js
    console.warn('Availability functionality has been moved to availability.js');
}

function deleteAvailability(id) {
    // Deprecated - Availability functionality moved to availability.js
    console.warn('Availability functionality has been moved to availability.js');
}

// function to format time
function formatTime(time) {
    // If no time is provided, return a placeholder
    if (!time) return "12:00 AM";
    
    try {
        // Handle if time is already in HH:MM format (string)
        if (typeof time === 'string' && time.includes(':')) {
            const parts = time.split(':');
            if (parts.length >= 2) {
                const hours = parseInt(parts[0], 10);
                const minutes = parseInt(parts[1], 10);
                
                if (isNaN(hours) || isNaN(minutes)) {
                    return "12:00 AM"; // Default for invalid input
                }
                
                // Format for display with AM/PM
                const period = hours >= 12 ? 'PM' : 'AM';
                let displayHours = hours % 12;
                if (displayHours === 0) displayHours = 12; // 0 should display as 12
                
                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }
        }
        
        // Handle Date objects
        if (time instanceof Date && !isNaN(time.getTime())) {
            const hours = time.getHours();
            const minutes = time.getMinutes();
            
            // Format with AM/PM
            const period = hours >= 12 ? 'PM' : 'AM';
            let displayHours = hours % 12;
            if (displayHours === 0) displayHours = 12;
            
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        }
        
        // Try to create a Date object from the input
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            
            // Format with AM/PM
            const period = hours >= 12 ? 'PM' : 'AM';
            let displayHours = hours % 12;
            if (displayHours === 0) displayHours = 12;
            
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        }
        
        // If all else fails, return the default
        return "12:00 AM";
    } catch (error) {
        console.error('Error formatting time:', error);
        return "12:00 AM";
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
            const shiftTypeElement = document.querySelector('input[name="shift-type"]:checked');
            const dateElement = document.getElementById('availability-date');
            const allDayElement = document.getElementById('all-day-checkbox');
            const startTimeElement = document.getElementById('availability-start-time');
            const endTimeElement = document.getElementById('availability-end-time');
            const noteElement = document.getElementById('availability-note');
            
            // Exit if required elements don't exist
            if (!shiftTypeElement || !dateElement) {
                console.error('Required form elements not found:', { 
                    shiftTypeElement, 
                    dateElement 
                });
                return;
            }
            
            // Safely access values
            const shiftType = shiftTypeElement.value;
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
            
            // Set default times based on shift type if none provided
            let finalStartTime = startTime;
            let finalEndTime = endTime;
            
            if (!finalStartTime || !finalEndTime) {
                if (shiftType === 'MORNING') {
                    finalStartTime = '09:00';
                    finalEndTime = '17:00';
                } else if (shiftType === 'AFTERNOON') {
                    finalStartTime = '14:00';
                    finalEndTime = '22:00';
                } else if (shiftType === 'NIGHT') {
                    finalStartTime = '22:00';
                    finalEndTime = '06:00';
                }
            }
            
            // Create availability data
            const availabilityData = {
                date: date,
                startTime: finalStartTime,
                endTime: finalEndTime,
                shiftType: shiftType,
                note: note,
                allDay: allDay
            };
            
            console.log('Submitting availability:', availabilityData);
            
            // Close modal and refresh availability list
            document.getElementById('availabilityModal').style.display = 'none';
            loadAvailabilityData();
        });
    }
});

// Function to fetch all shifts
async function fetchShifts() {
    try {
        // Get user ID from local storage
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userId = userInfo.userId || 'unknown';
        const userRole = userInfo.role?.toLowerCase() || 'employee';
        
        console.log('Fetching shifts for user:', userId, 'with role:', userRole);
        
        let shifts = [];
        
        // For managers and admins, fetch all shifts
        if (userRole === 'manager' || userRole === 'admin') {
            console.log('User is manager/admin - fetching all shifts');
            try {
                const allShiftsResponse = await fetch(`${window.API_BASE_URL}/shift/all`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (allShiftsResponse.ok) {
                    const allShifts = await allShiftsResponse.json();
                    console.log('All shifts loaded:', allShifts.length);
                    
                    // Map to calendar format with employee name in title
                    shifts = allShifts.map(shift => {
                        // Include employee name in the shift title for better identification
                        let title = shift.title || `${shift.department || 'Unknown'}`;
                        if (shift.employeeName) {
                            title = `${shift.employeeName} - ${title}`;
                        }
                        
                        // Ensure valid dates
                        const startDate = new Date(shift.startDate);
                        let endDate;
                        
                        // Check if endDate is valid, if not create a default
                        if (shift.endDate && !isNaN(new Date(shift.endDate).getTime())) {
                            endDate = new Date(shift.endDate);
                            // If startDate and endDate are the same, add 1 hour to endDate
                            if (startDate.getTime() === endDate.getTime()) {
                                endDate = new Date(startDate);
                                endDate.setHours(endDate.getHours() + 1);
                            }
                        } else {
                            // Default: end time is start time + 1 hour
                            endDate = new Date(startDate);
                            endDate.setHours(endDate.getHours() + 1);
                            console.warn('Invalid or missing end date for shift ID:', shift.shiftId);
                        }
                        
                        // Convert "Scheduled" status to "Approved" for consistency
                        let status = shift.status || 'Pending';
                        if (status === 'Scheduled') {
                            status = 'Approved';
                            console.log(`Normalized shift ${shift.shiftId} status from "Scheduled" to "Approved"`);
                        }
                        
                        console.log(`Shift ID ${shift.shiftId} has status: ${status} (original: ${shift.status})`);
                        
                        return {
                            id: shift.shiftId,
                            title: title,
                            start: startDate,
                            end: endDate,
                            extendedProps: {
                                status: status,
                                type: 'regular',
                                shiftId: shift.shiftId,
                                employeeId: shift.employeeId,
                                employeeName: shift.employeeName,
                                department: shift.department,
                                clinicId: shift.clinicId
                            }
                        };
                    });
                } else {
                    console.error('Failed to fetch all shifts, falling back to user shifts');
                    // If all shifts endpoint fails, fall back to user shifts
                }
            } catch (error) {
                console.error('Error fetching all shifts:', error);
                // Continue with user shifts as fallback
            }
        }
        
        // If we couldn't get all shifts (or user is not admin/manager), get user's shifts
        if (shifts.length === 0) {
            // Get regular shifts for the current user
            const regularShiftsResponse = await fetch(`${window.API_BASE_URL}/shift/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!regularShiftsResponse.ok) {
                throw new Error('Failed to fetch shifts');
            }
            
            const regularShifts = await regularShiftsResponse.json();
            console.log('Regular shifts loaded:', regularShifts);
            
            // Map to calendar format
            shifts = regularShifts.map(shift => {
                let title = shift.title || `${shift.department || 'Unknown'} Shift`;
                // Convert "Scheduled" status to "Approved" for consistency
                let status = shift.status || 'Pending';
                if (status === 'Scheduled') {
                    status = 'Approved';
                    console.log(`Normalized user shift ${shift.shiftId} status from "Scheduled" to "Approved"`);
                }
                
                console.log(`User shift ID ${shift.shiftId} has status: ${status} (original: ${shift.status})`);
                
                // Ensure valid dates
                const startDate = new Date(shift.startDate);
                let endDate;
                
                // Check if endDate is valid, if not create a default
                if (shift.endDate && !isNaN(new Date(shift.endDate).getTime())) {
                    endDate = new Date(shift.endDate);
                    // If startDate and endDate are the same, add 1 hour to endDate
                    if (startDate.getTime() === endDate.getTime()) {
                        endDate = new Date(startDate);
                        endDate.setHours(endDate.getHours() + 1);
                    }
                } else {
                    // Default: end time is start time + 1 hour
                    endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + 1);
                    console.warn('Invalid or missing end date for shift ID:', shift.shiftId);
                }
                
                return {
                    id: shift.shiftId,
                    title: title,
                    start: startDate,
                    end: endDate,
                    extendedProps: {
                        status: status,
                        type: 'regular',
                        shiftId: shift.shiftId,
                        employeeId: shift.employeeId,
                        employeeName: shift.employeeName,
                        department: shift.department,
                        clinicId: shift.clinicId
                    }
                };
            });
        }
        
        // Get pending shifts if the user is a manager or admin
        let pendingShifts = [];
        if (userRole === 'manager' || userRole === 'admin') {
            pendingShifts = await fetchPendingShifts();
        }
        
        // Fetch time off requests
        let timeOffEvents = await fetchTimeOffForCalendar();
        
        // Combine shifts, pending shifts, and time off events
        const combinedShifts = [...shifts, ...pendingShifts, ...timeOffEvents];
        
        // Print a summary of the shifts by status
        const statusCounts = combinedShifts.reduce((counts, shift) => {
            const status = shift.extendedProps?.status || 'Unknown';
            counts[status] = (counts[status] || 0) + 1;
            return counts;
        }, {});
        
        console.log("Shifts summary by status:", statusCounts);
        
        return combinedShifts;
    } catch (error) {
        console.error('Error fetching shifts:', error);
        return [];
    }
}

// Function to fetch time off requests for calendar display
async function fetchTimeOffForCalendar() {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userId = userInfo.userId;
        const userRole = userInfo.role?.toLowerCase() || 'employee';
        
        // Determine which endpoint to use based on user role
        let endpoint = `${window.API_BASE_URL}/timeoff/`;
        if (!(userRole === 'manager' || userRole === 'admin')) {
            endpoint += `employee/${userId}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load time off requests for calendar');
        }
        
        const requests = await response.json();
        
        // Filter for approved requests only
        const approvedRequests = requests.filter(req => req.status === 'Approved');
        
        // Convert each time off request to a calendar event
        return approvedRequests.map(req => {
            const startDate = new Date(req.startDate);
            const endDate = new Date(req.endDate);
            
            // Set end date to end of day
            endDate.setHours(23, 59, 59);
            
            return {
                id: `timeoff-${req.timeOffId}`,
                title: `Time Off: ${req.employeeName || 'Employee'} - ${req.type}`,
                start: startDate,
                end: endDate,
                allDay: true,
                extendedProps: {
                    status: 'Approved',
                    type: 'timeoff',
                    timeOffId: req.timeOffId,
                    employeeId: req.employeeId,
                    employeeName: req.employeeName,
                    timeOffType: req.type,
                    reason: req.reason
                },
                backgroundColor: '#FF9800', // Orange for time off events
                borderColor: '#FF5722'
            };
        });
    } catch (error) {
        console.error('Error fetching time off for calendar:', error);
        return [];
    }
}

// Function to get color based on shift status
function getStatusColor(status, type = 'regular') {
    // If it's a pending shift (from generate shifts feature), use a distinct color
    if (type === 'pending') {
        return '#9c27b0'; // Purple for pending generated shifts
    }

    // Normalize status to lowercase for case-insensitive comparison
    const normalizedStatus = status.toLowerCase();
    
    // Log for debugging
    console.log(`Getting color for shift status: "${status}" (normalized: "${normalizedStatus}")`);

    switch (normalizedStatus) {
        case 'confirmed':
            return '#4CAF50'; // Green
        case 'cancelled':
            return '#F44336'; // Red
        case 'completed':
            return '#607D8B'; // Gray/Blue
        case 'approved':
            return '#4CAF50'; // Green
        case 'scheduled': // Add handling for "Scheduled" status
            return '#4CAF50'; // Green (same as approved)
        case 'rejected':
            return '#F44336'; // Red
        case 'pending':
        default:
            return '#2196F3'; // Blue for regular pending
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
        const response = await fetch(`${window.API_BASE_URL}/shift/add`, {
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
        
        // Normalize status - treat "Scheduled" as "Approved"
        let normalizedStatus = status;
        if (status === 'Scheduled') {
            normalizedStatus = 'Approved';
            console.log('Normalized status from "Scheduled" to "Approved"');
        }
        
        // Normalize status to lowercase for case-insensitive comparison
        if (typeof normalizedStatus === 'string') {
            normalizedStatus = normalizedStatus.toLowerCase();
        }
        
        // Format to display status with proper capitalization
        const displayStatus = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
        
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
            console.log('End date is not after start date, adjusting');
            // Create a new end date 8 hours after start date for a full shift
            endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 8); // Set to 8 hours later for a standard shift
            
            // If the shift title contains specific words, set appropriate durations
            if (typeof title === 'string') {
                if (title.includes('Morning')) {
                    // Morning shift: 6:00 AM - 2:00 PM (8 hours)
                    startDate.setHours(6, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setHours(14, 0, 0, 0);
                } else if (title.includes('Afternoon')) {
                    // Afternoon shift: 2:00 PM - 10:00 PM (8 hours)
                    startDate.setHours(14, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setHours(22, 0, 0, 0);
                } else if (title.includes('Night')) {
                    // Night shift: 10:00 PM - 6:00 AM (8 hours)
                    startDate.setHours(22, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 1); // Next day
                    endDate.setHours(6, 0, 0, 0);
                }
            }
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
        // Create a normalized date using just year, month, day to avoid timezone issues
        const startDateNormalized = new Date(
            startDate.getFullYear(),
            startDate.getMonth(), 
            startDate.getDate(),
            0, 0, 0, 0
        );
        
        console.log('Comparing for display:', {
            todayDate: today.toISOString().split('T')[0],
            startDateNormalized: startDateNormalized.toISOString().split('T')[0],
            isToday: startDateNormalized.getTime() === today.getTime()
        });
        
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
        
        // Format time based on shift title
        let timeDisplay;
        if (typeof title === 'string') {
            if (title.includes('Morning')) {
                timeDisplay = '6:00 AM - 2:00 PM';
            } else if (title.includes('Afternoon')) {
                timeDisplay = '2:00 PM - 10:00 PM';
            } else if (title.includes('Night')) {
                timeDisplay = '10:00 PM - 6:00 AM';
            } else {
                // Default formatting using the date objects
                const startTimeStr = formatTime(startDate);
                const endTimeStr = formatTime(endDate);
                timeDisplay = `${startTimeStr} - ${endTimeStr}`;
            }
        } else {
            // If title is not a string, format using date objects
            const startTimeStr = formatTime(startDate);
            const endTimeStr = formatTime(endDate);
            timeDisplay = `${startTimeStr} - ${endTimeStr}`;
        }
        
        console.log('Formatted display values:', {
            dateDisplay,
            timeDisplay
        });
        
        // Create shift card with status-specific class
        const shiftCard = document.createElement('div');
        shiftCard.className = 'shift-card';
        
        // Add status-specific class for styling
        shiftCard.classList.add(`shift-status-${normalizedStatus}`);
        
        if (hide) {
            shiftCard.classList.add('future-shift');
            shiftCard.style.display = 'none';
        }
        
        shiftCard.innerHTML = `
            <div class="shift-date">${dateDisplay}</div>
            <div class="shift-time">${timeDisplay}</div>
            <div class="shift-details">
                <span class="shift-department">${title || 'Unassigned'}</span>
                <span class="shift-status ${normalizedStatus}">${displayStatus}</span>
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
                    status: normalizedStatus
                }
            };
            openEditShiftModal(this, eventObj);
        });
        
        // Add to container
        shiftsContainer.appendChild(shiftCard);
        
        // Log successful addition
        console.log(`Successfully added ${normalizedStatus} shift to upcoming section`);
    } catch (error) {
        console.error('Error adding shift to upcoming section:', error);
    }
}

// Function to refresh the calendar when a new shift is added
window.refreshCalendar = async function() {
    try {
        // Fetch updated shifts
        const updatedShifts = await fetchShifts();
        
        // Refresh the main calendar
        if (window.calendar) {
            window.calendar.refetchEvents();
        }
        
        // Also refresh the employee calendar if available
        if (employeeCalendar) {
            employeeCalendar.refetchEvents();
        }
        
        return true;
    } catch (error) {
        console.error('Error refreshing calendar:', error);
        return false;
    }
}

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
    // Deprecated - Availability functionality moved to availability.js
    console.warn('Availability functionality has been moved to availability.js');
}

// Function to handle pending shift approval
async function handlePendingShiftApproval(pendingShiftId) {
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        if (!['Manager', 'Admin'].includes(userInfo.role)) {
            showNotification('Only managers can approve shifts', 'error');
            return;
        }
        
        const response = await fetch(`${window.API_BASE_URL}/shift/approve-pending`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pendingShiftId: pendingShiftId,
                managerId: userInfo.userId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to approve pending shift');
        }
        
        const result = await response.json();
        showNotification('Shift approved successfully', 'success');
        
        // Refresh calendar to show the new approved shift
        if (window.employeeCalendar) {
            window.employeeCalendar.refetchEvents();
        }
        
        return result;
    } catch (error) {
        console.error('Error approving pending shift:', error);
        showNotification(`Error: ${error.message}`, 'error');
        throw error;
    }
}

// Function to handle replacement request approval
async function handleReplacementApproval(id, action) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/replacement/${id}/${action}`, {
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
        const response = await fetch(`${window.API_BASE_URL}/user/getUsers`, {
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
        // Fetch all users and find the specific user by ID
        const userResponse = await fetch(
            `${window.API_BASE_URL}/user/getUsers`,
            {
            headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
            }
        );
        
        if (!userResponse.ok) {
            throw new Error('Failed to fetch users');
        }
        
        const allUsers = await userResponse.json();
        const employee = allUsers.find(user => user.userId === userId);
        
        if (!employee) {
            throw new Error(`Employee with ID ${userId} not found`);
        }
        
        // Get current user info for permissions checking
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (userInfo.role || '').toLowerCase();
        
        let roleOptions;
        
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
                        <input type="text" id="edit-name" name="name" value="${employee.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-email">Email</label>
                        <input type="email" id="edit-email" name="email" value="${employee.email || ''}" readonly>
                        <small>Email cannot be changed as it's used as the user identifier</small>
                    </div>
                    <div class="form-group">
                        <label for="edit-role">Role</label>
                        <select id="edit-role" name="role" required>
                            ${roleOptions}
                        </select>
                        ${currentUserRole === 'manager' ? '<small>Managers can only assign Employee role</small>' : ''}
                    </div>
                    <div class="form-group">
                        <label for="edit-department">Department</label>
                        <input type="text" id="edit-department" name="department" value="${employee.department || ''}">
                    </div>
                    <div class="form-group">
                        <label for="edit-clinic">Clinic</label>
                        <select id="edit-clinic" name="clinicId">
                            <option value="">Select Clinic</option>
                            <!-- Will be populated dynamically -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-birthday">Birthday</label>
                        <input type="date" id="edit-birthday" name="birthday" value="${formatDateForInput(employee.birthday)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-gender">Gender</label>
                        <select id="edit-gender" name="gender" required>
                            <option value="Male" ${employee.gender === 'Male' ? 'selected' : ''}>Male</option>
                            <option value="Female" ${employee.gender === 'Female' ? 'selected' : ''}>Female</option>
                            <option value="other" ${employee.gender === 'other' ? 'selected' : ''}>Other</option>
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
        
        // Load clinics for the dropdown and set selected value
        populateClinicDropdown(document.getElementById('edit-clinic'), employee.clinicId);
        
        // Handle form submission
        const form = document.getElementById('editEmployeeForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Create FormData object from the form
            const formData = new FormData(this);
            
            // Convert FormData to an object
            const formValues = {};
            for (let [key, value] of formData.entries()) {
                formValues[key] = value;
            }
            
            // Manually get gender since it might be missing from FormData
            const genderSelect = document.getElementById('edit-gender');
            const genderValue = genderSelect ? genderSelect.value : null;
            
            // Check if email is present
            if (!formValues.email) {
                alert('Email is required');
                return;
            }
            
            // Get role for permission check
            const newRole = formValues.role;
            
            // Enforce role-based restrictions
            if (currentUserRole === 'manager') {
                // Managers can only assign Employee role
                if (newRole !== 'Employee' && employee.role !== newRole) {
                    alert('Managers can only assign Employee role');
                    return;
                }
            }
            
            // Create the request object
            const updatedEmployee = {
                email: formValues.email,
                name: formValues.name,
                role: formValues.role,
                department: formValues.department,
                clinicId: formValues.clinicId || null,
                birthday: formValues.birthday,
                gender: genderValue || formValues.gender // Use manually extracted gender value as fallback
            };
            
            try {
                // Send the update request
                const updateResponse = await fetch(
                    `${window.API_BASE_URL}/user/updateUser`,
                    {
                        method: 'PUT',
                    headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(updatedEmployee)
                    }
                );
                
                if (updateResponse.ok) {
                alert('Employee updated successfully');
                editModal.remove();
                loadEmployees();
                } else {
                    const errorData = await updateResponse.json();
                    alert(errorData.error || 'Failed to update employee');
                }
            } catch (error) {
                console.error('Error updating employee:', error);
                alert('An error occurred while updating the employee');
            }
        });
    } catch (error) {
        console.error('Error fetching employee details:', error);
        alert('Failed to load employee details. Please try again.');
    }
}

// Function to populate clinic dropdown and set selected clinic
async function populateClinicDropdown(dropdownElement, selectedClinicId) {
    try {
        if (!dropdownElement) return;
        
        // Clear existing options except the first one
        while (dropdownElement.options.length > 1) {
            dropdownElement.remove(1);
        }
        
        // Add loading option
        const loadingOption = document.createElement('option');
        loadingOption.text = 'Loading clinics...';
        loadingOption.disabled = true;
        dropdownElement.add(loadingOption);
        
        // Fetch clinics
        const response = await fetch(`${window.API_BASE_URL}/clinic/getClinics`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch clinics');
        }
        
        const clinics = await response.json();
        
        // Remove loading option
        dropdownElement.remove(dropdownElement.options.length - 1);
        
        // Add clinic options
        clinics.forEach(clinic => {
            const option = document.createElement('option');
            option.value = clinic.clinicId;
            option.text = clinic.clinicName;
            if (selectedClinicId && clinic.clinicId == selectedClinicId) {
                option.selected = true;
            }
            dropdownElement.add(option);
        });
    } catch (error) {
        console.error('Error loading clinics:', error);
        // Handle error in dropdown
        if (dropdownElement) {
            // Remove loading option if it exists
            if (dropdownElement.options.length > 1) {
                dropdownElement.remove(dropdownElement.options.length - 1);
            }
            
            // Add error option
            const errorOption = document.createElement('option');
            errorOption.text = 'Error loading clinics';
            errorOption.disabled = true;
            dropdownElement.add(errorOption);
        }
    }
}

// Helper function to diagnose and fix shift date issues
function ensureCorrectShiftTimes(shift) {
    const shiftTitle = shift.title || shift.preferredShift || 'Scheduled Shift';
    
    // Get the start and end dates
    let startDate = new Date(shift.startDate);
    let endDate = new Date(shift.endDate);
    
    // If it's an afternoon shift with problematic times
    if (shiftTitle.includes('Afternoon') && 
        endDate.getHours() === startDate.getHours() && 
        endDate.getMinutes() === startDate.getMinutes()) {
        
        // Set proper times for Afternoon shift (2:00 PM to 10:00 PM)
        startDate.setHours(14, 0, 0);
        endDate.setHours(22, 0, 0);
        
        // Update the shift object
        shift.startDate = startDate;
        shift.endDate = endDate;
    }
    
    // If it's a morning shift with problematic times
    if (shiftTitle.includes('Morning') && 
        endDate.getHours() === startDate.getHours() && 
        endDate.getMinutes() === startDate.getMinutes()) {
        
        // Set proper times for Morning shift (6:00 AM to 2:00 PM)
        startDate.setHours(6, 0, 0);
        endDate.setHours(14, 0, 0);
        
        // Update the shift object
        shift.startDate = startDate;
        shift.endDate = endDate;
    }
    
    // If it's a night shift with problematic times
    if (shiftTitle.includes('Night') && 
        endDate.getHours() === startDate.getHours() && 
        endDate.getMinutes() === startDate.getMinutes()) {
        
        // Set proper times for Night shift (10:00 PM to 6:00 AM)
        startDate.setHours(22, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(6, 0, 0);
        
        // Update the shift object
        shift.startDate = startDate;
        shift.endDate = endDate;
    }
    
    return shift;
}

// Shift Swap Functions
let swapRequestModal = null;
let myShifts = [];
let targetShifts = [];

function showSwapRequestModal() {
    swapRequestModal = document.getElementById('swapRequestModal');
    swapRequestModal.style.display = 'block';
    
    // Load my shifts
    loadMyShifts();
    // Load available employees
    loadAvailableEmployees();
    
    // Add event listeners
    document.getElementById('target-employee').addEventListener('change', handleTargetEmployeeChange);
    document.getElementById('swapRequestForm').addEventListener('submit', handleSwapRequestSubmit);
}

function closeSwapRequestModal() {
    if (swapRequestModal) {
        swapRequestModal.style.display = 'none';
    }
}

async function loadMyShifts() {
    try {
        window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:8800/api';
        
        // Get the user info from localStorage to get the user ID
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.userId) {
            throw new Error('User not logged in');
        }
        
        // Use the actual endpoint that exists in your backend
        const response = await fetch(`${window.API_BASE_URL}/shift/${userInfo.userId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            // If the endpoint returns an error, use mock data
            console.warn('Using mock shift data as fallback');
            
            // Create some mock shifts
            const mockShifts = [
                { 
                    shiftId: 1,
                    title: 'Morning Shift',
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
                },
                { 
                    shiftId: 2,
                    title: 'Afternoon Shift',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString()
                }
            ];
            
            // Populate the shift select dropdown
            const myShiftSelect = document.getElementById('my-shift');
            myShiftSelect.innerHTML = '<option value="">Select your shift</option>';
            
            mockShifts.forEach(shift => {
                const startDate = new Date(shift.startDate);
                const option = document.createElement('option');
                option.value = shift.shiftId;
                option.textContent = `${formatDateForDisplay(startDate)} - ${shift.title}`;
                myShiftSelect.appendChild(option);
            });
            
            return;
        }
        
        // If endpoint works, use actual data
        const shifts = await response.json();
        
        // Populate the shift select dropdown
        const myShiftSelect = document.getElementById('my-shift');
        myShiftSelect.innerHTML = '<option value="">Select your shift</option>';
        
        shifts.forEach(shift => {
            const startDate = new Date(shift.startDate);
            const option = document.createElement('option');
            option.value = shift.shiftId;
            option.textContent = `${formatDateForDisplay(startDate)} - ${shift.title}`;
            myShiftSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading shifts:', error);
        
        // Show a simple message in the dropdown
        const myShiftSelect = document.getElementById('my-shift');
        if (myShiftSelect) {
            myShiftSelect.innerHTML = '<option value="">Error loading shifts</option>';
        }
    }
}

async function loadAvailableEmployees() {
    try {
        window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:8800/api';
        
        // Since there's no specific endpoint for available employees, let's use the getUsers endpoint
        // and provide a fallback to mock data
        
        const response = await fetch(`${window.API_BASE_URL}/user/getUsers`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        let employeeData = [];
        
        if (!response.ok) {
            // If the endpoint returns an error, use mock data
            console.warn('Using mock employee data as fallback');
            
            employeeData = [
                { userId: 7, name: 'Admin User', department: 'Doctor' },
                { userId: 8, name: 'Manager User', department: 'Nurse' },
                { userId: 9, name: 'Employee User', department: 'Receptionist' }
            ];
        } else {
            // If endpoint works, use actual data
            employeeData = await response.json();
        }
        
        // Skip current user 
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserId = userInfo.userId;
        
        // Populate the employee select dropdown
        const targetEmployeeSelect = document.getElementById('target-employee');
        targetEmployeeSelect.innerHTML = '<option value="">Select employee</option>';
        
        employeeData
            .filter(employee => employee.userId != currentUserId) // Filter out current user
            .forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.userId;
                option.textContent = `${employee.name} (${employee.department || 'No department'})`;
                targetEmployeeSelect.appendChild(option);
            });
        
        // Enable the employee select
        targetEmployeeSelect.disabled = false;
    } catch (error) {
        console.error('Error loading employees:', error);
        
        // Show a simple message in the dropdown
        const targetEmployeeSelect = document.getElementById('target-employee');
        if (targetEmployeeSelect) {
            targetEmployeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            targetEmployeeSelect.disabled = true;
        }
    }
}

async function handleTargetEmployeeChange(event) {
    const employeeId = event.target.value;
    if (!employeeId) {
        // If no employee selected, clear and disable the shift dropdown
        const targetShiftSelect = document.getElementById('target-shift');
        targetShiftSelect.innerHTML = '<option value="">Select shift</option>';
        targetShiftSelect.disabled = true;
        return;
    }
    
    try {
        window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:8800/api';
        
        // Try to fetch the employee's shifts
        const response = await fetch(`${window.API_BASE_URL}/shift/${employeeId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        let shiftData = [];
        
        if (!response.ok) {
            // If the endpoint returns an error, use mock data
            console.warn('Using mock shift data for employee as fallback');
            
            shiftData = [
                { 
                    shiftId: 3,
                    title: 'Morning Shift',
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
                },
                { 
                    shiftId: 4,
                    title: 'Afternoon Shift',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString()
                }
            ];
        } else {
            // If endpoint works, use actual data
            shiftData = await response.json();
        }
        
        // Populate the target shift select dropdown
        const targetShiftSelect = document.getElementById('target-shift');
        targetShiftSelect.innerHTML = '<option value="">Select shift</option>';
        
        shiftData.forEach(shift => {
            const startDate = new Date(shift.startDate);
            const option = document.createElement('option');
            option.value = shift.shiftId;
            option.textContent = `${formatDateForDisplay(startDate)} - ${shift.title}`;
            targetShiftSelect.appendChild(option);
        });
        
        targetShiftSelect.disabled = false;
    } catch (error) {
        console.error('Error loading employee shifts:', error);
        
        // Show a simple message in the dropdown
        const targetShiftSelect = document.getElementById('target-shift');
        if (targetShiftSelect) {
            targetShiftSelect.innerHTML = '<option value="">Error loading shifts</option>';
            targetShiftSelect.disabled = true;
        }
    }
}

async function handleSwapRequestSubmit(event) {
    event.preventDefault();
    
    const myShiftId = document.getElementById('my-shift').value;
    const targetShiftId = document.getElementById('target-shift').value;
    const reason = document.getElementById('swap-reason').value;
    
    if (!myShiftId || !targetShiftId) {
        showNotification('Please select both shifts', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/shift/swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                shiftId: myShiftId,
                swapId: targetShiftId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit swap request');
        }
        
        
        showNotification('Swap request submitted successfully', 'success');
        closeSwapRequestModal();
        loadSwapRequests(); // Refresh the lists
    } catch (error) {
        console.error('Error submitting swap request:', error);
        showNotification('Failed to submit swap request', 'error');
    }
}

// Helper function to check if current user is a manager or admin
function isManager() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const role = userInfo.role ? userInfo.role.toLowerCase() : '';
    return role === 'manager' || role === 'admin';
}

