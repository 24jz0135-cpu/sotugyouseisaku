import cv2
from enum import Enum

class MyFrameColor(Enum):
    GLAY  = 1
    COLOR = 0

def main():
    frame_color = MyFrameColor.COLOR
    capture = cv2.VideoCapture(0)
    while (True):
        ret, frame = capture.read()
        if frame_color == MyFrameColor.GLAY:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        cv2.imshow('in camera', frame)
        Key = cv2.waitKey(1) & 0xFF
        if Key == ord('q'):
            break
        elif Key == ord('g'):
            frame_color = MyFrameColor.GLAY
    
    capture.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()