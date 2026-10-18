#!/usr/bin/env node

/**
 * Image Crop Tool
 *
 * Crops an image to a specified region and saves the result.
 * Useful for isolating chart areas before chart type detection.
 *
 * Usage:
 *   node crop_image.mjs <input_image> <output_image> <x> <y> <width> <height>
 *   node crop_image.mjs <input_image> <output_image> --region "x,y,width,height"
 *
 * Parameters:
 *   x, y       - Top-left corner of crop region (in pixels)
 *   width      - Width of crop region (in pixels)
 *   height     - Height of crop region (in pixels)
 *
 * Output:
 *   Saves cropped image to output_image path
 *   Returns JSON with crop details
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Crop an image to specified region
 *
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save cropped image
 * @param {number} x - Left position of crop region
 * @param {number} y - Top position of crop region
 * @param {number} width - Width of crop region
 * @param {number} height - Height of crop region
 * @returns {Promise<object>} - Crop result details
 */
export async function cropImage(inputPath, outputPath, x, y, width, height) {
  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Input image not found: ${absoluteInput}`);
  }

  // Get original image metadata
  const metadata = await sharp(absoluteInput).metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  // Validate crop region
  if (x < 0 || y < 0) {
    throw new Error(`Crop position cannot be negative: x=${x}, y=${y}`);
  }

  if (x + width > originalWidth) {
    throw new Error(`Crop region exceeds image width: x(${x}) + width(${width}) = ${x + width} > ${originalWidth}`);
  }

  if (y + height > originalHeight) {
    throw new Error(`Crop region exceeds image height: y(${y}) + height(${height}) = ${y + height} > ${originalHeight}`);
  }

  if (width <= 0 || height <= 0) {
    throw new Error(`Crop dimensions must be positive: width=${width}, height=${height}`);
  }

  // Perform crop
  await sharp(absoluteInput)
    .extract({
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    })
    .toFile(absoluteOutput);

  return {
    success: true,
    input: absoluteInput,
    output: absoluteOutput,
    original: {
      width: originalWidth,
      height: originalHeight
    },
    crop: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    }
  };
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Image Crop Tool

Usage:
  node crop_image.mjs <input_image> <output_image> <x> <y> <width> <height>
  node crop_image.mjs <input_image> <output_image> --region "x,y,width,height"

Arguments:
  input_image   Path to the source image
  output_image  Path to save the cropped image
  x             Left position of crop region (pixels)
  y             Top position of crop region (pixels)
  width         Width of crop region (pixels)
  height        Height of crop region (pixels)

Options:
  --region      Specify crop region as comma-separated values "x,y,width,height"

Example:
  node crop_image.mjs slide.png chart.png 100 200 600 400
  node crop_image.mjs slide.png chart.png --region "100,200,600,400"

Output:
  JSON object with crop details including original and cropped dimensions
`);
    process.exit(0);
  }

  if (args.length < 3) {
    console.error(JSON.stringify({
      error: true,
      message: 'Missing required arguments. Use --help for usage information.'
    }, null, 2));
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  let x, y, width, height;

  // Parse region argument
  const regionIndex = args.indexOf('--region');
  if (regionIndex !== -1 && args[regionIndex + 1]) {
    const regionStr = args[regionIndex + 1];
    const parts = regionStr.split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.error(JSON.stringify({
        error: true,
        message: `Invalid region format: "${regionStr}". Expected "x,y,width,height"`
      }, null, 2));
      process.exit(1);
    }
    [x, y, width, height] = parts;
  } else if (args.length >= 6) {
    x = parseFloat(args[2]);
    y = parseFloat(args[3]);
    width = parseFloat(args[4]);
    height = parseFloat(args[5]);

    if ([x, y, width, height].some(isNaN)) {
      console.error(JSON.stringify({
        error: true,
        message: 'Invalid numeric arguments for x, y, width, height'
      }, null, 2));
      process.exit(1);
    }
  } else {
    console.error(JSON.stringify({
      error: true,
      message: 'Missing crop region arguments. Provide x, y, width, height or use --region'
    }, null, 2));
    process.exit(1);
  }

  try {
    const result = await cropImage(inputPath, outputPath, x, y, width, height);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      error: true,
      message: error.message
    }, null, 2));
    process.exit(1);
  }
}

// Run if executed directly
main();
