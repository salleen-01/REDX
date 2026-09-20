from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "images"
ROOT.mkdir(parents=True, exist_ok=True)


def make_icon(size: int, red: str = "#ff3b30") -> Image.Image:
    image = Image.new("RGBA", (size, size), "#07080b")
    draw = ImageDraw.Draw(image)
    margin = int(size * 0.23)
    width = max(12, int(size * 0.13))
    draw.line((margin, margin, size - margin, size - margin), fill=red, width=width, joint="curve")
    draw.line((size - margin, margin, margin, size - margin), fill=red, width=width, joint="curve")
    return image


make_icon(1024).save(ROOT / "icon.png")
make_icon(1024).save(ROOT / "splash-icon.png")
make_icon(1024).save(ROOT / "android-icon-foreground.png")
make_icon(1024, "#ff3b30").convert("L").save(ROOT / "android-icon-monochrome.png")
Image.new("RGBA", (1024, 1024), "#07080b").save(ROOT / "android-icon-background.png")
make_icon(256).save(ROOT / "favicon.png")
print("Generated REDX black/red-X icon assets")
