import {connection, server as WebSocketServer} from "websocket";
import http from "http";
import { SupportedMessage, IncomingMessage} from "./messages/incomingMessages";
import { UserManager } from "./UserManager";
import { InMemoryStore } from "./store/InMemoryStore";
import { OutgoingMessage, SupportedMessage as OutgoingSupportedMessages } from "./messages/outgoingMessages";

const server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server

const userManager =  new UserManager();
const store = new InMemoryStore();

server.listen(8080,  function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin: String) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

wsServer.on('request', function(request) {
    // console.log('WebSocket request received with origin:', request.origin); //M
    console.log("Inside Connect");
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    var connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');

    // connection.on('message', function(message) {
    //     console.log("received", message);
    //     // Todo and rate limitting logic here
    //     connection.send(JSON.stringify({
    //         type: "ADD_CHAT",
    //         payload: {
    //             message: "Hello from server!",
    //             upvotes: 0
    //         }
    //     }));
    //     if (message.type === 'utf8') {
    //         try {
    //             console.log("Indie with message " + message.utf8Data)
    //             messageHandler(connection, JSON.parse(message.utf8Data))
    //         } catch(e){

    //         }

    //         // console.log('Received Message: ' + message.utf8Data);
    //         // connection.sendUTF(message.utf8Data);
    //     }
    // });
    
    
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            const data = message.utf8Data; // ✅ safe access now
            console.log("Indie with message " + message.utf8Data)
            
            try {
                messageHandler(connection, JSON.parse(message.utf8Data))
                // const { type, payload } = JSON.parse(data);
    
                // if (type === "SEND_MESSAGE") {
                //     const { message: msgText } = payload;
    
                //     connection.send(JSON.stringify({
                //         type: "ADD_CHAT",
                //         payload: {
                //             message: msgText,
                //             upvotes: 0
                //         }
                //     }));
                // }
            } catch (err) {
                console.error("JSON parse error", err);
            }
        } else {
            console.warn("Unsupported message type:", message.type);
        }
    });
    
    
});

function messageHandler(ws: connection, message: IncomingMessage){
    // console.log("Incoming Message " + JSON.stringify(message));
    // console.log("📨 Message received with type:", message.type);
    // console.log("📦 Full message:", message);
 

    if(message.type == SupportedMessage.JoinRoom){
        console.log("User added");
        const payload = message.payload;
        userManager.addUser(payload.name, payload.userId, payload.roomId, ws);
    }

    if(message.type == SupportedMessage.SendMessage){
        const payload = message.payload;
        const user = userManager.getUser(payload.roomId, payload.userId);
        if(!user) {
            console.error("User not found in DB");
            return;
        }
        let chat = store.addChat(payload.userId, user.name, payload.message, payload.roomId);
        if(!chat){
            return;
        }

        // Todo add broadcast logic here
        const outgoingPayload: OutgoingMessage = {
            type: OutgoingSupportedMessages.AddChat,
            payload: {
                chatId: chat.id,
                roomId: payload.roomId,
                message: payload.message,
                name: user.name,
                upvotes: 0
            }
        }
        ws.send(JSON.stringify(outgoingPayload));
        userManager.broadCast(payload.roomId, payload.userId, outgoingPayload);
    }

    if(message.type === SupportedMessage.UpvoteMessage){
        const payload = message.payload;
        const chat = store.upvote(payload.userId, payload.roomId, payload.chatId);
        console.log("Inside upvote");
        if(!chat) {
            return;
        }
        console.log("Inside upvote 2");

        // Todo add broadcast logic here
        const outgoingPayload: OutgoingMessage = {
            type: OutgoingSupportedMessages.UpdateChat,
            payload: {
                chatId: payload.chatId,
                roomId: payload.roomId,
                upvotes: chat.upvotes.length
            }
        }
        console.log("Inside upvote 3");
        userManager.broadCast(payload.roomId, payload.userId, outgoingPayload);
    }
}