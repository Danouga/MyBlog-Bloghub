import argparse
import math
import random
import numpy as np
from PIL import Image

def _round(v):
    return int(v + 0.5)


def load_image(path, inverted=False, resize=1.0):
    # "L" = 单通道灰度，0~255
    img = Image.open(path).convert("L")  # "L" = 单通道灰度，0~255

    if resize != 1.0:
        # Pillow 的 resize 需要整数尺寸，先按比例算好再缩放
        img = img.resize((int(img.width * resize), int(img.height * resize)))
    gray = np.array(img, dtype=np.int32)
    if inverted:
        # 反转：255 - 原值。反转后"高值=暗"，方便沿用同一套
        # "找最小灰度 = 找最暗"的逻辑。
        gray = 255 - gray
    return gray
def load_image_rgb(path, resize=1.0):
    """
    读入图片并转成 RGB 的 int32 三维数组。

    返回 shape (height, width, 3)，每个通道取值 0~255（0=黑，255=白）。
    """
    img = Image.open(path).convert("RGB")
    if resize != 1.0:
        img = img.resize((int(img.width * resize), int(img.height * resize)))
    return np.array(img, dtype=np.int32)

# 丰富细节的方案
def alloc_line_counts(rgb, num_lines):
    totals = [int(rgb[:, :, c].sum()) for c in range(3)]
    max_total = max(totals)
    if max_total <= 0:
        return [0, 0, 0]

    # 第一个达到最大值的通道拿满额（和 linify 的 r>=g>=b 优先序一致）
    idx = totals.index(max_total)
    counts = [0, 0, 0]
    for c in range(3):
        counts[c] = num_lines if c == idx else int(num_lines * totals[c] / max_total)
    return counts
# 总线条可控的方案
def _alloc_line_counts(rgb,num_lines):
    totals = [int(rgb[:, :, c].sum()) for c in range(3)]
    max_total = max(totals)
    if max_total <= 0:
        return [0, 0, 0]

    counts = [0, 0, 0]
    total_sum = sum(totals)
    for c in range(3):
        counts[c] = int(num_lines * totals[c]/total_sum)
    return counts    
# 画板交点
def _line_border_intersections(x0, y0, dx, dy, width, height):
    tmin, tmax = float("-inf"), float("inf")
    if dx!=0:
        t1 = (0 - x0) / dx
        t2 = (width - 1 - x0) / dx
        tmin = max(tmin,min(t1,t2))
        tmax = min(tmax,max(t1,t2))
    elif x0 < 0 or x0 > width - 1:
        # dx == 0 表示直线竖直、x 恒定；如果这个 x 已经出界，则无交点
        return None
    if dy!=0:
        t1 = (0 - y0) / dy
        t2 = (height - 1 - y0) / dy
        tmin = max(tmin,min(t1,t2))
        tmax = min(tmax,max(t1,t2))
    elif y0 < 0 or y0 > height - 1:
        return None

    if tmin > tmax:
        return None
    # 计算边界
    x1 = _round(x0 + tmin * dx)
    y1 = _round(y0 + tmin * dy)
    x2 = _round(x0 + tmax * dx)
    y2 = _round(y0 + tmax * dy)

    x1 = max(0, min(width - 1, x1))
    y1 = max(0, min(height - 1, y1))
    x2 = max(0, min(width - 1, x2))
    y2 = max(0, min(height - 1, y2))

    if x1 == x2 and y1 == y2:
        # 直线只与矩形相切于一个角点（比如最暗点正好在角上，而方向
        # 又朝图片外面），这条"线"在图片里长度为零，跳过这个角度。
        return None
    return (x1,y1),(x2,y2)

def line_pixels(x1, y1, x2, y2):
    if x1 == x2 and y1 == y2:
        return None
    if abs(y1 - y2) > abs(x1 - x2):
        # 线更接近竖直：沿 y 循环，反解 x
        slope = (x2 - x1) / (y2 - y1)   # x 随 y 的变化率
        s, e = min(y1, y2), max(y1, y2)
        ys = np.arange(s, e + 1)  # 含终点：每条线都从边界到边界，否则会丢掉终点所在的边界像素
        xs = np.round(x1 + (ys - y1) * slope).astype(np.int32)
        return xs,ys
    else:
        # 线更接近水平：
        slope = (y2 - y1) / (x2 - x1)    # y 随 x 的变化率
        s, e = min(x1, x2), max(x1, x2)
        xs = np.arange(s, e + 1)  # 含终点：每条线都从边界到边界，否则会丢掉终点所在的边界像素
        ys = np.round(y1 + (xs - x1) * slope).astype(np.int32)

        return xs,ys

def draw_lines(gray, num_lines, darkness, num_angles):
    height, width = gray.shape
    out = np.full((height, width), 255, dtype=np.int32)
    # 记录每条最终画出的线的两个边界端点 (x1, y1, x2, y2)
    chosen_lines = []

    for _ in range(num_lines):
        # ---- 随机找当前最暗的像素点（灰度最小） ----
        min_val = gray.min()
        ys_min, xs_min = np.where(gray == min_val)
        i = random.randrange(len(ys_min))
        y0, x0 = int(ys_min[i]), int(xs_min[i])

        # ---- 在这个点穿过的所有方向里，找平均最暗的直线 ----
        best_avg = float("inf")   # 记录当前最优的平均灰度，初始为无穷大
        best_xs = None
        best_ys = None
        best_ends = None          # 记录当前最优那条线的两个端点

        for _ in range(num_angles):
            # 随机角度
            theta = random.uniform(0, math.pi)
            dx, dy = math.cos(theta), math.sin(theta)   # 单位方向向量
            # 求这条方向直线贯穿整张图的两个边界交点
            ends = _line_border_intersections(x0, y0, dx, dy, width, height)
            if ends is None:
                continue   # 这个方向在图片里没有有效线段（如角点相切）
            (x1,y1),(x2,y2) = ends
            xs,ys = line_pixels(x1,y1,x2,y2)
            if xs is None or ys is None:
                continue
            avg = np.mean(gray[ys,xs])

            if avg < best_avg:
                best_avg = avg
                best_xs = xs
                best_ys = ys
                best_ends = (x1,y1,x2,y2)

        gray[best_ys, best_xs] = np.minimum(255, gray[best_ys, best_xs] + darkness)
        out[best_ys, best_xs] = np.maximum(0, out[best_ys, best_xs] - darkness)

        chosen_lines.append(best_ends)

    return out, chosen_lines
def main():
    # 命令行参数说明：
    #   -i 输入图片路径；-o 输出图片路径
    #   -n 一共画多少条线（越大越精细，也越慢）
    #   -a 每个最暗点尝试的角度数（180 = 每 1 度一个方向）
    #   -d 每条线的墨水量 1~255（越大线越黑，画面整体也越容易变黑）
    #   -r 缩放比例（0.5 缩一半，先看效果时很实用）
    #   -v 白线黑底模式（加这个开关，不加就是黑线白底）
    parser = argparse.ArgumentParser(
        description="用直线近似重现图片（linify 版）"
    )
    parser.add_argument("-i", "--input", default="..\\turing.png", help="输入图片")
    parser.add_argument("-o", "--output", default="turing.png", help="输出图片")
    parser.add_argument("-n", "--number", type=int, default=3072, help="画多少条线")
    parser.add_argument("-a", "--angles", type=int, default=100, help="每个最暗点尝试的随机角度的次数")
    parser.add_argument("-d", "--darkness", type=int, default=32, help="每条线的墨水量 1~255")
    parser.add_argument("-r", "--resize", type=float, default=1.0, help="缩放比例")
    parser.add_argument("-v", "--inverted", action="store_true", help="白线黑底")
    parser.add_argument("-c", "--color",action="store_true",help="彩色")
    args = parser.parse_args()
    # 颜色模式
    if args.color:
        rgb = load_image_rgb(args.input, args.resize)
        # 线数
        counts = alloc_line_counts(rgb,args.number)
        print
        channels = []
        for c in range(3):
            cov = draw_lines(rgb[:,:,c],counts[c],args.darkness,args.angles)[0]
            channels.append(cov)
        out = np.stack(channels, axis=-1)
    # 灰度图
    else:
        # 读图 -> 生成画布 -> （可选）反转 -> 保存
        gray = load_image(args.input, args.inverted, args.resize)

        out, lines = draw_lines(gray, args.number, args.darkness, args.angles)
        if args.inverted:
            # 白线黑底：画完后整体再反转一次（255 - 像素值），
            # 原来"黑线白底"就变成"白线黑底"
            out = 255 - out
    # int32 转回 uint8（Pillow 保存图片要求 0~255 的 uint8）
    Image.fromarray(out.astype(np.uint8)).save(args.output)
    print(f"已保存到 {args.output}")
    if args.color:
        print(f"（R/G/B 线数 {counts[0]}/{counts[1]}/{counts[2]})")

if __name__ == "__main__":
    main()