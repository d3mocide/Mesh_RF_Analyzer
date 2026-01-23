import { BitmapLayer } from '@deck.gl/layers';

// Fragment Shader: Renders RF signal strength as SNR-based gradient
// Signal strength (dBm) is converted to SNR and mapped to colors
const fs = `\
#version 300 es
precision highp float;

uniform sampler2D bitmapTexture;
uniform vec4 bounds;
uniform float opacity;
uniform float rxSensitivity; // RX sensitivity in dBm
uniform float noiseFloor; // Noise floor in dBm

in vec2 vTexCoord;
out vec4 fragColor;

// Convert signal strength (dBm) to SNR (dB)
float calculateSNR(float rssi_dbm) {
    return rssi_dbm - noiseFloor;
}

// SNR to Color Mapping (LoRa/MeshCore Quality Thresholds)
// > 10 dB = Excellent (dark green)
// 5-10 dB = Great (light green)
// 0-5 dB = Good/Okay (yellow)
// -7 to 0 dB = Fair/Marginal (orange)
// < -7 dB = Poor (red/transparent)
vec4 snrToColor(float snr) {
    if (snr > 10.0) {
        // Excellent: Dark Green
        return vec4(0.0, 0.6, 0.0, 0.8);
    } else if (snr > 5.0) {
        // Great: Light Green
        float t = (snr - 5.0) / 5.0;
        return vec4(0.0, mix(0.9, 0.6, t), 0.0, 0.75);
    } else if (snr > 0.0) {
        // Good/Okay: Yellow
        float t = snr / 5.0;
        return vec4(mix(1.0, 0.0, t), mix(1.0, 0.9, t), 0.0, 0.7);
    } else if (snr > -7.0) {
        // Fair/Marginal: Orange to Red
        float t = (snr + 7.0) / 7.0;
        return vec4(1.0, mix(0.0, 0.5, t), 0.0, 0.6);
    } else {
        // Poor: Red fading to transparent
        float alpha = max(0.0, (snr + 15.0) / 8.0); // Fade out below -15 dB
        return vec4(0.8, 0.0, 0.0, alpha * 0.5);
    }
}

void main() {
    // Sample signal strength from texture (stored as normalized float)
    vec4 texColor = texture(bitmapTexture, vTexCoord);
    
    // Decode signal strength (dBm) from red channel
    // Texture sampler automatically converts 0-255 byte to 0.0-1.0 float
    // Original encoding: byte = (dBm + 150) / 200 * 255
    // Decoding: dBm = (texColor.r * 255 / 255) * 200 - 150 = texColor.r * 200 - 150
    float rssi_dbm = texColor.r * 200.0 - 150.0;
    
    // Debug: Show ALL non-zero pixels to verify tex loading
    if (texColor.r == 0.0) {
        discard; // Only discard pure black (no data)
    }
    
    // Check if signal is above RX sensitivity
    if (rssi_dbm >= rxSensitivity) {
        // Usable Signal
        float snr = calculateSNR(rssi_dbm);
        vec4 color = snrToColor(snr);
        fragColor = vec4(color.rgb, color.a * opacity);
    } else {
        // Weak Signal (Below Sensitivity) - Visualize as faint Blue
        // Map -150 to -120 to alpha 0.0-0.3
        float range = rxSensitivity - (-150.0);
        float t = (rssi_dbm - (-150.0)) / range;
        
        // Faint Blue/Grey
        fragColor = vec4(0.0, 0.2, 0.5, t * 0.4 * opacity); 
    }
}
`;

export default class RFCoverageLayer extends BitmapLayer {
  getShaders() {
    return {
      ...super.getShaders(),
      fs
    };
  }

  draw(opts) {
    const { bounds, rfParams } = this.props;
    
    // Calculate noise floor from LoRa parameters
    // Thermal noise: -174 dBm/Hz + 10*log10(BW)
    const bw = rfParams?.bw || 125000; // Default 125kHz
    const noiseFloor = -174 + 10 * Math.log10(bw);
    
    const uniforms = {
        bounds: bounds || [0, 0, 0, 0],
        opacity: this.props.opacity !== undefined ? this.props.opacity : 1.0,
        rxSensitivity: rfParams?.rxSensitivity || -120.0,
        noiseFloor: noiseFloor
    };
    
    if (this.state.model && this.state.model.shaderInputs) {
      this.state.model.shaderInputs.setProps({ uniforms });
    }
    
    super.draw(opts);
  }
}

RFCoverageLayer.layerName = 'RFCoverageLayer';
RFCoverageLayer.defaultProps = {
    ...BitmapLayer.defaultProps,
    rfParams: { type: 'object', value: null, optional: true }
};
