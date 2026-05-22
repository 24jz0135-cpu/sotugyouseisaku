import cv2


def main():
    capture = cv2.VideoCapture(0)
    if not capture.isOpened():
        raise RuntimeError("Failed to open camera")

    # --- 動画保存の設定（トラブル防止のため数値を固定） ---
    # カメラの標準的な解像度（640x480）に強制設定
    w, h = 640, 480
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, w)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, h)

    # フレームレートも確実な「30」に固定
    fps = 30

    # 最も互換性が高く、Windowsで確実に再生できる「H264」を指定
    # ※もしエラーが出る場合は、ここを *'mp4v' に戻してください
    fmt = cv2.VideoWriter_fourcc(*'H264')
    out = cv2.VideoWriter('kadai5-1_output.mp4', fmt, fps, (w, h))

    # 表示用テキストのトグル
    show_text = False

    # 大きめの描画設定
    text = "test !"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 3.0
    thickness = 8
    color = (0, 0, 255)  # 赤(BGR)

    x, y = 50, 150

    while True:
        ret, frame = capture.read()
        if not ret:
            break

        # カメラから取得した画像を、念のため指定サイズ（640x480）にリサイズ
        frame = cv2.resize(frame, (w, h))

        if show_text:
            cv2.putText(frame, text, (x, y), font, font_scale, (255, 255, 255), thickness + 4, cv2.LINE_AA)
            cv2.putText(frame, text, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)

        # 動画ファイルへ書き込み
        out.write(frame)

        cv2.imshow("in camera", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord('t'):
            show_text = not show_text

    # 後処理
    out.release()
    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()