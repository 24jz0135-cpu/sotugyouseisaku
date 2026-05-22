import cv2
src_img = cv2.imread('.\\image\\lena.jpg')

text = "Hello OpenCV!"
org = (20, 50)
font = cv2.FONT_HERSHEY_SIMPLEX
fontScale = 0.7
color = (255, 255, 255)
thickness = 2

cv2.putText(src_img, text, org, font, fontScale, color, thickness)

cv2.imshow("lena_text.jpg", src_img)
cv2.waitKey(0)
cv2.destroyAllWindows()

cv2.imwrite('.\\image\\lena_text.jpg', src_img)