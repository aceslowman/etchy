/* global React, ReactDOM */
const App = () => {
  return (
    <ThemeContext.Provider
      value={{
        text_color: "black",
        background_color: "rgb(248 251 255)",
        foreground_color: "rgb(95 111 255)",
        accent_color: "rgb(95 111 255)"
      }}
    >
      <AppWrapper>
        <Settings>
          <InputPanel title="basic">
            <Button onClick={() => {}}>register</Button>
          </InputPanel>  
        </Settings>
        <div
          style={{
            flexGrow: 2,
            position: "relative",
            overflow: "overlay"
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            something
          </div>
        </div>
      </AppWrapper>
    </ThemeContext.Provider>
  );
};

const domContainer = document.getElementById("APP");
ReactDOM.render(React.createElement(App), domContainer);
