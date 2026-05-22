import os
import cv2
import time
from datetime import datetime
from dataclasses import dataclass


@dataclass
class TargetConfig:
    cls_id: int = 0  # 0:Aさん, 1:Bさん, 2:Cさん ...
    label_name: str = "person_A"


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def yolo_bbox_from_rect(x1: int, y1: int, x2: int, y2: int, img_w: int, img_h: int):
    """YOLO形式: (x_center, y_center, width, height) を 0-1 正規化で返す"""
    # clamp
    x1 = max(0, min(img_w - 1, x1))
    x2 = max(0, min(img_w - 1, x2))
    y1 = max(0, min(img_h - 1, y1))
    y2 = max(0, min(img_h - 1, y2))

    left = min(x1, x2)
    right = max(x1, x2)
    top = min(y1, y2)
    bottom = max(y1, y2)

    bw = right - left
    bh = bottom - top
    cx = left + bw / 2.0
    cy = top + bh / 2.0

    # 正規化
    return (
        cx / img_w,
        cy / img_h,
        bw / img_w,
        bh / img_h,
    )


def main():
    # 保存先（適宜変更）
    base_dir = os.path.join(os.path.dirname(__file__), "dataset_yolo26")
    split_dir = os.path.join(base_dir, "train")  # ざっくり train に保存

    images_dir = os.path.join(split_dir, "images")
    labels_dir = os.path.join(split_dir, "labels")
    ensure_dir(images_dir)
    ensure_dir(labels_dir)

    # 何秒おきに保存するか（インターバル）
    interval_sec = 1.0

    # ターゲット赤枠（中央固定）
    w_cam, h_cam = 640, 480
    box_w, box_h = 180, 180

    box_left = (w_cam - box_w) // 2
    box_top = (h_cam - box_h) // 2
    box_right = box_left + box_w
    box_bottom = box_top + box_h

    # 現在ターゲット
    # Aさん=0, Bさん=1, Cさん=2 を想定
    cfg = TargetConfig(cls_id=0, label_name="person_A")
    names = ["person_A", "person_B", "person_C"]

    # 入出力
    capture = cv2.VideoCapture(0)
    if not capture.isOpened():
        raise RuntimeError("Failed to open camera")
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, w_cam)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, h_cam)

    last_save = 0.0

    font = cv2.FONT_HERSHEY_SIMPLEX

    while True:
        ret, frame = capture.read()
        if not ret:
            break
        frame = cv2.resize(frame, (w_cam, h_cam))

        # 表示用：赤枠（画像には描写しない=保存画像には描かない）
        disp = frame.copy()
        cv2.rectangle(disp, (box_left, box_top), (box_right, box_bottom), (0, 0, 255), 2)

        # 画面表示テキスト（現在cls）
        cv2.putText(
            disp,
            f"cls={cfg.cls_id} ({cfg.label_name})",
            (10, 30),
            font,
            0.9,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            disp,
            "Keys: [0/1/2] cls, [s] save now, [i] toggle interval, [q] quit",
            (10, 55),
            font,
            0.6,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        cv2.imshow("kadai5-4 annotator", disp)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break

        # cls変更
        if key == ord('0'):
            cfg.cls_id = 0
            cfg.label_name = names[0]
        elif key == ord('1'):
            cfg.cls_id = 1
            cfg.label_name = names[1]
        elif key == ord('2'):
            cfg.cls_id = 2
            cfg.label_name = names[2]

        # いつでも手動で保存（赤枠は描かない）
        save_now = False
        if key == ord('s'):
            save_now = True

        # インターバル保存（手動 or 時間）
        now = time.time()
        if save_now or (now - last_save) >= interval_sec:
            # 保存名
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            img_path = os.path.join(images_dir, f"{stamp}.png")
            label_path = os.path.join(labels_dir, f"{stamp}.txt")

            # 保存画像：赤枠は描かない（要件どおり）
            cv2.imwrite(img_path, frame)

            # YOLOラベル出力
            xc, yc, bw, bh = yolo_bbox_from_rect(
                box_left, box_top, box_right, box_bottom, w_cam, h_cam
            )
            with open(label_path, "w", encoding="utf-8") as f:
                f.write(f"{cfg.cls_id} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}\n")

            last_save = now

    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

