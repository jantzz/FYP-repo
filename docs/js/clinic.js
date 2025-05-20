// Clinic Management JavaScript
 
document.addEventListener('DOMContentLoaded', function() {
    // Set API base URL if not already set
    window.API_BASE_URL = window.API_BASE_URL || 'https://emp-roster-backend.onrender.com/api';
    
    // Debug flag - set to true to enable debug logs
    window.CLINIC_DEBUG = true;
    
    // Helper function for debug logging
    function debugLog(...args) {
        if (window.CLINIC_DEBUG) {
            console.log('[CLINIC DEBUG]', ...args);
        }
    }
    
    // Elements
    const clinicManagementNav = document.getElementById('clinic-management-nav');
    const clinicManagementSection = document.querySelector('.clinic-management-section');
    const addClinicBtn = document.getElementById('add-clinic-btn');
    const addClinicModal = document.getElementById('add-clinic-modal');
    const editClinicModal = document.getElementById('edit-clinic-modal');
    const addClinicForm = document.getElementById('add-clinic-form');
    const editClinicForm = document.getElementById('edit-clinic-form');
    const clinicsTableBody = document.getElementById('clinics-table-body');
    const clinicFilter = document.getElementById('clinic-filter');
    
    // Check if we should auto-show the clinic section (e.g., if URL has a marker)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('show') && urlParams.get('show') === 'clinics') {
        showClinicManagementSection();
        loadClinics();
    }
    
    // Add event listeners
    if (clinicManagementNav) {
        clinicManagementNav.addEventListener('click', function() {
            showClinicManagementSection();
            loadClinics();
        });
    }
    
    // Modal functionality
    if (addClinicBtn) {
        addClinicBtn.addEventListener('click', function() {
            showAddClinicModal();
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
    if (addClinicForm) {
        addClinicForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addClinic();
        });
    }
    
    if (editClinicForm) {
        editClinicForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateClinic();
        });
    }
    
    // Function to show clinic management section
    function showClinicManagementSection() {
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
            '.department-management-section'
        ];
        
        // Hide all known section types
        sectionsToHide.forEach(sectionSelector => {
            const section = mainContent.querySelector(sectionSelector);
            if (section) {
                section.style.display = 'none';
            }
        });
        
        // Show clinic management section
        if (clinicManagementSection) {
            clinicManagementSection.style.display = 'block';
            debugLog('Displaying clinic management section');
        } else {
            console.error('clinicManagementSection element not found');
            
            // Try to find it another way as a fallback
            const altSection = document.querySelector('[class*="clinic-management"]');
            if (altSection) {
                altSection.style.display = 'block';
                debugLog('Found and displayed alternative clinic section element');
            } else {
                console.error('Could not find any clinic management section element');
            }
        }
        
        // Update active nav item
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        if (clinicManagementNav) {
            clinicManagementNav.classList.add('active');
        }
        
        // Update content header
        const contentHeader = document.querySelector('.content-header h1');
        if (contentHeader) {
            contentHeader.textContent = 'Clinic Management';
        }
    }
    
    // Function to load clinics
    async function loadClinics() {
        if (!clinicsTableBody) {
            console.error('clinicsTableBody element not found, cannot display clinics');
            return;
        }
        
        try {
            debugLog('Starting to load clinics...');
            clinicsTableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Loading clinics data...</td></tr>';
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('Authentication token not found');
                clinicsTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Authentication failed. Please log in again.</td></tr>';
                return;
            }
            
            // Use the correct path with API_BASE_URL from window
            const baseUrl = window.API_BASE_URL || '/api'; 
            const endpoint = `${baseUrl}/clinic/getClinics`;
            debugLog('Fetching clinics from:', endpoint);
            
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
                        console.error('Error response from clinic API (text):', errorText);
                        errorMessage = `${response.status} ${response.statusText}`;
                        debugLog('Error response (Text):', errorText);
                    }
                    
                    throw new Error(`Error fetching clinics: ${errorMessage}`);
                }
                
                debugLog('Parsing response body...');
                const clinics = await response.json();
                debugLog('Received clinics data:', clinics);
                
                if (clinics && Array.isArray(clinics) && clinics.length > 0) {
                    debugLog(`Successfully loaded ${clinics.length} clinics`);
                displayClinics(clinics);
            } else {
                    debugLog('No clinics found in response');
                    clinicsTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">No clinics found. Click "Add New Clinic" to create one.</td></tr>';
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
            console.error('Error loading clinics:', error);
            debugLog('Error in loadClinics():', error);
            let errorMessage = error.message;
            
            // Provide more user-friendly error messages for common issues
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message.includes('401')) {
                errorMessage = 'Your session has expired. Please log in again.';
            } else if (error.message.includes('403')) {
                errorMessage = 'You do not have permission to view clinics.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error. Please try again later or contact support.';
            }
            
            clinicsTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading clinics: ${errorMessage}</td></tr>`;
        }
    }
    
    // Function to display clinics
    function displayClinics(clinics) {
        if (!clinicsTableBody) {
            console.error('clinicsTableBody element not found');
            return;
        }
        
        clinicsTableBody.innerHTML = '';
        
        clinics.forEach(clinic => {
            const row = document.createElement('tr');
            
            // Format clinic ID to remove leading zeros
            const clinicIdFormatted = parseInt(clinic.clinicId, 10);
            
            row.innerHTML = `
                <td>${clinicIdFormatted}</td>
                <td>${clinic.clinicName || 'N/A'}</td>
                <td>${clinic.location || 'N/A'}</td>
                <td>${clinic.postalCode || 'N/A'}</td>
                <td>${clinic.phone || 'N/A'}</td>
                <td>${clinic.email || 'N/A'}</td>
                <td>${clinic.description || '-'}</td>
                <td class="actions">
                    <button class="edit-btn" data-id="${clinic.clinicId}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" data-id="${clinic.clinicId}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            clinicsTableBody.appendChild(row);
        });
        
        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const clinicId = this.getAttribute('data-id');
                openEditClinicModal(clinicId);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const clinicId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this clinic?')) {
                    deleteClinic(clinicId);
                }
            });
        });
        
        // Ensure the parent table is visible
        const clinicsTable = document.getElementById('clinics-table');
        if (!clinicsTable) {
            console.error('clinics-table element not found');
        }
    }
    
    // Function to add a new clinic
    async function addClinic() {
        try {
            const formData = new FormData(addClinicForm);
            const clinicData = {
                name: formData.get('name'),
                address: formData.get('address'),
                postalCode: formData.get('postalCode'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                description: formData.get('description')
            };
            
            debugLog('Adding new clinic with data:', clinicData);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            // Use the correct path with API_BASE_URL from window
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/clinic/createClinic`;
            debugLog('POST request to:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(clinicData)
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Add clinic request completed in ${requestTime}ms with status:`, response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from add clinic:', errorData);
                throw new Error(errorData.message || 'Failed to add clinic');
            }
            
            const result = await response.json();
            debugLog('Clinic added successfully:', result);
            
                // Close modal and reset form
                addClinicModal.style.display = 'none';
                addClinicForm.reset();
            
            // Show success message
            alert('Clinic added successfully');
                
                // Reload clinics
                loadClinics();
                
        } catch (error) {
            console.error('Error adding clinic:', error);
            debugLog('Error in addClinic():', error);
            alert(`Error adding clinic: ${error.message}`);
        }
    }
    
    // Function to open edit clinic modal
    async function openEditClinicModal(clinicId) {
        try {
            debugLog('Opening edit modal for clinic ID:', clinicId);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/clinic/getClinics`;
            debugLog('Fetching clinic details from:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Fetch clinic details completed in ${requestTime}ms with status:`, response.status);
            
            if (!response.ok) {
                throw new Error(`Error fetching clinic details: ${response.status} ${response.statusText}`);
            }
            
            const clinics = await response.json();
            debugLog('Fetched clinics:', clinics);
            
            const clinic = clinics.find(c => c.clinicId == clinicId);
            
            if (clinic) {
                debugLog('Found clinic to edit:', clinic);
                // Populate form fields
                document.getElementById('edit-clinic-id').value = clinic.clinicId;
                document.getElementById('edit-clinic-name').value = clinic.clinicName;
                document.getElementById('edit-clinic-location').value = clinic.location;
                document.getElementById('edit-clinic-postal-code').value = clinic.postalCode || '';
                document.getElementById('edit-clinic-phone').value = clinic.phone;
                document.getElementById('edit-clinic-email').value = clinic.email;
                document.getElementById('edit-clinic-description').value = clinic.description || '';
                
                // Show modal
                editClinicModal.style.display = 'block';
            } else {
                debugLog('Clinic not found with ID:', clinicId);
                alert('Clinic not found');
            }
        } catch (error) {
            console.error('Error fetching clinic details:', error);
            debugLog('Error in openEditClinicModal():', error);
            alert(error.message);
        }
    }
    
    // Function to update a clinic
    async function updateClinic() {
        try {
            const formData = new FormData(editClinicForm);
            const clinicData = {
                clinicId: formData.get('clinicId'),
                name: formData.get('name'),
                address: formData.get('address'),
                postalCode: formData.get('postalCode'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                description: formData.get('description')
            };
            
            debugLog('Updating clinic with data:', clinicData);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/clinic/updateClinic`;
            debugLog('PUT request to:', endpoint);
            
            const startTime = Date.now();
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(clinicData)
            });
            
            const requestTime = Date.now() - startTime;
            debugLog(`Update clinic request completed in ${requestTime}ms with status:`, response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from update clinic:', errorData);
                throw new Error(errorData.message || 'Failed to update clinic');
            }
            
            const result = await response.json();
            debugLog('Clinic updated successfully:', result);
            
                // Close modal
                editClinicModal.style.display = 'none';
            
            // Show success message
            alert('Clinic updated successfully');
                
                // Reload clinics
                loadClinics();
                
        } catch (error) {
            console.error('Error updating clinic:', error);
            debugLog('Error in updateClinic():', error);
            alert(`Error updating clinic: ${error.message}`);
        }
    }
    
    // Function to delete a clinic
    async function deleteClinic(clinicId) {
        try {
            debugLog('Deleting clinic with ID:', clinicId);
            
            // Get token for authentication
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication token not found');
            }
            
            const baseUrl = window.API_BASE_URL || '/api';
            const endpoint = `${baseUrl}/clinic/deleteClinic/${clinicId}`;
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
            debugLog(`Delete clinic request completed in ${requestTime}ms with status:`, response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                debugLog('Error response from delete clinic:', errorData);
                throw new Error(errorData.message || 'Failed to delete clinic');
            }
            
            const result = await response.json();
            debugLog('Clinic deleted successfully:', result);
            
            // Show success message
            alert('Clinic deleted successfully');
            
                // Reload clinics
                loadClinics();
        } catch (error) {
            console.error('Error deleting clinic:', error);
            debugLog('Error in deleteClinic():', error);
            alert(`Error deleting clinic: ${error.message}`);
        }
    }
    
    // Function to show add clinic modal
    function showAddClinicModal() {
        addClinicForm.reset();
        addClinicModal.style.display = 'block';
    }
    
    // Function to populate the clinic filter dropdown
    async function populateClinicFilter() {
        if (!clinicFilter) return;
        // Clear existing options except 'All Clinics'
        clinicFilter.innerHTML = '<option value="all">All Clinics</option>';
        const token = localStorage.getItem('token');
        if (!token) return;
        const baseUrl = window.API_BASE_URL || '/api';
        const endpoint = `${baseUrl}/clinic/getClinics`;
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) return;
            const clinics = await response.json();
            clinics.forEach(clinic => {
                const option = document.createElement('option');
                option.value = clinic.clinicId;
                option.textContent = clinic.clinicName;
                clinicFilter.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to populate clinic filter:', err);
        }
    }
    
    // At the end of DOMContentLoaded
    populateClinicFilter();
}); 