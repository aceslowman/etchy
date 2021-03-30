/* global THREE, React, ReactDOM */

const Sphere = () => {
  const container = React.useRef();
  let 

  const init = () => {
    // let container = document.getElementById("glcontainer");
    let bounds = container.current.getBoundingClientRect();
    console.log("bounds", bounds);

    const geometry = new THREE.PlaneGeometry(512, 512);
    const material = new THREE.MeshBasicMaterial({
      //CHANGED to MeshBasicMaterial
      // map: spraycanImg,
      map: circleImg,
      magFilter: THREE.NearestFilter
    });
    material.map.needsUpdate = true;

    symbol = new THREE.Mesh(geometry, material);
    scene.add(symbol);

    renderer = new THREE.WebGLRenderer();
    // renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(bounds.width, bounds.height);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;

    container.appendChild(renderer.domElement);

    // stats = new Stats();
    // container.appendChild(stats.dom);
  };

  React.useEffect(() => {
    init();
  }, []);

  return (
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
        ref={container}
      >
        something
      </div>
    </div>
  );
};

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
        <Sphere />
      </AppWrapper>
    </ThemeContext.Provider>
  );
};

const domContainer = document.getElementById("APP");
ReactDOM.render(React.createElement(App), domContainer);
