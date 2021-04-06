import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import Sphere from "./Sphere";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// import Stats from "three/examples/jsm/libs/stats.module.js";

const ThreeCanvas = () => {
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

      sphere = new Sphere();

      scene.add(sphere.mesh);
      scene.add(sphere.wireframe);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialiasing: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(bounds.width, bounds.height);
      renderer.setClearColor(0x000000, 0);

      container.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(
        cameraPerspective,
        renderer.domElement
      );

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
      sphere.update();

      renderer.render(scene, cameraPerspective);
    };

    init();
    animate();
  }, []);

  return (
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
    ></div>
  );
};

export default ThreeCanvas;
