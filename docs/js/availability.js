// Shift types and their time ranges
const SHIFT_TYPES = {
    MORNING: {
        name: 'Morning Shift',
        defaultStart: '06:00',
        defaultEnd: '14:00'
    },
    AFTERNOON: {
        name: 'Afternoon Shift',
        defaultStart: '14:00',
        defaultEnd: '22:00'
    },
    NIGHT: {
        name: 'Night Shift',
        defaultStart: '22:00',
        defaultEnd: '06:00'
    }
};

// Initialize employee availability data structure
let employeeAvailability = {
    remainingHours: 40,
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
});

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

    // Update progress bar if remainingHours exists
    if (employeeAvailability.remainingHours !== undefined) {
        let progressBar = document.querySelector('.progress-bar');
        if (!progressBar) {
            const remainingHoursDiv = document.createElement('div');
            remainingHoursDiv.className = 'remaining-hours';
            remainingHoursDiv.innerHTML = `
                <h3>Remaining Hours: <span id="remainingHours">40</span></h3>
                <div class="progress-bar">
                    <div class="progress" style="width: 100%"></div>
                </div>
            `;
            mainContainer.insertBefore(remainingHoursDiv, mainContainer.firstChild);
            progressBar = remainingHoursDiv.querySelector('.progress-bar');
        }
        const progress = progressBar.querySelector('.progress');
        if (progress) {
            const percentage = (employeeAvailability.remainingHours / 40) * 100;
            progress.style.width = `${percentage}%`;
            progress.style.backgroundColor = percentage < 20 ? '#ff4444' : 
                                          percentage < 50 ? '#ffa700' : 
                                          '#00C851';
        }
    }

    // Create or get the availability container
    let availabilityContainer = document.querySelector('#availability-container');
    console.log('Availability container found:', availabilityContainer);
    
    if (!availabilityContainer) {
        availabilityContainer = document.createElement('div');
        availabilityContainer.id = 'availability-container';
        mainContainer.appendChild(availabilityContainer);
        console.log('Created availability container');
    }

    // Create or get the availability list
    let availabilityList = document.querySelector('.availability-list');
    console.log('Availability list found:', availabilityList);
    
    if (!availabilityList) {
        availabilityList = document.createElement('div');
        availabilityList.className = 'availability-list';
        availabilityContainer.appendChild(availabilityList);
        console.log('Created availability list');
    }

    // Create a function to safely update the list
    const safelyUpdateList = (list, content) => {
        if (list && typeof list.innerHTML !== 'undefined') {
            list.innerHTML = content;
            console.log('Safely updated list content');
            return true;
        }
        console.error('Could not update list content - list is not a valid element');
        return false;
    };

    // Update availability list if it exists
    if (employeeAvailability.availability && employeeAvailability.availability.length > 0) {
        const content = employeeAvailability.availability.map(item => `
            <div class="availability-item ${item.status.toLowerCase()}">
                <div class="availability-date">${new Date(item.startDate).toLocaleDateString()}</div>
                <div class="availability-time">
                    ${new Date(item.startDate).toLocaleTimeString()} - 
                    ${new Date(item.endDate).toLocaleTimeString()}
                </div>
                <div class="availability-shift">${item.preferredShift}</div>
                <div class="availability-status">${item.status}</div>
                ${item.note ? `<div class="availability-note">${item.note}</div>` : ''}
            </div>
        `).join('');
        
        safelyUpdateList(availabilityList, content);
    } else {
        safelyUpdateList(availabilityList, '<div class="no-availability">No availability records found.</div>');
    }
}

// Function to create the availability form if it doesn't exist
function createAvailabilityFormIfNeeded() {
    console.log('Checking for availability form');
    
    if (!document.getElementById('availabilityForm')) {
        console.log('Creating availability form');
        
        // Get or create the container
        let container = document.querySelector('#availability-container');
        if (!container) {
            const mainContainer = document.querySelector('#my-availability-tab');
            if (!mainContainer) {
                console.error('Main container not found!');
                return;
            }
            
            container = document.createElement('div');
            container.id = 'availability-container';
            mainContainer.appendChild(container);
        }
        
        // Create the form
        const form = document.createElement('form');
        form.id = 'availabilityForm';
        form.className = 'availability-form';
        
        form.innerHTML = `
            <h3>Submit Availability</h3>
            <div class="form-group date-selection">
                <label for="availability-date">Date</label>
                <input type="date" id="availability-date" required>
            </div>
            <div class="form-group">
                <label for="availability-start-time">Start Time</label>
                <input type="time" id="availability-start-time" value="06:00" required>
            </div>
            <div class="form-group">
                <label for="availability-end-time">End Time</label>
                <input type="time" id="availability-end-time" value="14:00" required>
            </div>
            <div class="form-group">
                <label for="availability-note">Notes</label>
                <textarea id="availability-note" placeholder="Add any notes about your availability"></textarea>
            </div>
            <div class="form-group checkbox-group">
                <label>
                    <input type="checkbox" id="all-day-checkbox">
                    All Day
                </label>
                <label>
                    <input type="checkbox" id="repeat-checkbox">
                    Repeat Weekly
                </label>
            </div>
            <button type="submit" class="btn-primary">Submit Availability</button>
        `;
        
        container.insertBefore(form, container.firstChild);
        console.log('Availability form created');
    }
}

function initializeAvailabilityForm() {
    console.log('Initializing availability form');

    // Check if form already exists
    if (!document.getElementById('availabilityForm')) {
        console.error('Availability form not found!');
        return;
    }

    // Check if shift type container already exists
    if (document.querySelector('.shift-type-selection')) {
        console.log('Shift type selection already exists, skipping creation');
        return;
    }

    const shiftTypeContainer = document.createElement('div');
    shiftTypeContainer.className = 'form-group';
    shiftTypeContainer.innerHTML = `
        <label>Preferred Shift Type</label>
        <div class="shift-type-selection">
            ${Object.entries(SHIFT_TYPES).map(([key, shift]) => `
                <label class="shift-type-label">
                    <input type="radio" name="shift-type" value="${key}">
                    <span>${shift.name}</span>
                    <div class="shift-time">${shift.defaultStart} - ${shift.defaultEnd}</div>
                </label>
            `).join('')}
        </div>
    `;

    // Insert the shift type selection before the date selection
    const dateSelection = document.querySelector('#availabilityForm .date-selection');
    if (dateSelection) {
        dateSelection.parentNode.insertBefore(shiftTypeContainer, dateSelection);
    } else {
        console.error('Date selection element not found!');
        document.getElementById('availabilityForm').appendChild(shiftTypeContainer);
    }

    // Add remaining hours display if it doesn't exist
    if (!document.querySelector('.remaining-hours')) {
        const mainContainer = document.querySelector('#my-availability-tab');
        if (!mainContainer) {
            console.error('Main container not found!');
            return;
        }

        const remainingHoursDiv = document.createElement('div');
        remainingHoursDiv.className = 'remaining-hours';
        remainingHoursDiv.innerHTML = `
            <h3>Remaining Hours: <span id="remainingHours">40</span></h3>
            <div class="progress-bar">
                <div class="progress" style="width: 100%"></div>
            </div>
        `;

        const availabilityHeader = document.querySelector('.availability-header');
        if (availabilityHeader) {
            mainContainer.insertBefore(remainingHoursDiv, availabilityHeader);
        } else {
            mainContainer.appendChild(remainingHoursDiv);
        }
    }
}

function setupAvailabilityListeners() {
    console.log('Setting up availability listeners');

    const availabilityForm = document.getElementById('availabilityForm');
    if (!availabilityForm) {
        console.error('Availability form not found! Cannot set up listeners.');
        return;
    }

    // Listen for shift type selection
    document.querySelectorAll('input[name="shift-type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const startTimeEl = document.getElementById('availability-start-time');
            const endTimeEl = document.getElementById('availability-end-time');
            
            if (!startTimeEl || !endTimeEl) {
                console.error('Start time or end time input not found!');
                return;
            }
            
            const selectedShift = SHIFT_TYPES[this.value];
            startTimeEl.value = selectedShift.defaultStart;
            endTimeEl.value = selectedShift.defaultEnd;
            updateAvailabilityFeedback();
        });
    });

    // Listen for time changes
    ['availability-start-time', 'availability-end-time'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateAvailabilityFeedback);
        } else {
            console.error(`Element with id ${id} not found!`);
        }
    });

    // Enhanced form submission
    availabilityForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get userInfo from localStorage
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        console.log('UserInfo:', userInfo);
        
        // Extract userId
        const userId = userInfo.userId;
        if (!userId) {
            console.error('No userId found in userInfo:', userInfo);
            alert('User ID is missing. Please log in again.');
            return;
        }
        
        // Get form values
        const date = document.getElementById('availability-date').value;
        const startTime = document.getElementById('availability-start-time').value;
        const endTime = document.getElementById('availability-end-time').value;
        const shiftType = document.querySelector('input[name="shift-type"]:checked')?.value;
        const note = document.getElementById('availability-note').value;
        const isAllDay = document.getElementById('all-day-checkbox').checked;
        const isRepeat = document.getElementById('repeat-checkbox').checked;
        
        // Validate required fields
        if (!date || !startTime || !endTime || !shiftType) {
            const missingFields = [];
            if (!date) missingFields.push('date');
            if (!startTime) missingFields.push('start time');
            if (!endTime) missingFields.push('end time');
            if (!shiftType) missingFields.push('shift type');
            
            alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
            return;
        }
        
        // Prepare form data
        const formData = {
            employeeId: userId,
            date,
            startTime,
            endTime,
            shiftType,
            note,
            isAllDay,
            isRepeat
        };
        
        // Submit the form
        try {
            console.log('Submitting availability with data:', formData);
            const response = await fetch('/api/availability/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const responseData = await response.json();
            console.log('Server response:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || responseData.details || 'Failed to save availability');
            }

            updateEmployeeAvailability(responseData);
            closeAvailabilityModal();
            updateAvailabilityDisplay();
        } catch (error) {
            console.error('Error saving availability:', {
                message: error.message,
                stack: error.stack,
                formData: formData
            });
            alert(`Failed to save availability: ${error.message}`);
        }
    });
}

function updateAvailabilityFeedback() {
    console.log('Updating availability feedback');
    
    const startTimeEl = document.getElementById('availability-start-time');
    const endTimeEl = document.getElementById('availability-end-time');
    const shiftTypeChecked = document.querySelector('input[name="shift-type"]:checked');
    
    if (!startTimeEl || !endTimeEl) {
        console.error('Start time or end time input not found!');
        return;
    }
    
    const startTime = startTimeEl.value;
    const endTime = endTimeEl.value;
    const selectedShift = shiftTypeChecked?.value;

    if (!startTime || !endTime || !selectedShift) {
        console.log('Missing required feedback data', { startTime, endTime, selectedShift });
        return;
    }

    const feedbackContainer = document.querySelector('.availability-feedback') || 
        createFeedbackContainer();

    // Calculate hours
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    if (end < start) end.setDate(end.getDate() + 1);
    const hours = (end - start) / (1000 * 60 * 60);

    // Update feedback
    feedbackContainer.innerHTML = `
        <div class="feedback-item ${hours <= employeeAvailability.remainingHours ? 'valid' : 'invalid'}">
            <i class="fas fa-clock"></i>
            <span>Shift Duration: ${hours} hours</span>
            ${hours > employeeAvailability.remainingHours ? 
                `<span class="warning">Exceeds remaining hours (${employeeAvailability.remainingHours})</span>` : 
                ''}
        </div>
        <div class="feedback-item">
            <i class="fas fa-info-circle"></i>
            <span>Selected: ${SHIFT_TYPES[selectedShift].name}</span>
        </div>
    `;
}

function createFeedbackContainer() {
    console.log('Creating feedback container');
    
    const availabilityForm = document.getElementById('availabilityForm');
    if (!availabilityForm) {
        console.error('Availability form not found! Cannot create feedback container.');
        return document.createElement('div'); // Return empty div to prevent errors
    }
    
    const container = document.createElement('div');
    container.className = 'availability-feedback';
    
    // Simply append to the form before the submit button
    const submitButton = availabilityForm.querySelector('button[type="submit"]');
    if (submitButton) {
        // Insert before the button
        availabilityForm.insertBefore(container, submitButton);
        console.log('Inserted feedback container before submit button');
    } else {
        // If no submit button, just append at the end
        availabilityForm.appendChild(container);
        console.log('Appended feedback container to form');
    }
    
    return container;
}

function closeAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load employee availability from API
async function loadEmployeeAvailability() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.userId) {
            console.error('No userId found in userInfo:', userInfo);
            return;
        }

        const response = await fetch(`/api/availability/employee/${userInfo.userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Retrieved employee availability data:', data);
            
            // Ensure all required properties exist
            employeeAvailability = {
                remainingHours: data.remainingHours || 40,
                availability: data.availability || []
            };
            
            console.log('Processed employee availability data:', employeeAvailability);
            updateAvailabilityDisplay();
        } else if (response.status === 401) {
            // Unauthorized - redirect to login
            window.location.href = '/login.html';
        } else {
            console.error('Error loading employee availability:', response.status, response.statusText);
            // Initialize with default values
            employeeAvailability = {
                remainingHours: 40,
                availability: []
            };
            updateAvailabilityDisplay();
        }
    } catch (error) {
        console.error('Error loading employee availability:', error);
        // Initialize with default values on error
        employeeAvailability = {
            remainingHours: 40,
            availability: []
        };
        updateAvailabilityDisplay();
    }
}

function updateEmployeeAvailability(data) {
    employeeAvailability = {
        remainingHours: data.remainingHours || 40,
        availability: data.availability || []
    };
    updateAvailabilityDisplay();
}

// function to format time
function formatTime(timeString) {
    try {
        const date = new Date(timeString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('Error formatting time:', error);
        return timeString; // Return original string if parsing fails
    }
} 