import cv2
capture = cv2.VideoCapture(0)
while (True):
    ret, frame = capture.read()
    cv2.imshow('in camera', frame)
    Key = cv2.waitKey(1) & 0xFF
    if Key == ord('q'):
        break

capture.release()
cv2.destroyAllWindows()

    