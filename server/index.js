const { videoToken } = require("./tokens");
const config = require("./config");

const { io } = require("./socket");

const {
  addUserToRoom,
  createRoom,
  removeUserFromRoom,
  getUsersFromRoom,
  getUser,
  closeRoom,
  isRoomOpen,
} = require("./rooms");

const {
  createGame,
  userGuess,
  addUserPoint,
  isSpoiler,
  endGame,
  removeUserFromGame,
  isGameActive,
  addUserToGame,
} = require("./mechanics");

io.on("connect", (socket) => {
  console.log("user connected");

  socket.on("joinRoomQuery", ({ name, room }) => {
    var response = addUserToRoom(socket.id, name, room);

    const token = videoToken(name, room, config);

    socket.emit("joinRoomResponse", {
      response,
      room: room,
      token: token.toJwt(),
    });
    socket.join(room);

    // If game has already started, send usermessage to start game
    if (isGameActive(room)) {
      response = { status: 0, message: "Success" };
      socket.emit("startGameResponse", {
        response,
      });

      addUserToGame(room, name);
    }
  });

  socket.on("createRoomQuery", ({ name }) => {
    console.log(`${name} tried to make a new room`);

    const room = createRoom();
    const response = addUserToRoom(socket.id, name, room);

    const token = videoToken(name, room, config);

    socket.emit("joinRoomResponse", {
      response,
      room: room,
      token: token.toJwt(),
    });
    socket.join(room);
  });

  socket.on("startGameQuery", ({ room }) => {
    console.log(`${room} trying to start game`);

    var users = getUsersFromRoom(room);
    console.log("creating game: ", room, users);
    createGame(room, users);
    const response = { status: 0, message: "Success" };

    io.in(room).emit("startGameResponse", {
      response,
    });
  });

  socket.on("sendMessage", ({ message }) => {
    console.log(message);
    const user = getUser(socket.id);
    console.log(user);

    // Check if they have an active running game
    // if yes, check if they have already guessed the word
    // if no
    // they guessed correctly
    var correct = userGuess(user.roomName, user.userName, message);

    if (correct) {
      //broadcast to rest of users points update
      //broadcast to correct user to reveal word
      socket.emit("guessed", "true");

      io.to(user.roomName.toUpperCase()).emit("message", {
        user: "",
        text: `${user.userName} has guessed the word!`,
      });
    } else {
      if (!isSpoiler(user.roomName, message)) {
        io.to(user.roomName.toUpperCase()).emit("message", {
          user: user.userName,
          text: message,
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    const user = getUser(socket.id);

    if (user) {
      console.log(
        `${user.userName} disconnected from ${user.roomName.toUpperCase()}`
      );
      io.in(user.roomName.toUpperCase()).emit("userDisconnected", {
        username: user.userName,
      });

      removeUserFromRoom(socket.id, user.roomName);
      removeUserFromGame(user.roomName, user.userName);
    }
  });
});

console.log("server running on port 3001");
