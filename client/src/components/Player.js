import React, { useEffect, useRef, useCallback, useState } from "react";
import "./Player.css";

import fullVolume from "../resources/icons/volumeFull.svg";
import halfVolume from "../resources/icons/volumeHalf.svg";
import mute from "../resources/icons/mute.svg";

const Player = ({ player, muted, isActor, overlayContents }) => {
  const [volumeVal, setVolumeVal] = useState(player.volume);
  const [prevVolumeVal, setPrevVolumeVal] = useState(0.5);
  const userVideo = useRef();

  useEffect(() => {
    if (userVideo.current) {
      userVideo.current.srcObject = player.stream;
    }
  }, [player.stream]);

  useEffect(() => {
    if (userVideo.current) {
      userVideo.current.volume = volumeVal;
    }
  }, [volumeVal]);

  const handleVolumeChange = useCallback((event) => {
    setVolumeVal(event.target.value);
    player.volume = event.target.value;
  }, []);

  const handleVolumePress = useCallback(
    (event) => {
      if (volumeVal !== 0) {
        setPrevVolumeVal(volumeVal);
        setVolumeVal(0);
        player.volume = 0;
        document.getElementById("volControl").value = 0;
      } else {
        setVolumeVal(prevVolumeVal);
        player.volume = prevVolumeVal;
        document.getElementById("volControl").value = prevVolumeVal;
      }
    },
    [volumeVal]
  );

  const getVolumeIcon = () => {
    if (volumeVal === 0) {
      return mute;
    } else if (volumeVal < 0.5) {
      return halfVolume;
    } else {
      return fullVolume;
    }
  };

  return (
    <div className="playerContainer">
      <div className="videoArea">
        {isActor && overlayContents ? (
          <div className="actor-overlay">{overlayContents}</div>
        ) : (
          ""
        )}
        <video
          ref={userVideo}
          autoPlay={true}
          muted={muted}
          className="playerVideo"
        ></video>
        {!muted ? (
          <div className="volumeControls">
            <img
              className="volumeButton"
              src={getVolumeIcon()}
              onClick={handleVolumePress}
            />
            <input
              className="slider"
              id="volControl"
              type="range"
              min="0"
              max="1"
              value={volumeVal}
              step="0.01"
              onChange={handleVolumeChange}
            ></input>
          </div>
        ) : (
          ""
        )}
      </div>
      {isActor ? <div className="timer" id="timer" /> : ""}
      {isActor ? <div className="mask" id="mask" /> : ""}
    </div>
  );
};

export default Player;
