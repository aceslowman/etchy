import * as THREE from "three";
import OrbitControls from "three/examples/jsm/controls/OrbitControls.js";

class Sphere {
  constructor() {
    this.solid_geo = new THREE.SphereGeometry(150, 32, 32);
    this.solid_mat = new THREE.MeshBasicMaterial();
    // this.mesh = new THREE.Mesh(this.solid_geo, this.solid_mat);
    
    this.smaller_geo = new THREE.SphereGeometry(148, 32, 32);
    this.mesh = new THREE.Mesh(this.smaller_geo, this.solid_mat);

    this.wire_geo = new THREE.EdgesGeometry(this.solid_geo); // or WireframeGeometry( geometry )
    this.wire_mat = new THREE.LineBasicMaterial({ color: "#5F6FFF" });
    this.wireframe = new THREE.LineSegments(this.wire_geo, this.wire_mat);
  }
  
  update() {
//     this.mesh.rotation.x += 0.005;
//     this.mesh.rotation.y += 0.01;

//     this.wireframe.rotation.x += 0.005;
//     this.wireframe.rotation.y += 0.01;      
  }
}

export default Sphere;
