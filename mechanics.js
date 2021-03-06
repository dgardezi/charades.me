const { words } = require("./words");
const { getUsersFromRoom } = require("./rooms");
const activeGames = new Map(); // { userPoints,currentOrder,currentActor,currentWord,timer,lastTimerUpdate, guessedCorrectly
const timeoutBetweenGames = 5000; //in milliseconds
const { io } = require("./socket.js");
const { emit } = require("nodemon");
const currentTime = () => {
  return new Date().getTime();
};

const setCurrentWord = (room, word) => {
  activeGames.get(room.toUpperCase()).currentWord = word;
};

const createGame = (room, users) => {
  // Map (keys: userName, value: points)
  let userPoints = new Map(users.map((u) => [u.userName, 0]));
  var currentOrder = [...userPoints.keys()];
  var currentActor = -1;
  var currentWord = null;
  var timer = -1;
  var lastTimerUpdate = currentTime();
  var roundRunning = false;
  var guessedCorrectly = null; // Set of players who have guessed the word

  activeGames.set(room, {
    userPoints,
    currentOrder,
    currentActor,
    currentWord,
    timer,
    lastTimerUpdate,
    roundRunning,
    guessedCorrectly,
  });

  // The thread id to be used to close the game
  var gameId = setInterval(runGame, 100, room);
  activeGames.get(room).gameId = gameId;
};

const endGame = (room) => {
  room = room.toUpperCase();
  if (activeGames.has(room)) {
    clearInterval(activeGames.get(room).gameId);
    activeGames.delete(room);
  }
};

const addUserToGame = (room, username, id) => {
  room = room.toUpperCase();
  if (activeGames.has(room)) {
    var roomData = activeGames.get(room);
    if (!roomData.userPoints.has(username)) {
      roomData.userPoints.set(username, 0);
      roomData.currentOrder.push(username);

      // Resend the actor and word for new user if game is started
      var actor = roomData.currentOrder[roomData.currentActor];
      var word = roomData.currentWord;

      // Gives user time to join before sending room info
      if (roomData.roundRunning) {
        setTimeout(() => {
          if (word) {
            io.to(id).emit("actor", { actor });
            io.to(id).emit("word", { word });
          }
        }, 2000);
      }
    }
  }
};

const removeUserFromGame = (room, username) => {
  room = room.toUpperCase();
  if (activeGames.has(room)) {
    var roomData = activeGames.get(room);
    var isActor = roomData.currentOrder[roomData.currentActor] === username;

    if (roomData.userPoints.has(username)) {
      // Remove user from users with points and actor candidates
      roomData.userPoints.delete(username);
      const index = roomData.currentOrder.indexOf(username);
      if (index > -1) {
        roomData.currentOrder.splice(index, 1);
      }

      // If user leaves as the current actor, end the turn
      if (isActor) {
        roomData.timer = 0;
      }
    }

    // If lastUser in room, endGame
    if (roomData.userPoints.size === 0) {
      endGame(room);
    } else if (roomData.userPoints.size === 1) {
      roomData.timer = 0;
    }
  }
};

var timeoutWord;

const runGame = (room) => {
  room.toUpperCase();
  if (activeGames.has(room)) {
    var roomData = activeGames.get(room);
    if (
      roomData.timer <= -1 ||
      (roomData.userPoints.size !== 1 &&
        roomData.guessedCorrectly.size === roomData.userPoints.size - 1)
    ) {
      // Wait for time to pass before starting game
      var timeSinceLastGame = currentTime() - roomData.lastTimerUpdate;

      if (timeSinceLastGame > timeoutBetweenGames) {
        roomData.currentActor += 1;

        if (roomData.currentActor >= roomData.currentOrder.length) {
          // Start new round
          // Get random order of actors
          roomData.currentOrder = shuffle(roomData.currentOrder);
          roomData.currentActor = 0;
        }

        //sendActor
        var actor = roomData.currentOrder[roomData.currentActor];
        io.in(room).emit("actor", { actor });

        roomData.currentWord = null;
        timeoutWord = sendWordChoices(actor, room);

        roomData.guessedCorrectly = new Set();

        roomData.timer = 60;

        //send timer
        var time = roomData.timer;
        io.in(room).emit("timer", { time });

        roomData.lastTimerUpdate = currentTime();
        roomData.roundRunning = true;
      }
    } else {
      var timeSinceLastUpdate = currentTime() - roomData.lastTimerUpdate;

      if (roomData.userPoints.size === 1) {
        roomData.roundRunning = false;
      } else if (!roomData.roundRunning && roomData.userPoints.size >= 2) {
        roomData.timer = -1;
      }

      if (roomData.currentWord === null) {
        if (timeSinceLastUpdate >= 10000) {
          roomData.currentWord = timeoutWord;
          io.in(room).emit("word", { word: roomData.currentWord });
        }
      } else if (timeSinceLastUpdate > 1000 && roomData.roundRunning) {
        roomData.timer -= 1;

        // send update timer
        var time = roomData.timer;
        io.in(room).emit("timer", { time });

        roomData.lastTimerUpdate = currentTime();
      }
    }
  } else {
    console.log("an unexpected error has occured while running game");
  }
};

const shuffle = (array) => {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

const sendWordChoices = (actor, room) => {
  gameData = activeGames.get(room.toUpperCase());
  let wordChoices = new Set();
  users = getUsersFromRoom(room.toUpperCase());
  while (wordChoices.size < 3) {
    wordChoices.add(words[Math.floor(Math.random() * words.length)]);
  }
  wordChoices = Array.from(wordChoices);

  for (let key in users) {
    if (users[key].userName === actor) {
      io.to(users[key].userId).emit("wordChoices", wordChoices);
    }
  }
  return wordChoices[Math.floor(Math.random() * 3)];
};

const isGameActive = (room) => {
  return activeGames.has(room);
};

const userGuess = (room, username, guess) => {
  var r = room.toUpperCase();

  // If the room exists
  if (activeGames.has(r)) {
    var gameData = activeGames.get(r);

    // If username exists in room and is not the current actor
    if (
      gameData.userPoints.has(username) &&
      gameData.currentOrder[gameData.currentActor] != username
    ) {
      // If the current word has been set
      if (gameData.currentWord) {
        // If the user has not already guessed correctly
        if (!gameData.guessedCorrectly.has(username)) {
          // If the guess is the same as the word
          if (
            guess.trim().toLowerCase() ===
            gameData.currentWord.trim().toLowerCase()
          ) {
            gameData.guessedCorrectly.add(username);
            addUserPoint(username, room);
            gameData.timer = Math.ceil(gameData.timer * 0.75);
            return true;
          }
        }
      }
    }
  }
  return false;
};

const addUserPoint = (username, room) => {
  var gameData = activeGames.get(room.toUpperCase());
  gameData.userPoints.set(
    username,
    gameData.userPoints.get(username) + gameData.timer * 10
  );
  gameData.userPoints.set(
    gameData.currentOrder[gameData.currentActor],
    gameData.userPoints.get(gameData.currentOrder[gameData.currentActor]) + 100
  );
};

const getUserPoints = (room) => {
  return activeGames.get(room.toUpperCase()).userPoints;
};

const distMessage = (user, message) => {
  gameData = activeGames.get(user.roomName.toUpperCase());
  users = getUsersFromRoom(user.roomName.toUpperCase());

  // if the user has correctly guessed, only send their message to others who also correctly guessed
  if (
    gameData.guessedCorrectly !== null &&
    gameData.guessedCorrectly.has(user.userName)
  ) {
    for (var key in users) {
      if (
        gameData.guessedCorrectly.has(users[key].userName) ||
        users[key].userName === gameData.currentOrder[gameData.currentActor]
      ) {
        io.to(users[key].userId).emit("message", {
          user: user.userName,
          text: message,
        });
      }
    }
  } else {
    if (gameData.currentOrder[gameData.currentActor] !== user.userName) {
      io.to(user.roomName.toUpperCase()).emit("message", {
        user: user.userName,
        text: message,
      });
    }
  }
};

module.exports = {
  createGame,
  userGuess,
  addUserPoint,
  endGame,
  removeUserFromGame,
  isGameActive,
  addUserToGame,
  getUserPoints,
  distMessage,
  setCurrentWord,
};
