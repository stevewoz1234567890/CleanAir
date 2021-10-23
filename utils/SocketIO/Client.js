
const socketIo = require("socket.io");

let client = null


const socketClient = async (server) =>{
  client = socketIo(server,{
        cors: {
          origin: "http://localhost:3000",
          methods: ["GET", "POST"]
        }
      });
      client.on("connection", (socket) => {
        console.log("New client connected");
        
        socket.on("disconnect", () => {
          console.log("Client disconnected");
        });
      });

}

module.exports = {socketClient}


