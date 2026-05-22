import cv2
src_img = cv2.imread('.\\image\\lena.jpg')
print(src_img.shape)

dst_img = cv2.resize(src_img, dsize=(200,200))

print("---- after shape ----")
print(dst_img.shape)

cv2.imshow("lena_resize.jpg", dst_img)
cv2.waitKey(0)
cv2.destroyAllWindows()