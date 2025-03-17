document.addEventListener('DOMContentLoaded', function() {
    // Toggle between login and signup forms
    document.getElementById('show-signup').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('signup-section').style.display = 'block';
    });

    document.getElementById('show-login').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('signup-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
    });

    // Handle login form submission
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch('http://localhost:8800/api/user/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            console.log('Login response:', data); // Debug log
            
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
                            gender: userData.gender
                        };
                        
                        console.log('Storing user info:', userInfo); // Debug log
                        localStorage.setItem('userInfo', JSON.stringify(userInfo));
                        
                        // Redirect to dashboard
                        window.location.href = '/dashboard.html';
                    } else {
                        throw new Error('Failed to fetch user data');
                    }
                } catch (userError) {
                    console.error('Error fetching user data:', userError);
                    document.getElementById('login-error').textContent = 'Failed to retrieve user information';
                    document.getElementById('login-error').style.display = 'block';
                }
            } else {
                // Show error message
                document.getElementById('login-error').textContent = data.error || 'Login failed';
                document.getElementById('login-error').style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            document.getElementById('login-error').textContent = 'An error occurred. Please try again.';
            document.getElementById('login-error').style.display = 'block';
        }
    });

    // Handle signup form submission
    document.getElementById('signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const birthday = document.getElementById('signup-birthday').value;
        const gender = document.getElementById('signup-gender').value;
        
        try {
            const response = await fetch('http://localhost:8800/api/user/createUser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    birthday,
                    gender,
                    role: 'Employee' // Default role for signup
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show success message and switch to login
                alert('Account created successfully! Please log in.');
                document.getElementById('signup-section').style.display = 'none';
                document.getElementById('login-section').style.display = 'block';
                
                // Pre-fill email for convenience
                document.getElementById('login-email').value = email;
            } else {
                // Show error message
                document.getElementById('signup-error').textContent = data.error || 'Signup failed';
                document.getElementById('signup-error').style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('signup-error').textContent = 'An error occurred. Please try again.';
            document.getElementById('signup-error').style.display = 'block';
        }
    });
}); 