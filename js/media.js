let localStream;
let peerConnections = {};

// Capture local video/audio
navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
        localStream = stream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = stream;
    })
    .catch((error) => console.error('Error accessing media devices:', error));

// Listen for other users joining the room
socket.on('user-joined', (userId) => {
    console.log('New user joined:', userId);
    createOffer(userId);
});

// Handle signaling data
socket.on('signal', async ({ from, signal }) => {
    if (signal.type === 'offer') {
        await createAnswer(from, signal);
    } else if (signal.type === 'answer') {
        await peerConnections[from].setRemoteDescription(signal);
    } else if (signal.candidate) {
        await peerConnections[from].addIceCandidate(signal);
    }
});

// Create an offer
async function createOffer(userId) {
    const peerConnection = createPeerConnection(userId);
    peerConnections[userId] = peerConnection;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('signal', { to: userId, signal: offer });
}

// Create an answer
async function createAnswer(userId, offer) {
    const peerConnection = createPeerConnection(userId);
    peerConnections[userId] = peerConnection;

    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('signal', { to: userId, signal: answer });
}

// Create a new peer connection
function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection();

    // Add local tracks
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    // Send ICE candidates to the other peer
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { to: userId, signal: event.candidate });
        }
    };

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        const video = document.getElementById(`remoteVideo-${userId}`) || createRemoteVideo(userId);
        video.srcObject = event.streams[0];
    };

    return peerConnection;
}

// Create a video element for remote users
function createRemoteVideo(userId) {
    const remoteVideos = document.getElementById('remoteVideos');
    const video = document.createElement('video');
    video.id = `remoteVideo-${userId}`;
    video.autoplay = true;
    remoteVideos.appendChild(video);
    return video;
}

// Handle user disconnection
socket.on('user-left', (userId) => {
    console.log('User left:', userId);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
        const video = document.getElementById(`remoteVideo-${userId}`);
        if (video) video.remove();
    }
});
