import cv2

src_img = cv2.imread(r'.\image\lena.jpg')
glay_img = cv2.cvtColor(src_img, cv2.COLOR_RGB2GRAY)

dst_img = cv2.Sobel(glay_img, cv2.CV_64F, 0, 1, ksize=3)

cv2.imshow("lena_sobel.jpg", dst_img)
cv2.waitKey(0)
cv2.destroyAllWindows()