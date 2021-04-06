import React, { useEffect, useState, useRef } from "react";
import * as UI from "note-ui";
import * as THREE from "three";
import ThreeCanvas from "./components/ThreeCanvas.js";
// import Stats from "three/examples/jsm/libs/stats.module.js";

const App = () => {
  React.useEffect(() => {
    // remove loading screen
    document.querySelector(".loading").style.display = "none";
  }, []);

  return (
    <UI.ThemeContext.Provider
      value={{
        text_color: "black",
        background_color: "rgb(248 251 255)",
        foreground_color: "rgb(95 111 255)",
        accent_color: "#5F6FFF"
      }}
    >
      <UI.AppWrapper>
        <UI.Settings>
          <UI.InputPanel title="basic">
            <UI.InputPanel title="about you">address: {}</UI.InputPanel>
            <UI.TextInput> </UI.TextInput>
            <UI.Button onClick={() => {}}>register</UI.Button>
          </UI.InputPanel>
        </UI.Settings>
        <UI.MainContent
          style={{
            flexGrow: 2,
            position: "relative",
            overflow: "overlay"
          }}
        >
          <ThreeCanvas />
        </UI.MainContent>
      </UI.AppWrapper>
    </UI.ThemeContext.Provider>
  );
};

export default App;
