import React, { useEffect, useState, useRef } from "react";

// NOTE-UI version 0.1.0
// author: Austin Slominski (@aceslowman)

const ThemeContext = React.createContext({
  // text_color: "black",
  // background_color: "white",
  // foreground_color: "#6e2a00",
  // accent_color: "green"
});

const NumberInput = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <input
      onChange={props.onChange}
      type="number"
      step={props.step ? props.step : "1"}
      value={props.value}
      style={{
        backgroundColor: "#fff",
        color: theme.text_color,
        border: "1px dotted " + theme.text_color,
        minWidth: "0px",
        ...props.style
      }}
    />
  );
};

const Checkbox = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <input
      onChange={props.onChange}
      type="checkbox"
      checked={props.checked}
      style={{
        ...props.style
      }}
    />
  );
};

const Select = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <select
      style={{
        backgroundColor: "#fff",
        color: theme.text_color,
        border: "1px solid " + theme.text_color,
        minWidth: "0px",
        flexGrow: "2"
      }}
      onChange={props.onChange}
      value={props.value}
    >
      {props.children}
    </select>
  );
};

const Button = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <button
      style={{
        backgroundColor: props.active ? theme.foreground_color : "#fff",
        color: props.active ? "#fff" : theme.text_color,
        border: "1px solid " + theme.text_color,
        flexGrow: "2",
        whiteSpace: "nowrap",
        ...props.style
      }}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};

const Label = props => {
  return (
    <label
      style={{ padding: "5px 5px 5px 0px", ...props.style }}
      htmlFor={props.htmlFor}
    >
      {props.children}
    </label>
  );
};

const AppWrapper = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <div
      style={{
        backgroundColor: theme.background_color,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "0px",
        margin: "0px",
        ...props.style
      }}
    >
      {props.children}
    </div>
  );
};

const InputPanel = props => {
  const theme = React.useContext(ThemeContext);
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div
      style={{
        display: "flex",
        margin: "5px 0px",
        width: "100%",
        flexFlow: "column",
        border: "1px groove " + theme.text_color,
        padding: "10px",
        ...props.style
      }}
    >
      <h3 style={{ margin: "0px 0px 8px 0px" }}>{props.title}</h3>
      {props.children}
    </div>
  );
};

const InputGroup = props => (
  <div
    style={{
      display: "flex",
      flexFlow: "column",
      alignSelf: "flex-end",
      width: "48%"
    }}
  >
    {props.children}
  </div>
);

const InputRow = props => (
  <div
    style={{
      display: "flex",
      flexFlow: "row",
      width: "100%",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: "5px"
    }}
  >
    {props.children}
  </div>
);

const Credits = props => {
  const theme = React.useContext(ThemeContext);
  return (
    <div
      style={{
        color: theme.text_color,
        lineBreak: "anywhere",
        whiteSpace: "pre",
        margin: "15px 0px",
        padding: "5px",
        ...props.style
      }}
    >
      <a href={props.projectUrl} target="_blank">
        <strong>{props.projectName}</strong>
      </a>
      &nbsp;by&nbsp;
      <a href={props.authorUrl} target="_blank">
        {props.authorName}
      </a>
    </div>
  );
};

const Settings = props => {
  const theme = React.useContext(ThemeContext);
  let [expanded, setExpanded] = React.useState();

  React.useEffect(() => {
    // if found in local storage, restore expanded state
    if (window.localStorage.getItem("settingsIsExpanded") !== null)
      setExpanded(
        window.localStorage.getItem("settingsIsExpanded") === "true"
          ? true
          : false
      );
  }, [setExpanded]);

  const toggleSettings = props => {
    setExpanded(prev => !prev);
    window.localStorage.setItem("settingsIsExpanded", !expanded);
  };

  return (
    <div
      style={{
        width: expanded ? "300px" : "0%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        // -webkit-transition: width 1s ease-in-out,
        // -moz-transition: width 1s ease-in-out,
        // -o-transition: width 1s ease-in-out,
        transition: "width 1s ease-in-out",
        zIndex: 2
      }}
    >
      <div
        className="settingsInner"
        style={{
          backgroundColor: theme.background_color,
          color: theme.text_color,
          padding: "15px",
          display: "flex",
          flexFlow: "column",
          height: "100%",
          width: "100%",
          boxSizing: "border-box",
          alignContent: "stretch",
          zIndex: "2",
          paddingRight: "25px",
          justifyContent: "space-between",
          overflowY: "overlay"
        }}
      >
        {React.Children.map(props.children, (child, index) => {
          return React.cloneElement(child, {
            ...child.props,
            style: {
              display: "flex",
              boxShadow: "2px 2px 6px 0px",
              ...child.props.style
            }
          });
        })}
      </div>
      <div
        className="toggleSettings"
        style={{
          backgroundColor: theme.foreground_color,
          width: "20px",
          height: "20px",
          transform: "translate(10px, -0px) rotate(45deg)",
          position: "absolute",
          zIndex: "1"
        }}
        onClick={toggleSettings}
      ></div>
    </div>
  );
};

const MIDILog = props => {
  const [enable, setEnable] = React.useState(false);
  const [log, setLog] = React.useState([]);
  const tail_length = 10; // limit length of log

  React.useEffect(() => {
    if (!enable) return;

    const handleDeviceLog = m => {
      let [noteon, note, velocity] = m.data;
      // noteon: 144(on) or 128(off)
      // pitch: 0-127
      // velocity: 0-127
      log.push({ noteon, note, velocity });
      if (log.length > tail_length) log.shift();
      setLog(log);
    };

    if (props.device) {
      props.device.addEventListener("midimessage", handleDeviceLog);
      return () =>
        props.device.removeEventListener("midimessage", handleDeviceLog);
    }
  }, [props.device, log, setLog, enable]);

  return (
    <div style={props.style}>
      {enable && (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>noteon</th>
              <th>note</th>
              <th>velocity</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e, i) => {
              return (
                <tr
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 0 ? "#ccc" : "transparent"
                  }}
                >
                  <td>{e.noteon}</td>
                  <td>{e.note}</td>
                  <td>{e.velocity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div>
        <label>log:</label>
        <input
          type="checkbox"
          checked={enable}
          onChange={e => setEnable(e.target.checked)}
        />
      </div>
    </div>
  );
};

export {
  ThemeContext,
  NumberInput,
  Checkbox,
  Select,
  Button,
  Label,
  AppWrapper,
  InputPanel,
  InputGroup,
  InputRow,
  Credits,
  Settings,
  MIDILog
};
