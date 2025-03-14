from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, disconnect
import os
import json
from collections import deque
from threading import Lock
from datetime import datetime

app = Flask(__name__)
socketio = SocketIO(app)
thread = None
thread_lock = Lock()

log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

messages = deque(maxlen=20)  # Store the last 20 messages
online_users = {}  # Dictionary to store online users

@app.route('/')
def index():
    return render_template('index.html')  # Renders index.html

@app.route('/room1')
def room1():
    return render_template('room1.html')  # Renders room1.html

@app.route('/ips')
def get_ips():
    ips = []
    for filename in os.listdir(log_dir):
        if filename.endswith('.json'):
            with open(os.path.join(log_dir, filename), 'r') as f:
                data = json.load(f)
                ips.append({'ip': data['ip'], 'username': data.get('username', 'Unknown')})
    return jsonify(ips)

def log_ip(ip, username=None):
    log_data = {
        'ip': ip,
        'username': username
    }
    log_file = os.path.join(log_dir, f"{ip}.json")
    with open(log_file, 'w') as f:
        json.dump(log_data, f)
    print(f"IP logged: {ip}, Username: {username}")

@socketio.on('join')
def handle_join(data):
    username = data['username']
    ip = request.remote_addr
    log_ip(ip, username)
    online_users[username] = request.sid
    emit('user joined', username, broadcast=True)
    emit('load messages', list(messages), to=request.sid)  # Send the last 20 messages to the new user

@socketio.on('message')
def handle_message(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    msg['timestamp'] = timestamp
    messages.append(msg)  # Store the message
    print(f"Received message from {msg['username']}: {msg['text']} at {timestamp}")  # Log the username and message
    emit('message', msg, broadcast=True)  # Broadcast message to all connected clients

@socketio.on('clear messages')
def handle_clear_messages():
    messages.clear()  # Clear all messages
    emit('clear messages', broadcast=True)  # Notify all clients to clear their message list

@socketio.on('leave')
def handle_leave(data):
    username = data['username']
    if username in online_users:
        del online_users[username]
    emit('user left', username, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    for username, sid in list(online_users.items()):
        if sid == request.sid:
            del online_users[username]
            emit('user left', username, broadcast=True)
            break

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)  # Run the app on port 5000, accessible from any IP