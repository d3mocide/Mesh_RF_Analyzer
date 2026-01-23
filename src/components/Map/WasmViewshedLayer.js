import { BitmapLayer } from '@deck.gl/layers';


// Fragment Shader: Visualizes the 1-byte visibility mask
// Data comes in as Red channel (R8) if using single channel texture,
// or we just pack it. 
// For simplicity with standard BitmapLayer, we might need to rely on the texture being loaded as Luminance if strictly 1-byte.
// But BitmapLayer usually expects RGBA or Image.
// We'll try to treat it as a texture where value > 0 is visible.

const fs = `\
#version 300 es
precision highp float;

uniform sampler2D bitmapTexture;
uniform vec4 bounds;
uniform float opacity;

in vec2 vTexCoord;
out vec4 fragColor;

void main() {
    vec4 texColor = texture(bitmapTexture, vTexCoord);
    
    // texColor.r contains the visibility (0 or 1, scaled to 0.0-1.0 by sampler? 
    // If R8, 1 becomes 1/255. 0 becomes 0.
    
    float visible = texColor.r;
    
    if (visible > 0.0) {
        // Visible: Green/Yellow tint
        // Hardcoded opacity to debug uniform issue
        fragColor = vec4(0.2, 1.0, 0.2, 0.6);
    } else {
        // Invisible or No Data
        discard;
    }
}
`;

export default class WasmViewshedLayer extends BitmapLayer {
  getShaders() {
    return {
      ...super.getShaders(),
      fs
    };
  }

  draw(opts) {
    const { bounds } = this.props;
    const uniforms = {
        bounds: bounds || [0, 0, 0, 0],
        opacity: this.props.opacity !== undefined ? this.props.opacity : 1.0
    };
    if (this.state.model && this.state.model.shaderInputs) {
      this.state.model.shaderInputs.setProps({ uniforms });
    }
    super.draw(opts); // Pass opts as is
  }
}

WasmViewshedLayer.layerName = 'WasmViewshedLayer';
WasmViewshedLayer.defaultProps = {
    ...BitmapLayer.defaultProps,
    // We expect 'image' to be the Uint8Array or object. 
    // If it's Uint8Array, we need to specify dimensions.
    // deck.gl BitmapLayer handles ImageData or ImageBitmap best.
    // We'll pass an object with width/height/data to construction if needed.
};
