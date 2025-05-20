// Department Management JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Set API base URL if not already set
    window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/api';
    
    // Debug flag - set to true to enable debug logs
    window.DEPARTMENT_DEBUG = true;
    
    // Helper function for debug logging
    function debugLog(...args) {
        if (window.DEPARTMENT_DEBUG) {
            console.log('[DEPARTMENT DEBUG]', ...args);
        }
    }
    
    // Elements
    const departmentManagementNav = document.getElementById('department-management-nav');
    const departmentManagementSection = document.querySelector('.department-management-section');
    const addDepartmentBtn = document.getElementById('add-department-btn');
    const addDepartmentModal = document.getElementById('add-department-modal');
    const editDepartmentModal = document.getElementById('edit-department-modal');
    const addDepartmentForm = document.getElementById('add-department-form');
    const editDepartmentForm = document.getElementById('edit-department-form');
    const departmentsTableBody = document.getElementById('departments-table-body');
    
    // Check if we should auto-show the department section (e.g., if URL has a marker)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('show') && urlParams.get('show') === 'departments') {
        showDepartmentManagementSection();
        loadDepartments();
    }
    
    // Add event listeners
    if (departmentManagementNav) {
        departmentManagementNav.addEventListener('click', function() {
            showDepartmentManagementSection();
            loadDepartments();
        });
    }
    
    // Modal functionality
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener('click', function() {
            showAddDepartmentModal();
        });
    }
    
    // Close modals on X click
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Form submissions
    if (addDepartmentForm) {
        addDepartmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addDepartment();
        });
    }
    
    if (editDepartmentForm) {
        editDepartmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateDepartment();
        });
    }
    
    // Function to hide department management section
    function hideDepartmentManagementSection() {
        if (departmentManagementSection) {
            departmentManagementSection.style.display = 'none';
            debugLog('Hiding department management section');
        }
    }
    
    // Function to show department management section
    function showDepartmentManagementSection() {
        // Hide all content in main-content
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) {
            console.error('Could not find .main-content element');
            return;
        }
        
        // Define specific sections to hide (more targeted approach)
        const sectionsToHide = [
            '.calendar-section', 
            '.upcoming-shifts-section', 
            '.reports-section',
            '.attendance-section',
            '.payroll-section',
            '.employee-management-section',
            '.timeoff-section',
            '.availability-section',
            '.generate-shifts-section',
            '.approve-shifts-section',
            '.clinic-management-section'
        ];
        
        // Hide all known section types
        sectionsToHide.forEach(sectionSelector => {
            const section = mainContent.querySelector(sectionSelector);
            if (section) {
                section.style.display = 'none';
            }
        });
        
        // Show department management section
        if (departmentManagementSection) {
            departmentManagementSection.style.display = 'block';
            debugLog('Displaying department management section');
        } else {
            console.error('departmentManagementSection element not found');
            
            // Try to find it another way as a fallback
            const altSection = document.querySelector('[class*="department-management"]');
            if (altSection) {
                altSection.style.display = 'block';
                debugLog('Found and displayed alternative department section element');
            } else {
                console.error('Could not find any department management section element');
            }
        }
        
        // Update active nav item
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        if (departmentManagementNav) {
            departmentManagementNav.classList.add('active');
        }
        
        // Update content header
        const contentHeader = document.querySelector('.content-header h1');
        if (contentHeader) {
            contentHeader.textContent = 'Department Management';
        }
    }
    
    // Function to load departments
    async function loadDepartments() {
        if (!departmentsTableBody) {
            console.error('departmentsTableBody element not found, cannot display departments');
            return;
        }
        
        try {
            debugLog('Starting to load departments...');
            departmentsTableBody.innerHTML = '<tr><td colspan="4" class="loading-message">Loading departments data...</td></tr>';
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('Authentication token not found');
                departmentsTableBody.innerHTML = '<tr><td colspan="4" class="error-message">Authentication failed. Please log in again.</td></tr>';
                return;
            }
            
            // Use the correct path with API_BASE_URL from window
            const baseUrl = window.API_BASE_URL || '/api'; 
            const endpoint = `${baseUrl}/department/getDepartments`;
            debugLog('Fetching departments from:', endpoint);
            
            // Implement timeout for the fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            try {
                debugLog('Initiating fetch request...');
                const startTime = Date.now();
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const requestTime = Date.now() - startTime;
                debugLog(`Fetch completed in ${requestTime}ms with status:`, response.status);
                
                if (!response.ok) {
                    let errorMessage;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorData.error || `${response.status} ${response.statusText}`;
                        debugLog('Error response (JSON):', errorData);
                    } catch (e) {
                        const errorText = await response.text();
                        console.error('Error response from department API (text):', errorText);
                        errorMessage = `${response.status} ${response.statusText}`;
                        debugLog('Error response (Text):', errorText);
                    }
                    
                    throw new Error(`Error fetching departments: ${errorMessage}`);
                }
                
                debugLog('Parsing response body...');
                const departments = await response.json();
                debugLog('Received departments data:', departments);
                
                if (!departments) {
                    throw new Error('Received invalid department data (null or undefined)');
                }
                
                if (!Array.isArray(departments)) {
                    throw new Error('Received invalid department data format - expected array');
                }
                
                if (departments.length > 0) {
                    debugLog(`Successfully loaded ${departments.length} departments`);
                    displayDepartments(departments);
                } else {
                    debugLog('No departments found in response');
                    departmentsTableBody.innerHTML = '<tr><td colspan="4" class="empty-message">No departments found. Click "Add New Department" to create one.</td></tr>';
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    debugLog('Fetch request timed out');
                    throw new Error('Request timed out. Server may be unavailable.');
                }
                debugLog('Fetch error:', fetchError);
                throw fetchError;
            }
        } catch (error) {
            console.error('Error loading departments:', error);
            debugLog('Error in loadDepartments():', error);
            let errorMessage = error.message;
            
            // Provide more user-friendly error messages for common issues
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message.includes('401')) {
                errorMessage = 'Your session has expired. Please log in again.';
            } else if (error.message.includes('403')) {
                errorMessage = 'You do not have permission to view departments.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error. Please try again later or contact support.';
            } else if (error.message.includes('404')) {
                errorMessage = 'Department API endpoint not found. Contact your administrator.';
            }
            
            departmentsTableBody.innerHTML = `<tr><td colspan="4" class="error-message">Error loading departments: ${errorMessage}</td></tr>`;
        }
    }
    
    // Function to display departments
    function displayDepartments(departments) {
        if (!departmentsTableBody) {
            console.error('departmentsTableBody element not found');
            return;
        }
        
        departmentsTableBody.innerHTML = '';
        
        if (!Array.isArray(departments) || departments.length === 0) {
            departmentsTableBody.innerHTML = '<tr><td colspan="4" class="empty-message">No departments found. Click "Add New Department" to create one.</td></tr>';
            return;
        }
        
        departments.forEach(department => {
            const row = document.createElement('tr');
            
            // Get employee count - handle different property formats
            const employeeCount = department.employeeCount || 0;
            
            // Handle department name which could be in different formats
            const departmentName = department.name || department.departmentName || 'N/A';
            
            row.innerHTML = `
                <td>${departmentName}</td>
                <td>${department.description || '-'}</td>
                <td>${employeeCount}</td>
                <td class="actions">
                    <button class="edit-btn" data-name="${departmentName}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" data-name="${departmentName}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            departmentsTableBody.appendChild(row);
        });
        
        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const departmentName = this.getAttribute('data-name');
                openEditDepartmentModal(departmentName);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const departmentName = this.getAttribute('data-name');
                if (confirm(`Are you sure you want to delete the department "${departmentName}"?`)) {
                    deleteDepartment(departmentName);
                }
            });
        });
    }
    
    // Function to add a new department
    async function addDepartment() {
        try {
            const formData = new FormData(addDepartmentForm);
            const departmentData = {
                name: formData.get('name'),
                description: formData.get('description')
            };
            
            debugLog('Adding new department with data:', departmentData);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            // Use the correct path with API_BASE_URL from window
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/department/createDepartment`;
            debugLog('POST request to:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(departmentData)
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Add department request completed in ${requestTime}ms with status:`, response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from add department:', errorData);
                throw new Error(errorData.message || 'Failed to add department');
            }
            
            const result = await response.json();
            debugLog('Department added successfully:', result);
            
            // Close modal and reset form
            addDepartmentModal.style.display = 'none';
            addDepartmentForm.reset();
            
            // Show success message
            alert('Department added successfully');
            
            // Reload departments
            loadDepartments();
            
        } catch (error) {
            console.error('Error adding department:', error);
            debugLog('Error in addDepartment():', error);
            alert(`Error adding department: ${error.message}`);
        }
    }
    
    // Function to open edit department modal
    async function openEditDepartmentModal(departmentName) {
        try {
            debugLog('Opening edit modal for department:', departmentName);
            
            if (!departmentName) {
                throw new Error('Department name is required');
            }
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            // Use the direct department endpoint to get exact department details
            const endpoint = `${baseUrl}/department/${encodeURIComponent(departmentName)}`;
            debugLog('Fetching department details from:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Fetch department details completed in ${requestTime}ms with status:`, response.status);
            
            if (response.status === 404) {
                throw new Error('Department not found. It may have been deleted.');
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error fetching department details: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const department = await response.json();
            debugLog('Fetched department details:', department);
            
            if (department) {
                // Populate form fields
                document.getElementById('edit-department-id').value = department.departmentName;
                document.getElementById('edit-department-name').value = department.departmentName;
                document.getElementById('edit-department-description').value = department.description || '';
                
                // Hide manager dropdown section if present
                const managerField = document.getElementById('edit-department-manager')?.closest('.form-group');
                if (managerField) {
                    managerField.style.display = 'none';
                }
                
                // Show modal
                editDepartmentModal.style.display = 'block';
            } else {
                debugLog('Department data is empty for:', departmentName);
                alert('Department details could not be loaded');
            }
        } catch (error) {
            console.error('Error fetching department details:', error);
            debugLog('Error in openEditDepartmentModal():', error);
            alert(error.message);
        }
    }
    
    // Function to update a department
    async function updateDepartment() {
        try {
            const formData = new FormData(editDepartmentForm);
            const originalName = formData.get('departmentId');
            const newName = formData.get('name');
            const description = formData.get('description');
            
            if (!originalName) {
                throw new Error('Original department name is missing');
            }
            
            if (!newName) {
                throw new Error('Department name cannot be empty');
            }
            
            const departmentData = {
                originalName: originalName,
                name: newName,
                description: description || ''
            };
            
            debugLog('Updating department with data:', departmentData);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/department/updateDepartment`;
            debugLog('PUT request to:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(departmentData)
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Update department request completed in ${requestTime}ms with status:`, response.status);
            
            if (response.status === 404) {
                throw new Error(`Department "${originalName}" not found. It may have been deleted.`);
            }
            
            if (response.status === 400) {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes("already exists")) {
                    throw new Error(`Department name "${newName}" already exists. Please choose a different name.`);
                }
                throw new Error(errorData.error || 'Bad request');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from update department:', errorData);
                throw new Error(errorData.message || errorData.error || 'Failed to update department');
            }
            
            const result = await response.json();
            debugLog('Department updated successfully:', result);
            
            // Close modal
            editDepartmentModal.style.display = 'none';
            
            // Show success message
            alert(`Department updated successfully from "${originalName}" to "${newName}"`);
            
            // Reload departments
            loadDepartments();
            
        } catch (error) {
            console.error('Error updating department:', error);
            debugLog('Error in updateDepartment():', error);
            alert(`Error updating department: ${error.message}`);
        }
    }
    
    // Function to delete a department
    async function deleteDepartment(departmentName) {
        try {
            debugLog('Deleting department with name:', departmentName);
            
            if (!departmentName) {
                throw new Error('Department name is required for deletion');
            }
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const encodedName = encodeURIComponent(departmentName);
            const endpoint = `${baseUrl}/department/deleteDepartment/${encodedName}`;
            debugLog('DELETE request to:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Delete department request completed in ${requestTime}ms with status:`, response.status);
            
            if (response.status === 404) {
                throw new Error(`Department "${departmentName}" not found. It may have been already deleted.`);
            }
            
            if (response.status === 400) {
                const errorData = await response.json();
                if (errorData.error && errorData.error.includes("employees")) {
                    throw new Error(`Cannot delete department "${departmentName}" as it has employees assigned to it. Please reassign employees first.`);
                }
                throw new Error(errorData.error || 'Bad request');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from delete department:', errorData);
                throw new Error(errorData.message || 'Failed to delete department');
            }
            
            const result = await response.json();
            debugLog('Department deleted successfully:', result);
            
            // Show success message
            alert(`Department "${departmentName}" deleted successfully`);
            
            // Reload departments
            loadDepartments();
        } catch (error) {
            console.error('Error deleting department:', error);
            debugLog('Error in deleteDepartment():', error);
            alert(`Error deleting department: ${error.message}`);
        }
    }
    
    // Function to show add department modal
    function showAddDepartmentModal() {
        addDepartmentForm.reset();
        
        // Hide manager dropdown section if present
        const managerField = document.getElementById('department-manager')?.closest('.form-group');
        if (managerField) {
            managerField.style.display = 'none';
        }
        
        addDepartmentModal.style.display = 'block';
    }
    
    // Function to load managers for dropdown - Now optional and won't cause problems if it fails
    async function loadManagersForDropdown(dropdownId, selectedManagerId = null) {
        try {
            const managerDropdown = document.getElementById(dropdownId);
            if (!managerDropdown) {
                debugLog(`Dropdown with ID ${dropdownId} not found, skipping manager load`);
                return;
            }
            
            // Hide the dropdown's container element since we don't need it
            const formGroup = managerDropdown.closest('.form-group');
            if (formGroup) {
                formGroup.style.display = 'none';
                debugLog('Hiding manager dropdown as it is not needed');
                return;
            }
            
            // The rest of the function will be skipped since we're hiding the manager dropdown
            // But we keep it for future use if managers are needed later
            
            // Clear existing options except the first one
            while (managerDropdown.options.length > 1) {
                managerDropdown.remove(1);
            }
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/user/getManagerUsers`;
            
            debugLog('Attempting to fetch managers (optional)');
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                debugLog(`Manager API not available (status ${response.status}), proceeding without managers`);
                return; // Just return without throwing an error since managers are optional
            }
            
            const managers = await response.json();
            debugLog('Fetched managers for dropdown:', managers);
            
            // Add manager options to dropdown
            managers.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.userId;
                option.textContent = manager.name;
                
                // Set as selected if matching the selectedManagerId
                if (selectedManagerId && manager.userId == selectedManagerId) {
                    option.selected = true;
                }
                
                managerDropdown.appendChild(option);
            });
            
        } catch (error) {
            // Log the error but don't propagate it since managers are optional
            console.error('Error loading managers for dropdown:', error);
            debugLog('Error in loadManagersForDropdown() (non-critical):', error);
        }
    }
}); 