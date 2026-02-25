#!/usr/bin/env python3
"""
大幅缩小 PNG 图片体积：缩放尺寸 + 256 色量化 + 优化写入。
用法: pip install Pillow && python scripts/shrink_images.py [目录或文件...]
默认处理 piggame/assets/ 下的 png。
"""

from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    print("请先安装 Pillow: pip install Pillow")
    sys.exit(1)

# 最大边长（像素），超过会按比例缩小
MAX_SIDE = 800
# 量化颜色数（256 可大幅减小体积且对游戏图通常够用）
COLORS = 256
# 是否先备份原图（备份为 xxx.png.bak）
BACKUP = True


def shrink_one(path: Path, out_dir: Path) -> None:
    path = path.resolve()
    if not path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        return
    try:
        im = Image.open(path).convert("RGBA")
    except Exception as e:
        print(f"  跳过 {path}: {e}")
        return

    old_size = path.stat().st_size
    w, h = im.size

    # 按最大边长缩放
    if max(w, h) > MAX_SIDE:
        if w >= h:
            new_w, new_h = MAX_SIDE, max(1, int(h * MAX_SIDE / w))
        else:
            new_w, new_h = max(1, int(w * MAX_SIDE / h)), MAX_SIDE
        im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 256 色量化（RGBA 需用 Octree；量化后为 P 模式，透明会保留在调色板）
    im = im.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE)
    # 保存为 PNG
    out_path = out_dir / path.name if out_dir else path
    if BACKUP and path.exists() and path == out_path:
        bak = path.with_suffix(path.suffix + ".bak")
        if not bak.exists():
            import shutil
            shutil.copy2(path, bak)
            print(f"  已备份: {bak.name}")
    im.save(out_path, "PNG", optimize=True)

    new_size = out_path.stat().st_size
    pct = (1 - new_size / old_size) * 100 if old_size else 0
    print(f"  {path.name}: {old_size / 1024:.1f} KB -> {new_size / 1024:.1f} KB (-{pct:.0f}%)")


def main():
    root = Path(__file__).resolve().parent.parent
    assets = root / "piggame" / "assets"
    targets = []

    if len(sys.argv) > 1:
        for a in sys.argv[1:]:
            p = Path(a)
            if not p.is_absolute():
                p = (Path.cwd() / p).resolve()
            if p.is_dir():
                targets.extend(p.glob("*.png"))
                targets.extend(p.glob("*.jpg"))
            elif p.is_file():
                targets.append(p)
    else:
        if assets.is_dir():
            targets = list(assets.glob("*.png")) + list(assets.glob("*.jpg"))
        else:
            print("用法: python shrink_images.py [目录或文件...]")
            print("默认处理 piggame/assets/ 下的图片")
            sys.exit(1)

    if not targets:
        print("没有找到要处理的图片")
        return

    out_dir = assets if assets.is_dir() else None
    if not out_dir and targets:
        out_dir = targets[0].parent

    print(f"处理 {len(targets)} 个文件 (max_side={MAX_SIDE}, colors={COLORS})")
    for f in sorted(set(targets)):
        shrink_one(f, out_dir or f.parent)
    print("完成")


if __name__ == "__main__":
    main()
