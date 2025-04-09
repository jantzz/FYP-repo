//fetch the current logged-in user's employeeId from the backend
async function getEmployeeId() {
    try {
        const response = await fetch('http://localhost:8800/api/user/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        return userData.userId;  
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

//connects to backend via socket.io
const socket = io('http://localhost:8800');

//handle socket connection
socket.on("connect", async () => {
    console.log("Connected to socket.io");

    //fetch the current logged-in user's employeeId (userId)
    const employeeId = await getEmployeeId();

    if (employeeId) {
        //join the room specific to the current user
        socket.emit('join', { userId: employeeId });
    } else {
        console.log('No employeeId found, unable to join room');
    }
});

//listen for the 'shift_added' event from the backend
socket.on("shift_added", (data) => {
    console.log('Received shift_added event from server:', data);
    //pass the message received from the backend
    showNotification(data.message); 
});

//frontend listener for availability updates
socket.on("availability_updated", (data) => {
    console.log("Availability notification:", data);
    showNotification(data.message);  
});



//function to display notification (you can replace this with a toast, modal, 
//not sure which part to look at the frontend, sorry)
function showNotification(message) {
    const icon = document.querySelector(".notification-icon i");

    if (icon) {
        icon.classList.add("has-notification");
        //simple notification via alert for now
        alert(message); 
    }
}

//clear notification (e.g., when the user clicks the notification icon)
function clearNotification() {
    const icon = document.querySelector(".notification-icon i");
    if (icon) {
        icon.classList.remove("has-notification");
    }
}
