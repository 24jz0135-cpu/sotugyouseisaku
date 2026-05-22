import cv2

src_img = cv2.imread(r'.\image\lena.jpg')
glay_img = cv2.cvtColor(src_img, cv2.COLOR_BGR2GRAY)

dst_img = cv2.Laplacian(glay_img, cv2.CV_64F, ksize=3)
dst_img = cv2.convertScaleAbs(dst_img)

cv2.imshow("lena_laplacian.jpg", dst_img)
cv2.waitKey(0)
cv2.destroyAllWindows()