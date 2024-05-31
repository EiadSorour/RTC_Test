const username = `user-${Math.floor(Math.random()*10000)}`;
const userElement = document.getElementById("username");
userElement.innerText = username;

const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const offersElement = document.getElementById("offers");
const remoteStream = new MediaStream();

var peerConnection;

const peerConfig = {
    iceServers:[
        {
            urls:[
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

const socket = io.connect("https://192.168.1.8:8181" , {
    auth:{
        username:username
    }
});

function test(){
    console.log("RTC Object: ");
    console.log(peerConnection);
    socket.emit("test");
}
socket.on("test", (offers)=>{
    console.log(offers);
})

socket.on("new_offer_is_ready", async (offer)=>{
    const newOffer = document.createElement("button");
    newOffer.innerText = `${offer.offerUserName}`;
    newOffer.classList.add("btn", "btn-primary", "m-2");
    newOffer.addEventListener("click" , ()=>{answer(offer)});
    offersElement.appendChild(newOffer);
})

socket.on("offer_answered", (offer)=>{
    peerConnection.setRemoteDescription(offer.answer);
})

socket.on("answer_candidate_recieved", (candidate)=>{
    peerConnection.addIceCandidate(candidate);
});


async function call(){
    // Get local media stream
    const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        // audio: true
    });
    localVideo.srcObject = localStream; 
    remoteVideo.srcObject = remoteStream;

    // Create peer connection object
    peerConnection = new RTCPeerConnection(peerConfig);
    
    // When ICE Candidate is received send it to signaling server
    peerConnection.onicecandidate = (event)=>{
        const iceCandidate = event.candidate;
        if(iceCandidate){
            socket.emit("send_ice_candidate_to_server",{
                candidate: iceCandidate,
                isOffer: true
            });
        }
    };

    peerConnection.addEventListener('track',e=>{
        console.log("Got stream from other side!");
        e.streams[0].getTracks().forEach(track=>{
            remoteStream.addTrack(track,remoteStream);
        })
    })

    // Add local stream tracks to peer connection object
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track,localStream);
    })

    // Create offer 
    const offer = await peerConnection.createOffer();
    peerConnection.setLocalDescription(offer)

    // Send offer to signaling server
    socket.emit("new_offer" , offer)

}

async function answer(offer){
    // Get local media stream
    const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        // audio: true
    });
    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    // Create peer connection object
    peerConnection = new RTCPeerConnection(peerConfig);
    
    // When ICE Candidate is received send it to signaling server
    peerConnection.onicecandidate = (event)=>{
        const iceCandidate = event.candidate;
        if(iceCandidate){
            socket.emit("send_ice_candidate_to_server",{
                candidate: iceCandidate,
                isOffer: false
            });
        }
    };

    peerConnection.addEventListener('track',e=>{
        console.log("Got stream from other side!");
        e.streams[0].getTracks().forEach(track=>{
            remoteStream.addTrack(track,remoteStream);
        })
    })

    // Add local stream tracks to peer connection object
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track,localStream);
    })

    // Create answer
    peerConnection.setRemoteDescription(offer.offer)
    const answer = await peerConnection.createAnswer({});
    peerConnection.setLocalDescription(answer);

    const offerIce = await socket.emitWithAck("get_offer_candidates", offer);
    offerIce.forEach((candidate)=>{
        peerConnection.addIceCandidate(candidate);
    })

    // Send answer to signaling server
    socket.emit("new_answer" , {
        offerToAnswer: offer,
        answer: answer
    })
}

