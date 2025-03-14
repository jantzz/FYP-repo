document.addEventListener('DOMContentLoaded', function() {
    // Toggle between login and signup forms
    document.getElementById('showSignup').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });

    document.getElementById('showLogin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });

    // Handle login form submission
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/user/login', {
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
                document.getElementById('loginError').textContent = data.error || 'Login failed';
                document.getElementById('loginError').style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('loginError').textContent = 'An error occurred. Please try again.';
            document.getElementById('loginError').style.display = 'block';
        }
    });

    // Handle signup form submission
    document.getElementById('signupForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const birthday = document.getElementById('signup-birthday').value;
        const gender = document.getElementById('signup-gender').value;
        
        // Validate password match
        if (password !== confirmPassword) {
            document.getElementById('signupError').textContent = 'Passwords do not match';
            document.getElementById('signupError').style.display = 'block';
            return;
        }
        
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
                document.getElementById('signupForm').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                
                // Pre-fill email for convenience
                document.getElementById('email').value = email;
            } else {
                // Show error message
                document.getElementById('signupError').textContent = data.error || 'Signup failed';
                document.getElementById('signupError').style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('signupError').textContent = 'An error occurred. Please try again.';
            document.getElementById('signupError').style.display = 'block';
        }
    });
}); 