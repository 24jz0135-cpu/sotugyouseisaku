import cv2
capture = cv2.VideoCapture(0)

fps = int(capture.get(cv2.CAP_PROP_FPS))
w   = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
h   = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))

fmt = cv2.VideoWriter_fourcc(*'XVID')
out = cv2.VideoWriter('output.avi', fmt, fps, (w, h))

while (True):
    ret, frame = capture.read()
    cv2.imshow('in camera', frame)

    out.write(frame)

    Key = cv2.waitKey(1) & 0xFF
    if Key == ord('q'):
        break

capture.release()
out.release()
cv2.destroyAllWindows()