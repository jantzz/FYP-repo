// Shift types and their time ranges
const SHIFT_TYPES = {
    '9am-5pm': {
        name: 'Day Shift',
        defaultStart: '09:00',
        defaultEnd: '17:00',
        displayTime: '9:00 AM - 5:00 PM'
    },
    '5pm-1am': {
        name: 'Evening Shift',
        defaultStart: '17:00',
        defaultEnd: '01:00',
        displayTime: '5:00 PM - 1:00 AM'
    }
};

// Add CSS for used-hours span
const usedHoursStyle = document.createElement('style');
usedHoursStyle.textContent = `
    .availability-form-container {
        margin-top: 20px;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 8px;
    }
    
    .availability-form .form-group {
        margin-bottom: 15px;
    }
    
    .days-checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .days-checkboxes label {
        margin-right: 10px;
        display: flex;
        align-items: center;
    }
    
    .days-checkboxes input {
        margin-right: 5px;
    }
    
    #submit-availability {
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    #submit-availability:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
    
    .availability-item {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        background-color: white;
    }
    
    .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
    }
    
    .status-approved {
        background-color: #d4edda;
        color: #155724;
    }
    
    .status-declined {
        background-color: #f8d7da;
        color: #721c24;
    }
    
    .status-pending {
        background-color: #fff3cd;
        color: #856404;
    }
    
    .no-data {
        padding: 20px;
        text-align: center;
        color: #6c757d;
        background-color: #f8f9fa;
        border-radius: 8px;
        font-style: italic;
    }
`;
document.head.appendChild(usedHoursStyle);

// Initialize employee availability data structure
let employeeAvailability = {
    availability: []
};

// Initialize availability functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Check if main exists, if not use body or create a container
    const mainElement = document.querySelector('main') || document.body;
    console.log('Main element found:', mainElement);
    
    // Ensure the main container exists
    let mainContainer = document.querySelector('#my-availability-tab');
    console.log('Initial my-availability-tab found:', mainContainer);
    
    if (!mainContainer) {
        mainContainer = document.createElement('div');
        mainContainer.id = 'my-availability-tab';
        mainElement.appendChild(mainContainer);
        console.log('Created my-availability-tab');
    }

    // Create the basic structure if it doesn't exist
    if (!document.querySelector('.availability-header')) {
        const header = document.createElement('div');
        header.className = 'availability-header';
        header.innerHTML = '<h2>My Availability</h2>';
        mainContainer.appendChild(header);
    }

    // Create availability container if it doesn't exist
    if (!document.querySelector('#availability-container')) {
        const availabilityContainer = document.createElement('div');
        availabilityContainer.id = 'availability-container';
        mainContainer.appendChild(availabilityContainer);

        // Create availability list container
        const availabilityList = document.createElement('div');
        availabilityList.className = 'availability-list';
        availabilityContainer.appendChild(availabilityList);
    }
    
    // Create the availability form if it doesn't exist
    createAvailabilityFormIfNeeded();

    initializeAvailabilityForm();
    setupAvailabilityListeners();
    loadEmployeeAvailability();
    
    // Listen for availability updates from the manager side
    document.addEventListener('manager-update-availability', function(e) {
        console.log('Received manager-update-availability event:', e.detail);
        if (e.detail && e.detail.data) {
            updateEmployeeAvailability(e.detail.data);
        } else {
            // If no data provided, reload from the API
            loadEmployeeAvailability();
        }
    });
});

// Expose functions to window object for cross-file access
window.loadEmployeeAvailability = loadEmployeeAvailability;
window.updateEmployeeAvailability = updateEmployeeAvailability;

// Function to update the availability display
function updateAvailabilityDisplay() {
    console.log('Updating availability display');
    
    // Make sure body exists as a fallback
    const body = document.body;
    if (!body) {
        console.error('Document body not found! Cannot update display.');
        return;
    }
    
    // Check if main exists, if not use body
    const mainElement = document.querySelector('main') || body;
    console.log('Main element found in updateAvailabilityDisplay:', mainElement);
    
    // Ensure main container exists
    let mainContainer = document.querySelector('#my-availability-tab');
    console.log('my-availability-tab found in updateAvailabilityDisplay:', mainContainer);
    
    if (!mainContainer) {
        mainContainer = document.createElement('div');
        mainContainer.id = 'my-availability-tab';
        mainElement.appendChild(mainContainer);
        console.log('Created my-availability-tab in updateAvailabilityDisplay');
    }

    // Container for the list view
    let availabilityContainer = document.querySelector('#availability-container');
    if (!availabilityContainer) {
        console.log('Creating new availability container');
        availabilityContainer = document.createElement('div');
        availabilityContainer.id = 'availability-container';
        mainContainer.appendChild(availabilityContainer);
        
        const availabilityList = document.createElement('div');
        availabilityList.className = 'availability-list';
        availabilityContainer.appendChild(availabilityList);
    }
    
    console.log('Updating availability list content');
    
    // Look for or create the availability list
    let availabilityList = availabilityContainer.querySelector('.availability-list');
    if (!availabilityList) {
        availabilityList = document.createElement('div');
        availabilityList.className = 'availability-list';
        availabilityContainer.appendChild(availabilityList);
    }
    
    // Define a safe way to update the list content
    const safelyUpdateList = (list, content) => {
        if (list) {
            list.innerHTML = content;
        } else {
            console.error('Cannot find .availability-list to update');
        }
    };
    
    // Function to format the preferred dates display
    const getPreferredDatesDisplay = (preferredDates) => {
        if (!preferredDates) return 'Not specified';
        
        // Map the single letter codes to day names
        const dayMap = {
            'M': 'Monday',
            'T': 'Tuesday',
            'W': 'Wednesday',
            'TH': 'Thursday',
            'F': 'Friday',
            'S': 'Saturday',
            'SN': 'Sunday'
        };
        
        // Split the string into an array of day codes
        const days = preferredDates.split(',');
        
        // Map the day codes to full day names
        return days.map(day => dayMap[day] || day).join(', ');
    };
    
    // Check if we have availability data
    if (Array.isArray(employeeAvailability.availability) && employeeAvailability.availability.length > 0) {
        console.log('Rendering availability data:', employeeAvailability.availability);
        
        // Build the HTML for each availability record
        const availabilityHTML = employeeAvailability.availability.map(item => {
            const preferredDatesDisplay = getPreferredDatesDisplay(item.preferredDates);
            
            // Display shift times if available
            const shiftTimes = item.preferredShiftTimes ? ` (${item.preferredShiftTimes})` : '';
            
            // Determine a status badge class
            const statusClass = item.status === 'Approved' ? 'status-approved' : 
                               item.status === 'Declined' ? 'status-declined' : 'status-pending';
            
            return `
                <div class="availability-item">
                    <div class="availability-details">
                        <h3>${preferredDatesDisplay}${shiftTimes}</h3>
                        <p>Submitted: ${new Date(item.submittedAt).toLocaleString()}</p>
                        <span class="status-badge ${statusClass}">${item.status}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        safelyUpdateList(availabilityList, availabilityHTML);
    } else {
        console.log('No availability data found');
        safelyUpdateList(availabilityList, '<div class="no-data">No availability preferences found. Add your availability by filling out the form below.</div>');
    }
}

// Function to initialize the availability form
function initializeAvailabilityForm() {
    console.log('Initializing availability form');
    
    // Create form if it doesn't exist
    createAvailabilityFormIfNeeded();
    
    // Add day options to form
    const dayOptions = [
        { value: 'M', label: 'Monday' },
        { value: 'T', label: 'Tuesday' },
        { value: 'W', label: 'Wednesday' },
        { value: 'TH', label: 'Thursday' },
        { value: 'F', label: 'Friday' },
        { value: 'S', label: 'Saturday' },
        { value: 'SN', label: 'Sunday' }
    ];
    
    const daysContainer = document.querySelector('.days-checkboxes');
    if (daysContainer) {
        daysContainer.innerHTML = dayOptions.map(day => `
            <div class="day-checkbox">
                <input type="checkbox" id="day-${day.value}" name="preferredDays" value="${day.value}">
                <label for="day-${day.value}">${day.label}</label>
            </div>
        `).join('');
    }
}

// Function to setup availability listeners
function setupAvailabilityListeners() {
    console.log('Setting up availability form listeners');
    
    const availabilityForm = document.getElementById('availability-form');
    if (!availabilityForm) {
        console.error('Cannot find availability form element');
        return;
    }
    
    // Set up day checkboxes
    const daysContainer = document.querySelector('.days-checkboxes');
    if (daysContainer) {
        daysContainer.innerHTML = `
            <label><input type="checkbox" name="day" value="M"> Monday</label>
            <label><input type="checkbox" name="day" value="T"> Tuesday</label>
            <label><input type="checkbox" name="day" value="W"> Wednesday</label>
            <label><input type="checkbox" name="day" value="TH"> Thursday</label>
            <label><input type="checkbox" name="day" value="F"> Friday</label>
            <label><input type="checkbox" name="day" value="S"> Saturday</label>
            <label><input type="checkbox" name="day" value="SN"> Sunday</label>
        `;
    }
    
    // Listen for form submission
    availabilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const note = document.getElementById('availability-note').value;
        
        // Get selected days
        const selectedDays = [];
        document.querySelectorAll('input[name="day"]:checked').forEach(checkbox => {
            selectedDays.push(checkbox.value);
        });
        
        if (selectedDays.length === 0) {
            alert('Please select at least one day');
            return;
        }
        
        try {
            const submitButton = document.getElementById('submit-availability');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
            }
            
            const formData = {
                preferredDays: selectedDays,
                note: note
            };
            
            console.log('Submitting availability:', formData);
            
            // Submit the availability
            const result = await submitAvailability(formData);
            
            // Show success message
            alert('Availability submitted successfully!');
            
            // Reload availability data
            await loadEmployeeAvailability();
            
            // Reset the form
            availabilityForm.reset();
        } catch (error) {
            console.error('Error submitting availability:', error);
            alert(`Failed to submit availability: ${error.message}`);
        } finally {
            // Reset submit button
            const submitButton = document.getElementById('submit-availability');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Availability';
            }
        }
    });
}

// Function to create the availability form if needed
function createAvailabilityFormIfNeeded() {
    console.log('Creating availability form if needed');
    
    if (!document.getElementById('availability-form')) {
        const formContainer = document.createElement('div');
        formContainer.className = 'availability-form-container';
        
        formContainer.innerHTML = `
            <h3>Submit New Availability</h3>
            <form id="availability-form" class="availability-form">
                <div class="form-group">
                    <label>Preferred Days:</label>
                    <div class="days-checkboxes"></div>
                </div>
                <div class="form-group">
                    <label for="availability-note">Notes (optional):</label>
                    <textarea id="availability-note" rows="3"></textarea>
                </div>
                <button type="submit" id="submit-availability">Submit Availability</button>
            </form>
        `;
        
        const availabilityContainer = document.getElementById('availability-container');
        if (availabilityContainer) {
            availabilityContainer.appendChild(formContainer);
        } else {
            console.error('Could not find availability container to append form');
        }
    }
}

function closeAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to submit availability
async function submitAvailability(formData) {
    try {
        // Convert form data format to match backend schema
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        // Format into the schema needed for the backend
        const requestData = {
            employeeId: userInfo.userId,
            preferredDates: formData.preferredDays.join(',') // convert array to comma-separated string
        };
        
        console.log('Submitting availability data:', requestData);
        
        const response = await fetch('https://emp-roster-backend.onrender.com//availability/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit availability');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error submitting availability:', error);
        throw error;
    }
}

// Function to update employee availability
function updateEmployeeAvailability(data) {
    console.log('Updating employee availability with data:', data);
    employeeAvailability = {
        availability: data.availability || []
    };
    updateAvailabilityDisplay();
    
    // Dispatch an event to notify that availability has been updated
    const event = new CustomEvent('availability-updated');
    window.dispatchEvent(event);
}

// Function to load employee availability
async function loadEmployeeAvailability() {
    try {
        console.log('Loading employee availability...');
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.userId) {
            throw new Error('User not logged in');
        }

        const response = await fetch(`https://emp-roster-backend.onrender.com//availability/employee/${userInfo.userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load availability');
        }

        const data = await response.json();
        console.log('Received availability data:', data);
        
        // Update global availability object
        updateEmployeeAvailability(data);
        
        return data;
    } catch (error) {
        console.error('Error loading availability:', error);
        return null;
    }
}