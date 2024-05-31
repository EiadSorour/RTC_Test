const fs = require("fs");
const https = require("https");
const express = require("express");
const socketio = require("socket.io");

const cert = fs.readFileSync("./cert.crt");
const key = fs.readFileSync("./cert.key");

const app = express();
app.use(express.static(__dirname));

const expressServer = https.createServer({key,cert} , app);

const offers = []

const connectedSockets = []

const io = socketio(expressServer, {
    cors: {
        origin: [
            // IP address
            "https://192.168.1.8"
        ]
    }
});

io.on("connection" , (socket)=>{
    const username = socket.handshake.auth.username;
    console.log(`${username} is connected`);

    connectedSockets.push({
        username: username,
        socketID: socket.id
    })

    socket.on("test", ()=>{
        socket.emit("test", offers);
    })

    socket.on("new_offer", (offer)=>{
        offers.push({
            offerUserName: username,
            offer: offer,
            offerIce: [],
            answerUserName: "",
            answer: "",
            answerIce: []
        });
        socket.broadcast.emit("new_offer_is_ready", offers[offers.length -1]);
    })

    socket.on("new_answer", (object)=>{
        const {offerToAnswer , answer} = object;
        offers.find((offer)=>offer.offerUserName == offerToAnswer.offerUserName).answerUserName = username;
        offers.find((offer)=>offer.offerUserName == offerToAnswer.offerUserName).answer = answer;
        const offer = offers.find((offer)=>offer.offerUserName == offerToAnswer.offerUserName);
        const socketToAnswer = connectedSockets.find((socket)=>socket.username == offerToAnswer.offerUserName);
        io.to(socketToAnswer.socketID).emit("offer_answered", offer)
    })
    
    socket.on("send_ice_candidate_to_server", (iceCandidate)=>{
        const isOffer = iceCandidate.isOffer;
        if(isOffer){
            offers.find((offer)=>offer.offerUserName == username).offerIce.push(iceCandidate.candidate);
        }else{
            offers.find((offer)=>offer.answerUserName == username).answerIce.push(iceCandidate.candidate);
            const offer = offers.find((offer)=>offer.answerUserName == username);
            const socketToAnswer = connectedSockets.find((socket)=>socket.username == offer.offerUserName);
            io.to(socketToAnswer.socketID).emit("answer_candidate_recieved", iceCandidate.candidate)
        }
    })

    socket.on("get_offer_candidates", (offerToGetCandidates , ackFunc)=>{
        ackFunc(offers.find((offer)=>offer.offerUserName == offerToGetCandidates.offerUserName).offerIce);
    })

    socket.conn.on("close", ()=>{
        console.log(`${username} is disconnected`);
    })
})

expressServer.listen(8181, ()=>{
    console.log("Server is running on port 8181");
})