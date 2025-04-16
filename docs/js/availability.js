// Shift types and their time ranges
const SHIFT_TYPES = {
    MORNING: {
        name: 'Morning Shift',
        defaultStart: '06:00',
        defaultEnd: '14:00',
        displayTime: '6:00 AM - 2:00 PM'
    },
    AFTERNOON: {
        name: 'Afternoon Shift',
        defaultStart: '14:00',
        defaultEnd: '22:00',
        displayTime: '2:00 PM - 10:00 PM'
    },
    NIGHT: {
        name: 'Night Shift',
        defaultStart: '22:00',
        defaultEnd: '06:00',
        displayTime: '10:00 PM - 6:00 AM'
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
            }
        } catch (e) {
            console.error('Error updating progress bar:', e);
        }
    }
    
    // Get availability list container
    let availabilityList = document.querySelector('.availability-list');
    if (!availabilityList) {
        const availabilityContainer = document.querySelector('#availability-container') || document.createElement('div');
        availabilityContainer.id = 'availability-container';
        
        if (!availabilityContainer.parentNode) {
            mainContainer.appendChild(availabilityContainer);
        }
        
        availabilityList = document.createElement('div');
        availabilityList.className = 'availability-list';
        availabilityContainer.appendChild(availabilityList);
    }
    
    // Helper function to safely update list content
    const safelyUpdateList = (list, content) => {
        if (list) {
            list.innerHTML = content;
        } else {
            console.error('Cannot find availability list element to update');
        }
    };

    // Parse preferred dates for display
    const getPreferredDatesDisplay = (preferredDates) => {
        if (!preferredDates) return 'No dates specified';
        
        // Format M,W,F style codes into readable text
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
    };
    
    // Update availability list content
    if (employeeAvailability.availability && employeeAvailability.availability.length) {
        console.log('Updating availability list with:', employeeAvailability.availability);
        
        const availabilityContent = employeeAvailability.availability.map(item => {
            // Format the date for display
            const submittedDate = new Date(item.submittedAt);
            const formattedDate = submittedDate.toLocaleDateString();
            
            // Get status class for color coding
            const statusClass = item.status === 'Approved' 
                ? 'status-approved' 
                : item.status === 'Declined' 
                    ? 'status-declined' 
                    : 'status-pending';
            
            return `
                <div class="availability-item ${item.isCurrentWeek ? 'current-week' : ''}">
                    <div class="availability-header">
                        <span class="availability-date">${formattedDate}</span>
                        <span class="availability-status ${statusClass}">${item.status}</span>
                    </div>
                    <div class="availability-details">
                        <p><strong>Preferred Days:</strong> ${getPreferredDatesDisplay(item.preferredDates)}</p>
                        <p><strong>Hours:</strong> ${item.hours}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        safelyUpdateList(availabilityList, availabilityContent);
    } else {
        safelyUpdateList(availabilityList, '<p class="no-availability">No availability records found. Submit your availability using the form below.</p>');
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
    console.log('Setting up availability listeners');

    // Form submission listener
    const availabilityForm = document.getElementById('availability-form');
    if (availabilityForm) {
        availabilityForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const hours = document.getElementById('availability-hours').value;
            const note = document.getElementById('availability-note').value;
            
            // Get selected days
            const selectedDays = [];
            document.querySelectorAll('input[name="preferredDays"]:checked').forEach(checkbox => {
                selectedDays.push(checkbox.value);
            });
            
            if (selectedDays.length === 0) {
                alert('Please select at least one day');
                return;
            }
            
            if (!hours || isNaN(hours) || hours <= 0) {
                alert('Please enter valid hours');
                return;
            }
            
            try {
                // Submit button
                const submitButton = document.getElementById('submit-availability');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = 'Submitting...';
                }
                
                // Create form data
                const formData = {
                    preferredDays: selectedDays,
                    hours: parseFloat(hours),
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
                
                // Reset submit button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = 'Submit Availability';
                }
                
            } catch (error) {
                console.error('Error submitting availability:', error);
                alert(`Failed to submit availability: ${error.message}`);
                
                // Reset submit button
                const submitButton = document.getElementById('submit-availability');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = 'Submit Availability';
                }
            }
        });
    }
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
                    <label for="availability-hours">Hours:</label>
                    <input type="number" id="availability-hours" min="1" max="40" step="0.5" required>
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
        // Convert form data format to match backend schema
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        // Format into the schema needed for the backend
        const requestData = {
            employeeId: userInfo.userId,
            preferredDates: formData.preferredDays.join(','), // convert array to comma-separated string
            hours: formData.hours
        };
        
        console.log('Submitting availability data:', requestData);
        
        const response = await fetch('http://localhost:8800/api/availability/submit', {
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

        const response = await fetch(`http://localhost:8800/api/availability/employee/${userInfo.userId}`, {
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