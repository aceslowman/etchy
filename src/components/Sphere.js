import * as THREE from "three";
import OrbitControls from "three/examples/jsm/controls/OrbitControls.js";

class Marker {
  constructor(_label, _position, _metadata) {
    this.label = _label;
    this.position = _position;
    this.metadata = _metadata;

    this.geometry = new THREE.SphereGeometry(10, 8, 8);
    this.material = new THREE.MeshBasicMaterial({ color: "orange" });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // random position on sphere
    let pos = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    pos.multiplyScalar(150);

    this.mesh.position.set(pos.x, pos.y, pos.z);
  }
}

class Sphere {
  constructor(scene) {
    this.scene = scene;
    this.solid_geo = new THREE.SphereGeometry(150, 32, 32);
    this.solid_mat = new THREE.MeshBasicMaterial();
    // this.mesh = new THREE.Mesh(this.solid_geo, this.solid_mat);

    this.smaller_geo = new THREE.SphereGeometry(148, 32, 32);
    this.mesh = new THREE.Mesh(this.smaller_geo, this.solid_mat);

    this.wire_geo = new THREE.EdgesGeometry(this.solid_geo); // or WireframeGeometry( geometry )
    this.wire_mat = new THREE.LineBasicMaterial({ color: "#5F6FFF" });
    this.wireframe = new THREE.LineSegments(this.wire_geo, this.wire_mat);

    this.scene.add(this.mesh);
    this.scene.add(this.wireframe);

    this.markers = [];

    this.addMarker(); // temp
    this.addMarker(); // temp
    this.addMarker(); // temp
    this.addMarker(); // temp
    this.addMarker(); // temp
    this.addMarker(); // temp
  }

  update() {
    // this.mesh.rotation.x += 0.001;
    // this.mesh.rotation.y += 0.005;
    // this.wireframe.rotation.x += 0.001;
    // this.wireframe.rotation.y += 0.005;
  }

  addMarker() {
    let marker = new Marker("test");
    this.markers.push(marker);
    //     add marker to sphere and scene
    this.scene.add(marker.mesh);
  }
}

export default Sphere;
