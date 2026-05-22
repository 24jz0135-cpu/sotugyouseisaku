while True:
    try:
        number = int(input("数値を入力してください: "))
        print(f"入力された数値: {number}")
        break
    except ValueError:
        print("数値を入力してください")

# >>> while True:
# ...     try:
# ...         number = int(input("数値を入力してください: "))
# ...         print(f"入力された数値: {number}")
# ...         break
# ...     except ValueError:
# ...         print("数値を入力してください")
# ...
# 数値を入力してください: aaa
# 数値を入力してください
# 数値を入力してください: 10
# 入力された数値: 10
# >>>