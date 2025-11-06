# Icon Generation Instructions

The extension requires 3 icon sizes:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

## Design Suggestions

**Theme**: Currency conversion symbol
**Colors**: Purple gradient (#667eea to #764ba2)
**Style**: Modern, minimal, flat design

### Recommended Icon Concepts:

1. **Currency Symbol Swap**
   - Two currency symbols (£ ↔ $) with arrows
   - Clean sans-serif font
   - White symbols on purple gradient background

2. **Lightning Bolt + Money**
   - Lightning bolt (⚡) overlaid on currency symbol
   - Represents "quick" conversion
   - Gold/white on purple

3. **Circular Exchange**
   - Circular arrows around currency symbol
   - Suggests conversion/exchange
   - Minimalist line art style

### Tools to Generate Icons:

**Online Tools**:
- Canva (free tier)
- Figma (free)
- Adobe Express (free tier)

**CLI Tools**:
```bash
# Using ImageMagick to create placeholder icons
convert -size 16x16 xc:#667eea -gravity center -pointsize 12 -fill white -annotate +0+0 "£$" icon16.png
convert -size 48x48 xc:#667eea -gravity center -pointsize 32 -fill white -annotate +0+0 "£$" icon48.png
convert -size 128x128 xc:#667eea -gravity center -pointsize 90 -fill white -annotate +0+0 "£$" icon128.png
```

### Quick Placeholder Creation

If you need quick placeholders for testing:

**Python Script** (requires Pillow):
```python
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Draw currency symbols
    try:
        font = ImageFont.truetype("arial.ttf", size // 2)
    except:
        font = ImageFont.load_default()

    text = "£$"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    position = ((size - text_width) // 2, (size - text_height) // 2)
    draw.text(position, text, fill='white', font=font)

    img.save(filename)
    print(f"Created {filename}")

create_icon(16, 'icon16.png')
create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
```

Run with:
```bash
pip install Pillow
python create_icons.py
```

### Testing Without Icons

The extension will still work without icons, but you'll see:
- Default puzzle piece icon in toolbar
- Warning in chrome://extensions

Not critical for testing functionality.
