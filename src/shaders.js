const screenVert = `
  precision highp float;
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;

  varying highp vec2 vTextureCoord;

  void main(void) {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const screenFrag = `
  precision highp float;
  uniform sampler2D tex0;
  uniform sampler2D tex1;
  
  varying highp vec2 vTextureCoord;
  
  void main() {
    vec4 v0 = texture2D(tex0, vTextureCoord);
    vec4 v1 = texture2D(tex1, vTextureCoord);
    // gl_FragColor = v0;
    gl_FragColor = vec4(0.0,1.0,0.0,1.0);
  }
`;

const multiplyVert = `
  precision highp float;
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;
  
  varying highp vec2 vTextureCoord;

  void main(void) {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const multiplyFrag = `
  precision highp float;
  uniform sampler2D tex0;
  uniform sampler2D tex1;
  
  varying highp vec2 vTextureCoord;
  
  void main() {
    vec4 v0 = texture2D(tex0, vTextureCoord);
    vec4 v1 = texture2D(tex1, vTextureCoord);
    // gl_FragColor = v0;
    gl_FragColor = vec4(1.0,0.0,0.0,1.0);
  }
`;

module.exports = {
  screenVert,
  screenFrag,
  multiplyVert,
  multiplyFrag
};
