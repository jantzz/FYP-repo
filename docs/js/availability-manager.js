// Manager functionality for handling availability requests
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is manager or admin
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const userRole = (userInfo.role || '').toLowerCase();

    // Add manager-visible class to body if user is manager or admin
    if (userRole === 'manager' || userRole === 'admin') {
        document.body.classList.add('manager-visible');
        
        // Set up tab switching
        setupTabSwitching();
    } else {
        // Hide manager sections if not a manager
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