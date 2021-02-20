import React, { useState, useCallback, useEffect } from "react";
import Peer from "peerjs";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

import { socket } from "./Socket";

const PEER_OPTIONS = {
  host: "localhost",
  port: "9000",
  path: "video",
  debug: 3,
};

const App = () => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [players, setPlayers] = useState([]); // player = {userId, username, stream, call}
  const [state, setState] = useState("home");
  const [myPeer, setMyPeer] = useState(null);

  const handleNameChange = useCallback((event) => {
    setName(event.target.value);
  }, []);

  const handleRoomChange = useCallback((event) => {
    setRoom(event.target.value.trim().toUpperCase());
  }, []);

  const addPlayer = (userId, username, stream, call) => {
    console.log("adding player", players);
    setPlayers((prevplayers) => [
      ...prevplayers,
      {
        userId: userId,
        username: username,
        stream: stream,
        call: call,
      },
    ]);
  };

  const connectToNewUser = (userId, username, stream) => {
    console.log(
      `connecting to ${userId}, ${username} at ${new Date().getTime()}`
    );
    const call = myPeer.call(userId, stream, { metadata: { username: name } });

    console.log(`setting up stream for response ${new Date().getTime()}`);
    let count = 0;
    call.on("stream", (userVideoStream) => {
      if (count++ % 2 === 0) {
        console.log(
          `receiving stream from ${username} at ${new Date().getTime()}`
        );
        addPlayer(userId, username, userVideoStream, call);
      }
    });
  };

  useEffect(() => {
    // Setup peer on startup
    console.log(socket.id);
    setMyPeer(new Peer(socket.id, PEER_OPTIONS));
  }, []);

  useEffect(() => {
    if (myPeer) {
      myPeer.on("error", (err) => {
        console.log(err.type, err);
      });

      socket.on("joinRoomResponse", ({ response, room }) => {
        const { status, message } = response;
        console.log("Success:", response);
        if (status === 0) {
          setRoom(room);
          setState("lobby");
        } else {
          alert(message);
        }
      });

      socket.on("startGameResponse", ({ response }) => {
        const { status, message } = response;
        console.log("Success:", response);
        if (status === 0) {
          setState("game");
        } else {
          alert(message);
        }
      });

      socket.on("userDisconnected", ({ userId }) => {
        console.log(`Removing user ${userId}`);

        // Close connection to user
        var dcUser = players.find((player) => player.userId === userId);
        if (dcUser) {
          dcUser.call.close();
        }

        // Remove user from plays
        setPlayers((prevPlayers) =>
          prevPlayers.filter((p) => p.userId !== userId)
        );
      });
    }
  }, [myPeer]);

  useEffect(() => {
    const setupConnections = async (stream) => {
      // Setup socket to answer calls and share stream from other users
      console.log("setting up answering machine", new Date().getTime());
      await myPeer.on("call", (call) => {
        const userId = call.peer;
        const username = call.metadata.username;
        console.log(
          `receiving call from ${username} at ${new Date().getTime()}`
        );
        call.answer(stream);

        // Wait to receive the users stream
        console.log("setting up stream answer once");
        let count = 0;
        call.on("stream", (userVideoStream) => {
          if (count++ % 2 === 0) {
            console.log(
              `receiving stream from ${userId} at ${new Date().getTime()}`
            );
            addPlayer(userId, username, userVideoStream, call);
          }
        });
      });

      // Setup listener that calls new user when they connect
      socket.on("userConnected", (userId, username) => {
        connectToNewUser(userId, username, stream);
      });
    };

    if (state === "lobby") {
      navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: true,
        })
        .then((stream) => {
          // Add client stream to players
          addPlayer(socket.id, name, stream, null);

          // After all connections are made, let server know to let other users in room know.
          setupConnections(stream).then(() => {
            console.log("connecting to other users");
            socket.emit("userConnected", room);
          });
        });
    }
  }, [state]);

  let render;
  if (state === "home") {
    render = (
      <Home
        name={name}
        room={room}
        handleNameChange={handleNameChange}
        handleRoomChange={handleRoomChange}
      />
    );
  } else if (state === "lobby") {
    render = <Lobby room={room} players={players} />;
  } else {
    render = <Game room={room} name={name} players={players} />;
  }

  return render;
};

export default App;
