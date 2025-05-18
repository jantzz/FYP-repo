// Manager functionality for handling availability requests
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is manager or admin
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();

    // Reset manager visibility
    document.body.classList.remove('manager-visible');
    
    // For managers only (not admin), add manager-visible class
    if (userRole === 'manager') {
        document.body.classList.add('manager-visible');
        
        // Set up tab switching
        setupTabSwitching();
    } 
    // For admins, don't add manager visibility
    else if (userRole === 'admin') {
        // Do not add manager-visible class
        // Admin should only see employee, department, and clinic management
    } 
    // Regular employee
    else {
        // Hide manager sections
        document.body.classList.remove('manager-visible');
    }
});

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
            } else {
                console.error(`Tab pane not found for ${tabId}`);
            }
        });
    });
} 