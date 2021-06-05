const screenVert = `
  attribute vec4 position;
  void main() {
    gl_Position = position;
  }
`;

const screenFrag = `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
`;

const multiplyVert = `
  attribute vec4 position;
  void main() {
    gl_Position = position;
  }
`;

const multiplyFrag = `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
`;

module.export = {
  screenVert,
  screenFrag,
  multiplyVert,
  multiplyFrag
};
