from pathlib import Path

path = Path(r"d:\quant-web\apps\api\README.md")
data = path.read_bytes()

# 检查文件是否有 BOM
has_bom = data[:3] == b'\xef\xbb\xbf'
print(f"Has UTF-8 BOM: {has_bom}")

# 解码
text = data.decode("utf-8-sig")

# 要删除的行
target_line = "- TaskService 持久化实现（替换 InMemoryTaskService）\n"

if target_line not in text:
    print("ERROR: target line not found")
    print("Last 500 chars of file:")
    print(repr(text[-500:]))
    # 检查是否有变体
    if "TaskService 持久化" in text:
        print("Found 'TaskService 持久化' somewhere:")
        idx = text.find("TaskService 持久化")
        print(repr(text[max(0, idx-100):idx+200]))
    raise SystemExit(1)

new_text = text.replace(target_line, "", 1)
print(f"Removed target line. Old size: {len(data)}, new size: {len(new_text.encode('utf-8'))}")

# 写回（保持原 BOM 状态）
if has_bom:
    path.write_bytes(b'\xef\xbb\xbf' + new_text.encode("utf-8"))
else:
    path.write_bytes(new_text.encode("utf-8"))

print(f"File written. New size on disk: {path.stat().st_size}")
