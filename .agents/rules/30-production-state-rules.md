# Rule 30: Production State Rules

## 1. Thứ tự 6 Trạm cố định:
$$\text{1. RECEIVING} \rightarrow \text{2. SORTING} \rightarrow \text{3. WASHING} \rightarrow \text{4. DRYING} \rightarrow \text{5. FOLDING} \rightarrow \text{6. DISPATCH}$$

## 2. Quy tắc Trạm hiện tại & Tiến trạm:
- **Trạm xa nhất (`Furthest Station Reached`):** Trạm hiện tại của lô hàng luôn là trạm có số thứ tự cao nhất đã được ghi nhận sự kiện accepted.
- **Không bao giờ lùi trạm (`Never Move Backwards`):** Sự kiện cũ gửi muộn chỉ bổ sung vào lịch sử (history), không được làm lùi vị trí trạm hiện tại.

## 3. Thứ tự ưu tiên Trạng thái (State Precedence):
1. **`COMPLETED`**: Có sự kiện `DISPATCH` hợp lệ (kể cả trước đó có bị Block).
2. **`BLOCKED`**: Chưa có `DISPATCH` và Quản lý đang áp dụng active block (`BLOCK` chưa được `RESUME`).
3. **`IN_PROGRESS`**: Chưa có `DISPATCH`/active block và có ít nhất 1 sự kiện từ `RECEIVING` đến `FOLDING`.
4. **`PLANNED`**: Đã tạo đơn/lô hàng nhưng chưa có bất kỳ sự kiện sản xuất nào.

## 4. WIP, Completed Quantity & Cảnh báo:
- **Station WIP:** Tổng số lô hàng chưa `COMPLETED` đang có trạm hiện tại là trạm đó.
- **Completed Quantity:** Sản lượng hoàn thành đã khử trùng lặp (Deduplicated), không cộng dồn trùng lặp từ nhiều quan sát.
- **`STALE` Indicator:** Thời gian từ sự kiện cuối cùng vượt quá ngưỡng cấu hình (mặc định 15 phút).
- **`MISSING_DATA` Indicator:** Lô hàng nhảy cóc qua trạm mà thiếu sự kiện của trạm trước đó.
- **`QUALITY` Indicator:** Có cảnh báo lỗi chất lượng từ telemetry hoặc kiểm tra trạm.
- **Management Events:** Thao tác Block/Resume/Note/Acknowledge được lưu dạng **Append-only** kèm `organizationId`, `actor` và `timestamp`.
