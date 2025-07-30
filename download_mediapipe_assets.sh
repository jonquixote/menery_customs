#!/bin/zsh
# Download all required MediaPipe SelfieSegmentation assets for local use

TARGET_DIR="public/libs/mediapipe_selfie_segmentation"
mkdir -p "$TARGET_DIR"

echo "Downloading MediaPipe SelfieSegmentation assets..."

# List of required files (update URLs as needed for latest version)
files=(
  "selfie_segmentation_landscape.tflite"
  "selfie_segmentation_landscape.tflite.bin"
  "selfie_segmentation_solution_packed_assets_loader.js"
  "selfie_segmentation_wasm_internal.js"
  "selfie_segmentation_wasm.js"
  "selfie_segmentation_wasm.wasm"
  "selfie_segmentation.binarypb"
  "selfie_segmentation_solution_wasm_bin.js"
)

base_url="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1633548252"

for file in "${files[@]}"; do
  url="$base_url/$file"
  echo "Fetching $file ..."
  curl -fsSL "$url" -o "$TARGET_DIR/$file" || echo "Failed to fetch $file from $url"
done

echo "Download complete. Please verify all files exist in $TARGET_DIR."
