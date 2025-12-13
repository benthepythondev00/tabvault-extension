#!/usr/bin/env python3
"""
Create professional Chrome Web Store screenshots for TabVault.
Places popup screenshots on a beautiful gradient background with shadow effects.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E2E_SCREENSHOTS = os.path.join(BASE_DIR, "e2e", "screenshots")
OUTPUT_DIR = os.path.join(BASE_DIR, "store-assets", "resized")
ICON_PATH = os.path.join(BASE_DIR, "public", "icon", "128.png")

# Dimensions
STORE_WIDTH = 1280
STORE_HEIGHT = 800
PROMO_WIDTH = 440
PROMO_HEIGHT = 280

# TabVault brand colors (teal gradient)
GRADIENT_START = (13, 148, 136)  # teal-600
GRADIENT_END = (20, 184, 166)  # teal-500
GRADIENT_LIGHT = (45, 212, 191)  # teal-400


def create_gradient_background(
    width, height, start_color, end_color, direction="diagonal"
):
    """Create a smooth gradient background."""
    image = Image.new("RGB", (width, height))
    pixels = image.load()

    for y in range(height):
        for x in range(width):
            if direction == "diagonal":
                # Diagonal gradient from top-left to bottom-right
                ratio = (x / width + y / height) / 2
            elif direction == "vertical":
                ratio = y / height
            else:  # horizontal
                ratio = x / width

            r = int(start_color[0] + (end_color[0] - start_color[0]) * ratio)
            g = int(start_color[1] + (end_color[1] - start_color[1]) * ratio)
            b = int(start_color[2] + (end_color[2] - start_color[2]) * ratio)
            pixels[x, y] = (r, g, b)

    return image


def add_shadow(image, offset=(0, 10), shadow_color=(0, 0, 0, 80), blur_radius=30):
    """Add a soft shadow behind an image."""
    # Create a larger canvas for the shadow
    shadow_canvas = Image.new(
        "RGBA",
        (
            image.width + blur_radius * 2 + abs(offset[0]),
            image.height + blur_radius * 2 + abs(offset[1]),
        ),
        (0, 0, 0, 0),
    )

    # Create shadow shape
    shadow = Image.new("RGBA", image.size, shadow_color)

    # If image has alpha, use it as mask
    if image.mode == "RGBA":
        shadow.putalpha(image.split()[3])

    # Position shadow
    shadow_x = blur_radius + max(0, offset[0])
    shadow_y = blur_radius + max(0, offset[1])
    shadow_canvas.paste(shadow, (shadow_x, shadow_y))

    # Blur the shadow
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(blur_radius))

    return shadow_canvas


def create_store_screenshot(popup_path, output_name, crop_popup=True):
    """Create a professional store screenshot with the popup on gradient background."""

    # Load popup screenshot
    popup = Image.open(popup_path).convert("RGBA")

    # Crop the popup to remove extra whitespace if needed
    if crop_popup:
        # Find the bounding box of non-white/non-transparent content
        bbox = popup.getbbox()
        if bbox:
            popup = popup.crop(bbox)

    # Scale popup if it's too large (should fit nicely in center)
    max_popup_height = int(STORE_HEIGHT * 0.85)
    max_popup_width = int(STORE_WIDTH * 0.45)

    # Calculate scale to fit
    scale = min(max_popup_width / popup.width, max_popup_height / popup.height, 1.0)

    if scale < 1.0:
        new_width = int(popup.width * scale)
        new_height = int(popup.height * scale)
        popup = popup.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Create gradient background
    background = create_gradient_background(
        STORE_WIDTH, STORE_HEIGHT, GRADIENT_START, GRADIENT_END, "diagonal"
    )
    background = background.convert("RGBA")

    # Add shadow
    shadow = add_shadow(
        popup, offset=(0, 15), shadow_color=(0, 0, 0, 60), blur_radius=40
    )

    # Calculate center position
    popup_x = (STORE_WIDTH - popup.width) // 2
    popup_y = (STORE_HEIGHT - popup.height) // 2

    # Adjust shadow position
    shadow_x = popup_x - 40  # Account for shadow padding
    shadow_y = popup_y - 40 + 15  # Account for shadow offset

    # Paste shadow first
    background.paste(shadow, (shadow_x, shadow_y), shadow)

    # Add rounded corners to popup
    popup_with_corners = add_rounded_corners(popup, radius=12)

    # Paste popup
    background.paste(popup_with_corners, (popup_x, popup_y), popup_with_corners)

    # Save
    output_path = os.path.join(OUTPUT_DIR, output_name)
    background.convert("RGB").save(output_path, "PNG", quality=95)
    print(f"Created: {output_path}")
    return output_path


def add_rounded_corners(image, radius=12):
    """Add rounded corners to an image."""
    # Create a mask with rounded corners
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), image.size], radius=radius, fill=255)

    # Apply mask
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.paste(image, mask=mask)

    return output


def create_promo_tile():
    """Create the small promotional tile (440x280)."""

    # Create gradient background
    background = create_gradient_background(
        PROMO_WIDTH, PROMO_HEIGHT, GRADIENT_START, GRADIENT_END, "diagonal"
    )
    background = background.convert("RGBA")

    draw = ImageDraw.Draw(background)

    # Load and place icon
    try:
        icon = Image.open(ICON_PATH).convert("RGBA")
        icon_size = 80
        icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)

        # Position icon on the left
        icon_x = 50
        icon_y = (PROMO_HEIGHT - icon_size) // 2

        # Add shadow to icon
        icon_shadow = add_shadow(
            icon, offset=(0, 5), shadow_color=(0, 0, 0, 40), blur_radius=15
        )
        background.paste(icon_shadow, (icon_x - 15, icon_y - 15 + 5), icon_shadow)
        background.paste(icon, (icon_x, icon_y), icon)

        text_x = icon_x + icon_size + 25
    except Exception as e:
        print(f"Could not load icon: {e}")
        text_x = 50

    # Add text
    try:
        # Try to use a nice font, fall back to default if not available
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
        subtitle_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()

    # Title
    title = "TabVault"
    title_y = PROMO_HEIGHT // 2 - 25
    draw.text((text_x, title_y), title, fill=(255, 255, 255), font=title_font)

    # Subtitle
    subtitle = "Save & restore browser sessions"
    subtitle_y = title_y + 40
    draw.text(
        (text_x, subtitle_y), subtitle, fill=(255, 255, 255, 220), font=subtitle_font
    )

    # Save
    output_path = os.path.join(OUTPUT_DIR, "promo-tile-440x280.png")
    background.convert("RGB").save(output_path, "PNG", quality=95)
    print(f"Created: {output_path}")


def create_store_icon():
    """Resize icon for store (128x128)."""
    try:
        icon = Image.open(ICON_PATH).convert("RGBA")
        icon = icon.resize((128, 128), Image.Resampling.LANCZOS)
        output_path = os.path.join(OUTPUT_DIR, "store-icon-128x128.png")
        icon.save(output_path, "PNG")
        print(f"Created: {output_path}")
    except Exception as e:
        print(f"Error creating store icon: {e}")


def main():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Screenshot mappings: (source file, output name)
    screenshots = [
        ("full-ui-sessions-light.png", "screenshot-1-sessions-light-1280x800.png"),
        ("session-expanded.png", "screenshot-2-expanded-1280x800.png"),
        ("session-search.png", "screenshot-3-search-1280x800.png"),
        ("settings-modal.png", "screenshot-4-settings-1280x800.png"),
        ("session-modal-open.png", "screenshot-5-save-modal-1280x800.png"),
        ("full-ui-sessions-dark.png", "screenshot-6-dark-mode-1280x800.png"),
    ]

    print("Creating TabVault Chrome Web Store assets...\n")

    # Create store icon
    print("Creating store icon...")
    create_store_icon()

    # Create promo tile
    print("\nCreating promo tile...")
    create_promo_tile()

    # Create screenshots
    print("\nCreating screenshots...")
    for source, output in screenshots:
        source_path = os.path.join(E2E_SCREENSHOTS, source)
        if os.path.exists(source_path):
            create_store_screenshot(source_path, output)
        else:
            print(f"Warning: Source file not found: {source_path}")

    print("\nDone! All assets created in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
