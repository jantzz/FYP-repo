// Clinic Management JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const clinicManagementNav = document.getElementById('clinic-management-nav');
    const clinicManagementSection = document.querySelector('.clinic-management-section');
    const addClinicBtn = document.getElementById('add-clinic-btn');
    const addClinicModal = document.getElementById('add-clinic-modal');
    const editClinicModal = document.getElementById('edit-clinic-modal');
    const addClinicForm = document.getElementById('add-clinic-form');
    const editClinicForm = document.getElementById('edit-clinic-form');
    const clinicsTableBody = document.getElementById('clinics-table-body');
    
    // Base URL for API calls
    const API_BASE_URL = '/api/clinic';
    
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
        const allContent = document.querySelectorAll('.main-content > div');
        allContent.forEach(content => {
            content.style.display = 'none';
        });
        
        // Show clinic management section
        if (clinicManagementSection) {
            clinicManagementSection.style.display = 'block';
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
        try {
            clinicsTableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Loading clinics data...</td></tr>';
            
            const response = await fetch(`${API_BASE_URL}/getClinics`);
            const clinics = await response.json();
            
            if (clinics && clinics.length > 0) {
                displayClinics(clinics);
            } else {
                clinicsTableBody.innerHTML = '<tr><td colspan="7" class="empty-message">No clinics found</td></tr>';
            }
        } catch (error) {
            console.error('Error loading clinics:', error);
            clinicsTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Error loading clinics</td></tr>';
        }
    }
    
    // Function to display clinics
    function displayClinics(clinics) {
        clinicsTableBody.innerHTML = '';
        
        clinics.forEach(clinic => {
            const row = document.createElement('tr');
            
            // Format clinic ID to remove leading zeros
            const clinicIdFormatted = parseInt(clinic.clinicId, 10);
            
            row.innerHTML = `
                <td>${clinicIdFormatted}</td>
                <td>${clinic.clinicName}</td>
                <td>${clinic.location}</td>
                <td>${clinic.phone}</td>
                <td>${clinic.email}</td>
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
    }
    
    // Function to add a new clinic
    async function addClinic() {
        try {
            const formData = new FormData(addClinicForm);
            const clinicData = {
                name: formData.get('name'),
                address: formData.get('address'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                description: formData.get('description')
            };
            
            const response = await fetch(`${API_BASE_URL}/createClinic`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clinicData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close modal and reset form
                addClinicModal.style.display = 'none';
                addClinicForm.reset();
                
                // Reload clinics
                loadClinics();
                
                // Show success message
                alert('Clinic added successfully');
            } else {
                alert(`Error: ${result.message || 'Failed to add clinic'}`);
            }
        } catch (error) {
            console.error('Error adding clinic:', error);
            alert('Error adding clinic. Please try again.');
        }
    }
    
    // Function to open edit clinic modal
    async function openEditClinicModal(clinicId) {
        try {
            const response = await fetch(`${API_BASE_URL}/getClinics`);
            const clinics = await response.json();
            
            const clinic = clinics.find(c => c.clinicId == clinicId);
            
            if (clinic) {
                // Populate form fields
                document.getElementById('edit-clinic-id').value = clinic.clinicId;
                document.getElementById('edit-clinic-name').value = clinic.clinicName;
                document.getElementById('edit-clinic-location').value = clinic.location;
                document.getElementById('edit-clinic-phone').value = clinic.phone;
                document.getElementById('edit-clinic-email').value = clinic.email;
                document.getElementById('edit-clinic-description').value = clinic.description || '';
                
                // Show modal
                editClinicModal.style.display = 'block';
            } else {
                alert('Clinic not found');
            }
        } catch (error) {
            console.error('Error fetching clinic details:', error);
            alert('Error fetching clinic details. Please try again.');
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
                phone: formData.get('phone'),
                email: formData.get('email'),
                description: formData.get('description')
            };
            
            const response = await fetch(`${API_BASE_URL}/updateClinic`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clinicData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close modal
                editClinicModal.style.display = 'none';
                
                // Reload clinics
                loadClinics();
                
                // Show success message
                alert('Clinic updated successfully');
            } else {
                alert(`Error: ${result.message || 'Failed to update clinic'}`);
            }
        } catch (error) {
            console.error('Error updating clinic:', error);
            alert('Error updating clinic. Please try again.');
        }
    }
    
    // Function to delete a clinic
    async function deleteClinic(clinicId) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteClinic/${clinicId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Reload clinics
                loadClinics();
                
                // Show success message
                alert('Clinic deleted successfully');
            } else {
                alert(`Error: ${result.message || 'Failed to delete clinic'}`);
            }
        } catch (error) {
            console.error('Error deleting clinic:', error);
            alert('Error deleting clinic. Please try again.');
        }
    }
    
    // Function to show add clinic modal
    function showAddClinicModal() {
        addClinicForm.reset();
        addClinicModal.style.display = 'block';
    }
}); 