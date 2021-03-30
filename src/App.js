import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";      

const Sphere = () => {
  const container = React.useRef();

  React.useEffect(() => {
    let renderer, scene, cameraPerspective, sphere, wireframe;

    const init = () => {
      // let container = document.getElementById("glcontainer");
      let bounds = container.current.getBoundingClientRect();
      console.log("bounds", bounds);

      cameraPerspective = new THREE.PerspectiveCamera(
        70,
        bounds.width / bounds.height,
        1,
        1000
      );
      cameraPerspective.position.z = 400;

      scene = new THREE.Scene();

      const geometry = new THREE.SphereGeometry(150, 32, 32);
      const material = new THREE.MeshNormalMaterial();
      sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);

      var geo = new THREE.EdgesGeometry(geometry); // or WireframeGeometry( geometry )
      var mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
      wireframe = new THREE.LineSegments(geo, mat);
      scene.add(wireframe);

      renderer = new THREE.WebGLRenderer();
      // renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(bounds.width, bounds.height);
      // renderer.setClearColor(0x000000, 0);
      // renderer.autoClear = false;

      container.current.appendChild(renderer.domElement);

      // stats = new Stats();
      // container.appendChild(stats.dom);
    };

    const animate = () => {
      requestAnimationFrame(animate);

      // stats.begin();
      render();
      // stats.end();
    };

    const render = () => {
      sphere.rotation.x += 0.005;
      sphere.rotation.y += 0.01;
      
      wireframe.rotation.x += 0.005;
      wireframe.rotation.y += 0.01;

      renderer.render(scene, cameraPerspective);
    };

    init();
    animate();
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

export default App;