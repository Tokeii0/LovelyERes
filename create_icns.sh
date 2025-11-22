#!/bin/bash
# 创建 macOS ICNS 图标文件

set -e

SOURCE_PNG="src-tauri/icons/icon.png"
ICONSET_DIR="src-tauri/icons/icon.iconset"
OUTPUT_ICNS="src-tauri/icons/icon.icns"

# 检查源文件
if [ ! -f "$SOURCE_PNG" ]; then
    echo "❌ 源文件不存在: $SOURCE_PNG"
    exit 1
fi

# 创建 iconset 目录
mkdir -p "$ICONSET_DIR"

echo "📁 从 $SOURCE_PNG 创建 ICNS 图标..."

# 生成各种尺寸的图标
sips -z 16 16     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_16x16.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_32x32.png" > /dev/null 2>&1
sips -z 64 64     "$SOURCE_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null 2>&1
sips -z 128 128   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_128x128.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_256x256.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_PNG" --out "$ICONSET_DIR/icon_512x512.png" > /dev/null 2>&1
sips -z 1024 1024 "$SOURCE_PNG" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1

echo "✅ 已生成所有尺寸的图标"

# 使用 iconutil 创建 ICNS 文件
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

# 清理临时文件
rm -rf "$ICONSET_DIR"

echo "✅ ICNS 文件已创建: $OUTPUT_ICNS"
ls -lh "$OUTPUT_ICNS"

