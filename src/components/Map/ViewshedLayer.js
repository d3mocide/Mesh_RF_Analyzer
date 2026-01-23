import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { picking } from '@deck.gl/core';

// WebGL 2.0 Fragment Shader for Viewshed
// Decodes Terrain-RGB elevation format and shows relative height
const fs = `\
#version 300 es
precision highp float;

uniform sampler2D bitmapTexture;
uniform vec3 observerPos; // lat, lon, height_meters (relative to sea level)
uniform vec4 bounds;      // west, south, east, north
uniform float maxDistance; // meters

in vec2 vTexCoord;
out vec4 fragColor;

// Decode Terrain-RGB format to height (meters)
float decodeHeight(vec4 color) {
    return -10000.0 + ((color.r * 255.0 * 256.0 * 256.0 + color.g * 255.0 * 256.0 + color.b * 255.0) * 0.1);
}

// Haversine approximation for shader
float distanceMeters(vec2 p1, vec2 p2) {
    float R = 6371000.0;
    float rad = 0.01745329251;
    float dLat = (p2.y - p1.y) * rad;
    float dLon = (p2.x - p1.x) * rad;
    float a = sin(dLat/2.0) * sin(dLat/2.0) +
              cos(p1.y * rad) * cos(p2.y * rad) *
              sin(dLon/2.0) * sin(dLon/2.0);
    return R * 2.0 * atan(sqrt(a), sqrt(1.0-a));
}

void main() {
    vec4 texColor = texture(bitmapTexture, vTexCoord);
    float currentHeight = decodeHeight(texColor);
    
    // Map vTexCoord to Lat/Lon
    // Standard Web Mercator tile mapping
    // bounds = [west, south, east, north]
    
    // Note: vTexCoord is standard OpenGL UV: (0,0) bottom-left
    // Images are usually loaded Top-Down.
    float lon = mix(bounds.x, bounds.z, vTexCoord.x);
    float lat = mix(bounds.w, bounds.y, vTexCoord.y); // Top to Bottom if standard image loading
    
    // Simple Distance Mask
    float d = distanceMeters(vec2(observerPos.y, observerPos.x), vec2(lat, lon));
    
    if (d > maxDistance) {
        discard;
    }
    
    // "Viewshed" Logic:
    // Simple delta-height for this prototype.
    // If ground is higher than observer, it's red.
    // If ground is lower, it's green.
    
    float delta = currentHeight - observerPos.z;
    
    vec4 color;
    if (delta > 0.0) {
        // Obstruction (Terrain higher than observer)
        color = vec4(1.0, 0.0, 0.0, 0.5); 
    } else {
        // Visible (Terrain lower)
        color = vec4(0.0, 1.0, 0.2, 0.3);
    }
    
    // Fade out at edge
    float alpha = 1.0 - smoothstep(maxDistance * 0.8, maxDistance, d);
    color.a *= alpha;
    
    fragColor = color;
}
`;

// Define a custom layer extending BitmapLayer to inject our shader
class ViewshedBitmapLayer extends BitmapLayer {
  getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      fs, // Inject our custom fragment shader
      // No inject needed as we define uniforms in fs directly
    };

  }

  draw(opts) {
    const { observerPos, bounds, maxDistance } = this.props;
    const uniforms = {
        observerPos: [observerPos.lng, observerPos.lat, observerPos.height || 0],
        bounds,
        maxDistance
    };
    if (this.state.model && this.state.model.shaderInputs) {
        this.state.model.shaderInputs.setProps({ uniforms });
    }
    super.draw(opts);
  }
}

ViewshedBitmapLayer.layerName = 'ViewshedBitmapLayer';
ViewshedBitmapLayer.defaultProps = {
    observerPos: null,
    bounds: [0, 0, 0, 0],
    maxDistance: 10000
};

// Custom Layer based on TileLayer to supply our custom sub-layer renderer
export class ViewshedLayer extends TileLayer {
  
  initializeState() {
      super.initializeState();
  }

  // Override getSubLayerProps instead of constructor hacks
  // But strictly speaking, we just want to set default props for the instance
  
  renderLayers() {
      return super.renderLayers();
  }
}

ViewshedLayer.defaultProps = {
    ...TileLayer.defaultProps,
    id: 'viewshed-tiles',
    data: '/api/tiles/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 14,
    tileSize: 256,
    
    // The customized sublayer renderer
    renderSubLayers: (props) => {
        const { bbox: { west, south, east, north } } = props.tile;
        // Grab observer from the parent layer props (passed into ViewshedLayer)
        // Access via props.observer (if passed via subLayerProps) or context? 
        // Correct way: The props passed to renderSubLayers *are* the specific tile props.
        // We need to access the parent layer's props.
        
        // In deck.gl, `this` inside renderSubLayers might not bind to the layer instance if not careful.
        // However, we can't easily access 'this' from a static default prop or pure function.
        
        // Wait, the cleaner way is to just export a function that *returns* a TileLayer instance
        // rather than subclassing if we are just configuring it.
        // But MapContainer does `new ViewshedLayer`.
        
        return new ViewshedBitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north],
            // We need to pass the observer from the parent props down.
            // When using TileLayer, props passed to the layer are available in `props` within renderSubLayers
            // IF we are careful. Actually, standard TileLayer renderSubLayers signature is (props).
            // These 'props' are the sub-layer props (tile, bounding box, etc.) merged with
            // what TileLayer passes down.
            // Use props.observerPos which we passed to the parent ViewshedLayer.
            
            observerPos: props.observerPos, 
            maxDistance: 20000.0,
            opacity: 0.8
        });
    }
};

ViewshedLayer.layerName = 'ViewshedLayer';

