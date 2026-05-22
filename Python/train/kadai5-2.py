import cv2
import os
from enum import Enum
from datetime import datetime


class MyFrameColor(Enum):
    COLOR = 0
    GLAY = 1


def main():
    capture = cv2.VideoCapture(0)
    if not capture.isOpened():
        raise RuntimeError("Failed to open camera")

    # サイズ固定
    w, h = 640, 480
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, w)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, h)

    fps = 30
    # Windows/環境によっては H264(OpenH264) が使えないことがあるため互換性重視で設定
    fmt = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter('kadai5-2_output.mp4', fmt, fps, (w, h))


    show_text = False
    text = "test !"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 3.0
    thickness = 8
    color = (0, 0, 255)  # BGR
    x, y = 50, 150

    frame_color = MyFrameColor.COLOR

    # 保存先
    save_dir = os.path.join(os.path.dirname(__file__), "snapshots")
    os.makedirs(save_dir, exist_ok=True)

    while True:
        ret, frame = capture.read()
        if not ret:
            break

        frame = cv2.resize(frame, (w, h))

        # 表示/保存用フレームをmodeに合わせて生成
        if frame_color == MyFrameColor.GLAY:
            frame_display = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # imshow・VideoWriter向けに3chに戻す
            frame_display = cv2.cvtColor(frame_display, cv2.COLOR_GRAY2BGR)
        else:
            frame_display = frame

        if show_text:
            cv2.putText(frame_display, text, (x, y), font, font_scale,
                        (255, 255, 255), thickness + 4, cv2.LINE_AA)
            cv2.putText(frame_display, text, (x, y), font, font_scale,
                        color, thickness, cv2.LINE_AA)

        out.write(frame_display)

        cv2.imshow("in camera", frame_display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord('t'):
            show_text = not show_text
        elif key == ord('c'):
            frame_color = MyFrameColor.COLOR
        elif key == ord('g'):
            frame_color = MyFrameColor.GLAY
        elif key == ord('s'):
            # 押した瞬間の画像を保存
            # frame_display は現在のmode反映済み
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            out_path = os.path.join(save_dir, f"snapshot_{stamp}.jpg")
            cv2.imwrite(out_path, frame_display)

    out.release()
    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

