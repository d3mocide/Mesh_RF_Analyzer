import numpy as np
from PIL import Image, ImageDraw
import os

def generate_icon(size, filename):
    try:
        # Load source image
        source_path = 'source_icon.png'
        if not os.path.exists(source_path):
            print(f"Error: {source_path} not found")
            return

        with Image.open(source_path) as img:
            # Resize with high quality resampling
            # Convert to RGB to ensure no alpha issues if saving as forced format (though PNG supports alpha)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Create a square background to center into (in case source isn't square)
            # Matching the dark theme background
            bg_color = (10, 10, 15, 255) # #0a0a0f
            new_img = Image.new('RGBA', (size, size), bg_color)
            
            # Calculate aspect ratio preserving resize
            src_w, src_h = img.size
            ratio = min(size / src_w, size / src_h)
            new_w = int(src_w * ratio)
            new_h = int(src_h * ratio)
            
            resized_source = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Center it
            x_offset = (size - new_w) // 2
            y_offset = (size - new_h) // 2
            
            new_img.paste(resized_source, (x_offset, y_offset), resized_source)
            
            # Round Corners Mask
            mask = Image.new('L', (size, size), 0)
            mask_draw = ImageDraw.Draw(mask)
            # Modern "Squircle"-ish radius (~22%)
            radius = size * 0.22
            mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)
            
            # Apply mask to make corners transparent
            new_img.putalpha(mask)
            
            # Save
            new_img.save(filename)
            print(f"Generated {filename} from source with rounded corners")

    except Exception as e:
        print(f"Failed to generate {filename}: {e}")

if __name__ == "__main__":
    generate_icon(192, 'pwa-192x192.png')
    generate_icon(512, 'pwa-512x512.png')
