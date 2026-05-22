import cv2
src_img = cv2.imread('.\\image\\lena.jpg')

cv2.imshow('lena',src_img)
cv2.waitKey(0)
cv2.destroyAllWindows()