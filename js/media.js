let localStream;
let peerConnections = {};

// Capture local video/audio
const message = document.querySelector('div.conga')
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = stream;
        message.textContent = 'Hello, this is a custom alert!';
    })
    .catch((error) => {
        console.error('Error accessing media devices.', error)
        message.textContent = 'ErrorErrorErrorError!';
    });

// Join a room
const roomId = 'example-room'; // Replace with dynamic room logic
socket.emit('join', roomId);

// Listen for new users
socket.on('user-joined', (userId) => {
    console.log('New user joined:', userId);
    createOffer(userId);
});

// Listen for signaling data
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

// Create a peer connection
function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection();

    // Add local stream tracks
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    // Send ICE candidates to the other peer
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { to: userId, signal: event.candidate });
        }
    };

    // Add remote tracks to the video element
    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById(`remoteVideo-${userId}`);
        if (!remoteVideo) {
            const video = document.createElement('video');
            video.id = `remoteVideo-${userId}`;
            video.autoplay = true;
            video.srcObject = new MediaStream([event.track]);
            document.body.appendChild(video);
        }
    };

    return peerConnection;
}
