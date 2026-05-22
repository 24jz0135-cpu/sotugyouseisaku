import cv2
src_img = cv2.imread('.\\image\\lena.jpg')

dst_img = cv2.cvtColor(src_img, cv2.COLOR_BGR2GRAY)
print("---- after shape ----")
print(dst_img.shape)

cv2.imwrite("C:\\Users\\24jz\\Documents\\VScode\\python\\train\\image\\lena_gray.jpg", dst_img)
cv2.imshow("lena_gray.jpg", dst_img)
cv2.waitKey(0)
cv2.destroyAllWindows()