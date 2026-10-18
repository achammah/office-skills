# Utilities

Supplementary commands for thumbnails, image conversion, and cropping.

## Thumbnail Grids
```bash
python scripts/thumbnail.py template.pptx [output_prefix] [--cols 4]
```
Default: 5 columns, max 30 slides per grid. Grid limits: 3 cols = 12/grid, 4 = 20, 5 = 30, 6 = 42.

## Slides to Images
```bash
soffice --headless --convert-to pdf template.pptx
pdftoppm -jpeg -r 150 template.pdf slide          # Creates slide-1.jpg, slide-2.jpg, etc.
pdftoppm -jpeg -r 150 -f 2 -l 5 template.pdf slide  # Pages 2-5 only
```

## Image Cropping
```bash
node scripts/crop_image.mjs input.png output.png 100 200 600 400  # x, y, width, height
```
