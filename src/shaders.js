const screenVert = `
  precision highp float;
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;

  varying highp vec2 vTextureCoord;

  void main() {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const screenFrag = `
  precision highp float;
  uniform sampler2D tex0;
  uniform sampler2D tex1;
  uniform vec2 resolution;
  uniform vec2 texdim0;
  uniform vec2 texdim1;
  
  varying highp vec2 vTextureCoord;
  
  // https://github.com/jamieowen/glsl-blend/blob/master/screen.glsl
  float blendScreen(float base, float blend) {
    return 1.0-((1.0-base)*(1.0-blend));
  }
  
  vec3 blendScreen(vec3 base, vec3 blend) {
    return vec3(blendScreen(base.r,blend.r),blendScreen(base.g,blend.g),blendScreen(base.b,blend.b));
  }

  vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
    return (blendScreen(base, blend) * opacity + base * (1.0 - opacity));
  }
  
  void main() {
    vec2 uv0 = vTextureCoord;
    vec2 uv1 = vTextureCoord;
   
    if(texdim0.x < texdim0.y) {
      float windowAspect = resolution.y / resolution.x;
      float aspect = texdim0.y / texdim0.x;
      uv0.y /= aspect;
      // uv0.y -= (windowAspect * aspect) / 2.0;
      // uv0.y += 0.5;
    }
    
    if(texdim1.x < texdim1.y) {
      float windowAspect = resolution.y / resolution.x;
      float aspect = texdim1.y / texdim1.x;
      uv1.y /= aspect;
      // uv1.y -= (windowAspect * aspect) / 2.0;
      // uv1.y += 0.5;
    }
    
    vec3 v0 = texture2D(tex0, uv0).rgb;
    vec3 v1 = texture2D(tex1, uv1).rgb;
    
    gl_FragColor = vec4(blendScreen(v0,v1,1.0),1.0);
  }
`;

const multiplyVert = `
  precision highp float;
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;
  
  varying highp vec2 vTextureCoord;

  void main() {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const multiplyFrag = `
  precision highp float;
  uniform sampler2D tex0;
  uniform sampler2D tex1;
  
  uniform vec2 resolution;
  uniform vec2 texdim0;
  uniform vec2 texdim1;
  
  varying highp vec2 vTextureCoord;
  
  void main() {
    vec2 uv0 = vTextureCoord;
    vec2 uv1 = vTextureCoord;
   
    if(texdim0.x < texdim0.y) {
      float windowAspect = resolution.y / resolution.x;
      float aspect = texdim0.y / texdim0.x;
      uv0.y /= aspect;
      // uv0.y -= (windowAspect * aspect) / 2.0;
      // uv0.y += 0.5;
    }
    
    if(texdim1.x < texdim1.y) {
      float windowAspect = resolution.y / resolution.x;
      float aspect = texdim1.y / texdim1.x;
      uv1.y /= aspect;
      // uv1.y -= (windowAspect * aspect) / 2.0;
      // uv1.y += 0.5;
    }
    
    vec3 v0 = texture2D(tex0, uv0).rgb;
    vec3 v1 = texture2D(tex1, uv1).rgb;
    //gl_FragColor = vec4(vec3(texdim1),1.0);
    gl_FragColor = vec4(v0 * v1,1.0);
  }
`;

module.exports = {
  screenVert,
  screenFrag,
  multiplyVert,
  multiplyFrag
};
