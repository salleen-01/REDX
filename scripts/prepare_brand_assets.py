from pathlib import Path
from collections import deque

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ICON = Path('/home/ubuntu/upload/ICON.jfif')
SOURCE_LOGO = Path('/home/ubuntu/upload/LOGOWITHOUTBACKGRAUND.jfif')
OUT = ROOT / 'assets' / 'images'


def remove_near_white_background(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    visited = set()
    queue = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return r >= threshold and g >= threshold and b >= threshold

    for x in range(rgba.width):
        queue.extend([(x, 0), (x, rgba.height - 1)])
    for y in range(rgba.height):
        queue.extend([(0, y), (rgba.width - 1, y)])

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < rgba.width and 0 <= y < rgba.height):
            continue
        visited.add((x, y))
        if not is_background(x, y):
            continue
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def remove_near_black_background(image: Image.Image, threshold: int = 24) -> Image.Image:
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    visited = set()
    queue = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return r <= threshold and g <= threshold and b <= threshold

    for x in range(rgba.width):
        queue.extend([(x, 0), (x, rgba.height - 1)])
    for y in range(rgba.height):
        queue.extend([(0, y), (rgba.width - 1, y)])
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < rgba.width and 0 <= y < rgba.height):
            continue
        visited.add((x, y))
        if not is_background(x, y):
            continue
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def crop_to_content(image: Image.Image, padding: int = 20) -> Image.Image:
    alpha = image.getchannel('A')
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def fit_on_square(image: Image.Image, size: int, background=(7, 8, 11, 255), margin=72) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), background)
    available = size - margin * 2
    scale = min(available / image.width, available / image.height)
    fitted = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


icon_source = Image.open(SOURCE_ICON).convert('RGB')
icon_rgba = remove_near_white_background(icon_source, threshold=242)
icon_content = crop_to_content(icon_rgba, padding=10)
icon = fit_on_square(icon_content, 1024, background=(7, 8, 11, 255), margin=116)
icon.convert('RGB').save(OUT / 'icon.png', format='PNG', optimize=True)

# Build the first-screen logo from the clean square icon artwork. Removing the
# connected dark field preserves all white, red, and black details of the mark.
logo_rgba = remove_near_black_background(icon_content, threshold=24)
logo_content = crop_to_content(logo_rgba, padding=16)
logo = fit_on_square(logo_content, 1024, background=(0, 0, 0, 0), margin=80)
logo.save(OUT / 'redx-logo-transparent.png', format='PNG', optimize=True)

# Android adaptive icon layers use the same brand mark on a safe dark field.
android_bg = Image.new('RGB', (1024, 1024), (7, 8, 11))
android_bg.save(OUT / 'android-icon-background.png', format='PNG', optimize=True)
foreground = fit_on_square(icon_content, 1024, background=(0, 0, 0, 0), margin=210)
foreground.save(OUT / 'android-icon-foreground.png', format='PNG', optimize=True)
monochrome = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
mono = icon_content.convert('L').point(lambda p: 255 if p < 245 else 0)
mono_rgba = Image.merge('RGBA', (mono, mono, mono, mono))
mono_rgba.thumbnail((600, 600), Image.Resampling.LANCZOS)
monochrome.alpha_composite(mono_rgba, ((1024 - mono_rgba.width) // 2, (1024 - mono_rgba.height) // 2))
monochrome.save(OUT / 'android-icon-monochrome.png', format='PNG', optimize=True)

# Keep the browser favicon square and visually consistent with the app icon.
icon.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / 'favicon.png', format='PNG', optimize=True)
# Splash uses the same clean supplied icon on the dark app background.
icon.save(OUT / 'splash-icon.png', format='PNG', optimize=True)

print('Prepared icon.png, redx-logo-transparent.png, adaptive icon layers, favicon.png, and splash-icon.png')
