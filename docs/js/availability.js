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

// Add CSS for used-hours span
const usedHoursStyle = document.createElement('style');
usedHoursStyle.textContent = `
    .used-hours {
        font-size: 0.85em;
        color: #666;
        margin-left: 8px;
    }
    .progress-container {
        margin-top: 8px;
        margin-bottom: 16px;
    }
`;
document.head.appendChild(usedHoursStyle);

// Initialize employee availability data structure
let employeeAvailability = {
    remainingHours: 40,
    availability: []
    // Removed suggestedShifts as it's not used
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

    // Update progress bar if remainingHours exists
    if (employeeAvailability.remainingHours !== undefined) {
        try {
            // Ensure remainingHours is a valid number
            let remainingHours = parseFloat(employeeAvailability.remainingHours);
            if (isNaN(remainingHours) || remainingHours < 0) {
                console.warn('Invalid remaining hours value:', employeeAvailability.remainingHours);
                remainingHours = 0;
            } else if (remainingHours > 40) {
                console.warn('Unexpected high remaining hours value:', remainingHours);
                remainingHours = 40;
            }
            
            // Round to 2 decimal places for display
            remainingHours = parseFloat(remainingHours.toFixed(2));
            employeeAvailability.remainingHours = remainingHours;
            
            const totalHours = 40;
            const usedHours = parseFloat((totalHours - remainingHours).toFixed(2));
            
            console.log('Hours calculation:', {
                totalHours,
                remainingHours,
                usedHours
            });
            
            let progressBarContainer = document.querySelector('.remaining-hours');
            if (!progressBarContainer) {
                progressBarContainer = document.createElement('div');
                progressBarContainer.className = 'remaining-hours';
                progressBarContainer.innerHTML = `
                    <h3>Hours: <span id="remainingHours">${remainingHours}</span> of ${totalHours} remaining</h3>
                    <div class="progress-container" style="width: 100%; background-color: #f5f5f5; height: 20px; border-radius: 4px; position: relative; overflow: hidden;">
                    </div>
                `;
                mainContainer.insertBefore(progressBarContainer, mainContainer.firstChild);
                
                // Create the progress element
                const progressContainer = progressBarContainer.querySelector('.progress-container');
                const progressElement = document.createElement('div');
                progressElement.className = 'progress-bar';
                progressElement.style.cssText = `
                    position: absolute;
                    height: 100%;
                    top: 0;
                    left: 0;
                    background-color: #00C851;
                    transition: width 0.3s ease;
                `;
                progressContainer.appendChild(progressElement);
            }
            
            // Update the progress bar width
            document.getElementById('remainingHours').textContent = remainingHours;
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                // Add used hours to the display
                const hoursDisplay = document.querySelector('.remaining-hours h3');
                if (hoursDisplay) {
                    hoursDisplay.innerHTML = `Hours: <span id="remainingHours">${remainingHours}</span> of ${totalHours} remaining <span class="used-hours">(${usedHours} used)</span>`;
                }
                
                // Calculate the percentage to fill the bar with remaining hours
                // Ensure the percentage is between 0 and 100
                const percentage = Math.max(0, Math.min(100, (remainingHours / totalHours) * 100));
                progressBar.style.width = `${percentage}%`;
                
                // Update color based on remaining hours
                progressBar.style.backgroundColor = percentage < 20 ? '#ff4444' : 
                                                  percentage < 50 ? '#ffa700' : 
                                                  '#00C851';
            }
        } catch (error) {
            console.error('Error updating progress bar:', error);
        }
    }

    // CRITICAL: Create or get the availability container
    let availabilityContainer = document.querySelector('#availability-container');
    console.log('Availability container found:', availabilityContainer);
    
    if (!availabilityContainer) {
        availabilityContainer = document.createElement('div');
        availabilityContainer.id = 'availability-container';
        mainContainer.appendChild(availabilityContainer);
        console.log('Created availability container');
    }

    // CRITICAL: Create or get the availability list
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
            <h3>Hours: <span id="remainingHours">${employeeAvailability.remainingHours}</span> of 40 remaining</h3>
            <div class="progress-container" style="width: 100%; background-color: #f5f5f5; height: 20px; border-radius: 4px; position: relative; overflow: hidden;">
            </div>
        `;

        // Create the progress element
        const progressContainer = remainingHoursDiv.querySelector('.progress-container');
        const progressElement = document.createElement('div');
        progressElement.className = 'progress-bar';
        progressElement.style.cssText = `
            position: absolute;
            height: 100%;
            top: 0;
            left: 0;
            background-color: #00C851;
            transition: width 0.3s ease;
            width: ${(employeeAvailability.remainingHours / 40) * 100}%;
        `;
        progressContainer.appendChild(progressElement);

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
        
        try {
            // Get user info from localStorage
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            if (!userInfo.userId) {
                throw new Error('User not logged in');
            }

            // Get form values
            const date = document.getElementById('availability-date').value;
            const startTime = document.getElementById('availability-start-time').value;
            const endTime = document.getElementById('availability-end-time').value;
            const shiftType = document.querySelector('input[name="shift-type"]:checked')?.value;
            const note = document.getElementById('availability-note').value;
            
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
                employeeId: userInfo.userId,
                startDate: `${date}T${startTime}:00`,
                endDate: `${date}T${endTime}:00`,
                preferredShift: SHIFT_TYPES[shiftType].name,
                note: note
            };

            // Submit availability
            await submitAvailability(formData);
            
            // Show success message
            alert('Availability submitted successfully!');
            
            // Close modal and refresh display
            closeAvailabilityModal();
            await loadEmployeeAvailability();
            
        } catch (error) {
            console.error('Error in form submission:', error);
            alert(error.message || 'Failed to submit availability');
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
    try {
        // Use a fixed date (2000-01-01) for consistent calculation
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        
        // Validate date objects
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Invalid time format:', { startTime, endTime, start, end });
            feedbackContainer.innerHTML = `
                <div class="feedback-item invalid">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Invalid time format</span>
                </div>
            `;
            return;
        }
        
        // If end time is earlier than start time, assume it's the next day
        let hours;
        if (end < start) {
            const endNextDay = new Date(end);
            endNextDay.setDate(endNextDay.getDate() + 1);
            hours = (endNextDay - start) / (1000 * 60 * 60);
        } else {
            hours = (end - start) / (1000 * 60 * 60);
        }
        
        // Validate calculated hours
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            console.error('Invalid hours calculated:', { startTime, endTime, hours });
            hours = 0;
        }
        
        console.log('Calculated shift duration:', { 
            startTime, 
            endTime, 
            hours: hours.toFixed(2), 
            remainingHours: employeeAvailability.remainingHours 
        });
        
        // Round to 2 decimal places for display
        const formattedHours = hours.toFixed(2);
        const remainingHours = parseFloat(employeeAvailability.remainingHours.toFixed(2));
        
        // Check if the shift duration fits within the employee's available hours
        const fitsWithinHours = hours <= remainingHours;

        // Update feedback
        feedbackContainer.innerHTML = `
            <div class="feedback-item ${fitsWithinHours ? 'valid' : 'invalid'}">
                <i class="fas fa-clock"></i>
                <span>Shift Duration: ${formattedHours} hours</span>
                ${!fitsWithinHours ? 
                    `<span class="warning">Exceeds remaining hours (${remainingHours})</span>` : 
                    ''}
            </div>
            <div class="feedback-item">
                <i class="fas fa-info-circle"></i>
                <span>Selected: ${SHIFT_TYPES[selectedShift].name}</span>
            </div>
        `;
    } catch (error) {
        console.error('Error calculating shift duration:', error);
        feedbackContainer.innerHTML = `
            <div class="feedback-item invalid">
                <i class="fas fa-exclamation-circle"></i>
                <span>Error calculating shift duration</span>
            </div>
        `;
    }
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

// Function to submit availability
async function submitAvailability(formData) {
    try {
        const response = await fetch('/api/availability/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
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
        remainingHours: data.remainingHours || 40,
        availability: data.availability || []
    };
    updateAvailabilityDisplay();
    
    // Dispatch an event to notify that availability has been updated
    const event = new CustomEvent('availability-updated', {
        detail: { remainingHours: employeeAvailability.remainingHours }
    });
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

        const response = await fetch(`/api/availability/employee/${userInfo.userId}`, {
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
        // Don't show alert as this might be called silently in background
        return null;
    }
}

// Helper function to format time
function formatTime(timeString) {
    try {
        const date = new Date(timeString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('Error formatting time:', error);
        return timeString; // Return original string if parsing fails
    }
} 