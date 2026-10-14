## Chạy ứng dụng

Từ thư mục gốc dự án:

```bash
./camera-simple/run.sh
```

Mở **http://localhost:8099/dashboard**, đăng nhập bằng tài khoản VTP hiện tại. Nhấn **Ctrl+C** để dừng. 

Script tự chuẩn bị Node.js 22, uv và môi trường Python vào `.tools`/`.venv`. Lần đầu cần Internet. Hỗ trợ Linux x86_64/ARM64, cần Python 3.10+. Không cần FFmpeg, Docker, npm hay pip hệ thống cho ứng dụng mini. 

## Chức năng

- Dashboard gốc: trạng thái và danh sách đơn theo bàn, tìm kiếm, lọc ngày/giờ và loại bàn, phân trang, ảnh đại diện, tự cập nhật, thông báo lỗi và thử lại.
- **Xem tất cả** mở danh sách đơn của bàn trong cửa sổ ngay trên dashboard, giữ bộ lọc ngày/giờ/loại bàn. Danh sách có đầy đủ bộ lọc, tab trạng thái, phân trang và mở chi tiết như trang đơn hàng gốc.
- Modal **Chi tiết đơn hàng** giữ nguyên từ hệ thống gốc: thông tin đơn, thời gian, video đại diện đã ghép, trạng thái ghép tự động, chuyển góc chính/phụ, kéo vị trí góc nhỏ, zoom, phát/dừng/tua đồng bộ hai góc, ảnh chụp và phóng to ảnh, xem video các phiên, tải từng góc và tải video ghép theo đủ **6 bố cục**.
- Đăng nhập, đăng xuất và quyền truy cập dùng hệ thống gốc. Không có trang quản trị hoặc nhập RTSP trong mini.

## Kết nối hệ thống đang chạy

Mặc định trên máy hiện tại:

| Biến | Mặc định | Mục đích |
| --- | --- | --- |
| `VTP_API_URL` | `http://127.0.0.1:18080` | API VTP gốc |
| `VTP_MEDIA_URL` | `http://127.0.0.1:18000` | Gateway video/MinIO |
| `VTP_MEDIA_SIGNED_HOST` | `192.168.1.94:18000` | Host và port trong `S3_PUBLIC_ENDPOINT` để bảo toàn chữ ký URL |
| `VTP_BIND_HOST` | `127.0.0.1` | Địa chỉ ứng dụng mini lắng nghe |
| `VTP_PORT` | `8099` | Cổng ứng dụng mini |
