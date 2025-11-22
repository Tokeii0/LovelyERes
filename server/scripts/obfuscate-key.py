#!/usr/bin/env python3
"""
RSA 公钥混淆工具

读取 PEM 格式的公钥，提取 Base64 部分，使用 XOR 混淆，生成 Rust 代码
"""

import sys

def obfuscate_key(public_key_path: str, xor_key: int = 0x5A):
    """
    混淆公钥
    
    Args:
        public_key_path: 公钥文件路径
        xor_key: XOR 混淆密钥
    """
    # 读取公钥
    with open(public_key_path, 'r') as f:
        pem_content = f.read()
    
    # 提取 Base64 部分（去除 PEM 头尾）
    lines = pem_content.strip().split('\n')
    base64_lines = [line for line in lines if not line.startswith('-----')]
    base64_key = ''.join(base64_lines)
    
    # 转换为字节
    key_bytes = base64_key.encode('utf-8')
    
    # XOR 混淆
    obfuscated = [b ^ xor_key for b in key_bytes]
    
    # 生成 Rust 代码
    print("/// 混淆的公钥数据")
    print("///")
    print(f"/// 使用 XOR 混淆，密钥为 0x{xor_key:02X}")
    print("/// 原始数据为 Base64 编码的公钥（去除 PEM 头尾）")
    print("const OBFUSCATED_PUBLIC_KEY: &[u8] = &[")
    
    # 每行 16 个字节
    for i in range(0, len(obfuscated), 16):
        chunk = obfuscated[i:i+16]
        hex_str = ', '.join(f'0x{b:02x}' for b in chunk)
        
        # 添加注释（显示原始 Base64 片段）
        original_chunk = base64_key[i:i+16]
        print(f"    {hex_str}, // {original_chunk}")
    
    print("];")
    print()
    print(f"/// XOR 混淆密钥")
    print(f"const XOR_KEY: u8 = 0x{xor_key:02X};")
    print()
    print("// 原始公钥（用于验证）:")
    print(f"// {base64_key}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python obfuscate-key.py <public_key_path> [xor_key]")
        print("Example: python obfuscate-key.py server/keys/public.pem 0x5A")
        sys.exit(1)
    
    public_key_path = sys.argv[1]
    xor_key = int(sys.argv[2], 0) if len(sys.argv) > 2 else 0x5A
    
    obfuscate_key(public_key_path, xor_key)

