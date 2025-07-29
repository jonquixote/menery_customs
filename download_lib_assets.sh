#!/bin/zsh
# Download all required assets for MediaPipe SelfieSegmentation and RecordRTC
# Run from project root

set -e

LIB_DIR="public/libs"
MP_DIR="$LIB_DIR/mediapipe_selfie_segmentation"
mkdir -p "$MP_DIR"

# MediaPipe SelfieSegmentation JS
curl -L -o "$LIB_DIR/selfie_segmentation.js" "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"

# WASM and model files (as referenced by selfie_segmentation.js)
for file in selfie_segmentation_wasm_internal.js selfie_segmentation_wasm.js selfie_segmentation_solution_packed_assets_loader.js selfie_segmentation.binarypb selfie_segmentation_landscape.tflite selfie_segmentation_landscape.tflite.bin selfie_segmentation_wasm.wasm; do
  curl -L -o "$MP_DIR/$file" "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/$file"
done

# RecordRTC
curl -L -o "$LIB_DIR/RecordRTC.js" "https://cdn.jsdelivr.net/npm/recordrtc@latest/RecordRTC.js"

echo "All assets downloaded to $LIB_DIR and $MP_DIR."
