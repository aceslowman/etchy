const blendVert = `
  attribute vec4 position;
  void main() {
    gl_Position = position;
  }
`;

const blendFrag = `
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
`;

module.export = {
  blendVert,
  blendFrag
};
