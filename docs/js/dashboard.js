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
    // Return true if shift is today or tomorrow
    return shiftDateOnly >= today && shiftDateOnly < dayAfterTomorrow;
}

// Initialize calendar and page functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Define API base URL globally at the top level
    window.API_BASE_URL = localStorage.getItem('apiBaseUrl') || 'https://emp-roster-backend.onrender.com/';
    console.log('Using API base URL:', window.API_BASE_URL);

    // Check authentication when page loads
    checkAuth();

    // Fetch initial leave balances
    fetchLeaveBalances();

    // Check user role and set up permissions using the checkUserRole function
    await checkUserRole();

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
            const isNearFuture = isShiftInNearFuture(shift.start);

            // current user
            if(shift.extendedProps.employeeId === JSON.parse(localStorage.getItem('userInfo')).userId){
                // Use the global addShiftToUpcomingSection function
                if(isNearFuture){
                    // If shift is today or tomorrow, DO NOT hide it
                    addShiftToUpcomingSection(
                        shift.title,
                        shift.start,
                        shift.end,
                        shift.extendedProps.status,
                        false // Do not hide
                    );
                } else {
                    // If shift is after tomorrow, hide it and indicate there are future shifts
                    addShiftToUpcomingSection(
                        shift.title,
                        shift.start,
                        shift.end,
                        shift.extendedProps.status,
                        true // Hide this future shift
                    );
                    hasFutureShifts = true;
                }
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

                const allEvents = await fetchShifts();
                
                // Filter out availability events
                const filteredEvents = allEvents.filter(event => {
                    // Check if event is an availability event based on title
                    if (event.title && event.title.toLowerCase().includes('availability')) {
                        console.log('Filtered out availability event from main calendar:', event.title);
                        return false;
                    }
                    
                    // Also filter by sourceType if it's an availability event
                    if (event.sourceType === 'availability') {
                        console.log('Filtered out availability by sourceType from main calendar:', event.title);
                        return false;
                    }
                    
                    // Also check extendedProps.type
                    if (event.extendedProps && event.extendedProps.type === 'availability') {
                        console.log('Filtered out availability by type from main calendar:', event.title);
                        return false;
                    }
                    
                    return true;
                });
                
                console.log(`Main calendar: Filtered from ${allEvents.length} to ${filteredEvents.length} events (removed availability)`);
                successCallback(filteredEvents);
            } catch (error) {
                console.error('Calendar failed to fetch events:', error);
                failureCallback(error);
            }
        },
        eventDidMount: function(info) {
            // Double-check no availability events are being displayed
            const eventType = info.event.extendedProps.type;
            const eventTitle = info.event.title || '';
            const eventSourceType = info.event.extendedProps.sourceType || '';
            
            if (eventType === 'availability' || 
                eventSourceType === 'availability' ||
                eventTitle.toLowerCase().includes('availability')) {
                // This is an availability event that shouldn't be shown
                console.log('Hiding availability event that slipped through in main calendar:', eventTitle);
                // Hide the event
                info.el.style.display = 'none';
                return; // Skip further processing
            }

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
            // const shiftTitle = eventInfo.event.title;
            const shiftTitle = eventInfo.event.extendedProps.employeeName;

            // Format the time display based on shift name(Calendar)
            let timeDisplay;
            if (shiftTitle.includes('Day')) {
                timeDisplay = '9:00 AM - 5:00 PM';
            } else if (shiftTitle.includes('Evening')) {
                timeDisplay = '5:00 PM - 1:00 AM';
            } else {
                // Default to using the event times
                const start = eventInfo.event.start;
                const end = eventInfo.event.end;
                timeDisplay = `${formatTime(start,'{h}:{i}:{s}')} - ${end == null ? '1:00AM' : formatTime(end,'{h}:{i}:{s}')}`;
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

    // Apply clinic filter for employees immediately after rendering
    filterCalendarEvents();

    // Add click handlers for navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            // Get the item text for identifying which section to show
            const itemText = this.textContent.trim();

            // Get user info to determine role
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const userRole = (userInfo.role || '').toLowerCase();
            const isAdmin = userRole === 'admin';
            
            // Check if employee management was clicked but user doesn't have permissions
            if (itemText === 'Employee Management' && !isAdmin) {
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
            document.querySelector('.approve-timeoff-section').style.display = 'none';

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
                // Only load employee data for admin
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const userRole = (userInfo.role || '').toLowerCase();
                const isAdmin = userRole === 'admin';
                
                if (isAdmin) {
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
            } else if (itemText === 'Approve Time Off') {
                document.querySelector('.approve-timeoff-section').style.display = 'block';
                // Load pending time off requests
                loadPendingTimeOffRequests();
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
    // Get user info to determine role
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';

    // Populate employee filters for admins (since they manage employees)
    if (isAdmin || isManager) {
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
    const isAdmin = userRole === 'admin';

    if (!isAdmin) {
        alert('Only administrators can create new employees.');
        return;
    }

    document.getElementById('createEmployeeModal').style.display = 'block';

    // Make sure the close button works
    document.querySelector('#createEmployeeModal .close').onclick = function() {
        document.getElementById('createEmployeeModal').style.display = 'none';
    };

    // Load departments for dropdown
    loadDepartmentsForDropdown();
}

// Function to load departments for dropdown
async function loadDepartmentsForDropdown() {
    try {
        const departmentDropdown = document.getElementById('department');
        if (!departmentDropdown) return;

        // Clear existing options except the first one
        while (departmentDropdown.options.length > 1) {
            departmentDropdown.remove(1);
        }

        // Add loading option
        const loadingOption = document.createElement('option');
        loadingOption.text = 'Loading departments...';
        loadingOption.disabled = true;
        departmentDropdown.add(loadingOption);

        // Fetch departments
        const response = await fetch(`${window.API_BASE_URL}/department/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch departments');
        }

        const departments = await response.json();

        // Remove loading option
        departmentDropdown.remove(departmentDropdown.options.length - 1);

        // Add department options
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.departmentName;
            option.text = dept.departmentName;
            departmentDropdown.add(option);
        });
    } catch (error) {
        console.error('Error loading departments:', error);
        // Handle error in dropdown
        const departmentDropdown = document.getElementById('department');
        if (departmentDropdown) {
            // Remove loading option if it exists
            if (departmentDropdown.options.length > 1) {
                departmentDropdown.remove(departmentDropdown.options.length - 1);
            }

            // Add error option
            const errorOption = document.createElement('option');
            errorOption.text = 'Error loading departments';
            errorOption.disabled = true;
            departmentDropdown.add(errorOption);
        }
    }
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

// Handle employee creation form submission
document.getElementById('createEmployeeForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const birthday = document.getElementById('birthday').value;
    const gender = document.getElementById('gender').value;
    const role = document.getElementById('role').value;
    const department = document.getElementById('department').value;
    const baseSalary = document.getElementById('baseSalary').value;
    const postalCode = document.getElementById('postalCode').value;

    if (!postalCode) {
        alert('Postal code is required for clinic auto-assignment');
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/user/createUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name,
                email,
                password,
                role,
                birthday,
                gender,
                department,
                baseSalary,
                postalCode
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create employee');
        }

        alert('Employee created successfully!');
        document.getElementById('createEmployeeModal').style.display = 'none';
        document.getElementById('createEmployeeForm').reset();
        loadEmployees();

    } catch (error) {
        alert(`Error: ${error.message}`);
        console.error('Error:', error);
        alert('Failed to create employee. Please make sure the backend server is running.');
    }
});

// Load employees
async function loadEmployees() {
    try {
        // Show loading indicator
        const tableBody = document.getElementById('employeeTableBody');
        tableBody.innerHTML = '<tr><td colspan="8">Loading employees...</td></tr>';

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
            let postalCode = '-';
            if (employee.clinicId && clinics.length) {
                const clinic = clinics.find(c => c.clinicId == employee.clinicId);
                if (clinic) {
                    clinicName = clinic.clinicName;
                    postalCode = employee.postalCode || clinic.postalCode || '-';
                }
            } else {
                postalCode = employee.postalCode || '-';
            }

            // Format salary if exists
            let salaryDisplay = '-';
            if (employee.baseSalary) {
                salaryDisplay = `$${parseFloat(employee.baseSalary).toFixed(2)}`;
            }

            row.innerHTML = `
                <td>${employee.name || '-'}</td>
                <td>${employee.email || '-'}</td>
                <td>${employee.role || '-'}</td>
                <td>${employee.department || '-'}</td>
                <td>${clinicName} <span class="auto-assigned">(Auto-assigned)</span></td>
                <td>${postalCode}</td>
                <td>${salaryDisplay}</td>
                <td>
                    ${canManageEmployees ? `
                            <button onclick="editEmployee(${employee.userId})" class="edit-btn">
                            <i class="fas fa-edit"></i>
                            <button onclick="deleteEmployee(${employee.userId})" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>` 
                    : ''}
                    </td>
                `;

            tableBody.appendChild(row);
            });

    } catch (error) {
        console.error('Error loading employees:', error);
        document.getElementById('employeeTableBody').innerHTML = `
             <tr>
                 <td colspan="8" class="error-message">Error loading employees: ${error.message}</td>
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
        // Fetch fresh data from the server
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found in localStorage');
            return;
        }

        // First try to get fresh data from the server
        try {
            const response = await fetch(`${window.API_BASE_URL}/user/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log('Fresh user data loaded:', userData);

                // Update localStorage with fresh data
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const updatedUserInfo = {
                    ...userInfo,
                    ...userData
                };
                localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
            } else {
                console.warn('Could not fetch fresh user data, using cached data');
            }
        } catch (fetchError) {
            console.warn('Error fetching fresh user data:', fetchError);
            // Continue with cached data if fetch fails
        }

        // Get the user info from localStorage
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
        // Update profile information
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
        alert('An error occurred while updating your profile: ' + error.message);
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
    // Handle null, undefined, or invalid dates
    if (!date) {
        return 'N/A';
    }

    // Handle special error messages
    if (typeof date === 'string' && (
        date === 'No date available' || 
        date.includes('Invalid') || 
        date.includes('Unknown')
    )) {
        return date; // Return the error message as is
    }

    // Handle time-only format like "09:00:00" from MySQL TIME columns
    if (typeof date === 'string' && date.match(/^\d{2}:\d{2}:\d{2}$/)) {
        return date.substring(0, 5); // Return "09:00" from "09:00:00"
    }

    let dateObj;
    try {
        // Special handling for MySQL DATE values that are objects with a UTC timestamp
        if (date instanceof Object && date.constructor !== Date && date.toString().includes('T')) {
            // This handles cases like 2025-06-07T16:00:00.000Z from JSON
            date = date.toString();
        }
        
        // Convert to Date object if it's not already
        dateObj = date instanceof Date ? date : new Date(date);

        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date received:', date);
            return 'Invalid Date';
        }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

        const dateToCheck = new Date(dateObj);
    dateToCheck.setHours(0, 0, 0, 0);

    if (dateToCheck.getTime() === today.getTime()) {
        return 'Today';
    } else if (dateToCheck.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } catch (error) {
        console.error('Error formatting date:', error, 'Original value:', date);
        // Return the original date string if it's a string, otherwise a default message
        return typeof date === 'string' ? date : 'Date Error';
    }
}

// Time Off variables
let currentTimeOffRequest = null;
// Store time off balances
let timeOffBalances = {};

// Function to fetch leave balances from the backend
async function fetchLeaveBalances() {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        if (!userInfo.userId) {
            console.warn('Cannot fetch leave balances: Missing user ID');
            setDefaultLeaveBalances();
            return;
        }

        const response = await fetch(`${window.API_BASE_URL}/timeoff/balances?employeeId=${userInfo.userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn('No leave balances found for user, using defaults');
                setDefaultLeaveBalances();
                return;
            }
            throw new Error('Failed to fetch leave balances');
        }

        const result = await response.json();
        if (result.data && result.data.length > 0) {
            const balance = result.data[0];
            timeOffBalances = {
                Paid: balance.Paid,
                Unpaid: balance.Unpaid,
                Medical: balance.Medical
            };
            updateTimeOffPolicyDisplay();
        } else {
            setDefaultLeaveBalances();
        }
    } catch (err) {
        console.error('Error fetching leave balances:', err);
        setDefaultLeaveBalances();
    }
}

// Function to set default leave balances when API fails
function setDefaultLeaveBalances() {
    timeOffBalances = {
        Paid: 0,
        Unpaid: 0,
        Medical: 0
    };
    updateTimeOffPolicyDisplay();
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
    const sections = [
        '.upcoming-shifts-section',
        '.calendar-section',
        '.employee-section',
        '.report-section',
        '.time-off-section',
        '.availability-section',
        '.schedule-section',
        '.generate-shifts-section',
        '.approve-timeoff-section'
    ];

    // Hide all sections safely with null checks
    sections.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    });

    // Show Time Off section
    const timeOffSection = document.querySelector('.time-off-section');
    if (timeOffSection) {
        timeOffSection.style.display = 'block';
    }

    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const timeOffNav = document.querySelector('.nav-item:has(i.fa-clock)');
    if (timeOffNav) {
        timeOffNav.classList.add('active');
    }

    // Fetch and update time off balances
    fetchLeaveBalances();

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

        // Determine user role
        const userRole = userInfo.role ? userInfo.role.toLowerCase() : '';
        const isAdmin = userRole === 'admin';
        const isManager = userRole === 'manager';
        
        // Only admins should see all time off requests
        let endpoint = `${window.API_BASE_URL}/timeoff/`;
        
        // Managers and regular employees only see their own requests
        if (!isAdmin) {
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

        // Add conflict indicator if there are schedule conflicts
        const conflictIndicator = request.hasScheduleConflicts ?
            `<span class="conflict-indicator" title="This request conflicts with existing shifts">
                <i class="fas fa-exclamation-triangle"></i>
            </span>` : '';

        row.innerHTML = `
            <td>${dateRequested}</td>
            <td>${request.type}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td><span class="request-status ${statusClass}">${request.status}</span> ${conflictIndicator}</td>
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

    // Get user info for employeeId
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const employeeId = userInfo.userId;

    if (!employeeId) {
        showNotification('User information not found', 'error');
        return;
    }

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

        const result = await response.json();

        if (!response.ok) {
                throw new Error(result.error || 'Failed to submit time off request');
            }

        // Show success message
            showNotification('Time off request submitted successfully', 'success');

        // Close the modal
        closeRequestTimeOffModal();

        // Refresh the time off history
        loadTimeOffHistory();

        // Refresh leave balances
        fetchLeaveBalances();

    } catch (err) {
        console.error('Error submitting time off request:', err);
        showNotification(err.message, 'error');
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

        // Get user info to check role
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userRole = userInfo.role ? userInfo.role.toLowerCase() : '';
        const isAdmin = userRole === 'admin';
        const isManager = userRole === 'manager';

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
        
        if ((isAdmin || isManager) && request.hasScheduleConflicts) {
            let conflictHTML = `
                <div class="detail-section schedule-conflicts">
                    <h3 class="section-title">
                        <i class="fas fa-exclamation-triangle"></i> Schedule Conflicts
                    </h3>
                    <div class="warning-message">
                        <p>This employee has shifts scheduled during the requested time off period.</p>
                    </div>
            `;

            // Add existing shift conflicts
            if (request.conflicts?.existing?.length > 0) {
                conflictHTML += `
                    <h4>Existing Shifts:</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>`;

                request.conflicts.existing.forEach(shift => {
                    conflictHTML += `
                        <tr>
                            <td>${shift.date}</td>
                            <td>${shift.title || 'Regular Shift'}</td>
                            <td>${shift.status}</td>
                        </tr>
                    `;
                });

                conflictHTML += `
                        </tbody>
                    </table>
                `;
            }

            // Add pending shift conflicts
            if (request.conflicts?.pending?.length > 0) {
                conflictHTML += `
                    <h4>Pending Shifts:</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>`;

                request.conflicts.pending.forEach(shift => {
                    conflictHTML += `
                        <tr>
                            <td>${shift.date}</td>
                            <td>${shift.title || 'Regular Shift'}</td>
                            <td>${shift.status}</td>
                        </tr>
                    `;
                });

                conflictHTML += `
                        </tbody>
                    </table>
                `;
            }

            // Add staff replacement suggestions
            if (request.availableStaffSuggestions?.length > 0) {
                conflictHTML += `
                    <h3 class="section-title">
                        <i class="fas fa-user-friends"></i> Available Staff Suggestions
                    </h3>
                `;

                request.availableStaffSuggestions.forEach(suggestion => {
                    conflictHTML += `
                        <div class="replacement-suggestion">
                            <h4>Shift Period: ${suggestion.shiftPeriod}</h4>
                    `;

                    if (suggestion.availableStaff.length > 0) {
                        conflictHTML += `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Department</th>
                                        <th>Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;

                        suggestion.availableStaff.forEach(staff => {
                            conflictHTML += `
                                <tr>
                                    <td>${staff.name}</td>
                                    <td>${staff.department}</td>
                                    <td>${staff.role}</td>
                                </tr>
                            `;
                        });

                        conflictHTML += `
                                </tbody>
                            </table>
                        `;
                    } else {
                        conflictHTML += `<p>No available staff for this shift period</p>`;
                    }

                    conflictHTML += `</div>`;
                });
            }

            // Add recommendations if any
            if (request.recommendations?.length > 0) {
                conflictHTML += `
                    <div class="recommendations">
                        <h4>Recommendations:</h4>
                        <ul>
                `;

                request.recommendations.forEach(recommendation => {
                    conflictHTML += `<li>${recommendation}</li>`;
                });

                conflictHTML += `
                        </ul>
                    </div>
                `;
            }

            conflictHTML += `</div>`;
            detailsContainer.innerHTML += conflictHTML;
        }

        // Show or hide manager actions based on user role and request status
        const managerActions = document.querySelector('.manager-actions');
        
        // Both managers and admins can approve/reject time off requests
        if ((isAdmin || isManager) && request.status === 'Pending') {
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

        // If there are conflicts in the time off request, show them along with replacement suggestions
        if (requestDetails.hasScheduleConflicts) {
            return new Promise((resolve) => {
                // Create confirmation modal
                const confirmModal = document.createElement('div');
                confirmModal.className = 'modal';
                confirmModal.id = 'shiftConflictModal';

                let modalHTML = `
                    <div class="modal-content warning-modal">
                        <span class="close">&times;</span>
                        <div class="warning-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h2>Shift Conflicts Detected</h2>
                        </div>
                        <p>The employee has shifts scheduled during the requested time off period:</p>
                        <div class="time-off-details">
                            <p><strong>Employee:</strong> ${requestDetails.employeeName || 'Employee'}</p>
                            <p><strong>Time Off Period:</strong> ${formatDateForDisplay(new Date(requestDetails.startDate))} to ${formatDateForDisplay(new Date(requestDetails.endDate))}</p>
                            <p><strong>Type:</strong> ${requestDetails.type} Leave</p>
                        </div>`;

                // Add existing shift conflicts
                if (requestDetails.conflicts?.existing?.length > 0) {
                    modalHTML += `
                        <h3>Existing Shifts:</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;

                    requestDetails.conflicts.existing.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${shift.date}</td>
                                <td>${shift.title || 'Regular Shift'}</td>
                                <td>${shift.status}</td>
                            </tr>`;
                    });

                    modalHTML += `
                            </tbody>
                        </table>`;
                }

                // Add pending shift conflicts
                if (requestDetails.conflicts?.pending?.length > 0) {
                    modalHTML += `
                        <h3>Pending Shifts:</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;

                    requestDetails.conflicts.pending.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${shift.date}</td>
                                <td>${shift.title || 'Regular Shift'}</td>
                                <td>${shift.status}</td>
                            </tr>`;
                    });

                    modalHTML += `
                            </tbody>
                        </table>`;
                }

                // Add staff replacement suggestions
                if (requestDetails.availableStaffSuggestions?.length > 0) {
                    modalHTML += `
                        <h3 class="section-title">
                            <i class="fas fa-user-friends"></i> Available Staff Suggestions
                        </h3>`;

                    requestDetails.availableStaffSuggestions.forEach(suggestion => {
                        modalHTML += `
                            <div class="replacement-suggestion">
                                <h4>Shift Period: ${suggestion.shiftPeriod}</h4>`;

                        if (suggestion.availableStaff.length > 0) {
                            modalHTML += `
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;

                            suggestion.availableStaff.forEach(staff => {
                                modalHTML += `
                                    <tr>
                                        <td>${staff.name}</td>
                                        <td>${staff.department}</td>
                                        <td>${staff.role}</td>
                                    </tr>`;
                            });

                            modalHTML += `
                                    </tbody>
                                </table>`;
                        } else {
                            modalHTML += `<p>No available staff for this shift period</p>`;
                        }

                        modalHTML += `</div>`;
                    });
                }

                // Add recommendations if any
                if (requestDetails.recommendations?.length > 0) {
                    modalHTML += `
                        <div class="recommendations">
                            <h4>Recommendations:</h4>
                            <ul>`;

                    requestDetails.recommendations.forEach(recommendation => {
                        modalHTML += `<li>${recommendation}</li>`;
                    });

                    modalHTML += `
                            </ul>
                        </div>`;
                } else {
                    modalHTML += `
                        <div class="recommendations">
                            <h3><i class="fas fa-info-circle"></i> What to do next</h3>
                            <ul>
                                <li>Consider rescheduling the conflicting shifts</li>
                                <li>Assign a replacement for the scheduled shifts</li>
                                <li>Discuss alternatives with the employee</li>
                            </ul>
                        </div>`;
                }

                modalHTML += `
                    <div class="modal-footer">
                        <p><i class="fas fa-headset"></i> Do you still want to approve this time off request?</p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn-danger" id="cancelApproval">Cancel</button>
                            <button class="btn-primary" id="confirmApproval">Approve Anyway</button>
                        </div>
                    </div>
                </div>`;

                confirmModal.innerHTML = modalHTML;
                document.body.appendChild(confirmModal);

                // Show the modal
                document.getElementById('shiftConflictModal').style.display = 'block';

                // Add event listeners for buttons
                document.getElementById('confirmApproval').addEventListener('click', async () => {
                    // Close the modal
                    document.getElementById('shiftConflictModal').style.display = 'none';

                    // Continue with approval
                    try {
                        await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
                        resolve();
                    } catch (error) {
                        console.error('Error during approval:', error);
                        showNotification(`Error: ${error.message}`, 'error');
                        resolve();
                    } finally {
                        // Remove the modal
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                    }
                });

                document.getElementById('cancelApproval').addEventListener('click', () => {
                    // Close and remove the modal
                    document.getElementById('shiftConflictModal').style.display = 'none';
                    setTimeout(() => {
                        document.getElementById('shiftConflictModal').remove();
                    }, 500);
                    resolve();
                });

                // Close button functionality
                document.querySelector('#shiftConflictModal .close').addEventListener('click', () => {
                    document.getElementById('shiftConflictModal').style.display = 'none';
                    setTimeout(() => {
                        document.getElementById('shiftConflictModal').remove();
                    }, 500);
                    resolve();
                });
            });
        } else {
            // No conflicts found in request, check for shifts manually
        try {
            // Fetch employee shifts for the time period
            const shiftResponse = await fetch(`${window.API_BASE_URL}/shift/${requestDetails.employeeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!shiftResponse.ok) {
                throw new Error('Failed to fetch employee shifts');
            }

            const shifts = await shiftResponse.json();

            // Find shifts that overlap with the requested time off period
            const startDate = new Date(requestDetails.startDate);
            const endDate = new Date(requestDetails.endDate);

            // Filter shifts that overlap with the time off period
            const conflictingShifts = shifts.filter(shift => {
                const shiftStart = new Date(shift.startDate);
                const shiftEnd = new Date(shift.endDate);

                // Check if shift overlaps with time off period
                return (
                    (shiftStart <= endDate && shiftEnd >= startDate) ||
                    (shiftStart >= startDate && shiftEnd <= endDate) ||
                    (shiftStart <= startDate && shiftEnd >= startDate) ||
                    (shiftStart <= endDate && shiftEnd >= endDate)
                );
            });

            // If there are conflicting shifts, show a confirmation modal
            if (conflictingShifts.length > 0) {
                return new Promise((resolve) => {
                    // Create confirmation modal
                    const confirmModal = document.createElement('div');
                    confirmModal.className = 'modal';
                    confirmModal.id = 'shiftConflictModal';

                    let modalHTML = `
                        <div class="modal-content warning-modal">
                            <span class="close">&times;</span>
                            <div class="warning-header">
                                <i class="fas fa-exclamation-triangle"></i>
                                <h2>Shift Conflicts Detected</h2>
                            </div>
                            <p>The employee has ${conflictingShifts.length} existing shift(s) scheduled during the requested time off period:</p>
                            <div class="time-off-details">
                                <p><strong>Employee:</strong> ${requestDetails.employeeName || 'Employee'}</p>
                                <p><strong>Time Off Period:</strong> ${formatDateForDisplay(new Date(requestDetails.startDate))} to ${formatDateForDisplay(new Date(requestDetails.endDate))}</p>
                                <p><strong>Type:</strong> ${requestDetails.type} Leave</p>
                            </div>
                            
                            <h3>Conflicting Shifts:</h3>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                    conflictingShifts.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${formatDateForDisplay(new Date(shift.startDate))}</td>
                                <td>${shift.title || shift.department || 'Shift'}</td>
                                <td><span class="status-badge ${shift.status.toLowerCase()}">${shift.status}</span></td>
                            </tr>`;
                    });

                    modalHTML += `
                                </tbody>
                            </table>
                            
                            <div class="recommendations">
                                <h3><i class="fas fa-info-circle"></i> What to do next</h3>
                                <ul>
                                    <li>Consider rescheduling the conflicting shifts</li>
                                    <li>Assign a replacement for the scheduled shifts</li>
                                    <li>Discuss alternatives with the employee</li>
                                </ul>
                            </div>
                            
                            <div class="modal-footer">
                                <p><i class="fas fa-headset"></i> Do you still want to approve this time off request?</p>
                                <div style="display: flex; gap: 10px; justify-content: center;">
                                    <button class="btn-danger" id="cancelApproval">Cancel</button>
                                    <button class="btn-primary" id="confirmApproval">Approve Anyway</button>
                                </div>
                            </div>
                        </div>`;

                    confirmModal.innerHTML = modalHTML;
                    document.body.appendChild(confirmModal);

                    // Show the modal
                    document.getElementById('shiftConflictModal').style.display = 'block';

                    // Add event listeners for buttons
                    document.getElementById('confirmApproval').addEventListener('click', async () => {
                        // Close the modal
                        document.getElementById('shiftConflictModal').style.display = 'none';

                        // Continue with approval
                        try {
                            await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
                            resolve();
                        } catch (error) {
                            console.error('Error during approval:', error);
                            showNotification(`Error: ${error.message}`, 'error');
                            resolve();
                        } finally {
                            // Remove the modal
                            setTimeout(() => {
                                document.getElementById('shiftConflictModal').remove();
                            }, 500);
                        }
                    });

                    document.getElementById('cancelApproval').addEventListener('click', () => {
                        // Close and remove the modal
                        document.getElementById('shiftConflictModal').style.display = 'none';
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                        resolve();
                    });

                    // Close button functionality
                    document.querySelector('#shiftConflictModal .close').addEventListener('click', () => {
                        document.getElementById('shiftConflictModal').style.display = 'none';
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                        resolve();
                    });
                });
            } else {
                // No conflicts, proceed with approval
                await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
            }
        } catch (error) {
            console.error('Error checking for shift conflicts:', error);
            // Continue with approval despite the error in conflict checking
            await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
        }
        }
    } catch (error) {
        console.error('Error approving time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Helper function to process the time off approval
async function processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed) {
    const token = getToken();

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

    const result = await response.json();

    if (!response.ok && !result.warning) {
        // If error is not a warning with conflicts
        throw new Error(result.error || 'Failed to approve time off request');
    }

    // Sync the approved time off with attendance records
    try {
        const syncResponse = await fetch(`${window.API_BASE_URL}/attendance/sync-timeoff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                employeeId: requestDetails.employeeId,
                startDate: requestDetails.startDate,
                endDate: requestDetails.endDate
            })
        });

        if (!syncResponse.ok) {
            console.error('Failed to sync time off with attendance records');
        } else {
            console.log('Successfully synced time off with attendance records');
        }
    } catch (err) {
        console.error('Error syncing time off with attendance:', err);
    }

    // Refresh leave balances from backend
    fetchLeaveBalances();

    // Check if the response contains conflict warnings
    if (result.warning) {
        // Create a warning modal for conflicts
        const warningModal = document.createElement('div');
        warningModal.className = 'modal';
        warningModal.id = 'warningModal';

        let conflictHTML = `
            <div class="modal-content warning-modal">
                <span class="close">&times;</span>
                <div class="warning-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>${result.warning.title || 'Warning'}</h2>
                </div>
                <p>${result.warning.message || 'There are conflicts with this time off request.'}</p>
                <div class="time-off-details">
                    <p><strong>Employee:</strong> ${result.message.split('for ')[1]?.split(' has')[0] || 'Employee'}</p>
                    <p><strong>Period:</strong> ${result.timeOffPeriod?.start} to ${result.timeOffPeriod?.end}</p>
                    <p><strong>Type:</strong> ${result.timeOffPeriod?.type || 'Leave'}</p>
                </div>`;

        // Add existing shift conflicts if any
        if (result.conflicts?.existing && result.conflicts.existing.length > 0) {
            conflictHTML += `
                <h3>Existing Shifts During This Period:</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Assignment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

            result.conflicts.existing.forEach(conflict => {
                conflictHTML += `
                    <tr>
                        <td>${conflict.date}</td>
                        <td>${conflict.title}</td>
                        <td><span class="status-badge ${conflict.status.toLowerCase()}">${conflict.status}</span></td>
                    </tr>`;
            });

            conflictHTML += `
                    </tbody>
                </table>`;
        }

        // Add pending shift conflicts if any
        if (result.conflicts?.pending && result.conflicts.pending.length > 0) {
            conflictHTML += `
                <h3>Pending Shifts During This Period:</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Assignment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

            result.conflicts.pending.forEach(conflict => {
                conflictHTML += `
                    <tr>
                        <td>${conflict.date}</td>
                        <td>${conflict.title}</td>
                        <td><span class="status-badge pending">Pending</span></td>
                    </tr>`;
            });

            conflictHTML += `
                    </tbody>
                </table>`;
        }

        // Add recommendations if any
        if (result.recommendations && result.recommendations.length > 0) {
            conflictHTML += `
                <div class="recommendations">
                    <h3>Recommendations:</h3>
                    <ul>`;

            result.recommendations.forEach(recommendation => {
                conflictHTML += `<li>${recommendation}</li>`;
            });

            conflictHTML += `</ul></div>`;
        }

        conflictHTML += `
            <div class="modal-footer">
                <p>The time off has been approved, but you may want to resolve these conflicts.</p>
                <button class="btn-primary" id="closeWarningModal">Acknowledge</button>
            </div>
        </div>`;

        warningModal.innerHTML = conflictHTML;
        document.body.appendChild(warningModal);

        // Setup close functionality
        document.getElementById('closeWarningModal').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
            setTimeout(() => {
                document.getElementById('warningModal').remove();
            }, 500);
        });

        document.querySelector('#warningModal .close').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
            setTimeout(() => {
                document.getElementById('warningModal').remove();
            }, 500);
        });


        // Show the modal
        document.getElementById('warningModal').style.display = 'block';

        // Display success notification
        showNotification(`Time off request approved with warnings.`, 'warning');
    } else {
        // Display regular success message
        showNotification(`Time off request approved successfully.`, 'success');
    }

    // Refresh the pending time off requests
    loadPendingTimeOffRequests();
    // Close the details modal if it was open
    if (document.getElementById('timeOffDetailsModal').style.display === 'block') {
        closeTimeOffDetailsModal();
    }
}

// Function to reject a time off request directly from the list
async function rejectTimeOffRequest(requestId) {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const approvedBy = userInfo.userId;

        // Fetch the time off request details first to get employee name and dates
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

        // Create a more friendly notification message
        const employeeName = requestDetails.employeeName || 'employee';
        const startDate = new Date(requestDetails.startDate).toLocaleDateString();
        const endDate = new Date(requestDetails.endDate).toLocaleDateString();

        showNotification(`Time off request for ${employeeName} (${startDate} to ${endDate}) has been declined.`, 'info');

        // Refresh the relevant list based on which view the user is in
        if (document.querySelector('.approve-timeoff-section').style.display === 'block') {
            loadPendingTimeOffRequests();
        } else {
            loadTimeOffHistory();
        }

        // Close the details modal if it was open
        if (document.getElementById('timeOffDetailsModal').style.display === 'block') {
            closeTimeOffDetailsModal();
        }

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
                // Get user info to check role and clinic
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const userRole = userInfo.role?.toLowerCase() || 'employee';
                const userClinicId = userInfo.clinicId;

                // Fetch all shifts
                const allShifts = await fetchShifts();
                
                // Filter out availability events from all shifts
                const filteredShifts = allShifts.filter(shift => {
                    // Check if event is an availability event based on title
                    if (shift.title && shift.title.toLowerCase().includes('availability')) {
                        console.log('Filtered out availability event:', shift.title);
                        return false;
                    }
                    
                    // Also filter by sourceType if it's an availability event
                    if (shift.sourceType === 'availability') {
                        console.log('Filtered out availability by sourceType:', shift.title);
                        return false;
                    }
                    
                    return true;
                });
                
                console.log(`Filtered from ${allShifts.length} to ${filteredShifts.length} shifts (removed availability)`);

                // For employees, filter shifts by their assigned clinic
                if (userRole === 'employee' && userClinicId) {
                    console.log('Filtering employee calendar by clinic:', userClinicId);
                    const clinicFilteredShifts = filteredShifts.filter(shift => {
                        const shiftClinicId = shift.extendedProps?.clinicId;
                        return shiftClinicId && shiftClinicId.toString() === userClinicId.toString();
                    });
                    successCallback(clinicFilteredShifts);
                } else {
                    // For managers/admins, show all shifts except availability
                    successCallback(filteredShifts);
                }
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
            
            // Double-check no availability events are being displayed
            const eventType = info.event.extendedProps.type;
            const eventTitle = info.event.title || '';
            const eventSourceType = info.event.extendedProps.sourceType || '';
            
            if (eventType === 'availability' || 
                eventSourceType === 'availability' ||
                eventTitle.toLowerCase().includes('availability')) {
                // This is an availability event that shouldn't be shown
                console.log('Hiding availability event that slipped through:', eventTitle);
                // Hide the event
                info.el.style.display = 'none';
                return; // Skip further processing
            }

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
            // First check if it's an availability event - if so, don't display it
            const eventType = eventInfo.event.extendedProps.type;
            const eventTitle = eventInfo.event.title || '';
            const eventSourceType = eventInfo.event.extendedProps.sourceType || '';
            
            if (eventType === 'availability' || 
                eventSourceType === 'availability' ||
                eventTitle.toLowerCase().includes('availability')) {
                // Return empty content for availability events
                return { html: '' };
            }
            
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

            // Format the time display based on shift name (SHIFT TITLE)
            let timeDisplay;
            if (shiftTitle.includes('Day')) {
                timeDisplay = '9:00 AM - 5:00 PM';
            } else if (shiftTitle.includes('Evening')) {
                timeDisplay = '5:00 PM - 1:00 AM';
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
            <td>${item.preferredDates}</td>
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
    // No default items - using real data only
    const defaultItems = [];

    defaultItems.forEach(item => {
        const row = document.createElement('tr');

        // Empty placeholder for compatibility
        let statusClass = '';
        let timeDisplay = '';

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
        const userClinicId = userInfo.clinicId; // Get user's assigned clinic

        console.log('Fetching shifts for user:', userId, 'with role:', userRole, 'clinicId:', userClinicId);

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

                        // Ensure valid start date
                        let startDate;
                        if (shift.shiftDate && shift.startDate) {
                            // Combine date and time parts
                            startDate = combineDateTime(shift.shiftDate, shift.startDate);
                        } else {
                            startDate = new Date();
                        }

                        // Ensure valid end date
                        let endDate;
                        if (shift.shiftDate && shift.endDate) {
                            // Combine date and time parts
                            endDate = combineDateTime(shift.shiftDate, shift.endDate);
                            
                            // Validate that end date is after start date
                            if (endDate <= startDate) {
                                endDate = new Date(startDate);
                                endDate.setHours(endDate.getHours());
                            }
                        } else {
                            console.warn(`Shift ${shift.shiftId} has invalid or missing end date, using default (start + 1 hour)`);
                            endDate = new Date(startDate);
                            endDate.setHours(endDate.getHours() + 1);
                        }

                        return {
                            id: shift.shiftId,
                            title: title,
                            start: startDate,
                            end: endDate,
                            extendedProps: {
                                status: shift.status || 'Pending',
                                type: 'regular',
                                shiftId: shift.shiftId,
                                employeeId: shift.employeeId,
                                employeeName: shift.employeeName,
                                department: shift.department, // Make sure department is included
                                clinicId: shift.clinicId, // Include clinic ID for filtering
                                clinicName: shift.clinicName // Include clinic name for display
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
                let status = shift.status || 'Pending';

                // Ensure valid start date
                let startDate;
                if (shift.shiftDate && shift.startDate) {
                    // Combine date and time parts
                    startDate = combineDateTime(shift.shiftDate, shift.startDate);
                } else {
                    startDate = new Date();
                }
                
                // Check if end date exists and is valid, otherwise default to start + 1 hour
                let endDate;
                if (shift.shiftDate && shift.endDate) {
                    // Combine date and time parts
                    endDate = combineDateTime(shift.shiftDate, shift.endDate);
                    
                    // Validate that end date is after start date
                    if (endDate <= startDate) {
                        endDate = new Date(startDate);
                        endDate.setHours(endDate.getHours() + 1);
                    }
                } else {
                    console.warn(`Shift ${shift.shiftId} has invalid end date, using default (start + 1 hour)`);
                    endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + 1);
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
                        department: shift.department, // Include department info
                        clinicId: shift.clinicId, // Include clinic ID for filtering
                        clinicName: shift.clinicName // Include clinic name for display
                    }
                };
            });
        }

        // For employees, filter shifts by their assigned clinic
        if (userRole === 'employee' && userClinicId) {
            console.log('Filtering shifts for employee by clinic:', userClinicId);
            shifts = shifts.filter(shift => {
                const shiftClinicId = shift.extendedProps?.clinicId;
                return shiftClinicId && shiftClinicId.toString() === userClinicId.toString();
            });
        }

        // Get pending shifts if the user is a manager or admin
        let pendingShifts = [];
        if (userRole === 'manager' || userRole === 'admin') {
            pendingShifts = await fetchPendingShifts();
        }

        // Fetch time off requests
        let timeOffEvents = await fetchTimeOffForCalendar();

        // Fetch availability data for the calendar if the feature is enabled
        let availabilityEvents = [];
        
        // Try to get availability data from the API
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const userId = userInfo.userId;
            
            // Only fetch availability for the current user
            const availabilityResponse = await fetch(`${window.API_BASE_URL}/availability/employee/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            if (availabilityResponse.ok) {
                const data = await availabilityResponse.json();
                const availabilityArray = Array.isArray(data) ? data : (data.availability || []);
                
                // Convert each availability to a calendar event
                // But we'll set a flag to NOT include them since we want to remove them
                console.log('Availability data found, but will be excluded from calendar view');
                availabilityEvents = []; // Return an empty array instead of mapping them
                
                console.log(`Loaded ${availabilityEvents.length} availability events for calendar`);
            }
        } catch (error) {
            console.error('Error fetching availability data for calendar:', error);
        }

        // Combine all events but mark them with their source type
        const allEvents = [
            ...shifts.map(s => ({ ...s, sourceType: 'shift' })), 
            ...pendingShifts.map(p => ({ ...p, sourceType: 'pending' })),
            ...timeOffEvents.map(t => ({ ...t, sourceType: 'timeoff' })),
            ...availabilityEvents
        ];
        
        // Return all events for the calendar (filtering will be done when displaying in upcoming shifts)
        return allEvents;
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
                sourceType: 'timeoff', // Mark explicitly as time off for filtering
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

    switch (status.toLowerCase()) {
        case 'confirmed':
            return '#4CAF50'; // Green
        case 'cancelled':
            return '#F44336'; // Red
        case 'completed':
            return '#607D8B'; // Gray/Blue
        case 'approved':
            return '#4CAF50'; // Green
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
    
    // Skip time off and availability entries
    if (title && (
        title.toLowerCase().includes('time off') || 
        title.toLowerCase().includes('availability') ||
        title.toLowerCase().includes('leave')
    )) {
        console.log('Skipping time off or availability in addShiftToUpcomingSection:', title);
        return;
    }

    try {
        console.log('Adding shift to upcoming section:', {
            title,
            start: start,
            end: end,
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

        // Format time based on shift title (Used for the shift card)
        let timeDisplay;
        if (typeof title === 'string') {
            if (title.includes('Day')) {
                timeDisplay = '9:00 AM - 5:00 PM';
            } else if (title.includes('Night')) {
                timeDisplay = '5:00 PM - 1:00 AM';
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

        // Create shift card
        const shiftCard = document.createElement('div');
        shiftCard.className = 'shift-card';

        // Normalize status for CSS class naming
        const normalizedStatus = status ? status.toLowerCase().replace(/\s+/g, '-') : 'pending';

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

        // Fetch all users and find the one we want to delete
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

        // Call the delete API endpoint
        const deleteResponse = await fetch(`${window.API_BASE_URL}/user/deleteUser/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            throw new Error(errorData.error || 'Failed to delete employee');
        }

        // Show success message
        showNotification('Employee deleted successfully', 'success');

        // Reload the employees list
        loadEmployees();

    } catch (error) {
        console.error('Error deleting employee:', error);
        showNotification(`Error deleting employee: ${error.message}`, 'error');
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
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch users');
        }

        const allUsers = await userResponse.json();
        const employee = allUsers.find(user => user.userId === userId);

        if (!employee) {
            throw new Error(`Employee with ID ${userId} not found`);
        }

        console.log('Editing employee:', employee);

        // Get current user info for permissions checking
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const currentUserRole = (userInfo.role || '').toLowerCase();

        let roleOptions;
        // Generate role options based on current user's role
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

        // Pre-fetch departments to include directly in the modal
        const deptsResponse = await fetch(`${window.API_BASE_URL}/department/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        let departmentOptions = '<option value="">Select Department</option>';

        if (deptsResponse.ok) {
            const departments = await deptsResponse.json();
            console.log('Fetched departments:', departments);

            departmentOptions = departments.map(dept =>
                `<option value="${dept.departmentName}" ${employee.department === dept.departmentName ? 'selected' : ''}>${dept.departmentName}</option>`
            ).join('');

            departmentOptions = '<option value="">Select Department</option>' + departmentOptions;
        } else {
            console.error('Failed to fetch departments');
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
                        <select id="edit-department" name="department">
                            ${departmentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-postalCode">Postal Code</label>
                        <input type="text" id="edit-postalCode" name="postalCode" value="${employee.postalCode || ''}" required>
                        <small>Clinic will be auto-assigned based on postal code</small>
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
                    <div class="form-group">
                        <label for="edit-baseSalary">Base Salary</label>
                        <input type="number" id="edit-baseSalary" name="baseSalary" step="0.01" min="0" value="${employee.baseSalary || ''}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="save-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editModal);

        // No need to populate department dropdown again since we've included it directly in the HTML
        console.log('Department dropdown populated directly with HTML options');

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

            // Check if postal code is present
            if (!formValues.postalCode) {
                alert('Postal code is required for clinic auto-assignment');
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
                postalCode: formValues.postalCode,
                birthday: formValues.birthday,
                gender: genderValue || formValues.gender, // Use manually extracted gender value as fallback
                baseSalary: formValues.baseSalary || null
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
                alert('Employee updated successfully. Clinic auto-assigned based on postal code.');
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
        console.error('Error in editEmployee function:', error);
        alert(`Error: ${error.message}`);
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
        window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';

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
        console.log('Shifts loaded for current user:', shifts);

        // Populate the shift select dropdown
        const myShiftSelect = document.getElementById('my-shift');
        myShiftSelect.innerHTML = '<option value="">Select your shift</option>';

        // Filter out availability and time off entries
        const filteredShifts = shifts.filter(shift => {
            // Check if this is a shift (not availability or time off)
            const title = (shift.title || '').toLowerCase();
            const department = (shift.department || '').toLowerCase();
            
            // Skip if it's availability or time off
            if (title.includes('availability') || 
                title.includes('time off') || 
                title.includes('leave') ||
                department.includes('availability') ||
                department.includes('time off')) {
                console.log('Filtered out non-shift entry:', shift.title || shift.department);
                return false;
            }
            
            // Also filter out shifts that are already approved for swap
            if (shift.status && shift.status.toLowerCase() === 'swap approved') {
                console.log('Filtered out already swapped shift:', shift.title);
                return false;
            }
            
            return true;
        });
        
        console.log(`Filtered from ${shifts.length} to ${filteredShifts.length} shifts`);

        filteredShifts.forEach(shift => {
            // Handle MySQL DATE and TIME types correctly
            let shiftDate;
            
            // Use the shiftDate field (DATE type from DB) if available
            if (shift.shiftDate) {
                // Create a properly formatted date string or use Date object directly
                shiftDate = shift.shiftDate;
            } else if (shift.startDate) {
                // Fallback to startDate if shiftDate isn't available
                shiftDate = shift.startDate;
            } else {
                // Last resort default
                shiftDate = new Date();
            }
            
            const option = document.createElement('option');
            option.value = shift.shiftId;
            
            // Get shift title or department
            const shiftName = shift.title || shift.department || 'Shift';
            
            // Create a display string with formatted date and shift name
            option.textContent = `${formatDateForDisplay(shiftDate)} - ${shiftName}`;
            
            // Add time info if available
            if (shift.startDate && typeof shift.startDate === 'string' && shift.startDate.includes(':')) {
                const timeInfo = ` (${shift.startDate.substring(0, 5)})`;
                option.textContent += timeInfo;
            }
            
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
        window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';

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
        window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';

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

        console.log(`Loaded ${shiftData.length} shifts for employee ${employeeId}:`, shiftData);

        if (shiftData.length === 0) {
            targetShiftSelect.innerHTML = '<option value="">No shifts available</option>';
            targetShiftSelect.disabled = true;
            return;
        }
        
        // Filter out availability and time off entries
        const filteredShifts = shiftData.filter(shift => {
            // Check if this is a shift (not availability or time off)
            const title = (shift.title || '').toLowerCase();
            const department = (shift.department || '').toLowerCase();
            
            // Skip if it's availability or time off
            if (title.includes('availability') || 
                title.includes('time off') || 
                title.includes('leave') ||
                department.includes('availability') ||
                department.includes('time off')) {
                console.log('Filtered out non-shift entry:', shift.title || shift.department);
                return false;
            }
            
            // Also filter out shifts that are already approved for swap
            if (shift.status && shift.status.toLowerCase() === 'swap approved') {
                console.log('Filtered out already swapped shift:', shift.title);
                return false;
            }
            
            return true;
        });
        
        console.log(`Filtered from ${shiftData.length} to ${filteredShifts.length} shifts`);
        
        if (filteredShifts.length === 0) {
            targetShiftSelect.innerHTML = '<option value="">No eligible shifts available</option>';
            targetShiftSelect.disabled = true;
            return;
        }

        filteredShifts.forEach(shift => {
            // Handle MySQL DATE and TIME types correctly
            let shiftDate;
            
            // Use the shiftDate field (DATE type from DB) if available
            if (shift.shiftDate) {
                shiftDate = shift.shiftDate;
            } else if (shift.startDate) {
                // Fallback to startDate if shiftDate isn't available
                shiftDate = shift.startDate;
            } else {
                // Last resort default
                shiftDate = new Date();
            }
            
            const option = document.createElement('option');
            option.value = shift.shiftId;
            
            // Get shift title or department
            const shiftName = shift.title || shift.department || 'Shift';
            
            // Format date for display
            const formattedDate = formatDateForDisplay(shiftDate);
            
            // Create a display string with formatted date and shift name
            option.textContent = `${formattedDate} - ${shiftName}`;
            
            // Add time info if available
            if (shift.startDate && typeof shift.startDate === 'string' && shift.startDate.includes(':')) {
                const timeInfo = ` (${shift.startDate.substring(0, 5)})`;
                option.textContent += timeInfo;
            }
            
            targetShiftSelect.appendChild(option);
        });

        // Enable the select element now that it's populated
        targetShiftSelect.disabled = false;
    } catch (error) {
        console.error('Error loading target employee shifts:', error);

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

// Helper function to check if current user is a manager
function isManager() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const role = userInfo.role ? userInfo.role.toLowerCase() : '';
    return role === 'manager'; // Only manager is considered manager, not admin
}

async function loadSwapRequests() {
    try {
        window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/';

        // Get the token and user info
        const token = getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userId = userInfo.userId;

        if (!userId) {
            throw new Error('User ID not found');
        }

        console.log('Fetching swap requests from /shift/swaps endpoint');
        const response = await fetch(`${window.API_BASE_URL}/shift/swaps`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Swap endpoint error (${response.status}):`, errorText);
            throw new Error(`Server error: ${response.status} - ${errorText || response.statusText}`);
            }

        const swapData = await response.json();
        console.log('Swap data received:', swapData);

        // If no swaps found
        if (!swapData || swapData.length === 0) {
            console.log('No swap requests available');
            renderMySwapRequests([]);
            renderIncomingSwapRequests([]);
            return;
        }

        // Helper function to extract date information safely
        const extractShiftData = (shift, shiftStartDate, shiftEndDate, employeeId, shiftDate, department, swapStatus) => {
            // Handle case where we get full objects vs. just IDs
            const shiftData = typeof shift === 'object' ? shift : { shiftId: shift };
            
            // Log received data for debugging
            console.log('Received shift data:', shiftData, 'Start date:', shiftStartDate, 'End date:', shiftEndDate, 'shiftDate:', shiftDate);
            
            // Process the shiftDate from the database (DATE type)
            // IMPORTANT: We'll use exactly what's in the data without defaulting to today's date
            let formattedShiftDate;
            if(shiftDate) {
                formattedShiftDate = shiftDate.split('T')[0];
            }
            else if (shiftData.shiftDate) {
                // If we have a shiftDate from the full object
                formattedShiftDate = shiftData.shiftDate;
            } else if (shiftData.date) {
                // Try to use the date field if available
                formattedShiftDate = shiftData.date;
            } else if (shiftStartDate && shiftStartDate.includes('-') && shiftStartDate.length > 8) {
                // Try to extract date from start date if it's a full datetime
                formattedShiftDate = shiftStartDate.split('T')[0].split(' ')[0];
            } else {
                // If no valid date is available, use a fixed date for now (as a temporary workaround)
                // This is a TEMPORARY FIX until the backend is updated to provide proper dates
                formattedShiftDate = '2024-06-15'; // Using a fixed future date instead of "No date available"
            }
            
            // Process startDate and endDate (TIME types from MySQL)
            // Using the parameters directly for more accurate data
            const startTimeStr = shiftData.startTime || shiftData.start_time || shiftStartDate || '09:00:00';
            const endTimeStr = shiftData.endTime || shiftData.end_time || shiftEndDate || '17:00:00';
            
            // Create the resulting object with properly formatted dates
            const result = {
                id: shiftData.shiftId || shift,
                date: formattedShiftDate,
                shiftDate: formattedShiftDate,
                start_time: startTimeStr,
                end_time: endTimeStr,
                startDate: startTimeStr,
                endDate: endTimeStr,
                status: swapStatus || shiftData.status || 'Pending',
                employeeId: employeeId || shiftData.employeeId,
                title: shiftData.title || 'Shift',
                department: department || shiftData.department || 'Unknown'
            };
            
            // Log the processed data
            console.log('Processed shift data:', result);
            
            return result;
        };

        // Process the data to match the required format for the UI
        const processedData = swapData.map(swap => {
            // Format and validate the submission date
            let formattedSubmitDate;
            try {
                formattedSubmitDate = swap.submittedAt;
                // If it's not a Date object or valid date string, convert to current date
                if (formattedSubmitDate && typeof formattedSubmitDate === 'object' && formattedSubmitDate.toString().includes('T')) {
                    // For date objects that might cause issues
                    formattedSubmitDate = formattedSubmitDate.toString();
                }
            } catch (error) {
                console.warn('Error processing submission date:', error);
                formattedSubmitDate = new Date().toISOString();
            }
            // Extract date from the first available property in the expected order
            return {
                id: swap.swapId,
                created_at: formattedSubmitDate,
                status: swap.status || 'Pending',
                original_shift: extractShiftData(
                    swap.currentShift,
                    swap.currentShift_startDate, 
                    swap.currentShift_endDate,
                    swap.currentShift_employeeId,
                    swap.shiftDate,
                    swap.requesterDepartment,
                    swap.status
                ),
                target_shift: extractShiftData(
                    swap.swapWith,
                    swap.swapWith_startDate,
                    swap.swapWith_endDate,
                    swap.swapWith_employeeId,
                    swap.targetShiftDate,
                    swap.targetDepartment,
                    swap.status
                ),
                requester_name: swap.requesterName || 'Unknown Employee',
                requester_id: swap.currentShift_employeeId,
                target_employee_name: swap.targetEmployeeName || 'Unknown Employee',
                target_id: swap.swapWith_employeeId
            };
        });

        console.log('Processed data:', processedData);

        // Filter data for different views
        const myRequests = processedData.filter(req => req.requester_id === userId);
        const incomingRequests = processedData.filter(req => req.target_id === userId);

        console.log('Filtered data:', {
            myRequests,
            incomingRequests
        });

        // Render the requests
        renderMySwapRequests(myRequests);
        renderIncomingSwapRequests(incomingRequests);
    } catch (error) {
        console.error('Error loading swap data:', error);
        showNotification('Failed to load swap data: ' + error.message, 'error');

        // Initialize empty arrays for the tables
        renderMySwapRequests([]);
        renderIncomingSwapRequests([]);
    }
}

function renderMySwapRequests(requests) {
    const tbody = document.getElementById('mySwapRequestsBody');
    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">No swap requests found</td></tr>';
        return;
    }

    console.log('Rendering my swap requests:', requests);

    requests.forEach(request => {
        try {
        const tr = document.createElement('tr');
            const status = request.status || 'Pending';
            
            // Format the created_at date using our helper function
            let formattedCreatedAt;
            try {
                formattedCreatedAt = formatSwapRequestDate(request.created_at);
            } catch (dateError) {
                console.warn('Error formatting created_at date:', dateError);
                formattedCreatedAt = 'Unknown date';
            }

            // Log the shift data for debugging
            console.log('My request - Original shift:', request.original_shift);
            console.log('My request - Target shift:', request.target_shift);

        tr.innerHTML = `
                <td>${formattedCreatedAt}</td>
            <td>${formatShiftInfo(request.original_shift)}</td>
            <td>${formatShiftInfo(request.target_shift)}</td>
            <td>${request.target_employee_name || 'Unknown'}</td>
            <td><span class="swap-status ${status.toLowerCase()}">${status}</span></td>
            <td>
                <div class="swap-actions">
                        ${status === 'Pending' ? 
                            `<button class="cancel-btn" onclick="cancelSwapRequest(${request.id || 0})">
                            <i class="fas fa-times"></i> Cancel
                        </button>` : 
                        ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        } catch (error) {
            console.error('Error rendering my swap request:', error, request);
        }
    });
}

function renderIncomingSwapRequests(requests) {
    const tbody = document.getElementById('incomingSwapRequestsBody');
    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">No incoming swap requests found</td></tr>';
        return;
    }

    console.log('Rendering incoming swap requests:', requests);

    requests.forEach(request => {
        try {
        const tr = document.createElement('tr');
            const status = request.status || 'Pending';
            
            // Format the created_at date using our helper function
            let formattedCreatedAt;
            try {
                formattedCreatedAt = formatSwapRequestDate(request.created_at);
            } catch (dateError) {
                console.warn('Error formatting created_at date:', dateError);
                formattedCreatedAt = 'Unknown date';
            }

            // Log the shift data for debugging
            console.log('Incoming request - Original shift:', request.original_shift);
            console.log('Incoming request - Target shift:', request.target_shift);

        tr.innerHTML = `
                <td>${formattedCreatedAt}</td>
            <td>${request.requester_name || 'Unknown'}</td>
            <td>${formatShiftInfo(request.original_shift)}</td>
            <td>${formatShiftInfo(request.target_shift)}</td>
            <td><span class="swap-status ${status.toLowerCase()}">${status}</span></td>
            <td>
                <div class="swap-actions">
                        ${status === 'Pending' ? `
                            <button class="approve-btn" onclick="respondToSwapRequest(${request.id || 0}, 'approve')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                            <button class="reject-btn" onclick="respondToSwapRequest(${request.id || 0}, 'reject')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        } catch (error) {
            console.error('Error rendering incoming swap request:', error, request);
        }
    });
}

// Function removed as all swap requests tab is no longer needed

// Helper function to ensure consistent date formatting for swap requests
function formatSwapRequestDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    
    // If it's already showing 'No date available', just return it
    if (dateStr === 'No date available') return dateStr;
    
    try {
        // If the string contains 'Invalid date' or similar, return that message
        if (typeof dateStr === 'string' && 
            (dateStr.includes('Unknown') || dateStr.includes('Invalid') || dateStr.includes('No date'))) {
            return dateStr;
        }
        
        // Handle different date formats that might come from the server
        let date;
        if (typeof dateStr === 'string') {
            // Handle MySQL date format (YYYY-MM-DD)
            if (dateStr.includes('-') && dateStr.length === 10) {
                date = new Date(dateStr);
            } 
            // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
            else if (dateStr.includes('-') && dateStr.includes(':')) {
                date = new Date(dateStr);
            }
            // Handle time-only format (HH:MM:SS)
            else if (dateStr.includes(':') && !dateStr.includes('-')) {
                // For time-only strings, DON'T use current date, just display the time
                console.log('Time-only string encountered, not adding a date:', dateStr);
                return `Time: ${dateStr}`;
            } else {
                // Try to parse the string as a date, but be cautious
                try {
                    date = new Date(dateStr);
                } catch (err) {
                    console.warn('Failed to parse date string:', dateStr);
                    return `Unparsable date: ${dateStr}`;
                }
            }
        } else {
            // If it's already a Date object
            date = new Date(dateStr);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date encountered:', dateStr);
            return `Invalid date format: ${dateStr}`;
        }
        
        // Format the date
        return formatDateForDisplay(date);
        } catch (error) {
        console.error('Error formatting date:', error, dateStr);
        return `Error parsing date: ${String(dateStr)}`;
        }
}

function formatShiftInfo(shift) {
    if (!shift) {
        return 'Shift information unavailable';
    }

    console.log('Formatting shift info for:', shift);

    // Find the date from various possible property names
    let shiftDate = shift.date || shift.shiftDate || shift.start_date || shift.startDate;

    if (!shiftDate) {
        console.error('Missing date property in shift object:', shift);
        return 'Shift date unavailable';
    }

    // Try to format the date
    try {
        // Check for error messages, but also handle our temporary fixed date
        if (typeof shiftDate === 'string' && 
            (shiftDate === 'No date available' || 
             shiftDate.includes('Invalid') || 
             shiftDate.includes('Unknown'))) {
            console.warn('Original date message handled:', shiftDate);
            // Use formatDateForDisplay to handle the date (will work with our fixed date or error message)
            var formattedDate = formatDateForDisplay(shiftDate);
        } 
        // Handle potentially malformed date strings
        else if (typeof shiftDate === 'string' && !shiftDate.includes('T') && !shiftDate.includes('-')) {
            console.warn('Unusual date format detected:', shiftDate);
            // Don't use current date, just show the actual string
            formattedDate = `Date format error: ${shiftDate}`;
        }
        // Normal case - format the date for display
        else {
            formattedDate = formatDateForDisplay(shiftDate);
        }
        
        console.log('Formatted date:', formattedDate, 'from source:', shiftDate);

        // Get department/title info from shift
        const department = shift.department || shift.title || '';

        // Determine shift time display
        let timeDisplay = '';

        // Check for standard shift types using case-insensitive check
        const shiftTitle = (department || '').toLowerCase();
        if (shiftTitle.includes('morning')) {
            timeDisplay = '6:00 AM - 2:00 PM';
        } else if (shiftTitle.includes('afternoon')) {
            timeDisplay = '2:00 PM - 10:00 PM';
        } else if (shiftTitle.includes('night')) {
            timeDisplay = '10:00 PM - 6:00 AM';
        } else {
            // Handle MySQL TIME format (HH:MM:SS) for start and end times
            // Get time values from the shift object, trying multiple possible property names
            const startTime = shift.startTime || shift.start_time || shift.startDate || shift.start;
            const endTime = shift.endTime || shift.end_time || shift.endDate || shift.end;

            console.log('Time values found:', {startTime, endTime});

            // Format time strings
            let startTimeFormatted, endTimeFormatted;

            // Handle time-only strings like "09:00:00" from MySQL TIME columns
            if (startTime && typeof startTime === 'string' && startTime.includes(':')) {
                startTimeFormatted = formatTime(startTime);
            } else {
                startTimeFormatted = formatTime(startTime);
            }

            if (endTime && typeof endTime === 'string' && endTime.includes(':')) {
                endTimeFormatted = formatTime(endTime);
                } else {
                endTimeFormatted = formatTime(endTime);
            }

            timeDisplay = `${startTimeFormatted} - ${endTimeFormatted}`;
        }

        // Get status if available
        const status = shift.status || 'Pending';

        // Create and return HTML for the shift display
        // Check if we're dealing with an error message
        const isDateError = formattedDate.includes('No date') || 
                           formattedDate.includes('error') || 
                           formattedDate.includes('Invalid');
        
        // Create an appropriate HTML representation based on whether we have valid date data
        const shiftHtml = isDateError ? 
            `<div class="shift-date shift-date-error">${formattedDate}</div>
             <div class="shift-time">${timeDisplay}</div>
             <div class="shift-details">
                 <span class="shift-department">${department || 'Unassigned'}</span>
                 <span class="shift-status">${status}</span>
             </div>` 
            : 
            `<div class="shift-date">${formattedDate}</div>
            <div class="shift-time">${timeDisplay}</div>
            <div class="shift-details">
                <span class="shift-department">${department || 'Unassigned'}</span>
                <span class="shift-status">${status}</span>
            </div>
        `;
        
        return shiftHtml;
    } catch (error) {
        console.error('Error formatting shift info:', error, shift);
        return `Shift on ${String(shiftDate)}`;
    }
}

async function cancelSwapRequest(requestId) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/shift/update-swap/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                swapId: requestId,
                status: 'Declined'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to cancel swap request');
        }

        showNotification('Swap request cancelled successfully', 'success');
        loadSwapRequests(); // Refresh the lists
    } catch (error) {
        console.error('Error cancelling swap request:', error);
        showNotification('Failed to cancel swap request', 'error');
    }
}

async function respondToSwapRequest(requestId, action) {
    try {
        const status = action === 'approve' ? 'Approved' : 'Declined';

        // First, get the swap request details to save the shift IDs
        let originalSwap;
        try {
            // Get the swap details before updating it
            const detailsResponse = await fetch(`${window.API_BASE_URL}/shift/swap/${requestId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (detailsResponse.ok) {
                originalSwap = await detailsResponse.json();
                console.log('Retrieved swap request details:', originalSwap);
            }
        } catch (detailsError) {
            console.warn('Could not retrieve swap details:', detailsError);
            // Continue anyway - this is a nice-to-have
        }

        // Now update the swap status
        const response = await fetch(`${window.API_BASE_URL}/shift/update-swap/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                swapId: requestId,
                status: status
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to ${action} swap request`);
        }

        // If approved, update the shift statuses to reflect the swap
        if (action === 'approve' && originalSwap) {
            try {
                // Update both shifts to indicate they've been swapped
                if (originalSwap.currentShift) {
                    await fetch(`${window.API_BASE_URL}/shift/update/${originalSwap.currentShift}`, {
                        method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                            status: 'Swap Approved'
            })
        });
                }
                
                if (originalSwap.swapWith) {
                    await fetch(`${window.API_BASE_URL}/shift/update/${originalSwap.swapWith}`, {
                        method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                            status: 'Swap Approved'
            })
        });
                }
                
                console.log('Updated shift statuses to Swap Approved');
            } catch (shiftUpdateError) {
                console.warn('Error updating shift statuses:', shiftUpdateError);
                // Continue anyway - the swap was still approved
            }
        }

        showNotification(`Swap request ${action}ed successfully`, 'success');
        
        // Refresh the lists and reload shifts to update UI
        loadSwapRequests();
        
        // Also refresh the user's shifts if we're in the swap request modal
        if (document.getElementById('swapRequestModal').style.display === 'block') {
            loadMyShifts();
        }
    } catch (error) {
        console.error(`Error ${action}ing swap request:`, error);
        showNotification(`Failed to ${action} swap request`, 'error');
    }
}

// Manager functions removed as we're focusing on employee-level approval

// Add event listener to load swap requests when the replacement tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.schedule-tabs .tab[data-tab="replacement"]').forEach(tab => {
        tab.addEventListener('click', function() {
            loadSwapRequests();
        });
    });

    // If the URL has a hash for replacement tab, load the data
    if (window.location.hash === '#replacement') {
        loadSwapRequests();
    }

    // Add filter change handlers
    document.getElementById('swap-status-filter')?.addEventListener('change', loadSwapRequests);
    document.getElementById('swap-date-filter')?.addEventListener('change', loadSwapRequests);
});

// Helper function to format date for display
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to fetch pending shifts
async function fetchPendingShifts() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/shift/pending`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch pending shifts');
        }

        const pendingShifts = await response.json();
        console.log('Pending shifts loaded:', pendingShifts.length);

        // Format for calendar
        return pendingShifts.map(shift => {
            // Create a title that includes employee name and department
            let title = shift.department || 'Unassigned Department';
            if (shift.employeeName) {
                title = `${shift.employeeName} - ${title}`;
            }

            // Create a formatted shift object
            return {
                id: `pending-${shift.pendingShiftId}`,
                title: title,
                start: new Date(shift.startDate),
                end: new Date(shift.endDate),
                extendedProps: {
                    status: shift.status || 'Pending',
                    type: 'pending',
                    shiftId: shift.pendingShiftId,
                    employeeId: shift.employeeId,
                    employeeName: shift.employeeName,
                    department: shift.department
                }
            };
        });
    } catch (error) {
        console.error('Error fetching pending shifts:', error);
        showNotification('Error loading pending shifts', 'error');
        return [];
    }
}

// Set up sidebar navigation
document.addEventListener('DOMContentLoaded', function() {
    // Set up sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    const mainContentSections = {
        'Dashboard': document.querySelector('.main-content > :not(.employee-section):not(.time-off-section):not(.schedule-section):not(.report-section):not(.attendance-section):not(.payroll-section):not(.generate-shifts-section):not(.availability-section)'),
        'Employee Management': document.querySelector('.employee-section'),
        'Schedule': document.querySelector('.schedule-section'),
        'Time Off': document.querySelector('.time-off-section'),
        'Reports': document.querySelector('.report-section'),
        'Attendance Rate': document.querySelector('.attendance-section'),
        'Payroll': document.querySelector('.payroll-section'),
        'Generate Shifts': document.querySelector('.generate-shifts-section'),
        'Availability': document.querySelector('.availability-section')
    };

    // Setup click handlers for all nav items
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Get the section name from the clicked item
            const sectionName = this.textContent.trim();

            // Hide all sections first
            Object.values(mainContentSections).forEach(section => {
                if (section) section.style.display = 'none';
            });

            // Show the selected section
            if (mainContentSections[sectionName]) {
                mainContentSections[sectionName].style.display = 'block';

                // Initialize specific section if needed
                if (sectionName === 'Generate Shifts') {
                    setupGenerateShiftsSection();
                }
            }

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Function to setup generate shifts section
function setupGenerateShiftsSection() {
    // Set minimum date as today for both inputs and set default values
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14); // Default to two weeks range

    const todayFormatted = today.toISOString().split('T')[0];
    const twoWeeksFormatted = twoWeeksLater.toISOString().split('T')[0];

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (startDateInput && endDateInput) {
        // Set minimums
        startDateInput.min = todayFormatted;
        endDateInput.min = todayFormatted;

        // Set default values if not already set
        if (!startDateInput.value) {
            startDateInput.value = todayFormatted;
        }
        if (!endDateInput.value) {
            endDateInput.value = twoWeeksFormatted;
        }

        // Make sure end date is always at least equal to start date
        const updateEndDateMin = () => {
            endDateInput.min = startDateInput.value;
            if (endDateInput.value < startDateInput.value) {
                endDateInput.value = startDateInput.value;
            }
        };

        // Set initial values
        updateEndDateMin();

        // Update end date min when start date changes
        startDateInput.addEventListener('change', updateEndDateMin);
    }
}

// Function to populate employee filter
async function populateEmployeeFilter() {
    const userRole = JSON.parse(localStorage.getItem('userInfo') || '{}').role?.toLowerCase();

    // Only for managers and admins
    if (userRole !== 'manager' && userRole !== 'admin') return;

    try {
        // Fetch all employees - use the correct endpoint
        const response = await fetch(`${window.API_BASE_URL}/user/getUsers`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch employees');
        }

        const employees = await response.json();
        console.log('Employees loaded for filter:', employees.length);

        // Get the select element
        const employeeFilter = document.getElementById('employee-filter');
        if (!employeeFilter) return;

        // Clear existing options except the first one (All Employees)
        while (employeeFilter.options.length > 1) {
            employeeFilter.remove(1);
        }

        // Add employee options
        employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.userId;
            option.textContent = employee.name;
            employeeFilter.appendChild(option);
        });

        // Set up event listener
        employeeFilter.addEventListener('change', filterCalendarEvents);

        // Also populate department filter
        populateDepartmentFilter(employees);

        // Also populate clinic filter
        populateClinicFilter();
    } catch (error) {
        console.error('Error populating employee filter:', error);
    }
}

// Function to populate department filter
function populateDepartmentFilter(employees) {
    // Get unique departments
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
    console.log('Departments loaded for filter:', departments);

    // Get the select element
    const departmentFilter = document.getElementById('department-filter');
    if (!departmentFilter) return;

    // Clear existing options except the first one (All Departments)
    while (departmentFilter.options.length > 1) {
        departmentFilter.remove(1);
    }

    // Add department options
    departments.forEach(department => {
        const option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        departmentFilter.appendChild(option);
    });

    // Set up event listener
    departmentFilter.addEventListener('change', filterCalendarEvents);
}

// Function to filter calendar events
function filterCalendarEvents() {
    const employeeFilter = document.getElementById('employee-filter');
    const departmentFilter = document.getElementById('department-filter');
    const clinicFilter = document.getElementById('clinic-filter');

    // Get user info to check role and clinic
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = userInfo.role?.toLowerCase() || 'employee';
    const userClinicId = userInfo.clinicId;

    // For employees, we'll automatically filter by their assigned clinic
    const isEmployee = userRole === 'employee';

    if (!window.calendar) return;

    // For non-employees, check if filters exist
    if (!isEmployee && (!employeeFilter || !departmentFilter || !clinicFilter)) return;

    // Get selected values from filters (for managers/admins)
    const selectedEmployee = isEmployee ? 'all' : employeeFilter.value;
    const selectedDepartment = isEmployee ? 'all' : departmentFilter.value;
    const selectedClinic = isEmployee ? (userClinicId || 'all') : clinicFilter.value;

    console.log(`Filtering events: Employee=${selectedEmployee}, Department=${selectedDepartment}, Clinic=${selectedClinic}`);

    // If no selection for managers/admins, show all events
    if (!isEmployee && selectedEmployee === 'all' && selectedDepartment === 'all' && selectedClinic === 'all') {
        window.calendar.refetchEvents();
        return;
    }

    // Apply filters to calendar events
    const events = window.calendar.getEvents();

    events.forEach(event => {
        const eventProps = event.extendedProps || {};
        let showEvent = true;
        
        // Always filter out availability events
        const eventType = eventProps.type;
        const eventTitle = event.title || '';
        const eventSourceType = eventProps.sourceType || '';
        
        if (eventType === 'availability' || 
            eventSourceType === 'availability' ||
            eventTitle.toLowerCase().includes('availability')) {
            showEvent = false;
        }

        // Filter by employee if selected
        if (showEvent && selectedEmployee !== 'all') {
            const employeeId = eventProps.employeeId;
            if (!employeeId || employeeId.toString() !== selectedEmployee) {
                showEvent = false;
            }
        }

        // Filter by department if selected
        if (showEvent && selectedDepartment !== 'all') {
            const department = eventProps.department;
            if (!department || department !== selectedDepartment) {
                showEvent = false;
            }
        }

        // Filter by clinic if selected (always applied for employees)
        if (showEvent && selectedClinic !== 'all') {
            const clinicId = eventProps.clinicId;
            if (!clinicId || clinicId.toString() !== selectedClinic) {
                showEvent = false;
            }
        }

        // Apply filter visually
        event.setProp('display', showEvent ? 'auto' : 'none');
    });

    // Refresh the calendar to apply changes
    window.calendar.render();
}

// Function to check user role and set up permissions
// Admin: Only has access to employee, department, and clinic management
// Manager: Has access to all manager features EXCEPT employee, department, and clinic management
async function checkUserRole() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userRole = (userInfo.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isManager = userRole === 'manager';

        // Reset all classes first
        document.body.classList.remove('admin-visible');
        document.body.classList.remove('manager-visible');

        // For admin, only allow employee, department, and clinic management
        if (isAdmin) {
            document.body.classList.add('admin-visible');
            
            // First, hide all nav items that are not admin-specific
            document.querySelectorAll('.nav-item:not(#employee-management):not(#department-management-nav):not(#clinic-management-nav)').forEach(item => {
                item.style.display = 'none';
            });
            
            // Admin should only see employee, department, and clinic management
            const employeeManagementItem = document.getElementById('employee-management');
            if (employeeManagementItem) {
                employeeManagementItem.style.display = 'flex';
            }

            // Show department management for admin
            const departmentManagementNav = document.getElementById('department-management-nav');
            if (departmentManagementNav) {
                departmentManagementNav.style.display = 'flex';
            }
            
            // Show clinic management for admin
            const clinicManagementNav = document.getElementById('clinic-management-nav');
            if (clinicManagementNav) {
                clinicManagementNav.style.display = 'flex';
            }
            
            // Hide other manager-only items for admin
            document.querySelectorAll('.manager-only').forEach(item => {
                item.style.display = 'none';
            });
            
            // Hide dashboard nav item for admin
            const dashboardNav = document.querySelector('.nav-item[class*="active"]');
            if (dashboardNav) {
                dashboardNav.style.display = 'none';
            }
            
            // Hide dashboard section and show employee management section by default for admin users
            document.querySelectorAll('.main-content > div[class$="-section"]').forEach(section => {
                section.style.display = 'none';
            });
            const employeeSection = document.querySelector('.employee-section');
            if (employeeSection) {
                employeeSection.style.display = 'block';
                // Load employee data when showing the section
                if (typeof loadEmployees === 'function') {
                    loadEmployees();
                }
            }
        } 
        // For manager, remove access to employee, department, and clinic management
        else if (isManager) {
            document.body.classList.add('manager-visible');
            
            // Hide employee management for managers
            const employeeManagementItem = document.getElementById('employee-management');
            if (employeeManagementItem) {
                employeeManagementItem.style.display = 'none';
            }
            
            // Hide department management for managers
            const departmentManagementNav = document.getElementById('department-management-nav');
            if (departmentManagementNav) {
                departmentManagementNav.style.display = 'none';
            }
            
            // Hide clinic management for managers
            const clinicManagementNav = document.getElementById('clinic-management-nav');
            if (clinicManagementNav) {
                clinicManagementNav.style.display = 'none';
            }
            
            // Show other manager-only elements
            document.querySelectorAll('.manager-only').forEach(item => {
                item.style.display = 'flex';
            });
        } else {
            // Regular employee - hide all admin and manager items
            document.querySelectorAll('.admin-only, .manager-only').forEach(item => {
                item.style.display = 'none';
            });
        }

        return userRole;
    } catch (error) {
        console.error('Error checking user role:', error);
        return 'employee'; // Default to employee role if check fails
    }
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication first
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // Check user role and set up permissions
        const userRole = await checkUserRole();
        console.log('User role:', userRole);

        // Initialize components that exist
        const initPromises = [];

        // Only load shifts if the function exists
        if (typeof loadShifts === 'function') {
            initPromises.push(loadShifts());
        }

        // Only load upcoming shifts if the function exists
        if (typeof loadUpcomingShifts === 'function') {
            initPromises.push(loadUpcomingShifts());
        }

        // Only load swap requests if the function exists
        if (typeof loadSwapRequests === 'function') {
            initPromises.push(loadSwapRequests());
        }

        // Wait for all initialization promises to complete
        await Promise.all(initPromises.filter(Boolean));

        // Initialize calendar if the function exists
        if (typeof initializeCalendar === 'function') {
            initializeCalendar();
        }

        // Set up event listeners if the function exists
        if (typeof setupEventListeners === 'function') {
            setupEventListeners();
        }

        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error initializing dashboard. Please try again.', 'error');
    }
});

// Add availability section to the navigation handler
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const sectionName = this.textContent.trim();

            // Update for availability section
            if (sectionName === 'Availability') {
                document.querySelectorAll('.main-content > div[class$="-section"]').forEach(section => {
                    section.style.display = 'none';
                });
                document.querySelector('.availability-section').style.display = 'block';
                loadAvailabilityPreferences();
            }
        });
    });
});

// Availability Modal Functions
function showAvailabilityPreferenceModal() {
    const modal = document.getElementById('availabilityPreferenceModal');
    if (!modal) {
        console.error('Availability preference modal not found');
        return;
    }

    // Show the modal first
    modal.style.display = 'block';

    // Reset form if it exists
    const form = document.getElementById('availabilityPreferenceForm');
    if (form) {
        form.reset();
    }
}

function closeAvailabilityPreferenceModal() {
    const modal = document.getElementById('availabilityPreferenceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to load availability preferences
async function loadAvailabilityPreferences() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const tableBody = document.getElementById('availabilityTableBody');

        if (!tableBody) {
            console.error('Availability table body not found');
            return;
        }

        // Show loading indicator
        tableBody.innerHTML = '<tr><td colspan="3">Loading availability preferences...</td></tr>';

        const response = await fetch(`${window.API_BASE_URL}/availability/employee/${userInfo.userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch availability preferences: ${response.status}`);
        }

        const data = await response.json();
        tableBody.innerHTML = '';

        // Check if data is an array, if not, handle accordingly
        const availabilityArray = Array.isArray(data) ? data : (data.availability || []);

        if (availabilityArray.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="no-data-message">
                        <div class="no-data-content">
                            <i class="fas fa-calendar-times"></i>
                            <p>No availability preferences found</p>
                            <p class="help-text">Use the "Set Availability" button above to add your preferred working days and shifts.</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        availabilityArray.forEach(pref => {
            const row = document.createElement('tr');
            const preferredDates = pref.preferredDates ? formatPreferredDates(pref.preferredDates) : 'Not specified';

            const shiftDisplay = pref.preferredShiftTimes ? getShiftName(pref.preferredShiftTimes) : 'Not specified';

            row.innerHTML = `
                <td>${preferredDates}</td>
                <td>${shiftDisplay}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteAvailabilityPreference(${pref.availabilityId})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading availability preferences:', error);
        const tableBody = document.getElementById('availabilityTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3">Error loading availability preferences</td></tr>';
        }
        showNotification('Failed to load availability preferences', 'error');
    }
}

// Helper function to format preferred dates from code to readable text
function formatPreferredDates(preferredDates) {
    if (!preferredDates) return 'Not specified';

    const daysMap = {
        'M': 'Monday',
        'T': 'Tuesday',
        'W': 'Wednesday',
        'TH': 'Thursday',
        'F': 'Friday',
        'S': 'Saturday',
        'SN': 'Sunday'
    };

    const dateArray = preferredDates.split(',');
    return dateArray.map(code => daysMap[code] || code).join(', ');
}

// Helper function to convert shift code to readable name
function getShiftName(shiftCode) {
    const shiftMap = {
        '9am-5pm': 'Day Shift (9:00 AM - 5:00 PM)',
        '5pm-1am': 'Evening Shift (5:00 PM - 1:00 AM)'
    };

    return shiftMap[shiftCode] || shiftCode;
}

// Handle availability preference form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('availabilityPreferenceForm');
    const submitButton = document.getElementById('submit-availability-btn');
    
    if (submitButton) {
        submitButton.addEventListener('click', async function() {
            console.log('Submit availability button clicked');
            
            // Get selected days
            const selectedDays = Array.from(document.querySelectorAll('input[name="preferredDays"]:checked'))
                .map(checkbox => checkbox.value)
                .join(',');

            if (!selectedDays) {
                showNotification('Please select at least one preferred day', 'error');
                return;
            }

            // Show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            
            try {
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                
                // Debug info
                console.log('User info:', userInfo);
                console.log('API URL:', window.API_BASE_URL);
                console.log('Selected days:', selectedDays);
                
                // Get preferred shift from radio buttons
                const preferredShiftRadio = document.querySelector('input[name="preferredShift"]:checked');
                const preferredShift = preferredShiftRadio ? preferredShiftRadio.value : null;
                
                if (!preferredShift) {
                    showNotification('Please select a preferred shift', 'error');
                    return;
                }
                
                const requestData = {
                    employeeId: userInfo.userId,
                    preferredDates: selectedDays,
                    preferredShift: preferredShift,
                    preferredShiftTimes: preferredShift // Use the shift value as preferredShiftTimes
                };
                
                console.log('Request data:', requestData);
                
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('Authentication token is missing. Please log in again.');
                }
                
                const response = await fetch(`${window.API_BASE_URL}/availability/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(requestData)
                });

                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    let errorMessage = 'Failed to submit availability preference';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        console.error('Error parsing error response:', e);
                    }
                    throw new Error(errorMessage);
                }

                showNotification('Availability preference submitted successfully', 'success');
                closeAvailabilityPreferenceModal();
                loadAvailabilityPreferences();
            } catch (error) {
                console.error('Error submitting availability preference:', error);
                showNotification(error.message || 'Failed to submit availability preference', 'error');
                alert('Error submitting availability: ' + error.message); // More visible error for debugging
            } finally {
                // Reset button state
                submitButton.disabled = false;
                submitButton.innerHTML = 'Submit Availability';
            }
        });
    }

    // For backward compatibility, also handle the form submit event
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            // If we have a button with click handler, trigger that instead
            if (submitButton) {
                submitButton.click();
            }
        });
    }
});

//function to delete an availability preference
async function deleteAvailabilityPreference(id) {
    if (!confirm('Are you sure you want to delete this availability preference?')) {
        return;
    }

    try {
        //retrieves user info from localStorage
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        //get userId from localStorage
        const userId = userInfo.userId || 'unknown';
        //get token from localStorage
        const token = localStorage.getItem('token');

        if (!token) {
            throw new Error('Token is missing');
        }

        const response = await fetch(`${window.API_BASE_URL}/availability/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Id': userId
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete availability preference');
        }

        showNotification('Availability preference deleted successfully', 'success');
        loadAvailabilityPreferences();

    } catch (error) {
        console.error('Error deleting availability preference:', error);
        showNotification(error.message || 'Failed to delete availability preference', 'error');
    }
}

// Function to show the Approve Time Off section
function showApproveTimeOffSection() {
    // Hide all sections first
    document.querySelectorAll('.main-content > div').forEach(section => {
        section.style.display = 'none';
    });

    // Show Approve Time Off section
    const approveTimeoffSection = document.querySelector('.approve-timeoff-section');
    if (approveTimeoffSection) {
        approveTimeoffSection.style.display = 'block';
    }

    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const approveTimeoffNav = document.querySelector('#approve-timeoff-nav');
    if (approveTimeoffNav) {
        approveTimeoffNav.classList.add('active');
    }

    // Load pending time off requests
    loadPendingTimeOffRequests();
}

// Function to load pending time off requests
async function loadPendingTimeOffRequests() {
    const tableBody = document.getElementById('pendingTimeOffBody');
    tableBody.innerHTML = '<tr><td colspan="8" class="loading-message">Loading time off requests...</td></tr>';

    try {
        const token = getToken();
        const statusFilter = document.getElementById('timeoff-status-filter').value;

        // Get all time off requests (managers/admins can see all)
        const response = await fetch(`${window.API_BASE_URL}/timeoff/`, {
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

        // Filter requests based on status if needed
        const filteredRequests = statusFilter === 'all'
            ? requests
            : requests.filter(req => req.status === statusFilter);

        if (filteredRequests.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="empty-message">No time off requests found</td></tr>';
            return;
        }

        filteredRequests.forEach(request => {
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

            // Add conflict indicator if there are schedule conflicts
            const conflictIndicator = request.hasScheduleConflicts ?
                `<span class="conflict-indicator" title="This request conflicts with existing shifts">
                    <i class="fas fa-exclamation-triangle"></i>
                </span>` : '';

            row.innerHTML = `
                <td>${request.employeeName || 'Employee'}</td>
                <td>${dateRequested}</td>
                <td>${request.type}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>${request.reason || 'No reason provided'}</td>
                <td><span class="request-status ${statusClass}">${request.status}</span> ${conflictIndicator}</td>
                <td class="request-actions">
                    <button class="action-btn view-btn" onclick="viewTimeOffRequest(${request.timeOffId})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${request.status === 'Pending' ? `
                    <button class="action-btn approve-btn" onclick="approveTimeOffRequest(${request.timeOffId})">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn reject-btn" onclick="rejectTimeOffRequest(${request.timeOffId})">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading pending time off requests:', error);
        tableBody.innerHTML = `<tr><td colspan="8" class="error-message">Error loading time off requests: ${error.message}</td></tr>`;
    }
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

        // If there are conflicts in the time off request, show them along with replacement suggestions
        if (requestDetails.hasScheduleConflicts) {
            return new Promise((resolve) => {
                // Create confirmation modal
                const confirmModal = document.createElement('div');
                confirmModal.className = 'modal';
                confirmModal.id = 'shiftConflictModal';

                let modalHTML = `
                    <div class="modal-content warning-modal">
                        <span class="close">&times;</span>
                        <div class="warning-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h2>Shift Conflicts Detected</h2>
                        </div>
                        <p>The employee has shifts scheduled during the requested time off period:</p>
                        <div class="time-off-details">
                            <p><strong>Employee:</strong> ${requestDetails.employeeName || 'Employee'}</p>
                            <p><strong>Time Off Period:</strong> ${formatDateForDisplay(new Date(requestDetails.startDate))} to ${formatDateForDisplay(new Date(requestDetails.endDate))}</p>
                            <p><strong>Type:</strong> ${requestDetails.type} Leave</p>
                        </div>`;

                // Add existing shift conflicts
                if (requestDetails.conflicts?.existing?.length > 0) {
                    modalHTML += `
                        <h3>Existing Shifts:</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;

                    requestDetails.conflicts.existing.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${shift.date}</td>
                                <td>${shift.title || 'Regular Shift'}</td>
                                <td>${shift.status}</td>
                            </tr>`;
                    });

                    modalHTML += `
                            </tbody>
                        </table>`;
                }

                // Add pending shift conflicts
                if (requestDetails.conflicts?.pending?.length > 0) {
                    modalHTML += `
                        <h3>Pending Shifts:</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>`;

                    requestDetails.conflicts.pending.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${shift.date}</td>
                                <td>${shift.title || 'Regular Shift'}</td>
                                <td>${shift.status}</td>
                            </tr>`;
                    });

                    modalHTML += `
                            </tbody>
                        </table>`;
                }

                // Add staff replacement suggestions
                if (requestDetails.availableStaffSuggestions?.length > 0) {
                    modalHTML += `
                        <h3 class="section-title">
                            <i class="fas fa-user-friends"></i> Available Staff Suggestions
                        </h3>`;

                    requestDetails.availableStaffSuggestions.forEach(suggestion => {
                        modalHTML += `
                            <div class="replacement-suggestion">
                                <h4>Shift Period: ${suggestion.shiftPeriod}</h4>`;

                        if (suggestion.availableStaff.length > 0) {
                            modalHTML += `
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;

                            suggestion.availableStaff.forEach(staff => {
                                modalHTML += `
                                    <tr>
                                        <td>${staff.name}</td>
                                        <td>${staff.department}</td>
                                        <td>${staff.role}</td>
                                    </tr>`;
                            });

                            modalHTML += `
                                    </tbody>
                                </table>`;
                        } else {
                            modalHTML += `<p>No available staff for this shift period</p>`;
                        }

                        modalHTML += `</div>`;
                    });
                }

                // Add recommendations if any
                if (requestDetails.recommendations?.length > 0) {
                    modalHTML += `
                        <div class="recommendations">
                            <h4>Recommendations:</h4>
                            <ul>`;

                    requestDetails.recommendations.forEach(recommendation => {
                        modalHTML += `<li>${recommendation}</li>`;
                    });

                    modalHTML += `
                            </ul>
                        </div>`;
                } else {
                    modalHTML += `
                        <div class="recommendations">
                            <h3><i class="fas fa-info-circle"></i> What to do next</h3>
                            <ul>
                                <li>Consider rescheduling the conflicting shifts</li>
                                <li>Assign a replacement for the scheduled shifts</li>
                                <li>Discuss alternatives with the employee</li>
                            </ul>
                        </div>`;
                }

                modalHTML += `
                    <div class="modal-footer">
                        <p><i class="fas fa-headset"></i> Do you still want to approve this time off request?</p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn-danger" id="cancelApproval">Cancel</button>
                            <button class="btn-primary" id="confirmApproval">Approve Anyway</button>
                        </div>
                    </div>
                </div>`;

                confirmModal.innerHTML = modalHTML;
                document.body.appendChild(confirmModal);

                // Show the modal
                document.getElementById('shiftConflictModal').style.display = 'block';

                // Add event listeners for buttons
                document.getElementById('confirmApproval').addEventListener('click', async () => {
                    // Close the modal
                    document.getElementById('shiftConflictModal').style.display = 'none';

                    // Continue with approval
                    try {
                        await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
                        resolve();
                    } catch (error) {
                        console.error('Error during approval:', error);
                        showNotification(`Error: ${error.message}`, 'error');
                        resolve();
                    } finally {
                        // Remove the modal
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                    }
                });

                document.getElementById('cancelApproval').addEventListener('click', () => {
                    // Close and remove the modal
                    document.getElementById('shiftConflictModal').style.display = 'none';
                    setTimeout(() => {
                        document.getElementById('shiftConflictModal').remove();
                    }, 500);
                    resolve();
                });

                // Close button functionality
                document.querySelector('#shiftConflictModal .close').addEventListener('click', () => {
                    document.getElementById('shiftConflictModal').style.display = 'none';
                    setTimeout(() => {
                        document.getElementById('shiftConflictModal').remove();
                    }, 500);
                    resolve();
                });
            });
        } else {
            // No conflicts found in request, check for shifts manually
        try {
            // Fetch employee shifts for the time period
            const shiftResponse = await fetch(`${window.API_BASE_URL}/shift/${requestDetails.employeeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!shiftResponse.ok) {
                throw new Error('Failed to fetch employee shifts');
            }

            const shifts = await shiftResponse.json();

            // Find shifts that overlap with the requested time off period
            const startDate = new Date(requestDetails.startDate);
            const endDate = new Date(requestDetails.endDate);

            // Filter shifts that overlap with the time off period
            const conflictingShifts = shifts.filter(shift => {
                const shiftStart = new Date(shift.startDate);
                const shiftEnd = new Date(shift.endDate);

                // Check if shift overlaps with time off period
                return (
                    (shiftStart <= endDate && shiftEnd >= startDate) ||
                    (shiftStart >= startDate && shiftEnd <= endDate) ||
                    (shiftStart <= startDate && shiftEnd >= startDate) ||
                    (shiftStart <= endDate && shiftEnd >= endDate)
                );
            });

            // If there are conflicting shifts, show a confirmation modal
            if (conflictingShifts.length > 0) {
                return new Promise((resolve) => {
                    // Create confirmation modal
                    const confirmModal = document.createElement('div');
                    confirmModal.className = 'modal';
                    confirmModal.id = 'shiftConflictModal';

                    let modalHTML = `
                        <div class="modal-content warning-modal">
                            <span class="close">&times;</span>
                            <div class="warning-header">
                                <i class="fas fa-exclamation-triangle"></i>
                                <h2>Shift Conflicts Detected</h2>
                            </div>
                            <p>The employee has ${conflictingShifts.length} existing shift(s) scheduled during the requested time off period:</p>
                            <div class="time-off-details">
                                <p><strong>Employee:</strong> ${requestDetails.employeeName || 'Employee'}</p>
                                <p><strong>Time Off Period:</strong> ${formatDateForDisplay(new Date(requestDetails.startDate))} to ${formatDateForDisplay(new Date(requestDetails.endDate))}</p>
                                <p><strong>Type:</strong> ${requestDetails.type} Leave</p>
                            </div>
                            
                            <h3>Conflicting Shifts:</h3>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                    conflictingShifts.forEach(shift => {
                        modalHTML += `
                            <tr>
                                <td>${formatDateForDisplay(new Date(shift.startDate))}</td>
                                <td>${shift.title || shift.department || 'Shift'}</td>
                                <td><span class="status-badge ${shift.status.toLowerCase()}">${shift.status}</span></td>
                            </tr>`;
                    });

                    modalHTML += `
                                </tbody>
                            </table>
                            
                            <div class="recommendations">
                                <h3><i class="fas fa-info-circle"></i> What to do next</h3>
                                <ul>
                                    <li>Consider rescheduling the conflicting shifts</li>
                                    <li>Assign a replacement for the scheduled shifts</li>
                                    <li>Discuss alternatives with the employee</li>
                                </ul>
                            </div>
                            
                            <div class="modal-footer">
                                <p><i class="fas fa-headset"></i> Do you still want to approve this time off request?</p>
                                <div style="display: flex; gap: 10px; justify-content: center;">
                                    <button class="btn-danger" id="cancelApproval">Cancel</button>
                                    <button class="btn-primary" id="confirmApproval">Approve Anyway</button>
                                </div>
                            </div>
                        </div>`;

                    confirmModal.innerHTML = modalHTML;
                    document.body.appendChild(confirmModal);

                    // Show the modal
                    document.getElementById('shiftConflictModal').style.display = 'block';

                    // Add event listeners for buttons
                    document.getElementById('confirmApproval').addEventListener('click', async () => {
                        // Close the modal
                        document.getElementById('shiftConflictModal').style.display = 'none';

                        // Continue with approval
                        try {
                            await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
                            resolve();
                        } catch (error) {
                            console.error('Error during approval:', error);
                            showNotification(`Error: ${error.message}`, 'error');
                            resolve();
                        } finally {
                            // Remove the modal
                            setTimeout(() => {
                                document.getElementById('shiftConflictModal').remove();
                            }, 500);
                        }
                    });

                    document.getElementById('cancelApproval').addEventListener('click', () => {
                        // Close and remove the modal
                        document.getElementById('shiftConflictModal').style.display = 'none';
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                        resolve();
                    });

                    // Close button functionality
                    document.querySelector('#shiftConflictModal .close').addEventListener('click', () => {
                        document.getElementById('shiftConflictModal').style.display = 'none';
                        setTimeout(() => {
                            document.getElementById('shiftConflictModal').remove();
                        }, 500);
                        resolve();
                    });
                });
            } else {
                // No conflicts, proceed with approval
                await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
            }
        } catch (error) {
            console.error('Error checking for shift conflicts:', error);
            // Continue with approval despite the error in conflict checking
            await processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed);
        }
        }
    } catch (error) {
        console.error('Error approving time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Helper function to process the time off approval
async function processApproval(requestId, approvedBy, requestDetails, balanceType, daysUsed) {
    const token = getToken();

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

    const result = await response.json();

    if (!response.ok && !result.warning) {
        // If error is not a warning with conflicts
        throw new Error(result.error || 'Failed to approve time off request');
    }

    // Sync the approved time off with attendance records
    try {
        const syncResponse = await fetch(`${window.API_BASE_URL}/attendance/sync-timeoff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                employeeId: requestDetails.employeeId,
                startDate: requestDetails.startDate,
                endDate: requestDetails.endDate
            })
        });

        if (!syncResponse.ok) {
            console.error('Failed to sync time off with attendance records');
        } else {
            console.log('Successfully synced time off with attendance records');
        }
    } catch (err) {
        console.error('Error syncing time off with attendance:', err);
    }

    // Refresh leave balances from backend
    fetchLeaveBalances();

    // Check if the response contains conflict warnings
    if (result.warning) {
        // Create a warning modal for conflicts
        const warningModal = document.createElement('div');
        warningModal.className = 'modal';
        warningModal.id = 'warningModal';

        let conflictHTML = `
            <div class="modal-content warning-modal">
                <span class="close">&times;</span>
                <div class="warning-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>${result.warning.title || 'Warning'}</h2>
                </div>
                <p>${result.warning.message || 'There are conflicts with this time off request.'}</p>
                <div class="time-off-details">
                    <p><strong>Employee:</strong> ${result.message.split('for ')[1]?.split(' has')[0] || 'Employee'}</p>
                    <p><strong>Period:</strong> ${result.timeOffPeriod?.start} to ${result.timeOffPeriod?.end}</p>
                    <p><strong>Type:</strong> ${result.timeOffPeriod?.type || 'Leave'}</p>
                </div>`;

        // Add existing shift conflicts if any
        if (result.conflicts?.existing && result.conflicts.existing.length > 0) {
            conflictHTML += `
                <h3>Existing Shifts During This Period:</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Assignment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

            result.conflicts.existing.forEach(conflict => {
                conflictHTML += `
                    <tr>
                        <td>${conflict.date}</td>
                        <td>${conflict.title}</td>
                        <td><span class="status-badge ${conflict.status.toLowerCase()}">${conflict.status}</span></td>
                    </tr>`;
            });

            conflictHTML += `
                    </tbody>
                </table>`;
        }

        // Add pending shift conflicts if any
        if (result.conflicts?.pending && result.conflicts.pending.length > 0) {
            conflictHTML += `
                <h3>Pending Shifts During This Period:</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Assignment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

            result.conflicts.pending.forEach(conflict => {
                conflictHTML += `
                    <tr>
                        <td>${conflict.date}</td>
                        <td>${conflict.title}</td>
                        <td><span class="status-badge pending">Pending</span></td>
                    </tr>`;
            });

            conflictHTML += `
                    </tbody>
                </table>`;
        }

        // Add recommendations if any
        if (result.recommendations && result.recommendations.length > 0) {
            conflictHTML += `
                <div class="recommendations">
                    <h3>Recommendations:</h3>
                    <ul>`;

            result.recommendations.forEach(recommendation => {
                conflictHTML += `<li>${recommendation}</li>`;
            });

            conflictHTML += `</ul></div>`;
        }

        conflictHTML += `
            <div class="modal-footer">
                <p>The time off has been approved, but you may want to resolve these conflicts.</p>
                <button class="btn-primary" id="closeWarningModal">Acknowledge</button>
            </div>
        </div>`;

        warningModal.innerHTML = conflictHTML;
        document.body.appendChild(warningModal);

        // Setup close functionality
        document.getElementById('closeWarningModal').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
            setTimeout(() => {
                document.getElementById('warningModal').remove();
            }, 500);
        });

        document.querySelector('#warningModal .close').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
            setTimeout(() => {
                document.getElementById('warningModal').remove();
            }, 500);
        });


        // Show the modal
        document.getElementById('warningModal').style.display = 'block';

        // Display success notification
        showNotification(`Time off request approved with warnings.`, 'warning');
    } else {
        // Display regular success message
        showNotification(`Time off request approved successfully.`, 'success');
    }

    // Refresh the pending time off requests
    loadPendingTimeOffRequests();
    // Close the details modal if it was open
    if (document.getElementById('timeOffDetailsModal').style.display === 'block') {
        closeTimeOffDetailsModal();
    }
}

// Function to reject a time off request directly from the list
async function rejectTimeOffRequest(requestId) {
    try {
        const token = getToken();
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const approvedBy = userInfo.userId;

        // Fetch the time off request details first to get employee name and dates
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

        // Create a more friendly notification message
        const employeeName = requestDetails.employeeName || 'employee';
        const startDate = new Date(requestDetails.startDate).toLocaleDateString();
        const endDate = new Date(requestDetails.endDate).toLocaleDateString();

        showNotification(`Time off request for ${employeeName} (${startDate} to ${endDate}) has been declined.`, 'info');

        // Refresh the relevant list based on which view the user is in
        if (document.querySelector('.approve-timeoff-section').style.display === 'block') {
            loadPendingTimeOffRequests();
        } else {
            loadTimeOffHistory();
        }

        // Close the details modal if it was open
        if (document.getElementById('timeOffDetailsModal').style.display === 'block') {
            closeTimeOffDetailsModal();
        }

    } catch (error) {
        console.error('Error rejecting time off request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Add event listeners for navigation items
document.addEventListener('DOMContentLoaded', function() {
    // Add click handler for clinic management
    const clinicManagementNav = document.getElementById('clinic-management-nav');
    if (clinicManagementNav) {
        console.log('Adding click handler to clinic management nav');
        clinicManagementNav.addEventListener('click', function() {
            // We'll let clinic.js handle this functionality
            console.log('Clinic management nav clicked, delegating to clinic.js');
        });
    }
    
    // Initialize the Availability section properly
    const availabilityNav = document.querySelector('.nav-item:has(i.fa-calendar-check)');
    if (availabilityNav) {
        console.log('Adding click handler to availability nav');
        availabilityNav.addEventListener('click', showAvailabilitySection);
    }
    
    // Manually trigger click event handler on availability button
    console.log('Checking for availability button handler');
    const submitButton = document.getElementById('submit-availability-btn');
    if (submitButton) {
        console.log('Found submit-availability-btn, ensuring event handlers are set');
    }
});

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

// Function to show the Availability section
function showAvailabilitySection() {
    // Hide all sections first
    const sections = [
        '.upcoming-shifts-section',
        '.calendar-section',
        '.employee-section',
        '.report-section',
        '.time-off-section',
        '.approve-timeoff-section',
        '.schedule-section',
        '.generate-shifts-section'
    ];

    // Hide all sections safely with null checks
    sections.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    });

    // Show Availability section
    const availabilitySection = document.querySelector('.availability-section');
    if (availabilitySection) {
        availabilitySection.style.display = 'block';
    }

    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const availabilityNav = document.querySelector('.nav-item:has(i.fa-calendar-check)');
    if (availabilityNav) {
        availabilityNav.classList.add('active');
    }

    // Load availability preferences
    loadAvailabilityPreferences();
}

// Function to populate clinic filter
async function populateClinicFilter() {
    // Get user role to ensure only admins and managers can use this
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = userInfo.role?.toLowerCase() || 'employee';

    // Only for managers and admins
    if (userRole !== 'manager' && userRole !== 'admin') return;

    try {
        // Fetch all clinics
        const response = await fetch(`${window.API_BASE_URL}/clinic/getClinics`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch clinics');
        }

        const clinics = await response.json();
        console.log('Clinics loaded for filter:', clinics.length);

        // Get the select element
        const clinicFilter = document.getElementById('clinic-filter');
        if (!clinicFilter) return;

        // Clear existing options except the first one (All Clinics)
        while (clinicFilter.options.length > 1) {
            clinicFilter.remove(1);
        }

        // Add clinic options
        clinics.forEach(clinic => {
            const option = document.createElement('option');
            option.value = clinic.clinicId;
            option.textContent = clinic.clinicName;
            clinicFilter.appendChild(option);
        });

        // Set up event listener
        clinicFilter.addEventListener('change', filterCalendarEvents);
    } catch (error) {
        console.error('Error populating clinic filter:', error);
    }
}

// Direct function to handle simple availability preference submission
// This is a fallback function for when the click event handlers don't work
function submitAvailabilityPreference() {
    console.log('Direct submitAvailabilityPreference function called');
    
    // Get the button for state management
    const submitButton = document.getElementById('submit-availability-btn');
    if (!submitButton) {
        console.error('Submit button not found');
        return;
    }
    
    // Get selected days
    const selectedDays = Array.from(document.querySelectorAll('input[name="preferredDays"]:checked'))
        .map(checkbox => checkbox.value)
        .join(',');

    if (!selectedDays) {
        alert('Please select at least one preferred day');
        return;
    }
    
    // Get preferred shift
    const preferredShiftRadio = document.querySelector('input[name="preferredShift"]:checked');
    if (!preferredShiftRadio) {
        alert('Please select a preferred shift');
        return;
    }
    const preferredShift = preferredShiftRadio.value;

    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    // Get user info and token
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Authentication token is missing. Please log in again.');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit Availability';
        return;
    }
    
    // Make the API request
    fetch(`${window.API_BASE_URL}/availability/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            employeeId: userInfo.userId,
            preferredDates: selectedDays,
            preferredShift: preferredShift,
            preferredShiftTimes: preferredShift // Send the shift value as preferredShiftTimes for the backend
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to submit availability preference');
            });
        }
        return response.json();
    })
    .then(() => {
        alert('Availability preference submitted successfully!');
        
        // Close the modal
        const modal = document.getElementById('availabilityPreferenceModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Reload availability preferences
        loadAvailabilityPreferences();
    })
    .catch(error => {
        console.error('Error submitting availability preference:', error);
        alert('Error: ' + error.message);
    })
    .finally(() => {
        // Reset button state
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit Availability';
    });
}

// Function to handle real-time availability deletion
function handleRealTimeAvailabilityDeletion(data) {
    console.log('Received real-time availability deletion:', data);
    
    if (data.deletedId) {
        // Find the row in the table with the matching ID and remove it
        const availabilityRow = document.querySelector(`#availability-item-${data.deletedId}`);
        if (availabilityRow) {
            availabilityRow.classList.add('deletion-animation');
            
            // After animation completes, remove the element
            setTimeout(() => {
                availabilityRow.remove();
                
                // Check if there are no more preferences
                const availabilityTableBody = document.getElementById('availabilityTableBody');
                if (availabilityTableBody && availabilityTableBody.children.length === 0) {
                    availabilityTableBody.innerHTML = '<tr><td colspan="3">No availability preferences found</td></tr>';
                }
            }, 500);
            
            // Show notification
            showNotification(data.message || 'Availability preference was deleted', 'info');
        }
    }
}

// Setup Socket.IO event listeners for real-time updates
document.addEventListener('DOMContentLoaded', function() {
    // Original DOMContentLoaded event listeners
    
    // Set up Socket.IO connection for real-time updates
    const socket = io();
    
    // Get user info for user-specific socket room
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.userId) {
        // Join user-specific room
        socket.emit('join_user_room', { userId: userInfo.userId });
        
        // Listen for availability deletion notifications
        socket.on('availability_deleted', handleRealTimeAvailabilityDeletion);
        
        // Listen for other availability updates
        socket.on('availability_updated', function(data) {
            console.log('Received availability update:', data);
            // Reload preferences to reflect the changes
            loadAvailabilityPreferences();
        });
    }
});

// Update the renderAvailabilityPreferences function to add IDs to rows for easier targeting
function renderAvailabilityPreferences(preferences) {
    const tableBody = document.getElementById('availabilityTableBody');
    
    if (!tableBody) {
        console.error('Availability table body not found');
        return;
    }
    
    if (!preferences || preferences.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No availability preferences found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    preferences.forEach(pref => {
        const preferredDates = formatPreferredDates(pref.preferredDates);
        
        // Use preferredShiftTimes if available, otherwise fall back to preferredShift
        let shiftToDisplay = pref.preferredShiftTimes || pref.preferredShift;
        const preferredShift = shiftToDisplay ? getShiftName(shiftToDisplay) : 'Not specified';
        
        const row = document.createElement('tr');
        row.id = `availability-item-${pref.availabilityId}`; // Add ID for targeting during deletion
        
        // Add a class based on status
        const statusClass = pref.status === 'Approved' ? 'status-approved' : 
                           pref.status === 'Declined' ? 'status-declined' : 'status-pending';
        
        row.innerHTML = `
            <td>${preferredDates}</td>
            <td>${pref.preferredShiftTimes ? getShiftName(pref.preferredShiftTimes) : 'Not specified'}</td>
            <td>
                <button class="action-btn delete-btn" onclick="deleteAvailabilityPreference(${pref.availabilityId})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Function to combine date and time into a JavaScript Date object
function combineDateTime(dateStr, timeStr) {
    try {
        // Check if inputs are valid
        if (!dateStr) {
            console.warn('Missing date string in combineDateTime');
            return new Date();
        }

        // Special handling for MySQL DATE and TIME formats
        
        // Format date part correctly
        let datePart;
        
        // Handle if dateStr is already a Date object
        if (dateStr instanceof Date) {
            if (!isNaN(dateStr.getTime())) {
                datePart = dateStr.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
                datePart = new Date().toISOString().split('T')[0]; // Use today if invalid
            }
        } 
        // Handle different string date formats
        else if (typeof dateStr === 'string') {
            // Try to convert to Date object
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                datePart = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
                // Fallback: Try to extract date parts from string
                // Check if it's YYYY-MM-DD format
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    datePart = dateStr;
                } else {
                    console.warn('Invalid date format in combineDateTime:', dateStr);
                    datePart = new Date().toISOString().split('T')[0]; // Use today if invalid
                }
            }
        } else {
            // Use current date as fallback
            datePart = new Date().toISOString().split('T')[0];
        }
        
        // Clean time format (handles MySQL TIME type format: "HH:MM:SS")
        let timePart = '00:00:00'; // Default time
        
        if (timeStr) {
            if (typeof timeStr === 'string' && timeStr.includes(':')) {
                // If timeStr is already in HH:MM:SS or HH:MM format
                const parts = timeStr.split(':');
                if (parts.length >= 2) {
                    if (parts.length === 2) {
                        timePart = `${parts[0]}:${parts[1]}:00`; // Add seconds if missing
                    } else {
                        timePart = timeStr; // Use as is if it has seconds
                    }
                }
            } else if (timeStr instanceof Date && !isNaN(timeStr.getTime())) {
                // Extract time from Date object
                const hours = timeStr.getHours().toString().padStart(2, '0');
                const minutes = timeStr.getMinutes().toString().padStart(2, '0');
                const seconds = timeStr.getSeconds().toString().padStart(2, '0');
                timePart = `${hours}:${minutes}:${seconds}`;
            }
        }
        
        // Fix timezone issue by manually parsing date parts and using UTC methods
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        const combinedDate = new Date();
        combinedDate.setFullYear(year);
        combinedDate.setMonth(month - 1); // Month is 0-indexed
        combinedDate.setDate(day);
        
        // Set time components
        combinedDate.setHours(hours, minutes, seconds, 0);
        
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const userRole = userInfo.role?.toLowerCase() || '';

        // Add a day for employee role to fix date - case insensitive check
        if (userRole === 'employee' || userRole === 'Employee' || userInfo.role?.toUpperCase() === 'EMPLOYEE') {
            combinedDate.setDate(combinedDate.getDate() + 1);
        }

        // Check if the date is valid
        if (isNaN(combinedDate.getTime())) {
            console.error('Invalid date/time combination in combineDateTime:', {datePart, timePart});
            return new Date(); // Return current date as fallback
        }
        
        return combinedDate;
    } catch (error) {
        console.error('Error combining date and time:', error, {dateStr, timeStr});
        // Return current date as fallback
        return new Date();
    }
}

// Fetch and populate department filter
async function populateDepartmentFilterDirect() {
    try {
        const response = await fetch(`${window.API_BASE_URL}/department/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch departments');
        const departments = await response.json();

        const departmentFilter = document.getElementById('department-filter');
        if (!departmentFilter) return;

        // Clear existing options except the first one
        while (departmentFilter.options.length > 1) {
            departmentFilter.remove(1);
        }

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.departmentName;
            option.textContent = dept.departmentName;
            departmentFilter.appendChild(option);
        });

        departmentFilter.addEventListener('change', filterCalendarEvents);
    } catch (error) {
        console.error('Error populating department filter:', error);
    }
}

// On DOMContentLoaded, always populate department filter if it exists
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('department-filter')) {
        populateDepartmentFilterDirect();
    }
});


