import cv2
src_img = cv2.imread('.\\image\\lena.jpg')

start_point = (60, 60)
end_point = (170, 180)

cv2.rectangle(src_img, start_point, end_point, (225, 0, 0), -1)

cv2.imshow("lena_rect.jpg", src_img)
cv2.waitKey(0)
cv2.destroyAllWindows()
cv2.imwrite('.\\image\\lena_blue.jpg', src_img)