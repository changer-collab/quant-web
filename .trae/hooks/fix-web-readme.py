from pathlib import Path

path = Path(r"d:\quant-web\apps\web\README.md")
data = path.read_bytes()
has_bom = data[:3] == b'\xef\xbb\xbf'
text = data.decode("utf-8-sig")

old_line = "后端 API（API 失败/无数据时降级到 mock）"
new_line = "后端 API（API 失败/无数据时展示空状态，不降级到 mock）"

if old_line not in text:
    print("ERROR: old line not found")
    raise SystemExit(1)

new_text = text.replace(old_line, new_line, 1)

if has_bom:
    path.write_bytes(b'\xef\xbb\xbf' + new_text.encode("utf-8"))
else:
    path.write_bytes(new_text.encode("utf-8"))

print(f"Fixed. Old size: {len(data)}, new size: {path.stat().st_size}")
