import cv2
import numpy as np


def main():
    capture = cv2.VideoCapture(0)
    if not capture.isOpened():
        raise RuntimeError("Failed to open camera")

    # カメラ解像度を固定
    w, h = 640, 480
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, w)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, h)

    fps = 30
    # コーデックは環境差があるため互換性優先
    fmt = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter('kadai5-3_output.mp4', fmt, fps, (w, h))

    # テキスト表示（任意）
    show_text = False
    text = "test !"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 3.0
    thickness = 8
    color = (0, 0, 255)  # BGR
    x, y = 50, 150

    # エッジ強度の閾値（調整して見やすくする）
    edge_threshold = 80

    while True:
        ret, frame = capture.read()
        if not ret:
            break

        frame = cv2.resize(frame, (w, h))

        # --- 5-3: グレースケール化→Sobelでエッジ検出→エッジ部分だけ赤にする ---
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Sobel（x,y）
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

        # 勾配の大きさ
        mag = np.sqrt(sobelx ** 2 + sobely ** 2)
        mag = np.uint8(np.clip(mag, 0, 255))

        # エッジ領域マスク
        edge_mask = mag >= edge_threshold

        # 元のカラー画像をコピーして、エッジ部分だけ赤に置換
        out_frame = frame.copy()
        out_frame[edge_mask] = (0, 0, 255)  # 赤(BGR)

        if show_text:
            cv2.putText(out_frame, text, (x, y), font, font_scale,
                        (255, 255, 255), thickness + 4, cv2.LINE_AA)
            cv2.putText(out_frame, text, (x, y), font, font_scale,
                        color, thickness, cv2.LINE_AA)

        # 書き込み＆表示
        out.write(out_frame)
        cv2.imshow("in camera", out_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('t'):
            show_text = not show_text

    out.release()
    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

