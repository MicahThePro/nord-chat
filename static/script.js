document.addEventListener('DOMContentLoaded', function () {
    // Ensure socket.io is available
    if (typeof io === 'undefined') {
        console.error('Socket.io is not loaded. Make sure you include the Socket.io library.');
        return;
    }

    var socket = io();  // Initialize socket.io connection
    var username = localStorage.getItem('username') || "";   // Retrieve username from localStorage
    var lastSender = "";  // Track the last sender to handle consecutive messages

    // Get all elements
    const setUsernameButton = document.getElementById('set-username-button');
    const usernameInput = document.getElementById('username-input');
    const usernameContainer = document.getElementById('username-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator'); // Add an element to display typing notifications
    const charCount = document.getElementById('char-count');

    // Check if all elements exist
    if (!setUsernameButton || !usernameInput || !usernameContainer || !messageInput || !sendButton || !messages || !typingIndicator || !charCount) {
        console.error('Some required HTML elements are missing. Please check the IDs.');
        return;
    }

    // Preload audio files
    const sendSound = new Audio('/static/imsend.mp3');
    const receiveSound = new Audio('/static/imrcv.mp3');
    const doorOpenSound = new Audio('/static/doorsoundopening.mp3');
    const doorCloseSound = new Audio('/static/doorsoundclose.mp3');

    // Set the username when the button is clicked
    setUsernameButton.addEventListener('click', function () {
        username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem('username', username); // Store username in localStorage
            usernameContainer.style.display = 'none'; // Hide the username input field
            messageInput.disabled = false; // Enable message input
            sendButton.disabled = false; // Enable send button
            socket.emit('join', { username: username }); // Notify the server of the new user
            alert('Username set to: ' + username); // Notify user of the chosen username
        } else {
            alert('Please enter a valid username.');
        }
    });

    // Automatically set the username if it exists in localStorage
    if (username) {
        usernameContainer.style.display = 'none'; // Hide the username input field
        messageInput.disabled = false; // Enable message input
        sendButton.disabled = false; // Enable send button
        socket.emit('join', { username: username }); // Notify the server of the new user
    }

    // Listen for incoming messages
    socket.on('message', function (msg) {
        if (msg.username && msg.text) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            const usernameClass = msg.username === username ? 'username-self' : 'username-other';
            const timestamp = msg.timestamp || new Date().toLocaleString();  // Use the timestamp from the server or the current date and time

            if (msg.username !== lastSender) {
                messageElement.innerHTML = `<strong class="${usernameClass}">${msg.username}</strong> <span class="timestamp">${timestamp}</span><br>${msg.text.replace(/\n/g, '<br>')}`;
            } else {
                messageElement.innerHTML = `<span class="timestamp">${timestamp}</span><br>${msg.text.replace(/\n/g, '<br>')}`;
            }

            messages.appendChild(messageElement); // Add the message to the DOM
            lastSender = msg.username;  // Update the last sender

            // Remove the oldest message if there are more than 20 messages
            if (messages.children.length > 20) {
                messages.removeChild(messages.firstChild);
            }

            messages.scrollTop = messages.scrollHeight; // Scroll to the bottom of the messages

            // Play sound when a new message is received
            if (msg.username === username) {
                playSound(sendSound); // Play send sound for the sender
            } else {
                playSound(receiveSound); // Play receive sound for others
            }
        } else {
            console.warn('Received invalid message:', msg);
        }
    });

    // Listen for user join
    socket.on('user joined', function (user) {
        if (user !== username) {
            playSound(doorOpenSound); // Play door opening sound for others
        }
    });

    // Listen for user leave
    socket.on('user left', function (user) {
        if (user !== username) {
            playSound(doorCloseSound); // Play door closing sound for others
        }
    });

    // Function to play a sound
    function playSound(audio) {
        audio.currentTime = 0; // Reset audio to start
        audio.play().catch(error => {
            console.error('Error playing sound:', error);
        });
    }

    // Listen for typing notifications
    socket.on('typing', function (data) {
        typingIndicator.innerHTML = `${data.username} is typing...`;
    });

    // Listen for stop typing notifications
    socket.on('stop typing', function () {
        typingIndicator.innerHTML = '';
    });

    // Listen for loading past messages
    socket.on('load messages', function (pastMessages) {
        pastMessages.forEach(function (msg) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            const usernameClass = msg.username === username ? 'username-self' : 'username-other';
            const timestamp = msg.timestamp || new Date().toLocaleString();  // Use the timestamp from the server or the current date and time

            if (msg.username !== lastSender) {
                messageElement.innerHTML = `<strong class="${usernameClass}">${msg.username}</strong> <span class="timestamp">${timestamp}</span><br>${msg.text.replace(/\n/g, '<br>')}`;
            } else {
                messageElement.innerHTML = `<span class="timestamp">${timestamp}</span><br>${msg.text.replace(/\n/g, '<br>')}`;
            }

            messages.appendChild(messageElement); // Add the message to the DOM
            lastSender = msg.username;  // Update the last sender
        });
        messages.scrollTop = messages.scrollHeight; // Scroll to the bottom of the messages
    });

    // Update character count as the user types
    messageInput.addEventListener('input', function () {
        const currentLength = messageInput.value.length;
        const remaining = 255 - currentLength;
        charCount.textContent = `${remaining} characters left`;
        if (remaining === 0) {
            charCount.style.color = 'red';
        } else {
            charCount.style.color = '';
        }
    });

    // Send message to the server when "Send" button is clicked
    sendButton.addEventListener('click', function (event) {
        event.preventDefault();  // Prevent the default button behavior (form submission)
        var msg = messageInput.value.trim();

        if (msg.length > 0 && msg.length <= 255 && username) {
            socket.emit('message', { username: username, text: msg }); // Emit message with username to the server
            messageInput.value = '';  // Clear message input
            charCount.textContent = '255 characters left'; // Reset character count
            socket.emit('stop typing'); // Notify the server that the user stopped typing
        } else if (msg.length > 255) {
            alert('Message exceeds the 255 character limit.');
        } else {
            alert('Please enter a valid message.');
        }
    });

    // Handle Enter key for sending message without clicking the "Send" button
    messageInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();  // Prevent the default Enter behavior (such as submitting a form)
            var msg = messageInput.value.trim();

            if (msg.length > 0 && msg.length <= 255 && username) {
                socket.emit('message', { username: username, text: msg }); // Emit message with username to the server
                messageInput.value = '';  // Clear message input
                charCount.textContent = '255 characters left'; // Reset character count
                socket.emit('stop typing'); // Notify the server that the user stopped typing
            } else if (msg.length > 255) {
                alert('Message exceeds the 255 character limit.');
            } else {
                alert('Please enter a valid message.');
            }
        } else {
            socket.emit('typing', { username: username }); // Notify the server that the user is typing
        }
    });

    // Notify the server when the user stops typing
    messageInput.addEventListener('keyup', function (event) {
        if (event.key !== 'Enter') {
            setTimeout(function () {
                socket.emit('stop typing'); // Notify the server that the user stopped typing
            }, 1000);
        }
    });

    // Notify the server when the user leaves the chat
    window.addEventListener('beforeunload', function () {
        socket.emit('leave', { username: username }); // Notify the server that the user left
        playSound(doorCloseSound); // Play door closing sound for the user leaving
    });

    // Redirect to /room1 and play door open sound for others
    window.addEventListener('load', function () {
        if (window.location.pathname === '/room1') {
            socket.emit('join room1', { username: username }); // Notify the server that the user joined room1
            playSound(doorOpenSound); // Play door opening sound for the user joining
        }
    });
});