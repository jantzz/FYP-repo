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
            
            if (response.ok) {
                // Store token in localStorage
                localStorage.setItem('token', data.token);
                
                // Store user info if available
                if (data.name) {
                    localStorage.setItem('userInfo', JSON.stringify({
                        name: data.name,
                        email: data.email,
                        role: data.role,
                        department: data.department,
                        birthday: data.birthday,
                        gender: data.gender
                    }));
                }
                
                // Redirect to dashboard
                window.location.href = '/dashboard.html';
            } else {
                // Show error message
                document.getElementById('login-error').textContent = data.error || 'Login failed';
                document.getElementById('login-error').style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
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
            const response = await fetch('/api/user/createUser', {
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