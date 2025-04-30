document.addEventListener('DOMContentLoaded', function() {
    // Function to show loading state on button
    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // Handle login form submission
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitButton = this.querySelector('button[type="submit"]');
        const errorElement = document.getElementById('login-error');
        
        // Clear previous error
        errorElement.style.display = 'none';
        errorElement.textContent = '';
        
        // Show loading state
        setButtonLoading(submitButton, true);
        
        try {
            const response = await fetch('http://localhost:8800/api/user/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            console.log('Login response:', data);
            
            if (response.ok) {
                // Store token in localStorage
                localStorage.setItem('token', data.token);
                
                // Now fetch user details using the token
                try {
                    const userResponse = await fetch('http://localhost:8800/api/user/me', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${data.token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        
                        // Store user info matching the database schema
                        const userInfo = {
                            userId: userData.userId,  
                            name: userData.name,    
                            email: userData.email,   
                            role: userData.role,    
                            department: userData.department,
                            birthday: userData.birthday,
                            gender: userData.gender,
                            baseSalary: userData.baseSalary
                        };
                        
                        console.log('Storing user info:', userInfo);
                        localStorage.setItem('userInfo', JSON.stringify(userInfo));
                        
                        // Show success message before redirect
                        submitButton.innerHTML = '<i class="fas fa-check"></i> Success!';
                        setTimeout(() => {
                            window.location.href = '/dashboard.html';
                        }, 1000);
                    } else {
                        throw new Error('Failed to fetch user data');
                    }
                } catch (userError) {
                    console.error('Error fetching user data:', userError);
                    errorElement.textContent = 'Failed to retrieve user information';
                    errorElement.style.display = 'block';
                    setButtonLoading(submitButton, false);
                }
            } else {
                // Show error message
                errorElement.textContent = data.error || 'Login failed';
                errorElement.style.display = 'block';
                setButtonLoading(submitButton, false);
            }
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = 'An error occurred. Please try again.';
            errorElement.style.display = 'block';
            setButtonLoading(submitButton, false);
        }
    });

    // Add password toggle functionality
    document.querySelector('.password-toggle').addEventListener('click', function() {
        const passwordInput = document.querySelector('#login-password');
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
}); 