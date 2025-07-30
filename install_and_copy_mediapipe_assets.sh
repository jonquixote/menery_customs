#!/bin/zsh
# Install MediaPipe SelfieSegmentation and copy all available assets for local use

echo "Installing @mediapipe/selfie_segmentation npm package..."
npm install @mediapipe/selfie_segmentation

TARGET_DIR="public/libs/mediapipe_selfie_segmentation"
SRC_DIR="node_modules/@mediapipe/selfie_segmentation"

mkdir -p "$TARGET_DIR"

echo "Copying all MediaPipe SelfieSegmentation assets found in npm package..."

cp $SRC_DIR/*.js $TARGET_DIR/ 2>/dev/null
cp $SRC_DIR/*.wasm $TARGET_DIR/ 2>/dev/null
cp $SRC_DIR/*.tflite $TARGET_DIR/ 2>/dev/null
cp $SRC_DIR/*.binarypb $TARGET_DIR/ 2>/dev/null

echo "All available assets copied to $TARGET_DIR. Please verify the files and update your loader if needed."