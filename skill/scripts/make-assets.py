#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
技能卡片资产生成（图标 / banner）
================================
输出：assets/icon.png（512×512）、assets/icon-128.png、assets/banner.png（1200×400）
     以及矢量备用 assets/icon.svg、assets/banner-graphic.svg

用法：python3 scripts/make-assets.py           （在 skill 目录下执行）
     python3 scripts/make-assets.py --out <目录>

说明：位图用 4× 超采样 + Lanczos 缩小，保证边缘平滑；中文文字使用 Noto Sans CJK。
      矢量备用图只含图形不含中文（避免目标环境缺字体导致字形错乱）。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SANS_B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
SANS_R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
SC = 2  # Noto Sans CJK SC 在 ttc 中的索引

SS = 4  # 超采样倍数
BG_1 = (76, 29, 149)     # #4C1D95 深紫
BG_2 = (124, 58, 237)    # #7C3AED 主紫
BG_3 = (192, 132, 252)   # #C084FC 亮紫
WHITE = (255, 255, 255)


def font(path, size, index=SC):
    return ImageFont.truetype(path, size, index=index)


def vgrad(size, c1, c2, c3=None):
    """竖向（略带对角）三段渐变底"""
    w, h = size
    ys = np.linspace(0.0, 1.0, h)[:, None]
    xs = np.linspace(0.0, 1.0, w)[None, :]
    t = np.clip(0.72 * ys + 0.28 * xs, 0.0, 1.0)
    if c3 is None:
        arr = np.array(c1)[None, None, :] * (1 - t[..., None]) + np.array(c2)[None, None, :] * t[..., None]
    else:
        mid = np.array(c2)[None, None, :]
        lo, hi = np.array(c1)[None, None, :], np.array(c3)[None, None, :]
        arr = np.where(t[..., None] < 0.5,
                       lo * (1 - 2 * t[..., None]) + mid * (2 * t[..., None]),
                       mid * (2 - 2 * t[..., None]) + hi * (2 * t[..., None] - 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


def glow(size, center, radius, color, strength):
    """叠加一层径向柔光"""
    w, h = size
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.sqrt((xs - center[0]) ** 2 + (ys - center[1]) ** 2) / radius
    a = np.clip(1 - d, 0, 1) ** 2 * strength
    layer = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L')
    img = Image.new('RGB', size, color)
    out = Image.new('RGB', size, (0, 0, 0))
    return Image.composite(img, out, layer)


def round_mask(size, radius):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def draw_scale(d, cx, top, scale, color, width=0):
    """天平剪影：支点三角 + 横梁 + 立柱 + 底座 + 两侧秤盘"""
    def X(v):
        return cx + v * scale

    def Y(v):
        return top + v * scale

    # 支点三角
    d.polygon([(X(0), Y(0)), (X(-16), Y(32)), (X(16), Y(32))], fill=color)
    # 横梁
    d.rounded_rectangle([X(-110), Y(30), X(110), Y(44)], radius=7 * scale, fill=color)
    # 立柱
    d.rounded_rectangle([X(-7), Y(38), X(7), Y(200)], radius=4 * scale, fill=color)
    # 底座两层
    d.rounded_rectangle([X(-58), Y(196), X(58), Y(212)], radius=6 * scale, fill=color)
    d.rounded_rectangle([X(-76), Y(212), X(76), Y(226)], radius=6 * scale, fill=color)
    # 吊线与秤盘
    for sx in (-92, 92):
        d.line([(X(sx), Y(44)), (X(sx), Y(96))], fill=color, width=max(2, int(5 * scale)))
        half, depth = 46, 34
        box = [X(sx) - half * scale, Y(96), X(sx) + half * scale, Y(96) + depth * 2 * scale]
        d.pieslice(box, 0, 180, fill=color)
        d.line([(X(sx) - half * scale, Y(96)), (X(sx) + half * scale, Y(96))],
               fill=color, width=max(2, int(5 * scale)))


def draw_calc_bar(d, x0, y0, x1, y1, accent):
    """计算器显示条：白底圆角条 + 深紫按键 + 等号"""
    r = (y1 - y0) * 0.28
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=WHITE)
    kh = y1 - y0
    kw = kh * 0.52
    cy = (y0 + y1) / 2
    for i in range(3):
        kx = x0 + kh * 0.42 + i * (kw + kh * 0.22)
        d.rounded_rectangle([kx, cy - kh * 0.15, kx + kw, cy + kh * 0.15],
                            radius=kh * 0.08, fill=accent)
    ex = x1 - kh * 0.38
    f_eq = ImageFont.truetype(SANS_B, int(kh * 0.58), index=SC)
    d.text((ex, cy), '=', font=f_eq, fill=accent, anchor='mm')


def make_icon(out_dir):
    N = 512
    big = (N * SS, N * SS)
    img = vgrad(big, BG_2, BG_3)
    img = Image.blend(img, glow(big, (big[0] * 0.28, big[1] * 0.22), big[0] * 0.85, (255, 255, 255), 0.30), 0.55)
    d = ImageDraw.Draw(img)
    draw_scale(d, cx=big[0] / 2, top=88 * SS, scale=1.02 * SS, color=WHITE)
    draw_calc_bar(d, 150 * SS, 352 * SS, 362 * SS, 420 * SS, BG_1)
    img.putalpha(round_mask(big, 116 * SS))
    icon = img.resize((N, N), Image.LANCZOS)
    icon.save(os.path.join(out_dir, 'icon.png'))
    icon.resize((128, 128), Image.LANCZOS).save(os.path.join(out_dir, 'icon-128.png'))
    return icon


def make_banner(out_dir):
    W, H = 1200, 400
    w, h = W * SS, H * SS
    img = vgrad((w, h), BG_1, BG_2, BG_3)
    img = Image.blend(img, glow((w, h), (w * 0.78, h * 0.18), w * 0.55, (233, 213, 255), 0.24), 0.5)

    # 右侧装饰：半透明大天平 + 圆点网格
    deco = Image.new('RGB', (w, h), (0, 0, 0))
    dd = ImageDraw.Draw(deco)
    draw_scale(dd, cx=w * 0.845, top=52 * SS, scale=1.5 * SS, color=WHITE)
    for r in range(6):
        for c in range(6):
            x = (w * 0.60 + c * 26 * SS)
            y = (h * 0.12 + r * 26 * SS)
            r0 = 3.2 * SS
            dd.ellipse([x - r0, y - r0, x + r0, y + r0], fill=WHITE)
    alpha = Image.new('L', (w, h), 0)
    ImageDraw.Draw(alpha).rectangle([0, 0, w, h], fill=int(255 * 0.14))
    img = Image.composite(deco, img, alpha)

    d = ImageDraw.Draw(img)
    f_title = font(SANS_B, 76 * SS)
    f_sub = font(SANS_R, 27 * SS)
    f_tag = font(SANS_R, 21 * SS)
    f_foot = font(SANS_R, 20 * SS)

    d.text((72 * SS, 86 * SS), '法律计算器大全', font=f_title, fill=WHITE)
    d.text((74 * SS, 186 * SS), '44 个计算器 · 7 大类 · 输入参数即出结果，可导出 Markdown / Excel / Word / HTML',
           font=f_sub, fill=(233, 213, 255))

    tags = ['诉讼费用', '利息与违约金', '劳动争议', '时效与期限', '税务', '差旅费用', '法务成本']
    x = 74 * SS
    y = 248 * SS
    th = 46 * SS
    for t in tags:
        tw = d.textlength(t, font=f_tag)
        pad = 18 * SS
        d.rounded_rectangle([x, y, x + tw + pad * 2, y + th], radius=th / 2, fill=(167, 139, 250))
        d.text((x + pad, y + (th - 21 * SS) / 2 - 2 * SS), t, font=f_tag, fill=(255, 255, 255))
        x += tw + pad * 2 + 12 * SS

    # 落款版本号从真源读取（src/core/version.ts 的 VERSION），不在本脚本硬写——
    # 写死必漂（DEV-RULES 12.3.1）；读不到时用占位并退出非零，不得静默用旧值。
    ver = None
    vt = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'core', 'version.ts')
    if os.path.exists(vt):
        import re
        m = re.search(r"VERSION\s*=\s*'([^']+)'", open(vt, encoding='utf-8').read())
        if m:
            ver = m.group(1)
    if not ver:
        sys.exit('✗ 无法从 src/core/version.ts 读取 VERSION，拒绝用旧值出图')
    foot = f'v{ver}　·　作者 胡皓　·　专有作品'
    fw = d.textlength(foot, font=f_foot)
    d.text((w - 72 * SS - fw, h - 52 * SS), foot, font=f_foot, fill=(216, 197, 255))

    banner = img.resize((W, H), Image.LANCZOS)
    banner.save(os.path.join(out_dir, 'banner.png'))
    return banner


ICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#C084FC"/>
    </linearGradient>
    <clipPath id="r"><rect width="512" height="512" rx="116"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="512" height="512" fill="url(#g)"/>
    <g fill="#FFFFFF">
      <polygon points="256,88 240,120 272,120"/>
      <rect x="146" y="118" width="220" height="14" rx="7"/>
      <rect x="249" y="126" width="14" height="162" rx="4"/>
      <rect x="198" y="284" width="116" height="16" rx="6"/>
      <rect x="180" y="300" width="152" height="14" rx="6"/>
      <rect x="158" y="136" width="5" height="52"/>
      <rect x="349" y="136" width="5" height="52"/>
      <path d="M110 188a46 34 0 0 0 92 0z"/>
      <path d="M310 188a46 34 0 0 0 92 0z"/>
    </g>
    <rect x="150" y="352" width="212" height="68" rx="19" fill="#FFFFFF"/>
    <g fill="#4C1D95">
      <rect x="171" y="374" width="35" height="24" rx="5"/>
      <rect x="216" y="374" width="35" height="24" rx="5"/>
      <rect x="261" y="374" width="35" height="24" rx="5"/>
      <rect x="316" y="382" width="30" height="7" rx="3"/>
      <rect x="316" y="394" width="30" height="7" rx="3"/>
    </g>
  </g>
</svg>
'''


def main():
    out = 'assets'
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]
    os.makedirs(out, exist_ok=True)
    make_icon(out)
    make_banner(out)
    with open(os.path.join(out, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(ICON_SVG)
    for n in ('icon.png', 'icon-128.png', 'banner.png', 'icon.svg'):
        p = os.path.join(out, n)
        print('[assets] %-14s %8d bytes' % (n, os.path.getsize(p)))


if __name__ == '__main__':
    main()
