#!/usr/bin/env python3
"""
图标生成脚本 - 从logo.png生成Tauri应用所需的所有图标素材
"""

import os
import sys
from PIL import Image
import argparse

def create_icon_with_background(source_image, size, output_path, background_color=(255, 255, 255, 0), max_upscale=0, skip_large=False):
    """
    创建指定尺寸的图标，智能处理小尺寸源图像
    """
    source_size = max(source_image.width, source_image.height)

    # 检查是否跳过大尺寸图标
    if skip_large and size > source_size:
        print(f"⏭️  跳过: {output_path} ({size}x{size}) [大于源图像]")
        return False

    # 检查最大放大倍数限制
    if max_upscale > 0 and size > source_size * max_upscale:
        print(f"⏭️  跳过: {output_path} ({size}x{size}) [超过最大放大倍数 {max_upscale}x]")
        return False

    # 如果目标尺寸小于等于源图像尺寸，直接缩放
    if size <= source_size:
        resized = source_image.resize((size, size), Image.Resampling.LANCZOS)
    else:
        # 如果目标尺寸大于源图像，使用更适合的放大算法
        # 对于小图像放大，使用NEAREST可以保持清晰度
        if source_size <= 128:
            resized = source_image.resize((size, size), Image.Resampling.NEAREST)
        else:
            resized = source_image.resize((size, size), Image.Resampling.LANCZOS)

    # 如果需要背景色，创建背景图像
    if background_color != (255, 255, 255, 0):
        icon = Image.new('RGBA', (size, size), background_color)
        if resized.mode == 'RGBA':
            icon.paste(resized, (0, 0), resized)
        else:
            icon.paste(resized, (0, 0))
    else:
        icon = resized

    # 保存图标
    icon.save(output_path, 'PNG')

    # 显示缩放信息
    scale_info = "放大" if size > source_size else "缩小" if size < source_size else "原尺寸"
    print(f"✓ 生成: {output_path} ({size}x{size}) [{scale_info}]")
    return True

def create_ico_file(source_image, output_path):
    """
    创建Windows ICO文件，包含多个尺寸
    """
    sizes = [128]
    icons = []
    source_size = max(source_image.width, source_image.height)

    for size in sizes:
        # 智能选择缩放算法
        if size <= source_size:
            resized = source_image.resize((size, size), Image.Resampling.LANCZOS)
        else:
            # 对于小图像放大，使用NEAREST保持清晰度
            if source_size <= 128:
                resized = source_image.resize((size, size), Image.Resampling.NEAREST)
            else:
                resized = source_image.resize((size, size), Image.Resampling.LANCZOS)
        icons.append(resized)

    # 保存ICO文件
    icons[0].save(output_path, format='ICO', sizes=[(icon.width, icon.height) for icon in icons])
    print(f"✓ 生成: {output_path} (多尺寸ICO)")

def create_icns_file(source_image, output_path):
    """
    创建macOS ICNS文件
    注意: 需要安装pillow-heif或使用其他工具
    """
    try:
        # 创建临时PNG文件用于转换
        temp_png = output_path.replace('.icns', '_temp.png')
        create_icon_with_background(source_image, 1024, temp_png)
        
        # 使用系统工具转换（如果在macOS上）
        if sys.platform == 'darwin':
            os.system(f'sips -s format icns "{temp_png}" --out "{output_path}"')
            os.remove(temp_png)
            print(f"✓ 生成: {output_path} (macOS ICNS)")
        else:
            # 在非macOS系统上，创建一个1024x1024的PNG作为替代
            create_icon_with_background(source_image, 1024, output_path.replace('.icns', '.png'))
            print(f"⚠ 在非macOS系统上生成PNG替代: {output_path.replace('.icns', '.png')}")
    except Exception as e:
        print(f"⚠ ICNS生成失败: {e}")

def main():
    parser = argparse.ArgumentParser(description='从logo.png生成Tauri应用所需的图标素材')
    parser.add_argument('--source', '-s', default='src-tauri/icons/logo.png',
                       help='源图标文件路径 (默认: src-tauri/icons/logo.png)')
    parser.add_argument('--output-dir', '-o', default='src-tauri/icons',
                       help='输出目录 (默认: src-tauri/icons)')
    parser.add_argument('--max-upscale', '-m', type=int, default=0,
                       help='最大放大倍数，0表示无限制 (默认: 0)')
    parser.add_argument('--skip-large', action='store_true',
                       help='跳过生成比源图像大的图标')
    
    args = parser.parse_args()
    
    # 检查源文件
    if not os.path.exists(args.source):
        print(f"❌ 源文件不存在: {args.source}")
        return 1
    
    # 创建输出目录
    os.makedirs(args.output_dir, exist_ok=True)
    
    try:
        # 加载源图像
        source_image = Image.open(args.source)
        source_size = max(source_image.width, source_image.height)
        print(f"📁 源图像: {args.source} ({source_image.width}x{source_image.height})")

        # 检查源图像尺寸并给出建议
        if source_size < 256:
            print(f"⚠️  警告: 源图像尺寸较小 ({source_size}px)，建议使用至少256x256的图像以获得更好的大尺寸图标质量")
        elif source_size < 512:
            print(f"💡 提示: 源图像尺寸适中 ({source_size}px)，如需更高质量的大尺寸图标，建议使用512x512或更大的图像")
        else:
            print(f"✅ 源图像尺寸良好 ({source_size}px)，适合生成高质量图标")

        # 确保是RGBA模式
        if source_image.mode != 'RGBA':
            source_image = source_image.convert('RGBA')
        
        # 生成各种尺寸的PNG图标
        png_sizes = [
            (32, '32x32.png'),
            (128, '128x128.png'),
            (256, '128x128@2x.png'),  # 2x版本
            (1024, 'icon.png'),      # 主图标
        ]
        
        generated_count = 0
        for size, filename in png_sizes:
            output_path = os.path.join(args.output_dir, filename)
            if create_icon_with_background(source_image, size, output_path, max_upscale=args.max_upscale, skip_large=args.skip_large):
                generated_count += 1

        # 生成Windows Store Logo尺寸
        store_sizes = [
            (30, 'Square30x30Logo.png'),
            (44, 'Square44x44Logo.png'),
            (71, 'Square71x71Logo.png'),
            (89, 'Square89x89Logo.png'),
            (107, 'Square107x107Logo.png'),
            (142, 'Square142x142Logo.png'),
            (150, 'Square150x150Logo.png'),
            (284, 'Square284x284Logo.png'),
            (310, 'Square310x310Logo.png'),
            (50, 'StoreLogo.png'),
        ]

        for size, filename in store_sizes:
            output_path = os.path.join(args.output_dir, filename)
            if create_icon_with_background(source_image, size, output_path, max_upscale=args.max_upscale, skip_large=args.skip_large):
                generated_count += 1
        
        # 生成ICO文件
        ico_path = os.path.join(args.output_dir, 'icon.ico')
        create_ico_file(source_image, ico_path)
        
        # 生成ICNS文件
        icns_path = os.path.join(args.output_dir, 'icon.icns')
        create_icns_file(source_image, icns_path)
        generated_count += 2  # ICO和ICNS文件

        print(f"\n🎉 图标生成完成! 共生成 {generated_count} 个文件")
        print(f"📂 输出目录: {args.output_dir}")

        if args.skip_large or args.max_upscale > 0:
            total_possible = len(png_sizes) + len(store_sizes) + 2
            skipped = total_possible - generated_count
            if skipped > 0:
                print(f"⏭️  跳过 {skipped} 个大尺寸文件")
        
    except Exception as e:
        print(f"❌ 生成失败: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
