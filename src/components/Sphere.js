import * as THREE from "three";

class Sphere {
  constructor() {
    this.solid_geo = new THREE.SphereGeometry(150, 32, 32);
    this.solid_mat = new THREE.MeshNormalMaterial();
    this.mesh = new THREE.Mesh(this.solid_geo, this.solid_mat);
    // scene.add(sphere);

    this.wire_geo = new THREE.EdgesGeometry(this.solid_geo); // or WireframeGeometry( geometry )
    this.wire_mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    this.wireframe = new THREE.LineSegments(this.wire_geo, this.wire_mat);
    // scene.add(wireframe);
  }
  
  
}

export default Sphere;
