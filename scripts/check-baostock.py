import baostock as bs

lg = bs.login()
print(f"login: error_code={lg.error_code}, error_msg={lg.error_msg}")

rs = bs.query_history_k_data_plus(
    "sh.600519",
    "date,open,high,low,close,volume",
    start_date="2024-01-02",
    end_date="2024-01-10",
    frequency="d",
    adjustflag="2",
)

rows = []
while (rs.error_code == "0") and rs.next():
    rows.append(rs.get_row_data())

print(f"rows={len(rows)}, first={rows[0] if rows else None}")
bs.logout()
