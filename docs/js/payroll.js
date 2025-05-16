// Payroll JavaScript Functions

// Get JWT token from local storage
function getToken() {
    return localStorage.getItem('token');
}

// Show payroll section and hide other sections
function showPayrollSection() {
    // Hide all sections
    document.querySelectorAll('.main-content > div').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show payroll section
    document.querySelector('.payroll-section').style.display = 'block';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector('.nav-item:has(i.fa-money-bill-wave)').classList.add('active');
    
    // Load payroll data
    loadPayrollData();
}

// Load payroll data based on user role
async function loadPayrollData() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // Check if user is a manager or admin
        const response = await fetch('/api/user/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch user data');
        
        const userData = await response.json();
        const isManager = ['Manager', 'Admin'].includes(userData.role);
        
        if (isManager) {
            // Show admin payroll view with all employees
            showAdminPayrollView();
        } else {
            // Show employee payroll view with their own records
            showEmployeePayrollView(userData.userId);
        }
        
    } catch (error) {
        console.error('Error loading payroll data:', error);
        showNotification('Failed to load payroll data. Please try again.', 'error');
    }
}

// Show employee's own payroll records
async function showEmployeePayrollView(employeeId) {
    try {
        const token = getToken();
        
        // Show employee payroll view elements
        document.getElementById('employee-payroll-view').style.display = 'block';
        document.getElementById('admin-payroll-view').style.display = 'none';
        
        // Fetch employee payroll data
        const response = await fetch(`/api/payroll/employee/${employeeId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch payroll data');
        
        const payrollData = await response.json();
        
        // Render employee payroll records
        renderEmployeePayrollRecords(payrollData);
        
    } catch (error) {
        console.error('Error fetching employee payroll:', error);
        document.getElementById('employee-payroll-records').innerHTML = 
            `<tr><td colspan="7" class="error-message">Failed to load payroll data</td></tr>`;
    }
}

// Render employee payroll records in table
function renderEmployeePayrollRecords(payrollData) {
    const tableBody = document.getElementById('employee-payroll-records');
    
    if (payrollData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-message">No payroll records found</td></tr>`;
        return;
    }
    
    // Sort payroll data by year and month (most recent first)
    payrollData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });
    
    const rows = payrollData.map(record => {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Ensure values are numbers
        const baseSalary = Number(record.baseSalary) || 0;
        const employeeCPF = Number(record.employeeCPF) || 0;
        const employerCPF = Number(record.employerCPF) || 0;
        const netSalary = Number(record.netSalary) || 0;
        
        return `
            <tr>
                <td>${monthNames[record.month - 1]} ${record.year}</td>
                <td>$${baseSalary.toFixed(2)}</td>
                <td>$${employeeCPF.toFixed(2)}</td>
                <td>$${employerCPF.toFixed(2)}</td>
                <td>$${netSalary.toFixed(2)}</td>
                <td><span class="status-badge ${record.status.toLowerCase()}">${record.status}</span></td>
                <td>
                    <button class="view-btn" onclick="viewPayslip(${record.payrollId})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Show admin/manager payroll view
async function showAdminPayrollView() {
    try {
        const token = getToken();
        
        // Show admin payroll view elements
        document.getElementById('employee-payroll-view').style.display = 'none';
        document.getElementById('admin-payroll-view').style.display = 'block';
        
        // Fetch all departments for filter
        const deptResponse = await fetch('/api/department/all', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!deptResponse.ok) throw new Error('Failed to fetch departments');
        
        const departments = await deptResponse.json();
        populateDepartmentFilter(departments);
        
        // Load payroll data
        await loadAllPayrollData();
        
        // Add event listeners for filters
        document.getElementById('payroll-month-filter').addEventListener('change', loadAllPayrollData);
        document.getElementById('payroll-year-filter').addEventListener('change', loadAllPayrollData);
        document.getElementById('payroll-department-filter').addEventListener('change', loadAllPayrollData);
        
        // Load payroll statistics
        loadPayrollStats();
        
    } catch (error) {
        console.error('Error setting up admin payroll view:', error);
        showNotification('Failed to load payroll administration panel', 'error');
    }
}

// Populate department filter dropdown
function populateDepartmentFilter(departments) {
    const departmentFilter = document.getElementById('payroll-department-filter');
    
    // Clear existing options except the first one
    while (departmentFilter.options.length > 1) {
        departmentFilter.remove(1);
    }
    
    // Add department options
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.departmentName;
        option.textContent = dept.departmentName;
        departmentFilter.appendChild(option);
    });
}

// Load all payroll data with filters
async function loadAllPayrollData() {
    try {
        const token = getToken();
        const month = document.getElementById('payroll-month-filter').value;
        const year = document.getElementById('payroll-year-filter').value;
        const department = document.getElementById('payroll-department-filter').value;
        
        let url = '/api/payroll/all';
        const queryParams = [];
        
        if (month !== 'all') queryParams.push(`month=${month}`);
        if (year !== 'all') queryParams.push(`year=${year}`);
        if (department !== 'all') queryParams.push(`department=${department}`);
        
        if (queryParams.length > 0) {
            url += '?' + queryParams.join('&');
        }
        
        // Show loading state
        document.getElementById('admin-payroll-records').innerHTML = 
            `<tr><td colspan="8" class="loading-message">Loading payroll data...</td></tr>`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch payroll data');
        
        const payrollData = await response.json();
        
        // Render all payroll records
        renderAllPayrollRecords(payrollData);
        
    } catch (error) {
        console.error('Error fetching all payroll data:', error);
        document.getElementById('admin-payroll-records').innerHTML = 
            `<tr><td colspan="8" class="error-message">Failed to load payroll data</td></tr>`;
    }
}

// Render all payroll records in table
function renderAllPayrollRecords(payrollData) {
    const tableBody = document.getElementById('admin-payroll-records');
    
    if (payrollData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-message">No payroll records found</td></tr>`;
        return;
    }
    
    // Sort payroll data by year and month (most recent first)
    payrollData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.employeeName.localeCompare(b.employeeName);
    });
    
    const rows = payrollData.map(record => {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Ensure values are numbers
        const baseSalary = Number(record.baseSalary) || 0;
        const employeeCPF = Number(record.employeeCPF) || 0;
        const employerCPF = Number(record.employerCPF) || 0;
        const netSalary = Number(record.netSalary) || 0;
        
        return `
            <tr>
                <td>${record.employeeName}</td>
                <td>${record.departmentName}</td>
                <td>${monthNames[record.month - 1]} ${record.year}</td>
                <td>$${baseSalary.toFixed(2)}</td>
                <td>$${employeeCPF.toFixed(2)}</td>
                <td>$${employerCPF.toFixed(2)}</td>
                <td>$${netSalary.toFixed(2)}</td>
                <td>
                    <span class="status-badge ${record.status.toLowerCase()}">${record.status}</span>
                    ${record.status === 'Pending' ? 
                        `<button class="pay-btn" onclick="updatePayrollStatus(${record.payrollId}, 'Paid')">
                            <i class="fas fa-check"></i> Mark as Paid
                        </button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Calculate payroll for an employee
async function calculatePayroll() {
    try {
        const token = getToken();
        const employeeId = document.getElementById('calc-employee-id').value;
        const month = document.getElementById('calc-month').value;
        const year = document.getElementById('calc-year').value;
        
        if (!employeeId || !month || !year) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        // Show loading state
        document.getElementById('calculate-btn').disabled = true;
        document.getElementById('calculate-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        
        // Check if the selected employee has a base salary
        const employeeOption = document.querySelector(`#calc-employee-id option[value="${employeeId}"]`);
        if (employeeOption && !employeeOption.dataset.baseSalary) {
            // Ask for base salary
            const baseSalary = prompt('This employee does not have a base salary set. Please enter a base salary:');
            
            if (!baseSalary || isNaN(parseFloat(baseSalary)) || parseFloat(baseSalary) <= 0) {
                showNotification('Valid base salary is required to calculate payroll', 'error');
            document.getElementById('calculate-btn').disabled = false;
            document.getElementById('calculate-btn').innerHTML = '<i class="fas fa-calculator"></i> Calculate';
            return;
            }
            
            // Update the user's base salary
            try {
                const updateResponse = await fetch('/api/user/updateBaseSalary', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: employeeId,
                        baseSalary: parseFloat(baseSalary)
                    })
                });
                
                if (!updateResponse.ok) {
                    const updateData = await updateResponse.json();
                    throw new Error(updateData.error || 'Failed to update base salary');
                }
                
                // Update the option data attribute
                employeeOption.dataset.baseSalary = parseFloat(baseSalary);
                
                // Update the option text
                const nameAndDept = employeeOption.textContent.split(' - ')[0];
                employeeOption.textContent = `${nameAndDept} - $${parseFloat(baseSalary).toFixed(2)}`;
                
                showNotification('Base salary has been set successfully', 'success');
            } catch (salaryError) {
                console.error('Error updating base salary:', salaryError);
                showNotification('Failed to update base salary: ' + salaryError.message, 'error');
                document.getElementById('calculate-btn').disabled = false;
                document.getElementById('calculate-btn').innerHTML = '<i class="fas fa-calculator"></i> Calculate';
                return;
            }
        }
        
        const response = await fetch('/api/payroll/calculate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeId: parseInt(employeeId),
                month: parseInt(month),
                year: parseInt(year)
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to calculate payroll');
        }
        
        // Reload payroll data
        loadAllPayrollData();
        
        // Reset button state
        document.getElementById('calculate-btn').disabled = false;
        document.getElementById('calculate-btn').innerHTML = '<i class="fas fa-calculator"></i> Calculate';
        
        // Show success message
        showNotification('Payroll calculated successfully', 'success');
        
    } catch (error) {
        console.error('Error calculating payroll:', error);
        showNotification(error.message || 'Failed to calculate payroll', 'error');
        document.getElementById('calculate-btn').disabled = false;
        document.getElementById('calculate-btn').innerHTML = '<i class="fas fa-calculator"></i> Calculate';
    }
}

// Recalculate payroll for an employee
async function recalculatePayroll(employeeId, month, year) {
    try {
        const token = getToken();
        
        const response = await fetch('/api/payroll/recalculate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeId: parseInt(employeeId),
                month: parseInt(month),
                year: parseInt(year)
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to recalculate payroll');
        }
        
        // Reload payroll data
        loadAllPayrollData();
        loadPayrollStats();
        
        showNotification('Payroll recalculated successfully', 'success');
        
    } catch (error) {
        console.error('Error recalculating payroll:', error);
        showNotification(error.message || 'Failed to recalculate payroll', 'error');
    }
}

// Update payroll status (mark as paid)
async function updatePayrollStatus(payrollId, status) {
    try {
        const token = getToken();
        
        const response = await fetch(`/api/payroll/status/${payrollId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update payroll status');
        }
        
        // Reload payroll data
        loadAllPayrollData();
        loadPayrollStats();
        
        showNotification(`Payroll marked as ${status}`, 'success');
        
    } catch (error) {
        console.error('Error updating payroll status:', error);
        showNotification(error.message || 'Failed to update payroll status', 'error');
    }
}

// Load and display payroll statistics
async function loadPayrollStats() {
    try {
        const token = getToken();
        const month = document.getElementById('payroll-month-filter').value;
        const year = document.getElementById('payroll-year-filter').value;
        const department = document.getElementById('payroll-department-filter').value;
        
        let url = '/api/payroll/stats';
        const queryParams = [];
        
        if (month !== 'all') queryParams.push(`month=${month}`);
        if (year !== 'all') queryParams.push(`year=${year}`);
        if (department !== 'all') queryParams.push(`department=${department}`);
        
        if (queryParams.length > 0) {
            url += '?' + queryParams.join('&');
        }
        
        // Show loading state
        document.getElementById('payroll-stats-container').innerHTML = 
            `<div class="loading-message">Loading payroll statistics...</div>`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch payroll statistics');
        
        const statsData = await response.json();
        
        // Debug stats data
        console.log('Raw payroll stats from API:', JSON.stringify(statsData));
        
        // Ensure CPF values are numeric
        const validatedStats = statsData.map(dept => ({
            ...dept,
            totalEmployeeCPF: parseFloat(dept.totalEmployeeCPF) || 0,
            totalEmployerCPF: parseFloat(dept.totalEmployerCPF) || 0
        }));
        
        // Render payroll statistics
        renderPayrollStats(validatedStats);
        
    } catch (error) {
        console.error('Error fetching payroll statistics:', error);
        document.getElementById('payroll-stats-container').innerHTML = 
            `<div class="error-message">Failed to load payroll statistics</div>`;
    }
}

// Render payroll statistics in cards
function renderPayrollStats(statsData) {
    const statsContainer = document.getElementById('payroll-stats-container');
    
    if (statsData.length === 0) {
        statsContainer.innerHTML = `<div class="empty-message">No payroll statistics available</div>`;
        return;
    }
    
    // Calculate totals across all departments
    const totalEmployees = statsData.reduce((sum, dept) => sum + Number(dept.totalEmployees || 0), 0);
    const totalBaseSalary = statsData.reduce((sum, dept) => sum + Number(dept.totalBaseSalary || 0), 0);
    const totalEmployeeCPF = statsData.reduce((sum, dept) => sum + Number(dept.totalEmployeeCPF || 0), 0);
    const totalEmployerCPF = statsData.reduce((sum, dept) => sum + Number(dept.totalEmployerCPF || 0), 0);
    const totalNetSalary = statsData.reduce((sum, dept) => sum + Number(dept.totalNetSalary || 0), 0);
    
    let html = `
        <div class="stats-summary">
            <div class="stats-card">
                <h3>Total Employees</h3>
                <div class="stats-value">${totalEmployees}</div>
            </div>
            <div class="stats-card">
                <h3>Total Base Salary</h3>
                <div class="stats-value">$${totalBaseSalary.toFixed(2)}</div>
            </div>
            <div class="stats-card">
                <h3>Total Employee CPF</h3>
                <div class="stats-value">$${totalEmployeeCPF.toFixed(2)}</div>
            </div>
            <div class="stats-card">
                <h3>Total Employer CPF</h3>
                <div class="stats-value">$${totalEmployerCPF.toFixed(2)}</div>
            </div>
            <div class="stats-card">
                <h3>Total Net Salary</h3>
                <div class="stats-value">$${totalNetSalary.toFixed(2)}</div>
            </div>
        </div>
        
        <h3>Department Breakdown</h3>
        <div class="department-stats">
    `;
    
    // Add department breakdown
    statsData.forEach(dept => {
        // Ensure values are numbers
        const employees = Number(dept.totalEmployees || 0);
        const baseSalary = Number(dept.totalBaseSalary || 0);
        const employeeCPF = Number(dept.totalEmployeeCPF || 0);
        const employerCPF = Number(dept.totalEmployerCPF || 0);
        const netSalary = Number(dept.totalNetSalary || 0);
        
        html += `
            <div class="department-card">
                <h4>${dept.departmentName}</h4>
                <div class="department-details">
                    <div class="detail-row">
                        <span class="detail-label">Employees:</span>
                        <span class="detail-value">${employees}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Base Salary:</span>
                        <span class="detail-value">$${baseSalary.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Employee CPF:</span>
                        <span class="detail-value">$${employeeCPF.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Employer CPF:</span>
                        <span class="detail-value">$${employerCPF.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Net Salary:</span>
                        <span class="detail-value">$${netSalary.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    statsContainer.innerHTML = html;
}

// View payslip details
async function viewPayslip(payrollId) {
    try {
        // Show loading notification
        showNotification('Fetching payslip...', 'info');
        
        // Get API base URL or use default if not set
        const apiUrl = window.API_BASE_URL || 'http://localhost:8800/api';
        console.log(`Fetching payslip for ID: ${payrollId} from ${apiUrl}/payroll/payslip/${payrollId}`);
        
        // Fetch payslip data from API
        const token = getToken();
        const response = await fetch(`${apiUrl}/payroll/payslip/${payrollId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Payslip response status:', response.status);
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.error || 'Failed to fetch payslip');
        }
        
        const payslip = responseData;
        console.log('Payslip data received:', payslip);
        
        // Create modal for payslip
        const modal = document.createElement('div');
        modal.id = 'payslipModal';
        modal.className = 'modal';
        
        // Format date for display
        const paymentDate = payslip.paymentDate ? new Date(payslip.paymentDate).toLocaleDateString() : 'Pending';
        
        // Build payslip HTML
        let html = `
            <div class="modal-content payslip-content">
                <span class="close" onclick="document.getElementById('payslipModal').style.display='none'">&times;</span>
                <div class="payslip-header">
                    <h2>Payslip Details</h2>
                    <div class="payslip-company">ShiftRoster Ltd</div>
                    <div class="payslip-period">Pay Period: ${payslip.payPeriod}</div>
                </div>
                
                <div class="payslip-employee-info">
                    <div class="info-group">
                        <div class="info-label">Employee</div>
                        <div class="info-value">${payslip.employeeName}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Department</div>
                        <div class="info-value">${payslip.department}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Email</div>
                        <div class="info-value">${payslip.employeeEmail || 'N/A'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Payment Date</div>
                        <div class="info-value">${paymentDate}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Status</div>
                        <div class="info-value">
                            <span class="status-badge ${payslip.status.toLowerCase()}">${payslip.status}</span>
                        </div>
                    </div>
                </div>
                
                <div class="payslip-section">
                    <h3>Salary Details</h3>
                    <div class="payslip-table">
                        <div class="payslip-row header">
                            <div class="payslip-cell">Description</div>
                            <div class="payslip-cell">Amount</div>
                        </div>
                        <div class="payslip-row">
                            <div class="payslip-cell">Base Salary</div>
                            <div class="payslip-cell">$${parseFloat(payslip.baseSalary).toFixed(2)}</div>
                        </div>
                        <div class="payslip-row">
                            <div class="payslip-cell">Employee CPF Contribution</div>
                            <div class="payslip-cell">-$${parseFloat(payslip.employeeCPF).toFixed(2)}</div>
                        </div>`;
        
        // Add deductions if any
        if (payslip.deductions && payslip.deductions.length > 0) {
            payslip.deductions.forEach(deduction => {
                html += `
                    <div class="payslip-row">
                        <div class="payslip-cell">Deduction: ${deduction.type}</div>
                        <div class="payslip-cell">-$${parseFloat(deduction.amount).toFixed(2)}</div>
                    </div>`;
            });
        }
        
        // Add total
        html += `
                        <div class="payslip-row total">
                            <div class="payslip-cell">Net Salary</div>
                            <div class="payslip-cell">$${parseFloat(payslip.netSalary).toFixed(2)}</div>
                        </div>
                    </div>
                </div>`;
        
        html += `
                <div class="payslip-footer">
                    <div class="payslip-actions">
                        <button class="btn-primary" onclick="printPayslip()">
                            <i class="fas fa-print"></i> Print
                        </button>
                    </div>
                    <div class="payslip-generated">
                        Generated on: ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
        
        // Show the modal
        modal.style.display = 'block';
        
        // Add CSS for the payslip modal if it doesn't exist
        if (!document.getElementById('payslip-styles')) {
            const styles = document.createElement('style');
            styles.id = 'payslip-styles';
            styles.textContent = `
                .payslip-content {
                    max-width: 800px;
                    padding: 30px;
                }
                
                .payslip-header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                    padding-bottom: 20px;
                }
                
                .payslip-company {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #333;
                    margin: 10px 0;
                }
                
                .payslip-period {
                    font-size: 1rem;
                    color: #666;
                }
                
                .payslip-employee-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                }
                
                .info-group {
                    margin-bottom: 10px;
                }
                
                .info-label {
                    font-size: 0.9rem;
                    color: #666;
                    margin-bottom: 5px;
                }
                
                .info-value {
                    font-size: 1rem;
                    font-weight: 500;
                    color: #333;
                }
                
                .payslip-section {
                    margin-bottom: 30px;
                }
                
                .payslip-section h3 {
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #eee;
                    color: #1976d2;
                }
                
                .payslip-section h4 {
                    margin: 20px 0 10px;
                    color: #444;
                }
                
                .payslip-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                
                .payslip-row {
                    display: flex;
                    border-bottom: 1px solid #eee;
                }
                
                .payslip-row.header {
                    background-color: #f5f5f5;
                    font-weight: 600;
                }
                
                .payslip-row.total {
                    font-weight: 600;
                    background-color: #e8f5e9;
                    border-top: 2px solid #c8e6c9;
                    border-bottom: none;
                }
                
                .payslip-cell {
                    padding: 12px 15px;
                    flex: 1;
                }
                
                .payslip-cell:last-child {
                    text-align: right;
                }
                
                .payslip-footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #f0f0f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .payslip-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .payslip-generated {
                    font-size: 0.9rem;
                    color: #666;
                    font-style: italic;
                }
                
                .status-badge {
                    display: inline-block;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                
                .status-badge.pending {
                    background-color: #fff8e1;
                    color: #ff8f00;
                }
                
                .status-badge.paid {
                    background-color: #e8f5e9;
                    color: #2e7d32;
                }
                
                .status-badge.processing {
                    background-color: #e3f2fd;
                    color: #1976d2;
                }
                
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #payslipModal, #payslipModal * {
                        visibility: visible;
                    }
                    #payslipModal {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        padding: 0;
                        margin: 0;
                    }
                    .payslip-content {
                        width: 100%;
                        box-shadow: none;
                        max-width: 100%;
                    }
                    .payslip-actions {
                        display: none;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add close event for the modal
        const closeButton = modal.querySelector('.close');
        closeButton.addEventListener('click', function() {
            modal.style.display = 'none';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
        
        // Close when clicking outside the modal
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 300);
            }
        });
        
    } catch (error) {
        console.error('Error fetching payslip:', error);
        showNotification(error.message || 'Failed to fetch payslip details', 'error');
    }
}

// Function to print payslip
function printPayslip() {
    window.print();
}

// Show notification message
function showNotification(message, type = 'info') {
    // Check if the GLOBAL showNotification function exists
    // but make sure it's not the same as this function
    if (typeof window.showNotification === 'function' && 
        window.showNotification !== showNotification) {
        window.showNotification(message, type);
    } else {
        // Create our own notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }
}

// Initialize payroll functionality when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up payroll navigation click handler
    const payrollNavItem = document.querySelector('.nav-item:has(i.fa-money-bill-wave)');
    if (payrollNavItem) {
        payrollNavItem.addEventListener('click', showPayrollSection);
    }
    
    // Set up calculate payroll form submit handler
    const calculatePayrollForm = document.getElementById('calculate-payroll-form');
    if (calculatePayrollForm) {
        calculatePayrollForm.addEventListener('submit', function(e) {
            e.preventDefault();
            calculatePayroll();
        });
    }
    
    // Populate year filter with reasonable range
    const yearFilter = document.getElementById('payroll-year-filter');
    if (yearFilter) {
        const currentYear = new Date().getFullYear();
        for (let year = currentYear - 2; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            yearFilter.appendChild(option);
        }
    }
    
    // Initialize employee lookup for calculating payroll
    initEmployeeLookup();
});

// Initialize employee lookup for payroll calculation
async function initEmployeeLookup() {
    try {
        const token = getToken();
        const employeeSelect = document.getElementById('calc-employee-id');
        
        if (!employeeSelect) return;
        
        const response = await fetch('/api/user/all', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch employees');
        
        const employees = await response.json();
        
        // Clear existing options
        while (employeeSelect.options.length > 1) {
            employeeSelect.remove(1);
        }
        
        // Add employees to dropdown
        employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.userId;
            // Add base salary to the option text if available
            const salaryText = employee.baseSalary ? ` - $${parseFloat(employee.baseSalary).toFixed(2)}` : '';
            option.textContent = `${employee.name} (${employee.department}${salaryText})`;
            
            // Store employee data as a data attribute for reference
            option.dataset.baseSalary = employee.baseSalary || '';
            option.dataset.department = employee.department || '';
            
            employeeSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error initializing employee lookup:', error);
        showNotification('Error loading employees: ' + error.message, 'error');
    }
}

