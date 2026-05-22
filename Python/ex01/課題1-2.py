score = int(input("点数を入力してください: "))

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "D"

print(f"点数: {score}点")
print(f"成績: {grade}")

# >>> score = int(input("点数を入力してください: "))
# ...
# ... if score >= 90:
# ...     grade = "A"
# ... elif score >= 80:
# ...     grade = "B"
# ... elif score >= 70:
# ...     grade = "C"
# ... else:
# ...     grade = "D"
# ...
# ... print(f"点数: {score}点")
# ... print(f"成績: {grade}")
# ...
# 点数を入力してください: 70
# 点数: 70点
# 成績: C
# >>>
# 点数を入力してください: 10
# 点数: 10点
# 成績: D