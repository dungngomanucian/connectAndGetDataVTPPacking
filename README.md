# VTP Packing

Ứng dụng giám sát đóng gói, tra cứu đơn hàng, xem bằng chứng hình ảnh/video và báo cáo hoạt động.

## Chức năng

- **Tổng quan** (`/dashboard`): theo dõi hoạt động bàn đóng gói và truy cập các phiên liên quan.
- **Đơn hàng** (`/packing`): tìm kiếm mã đơn/mã phiên; lọc thời gian, loại bàn, bàn và trạng thái; phân trang và cập nhật dữ liệu.
- **Xem lại**: xem hình ảnh/video, đổi góc camera, điều khiển phát và tải video theo bố cục được hỗ trợ.
- **Báo cáo** (`/reports`): lọc kho/bàn/thời gian/từ khóa; xem sản lượng theo ngày, hiệu suất theo bàn và biểu đồ; sắp xếp, phân trang và xuất Excel.

Sidebar hỗ trợ chuyển trang; trên điện thoại, sử dụng nút menu. Báo cáo tự cập nhật mỗi 15 giây khi tab đang hiển thị.

## Chạy từ mã nguồn

Trong thư mục ứng dụng:

```bash
bash run.sh
```

Mở [http://localhost:8099/dashboard](http://localhost:8099/dashboard) và đăng nhập bằng tài khoản được cấp. Có thể truy cập trực tiếp `/packing` hoặc `/reports`. Nhấn **Ctrl+C** để dừng.

Script hỗ trợ Linux x86_64/ARM64 và chuẩn bị Node.js, uv cùng các dependencies cần thiết. Máy cần Python 3.10+ và kết nối mạng khi cài dependencies lần đầu.

## Cấu hình dịch vụ

Đặt biến môi trường trước khi chạy:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VTP_API_URL` | `http://192.168.1.94:18080` | Địa chỉ dịch vụ API VTP. |
| `VTP_MEDIA_URL` | `http://192.168.1.94:18000` | Địa chỉ dịch vụ media. |
| `VTP_MEDIA_SIGNED_HOST` | `192.168.1.94:18000` | Host và port dùng khi ký URL media, khớp cấu hình `S3_PUBLIC_ENDPOINT`. |
| `VTP_BIND_HOST` | `127.0.0.1` | Địa chỉ mạng ứng dụng lắng nghe. |
| `VTP_PORT` | `8099` | Cổng ứng dụng. |

Ví dụ triển khai trên máy có thể kết nối API và media:

```bash
VTP_API_URL="http://192.168.1.94:18080" \
VTP_MEDIA_URL="http://192.168.1.94:18000" \
VTP_MEDIA_SIGNED_HOST="192.168.1.94:18000" \
VTP_BIND_HOST="0.0.0.0" \
bash run.sh
```

Truy cập `http://<dia-chi-may-chu>:8099/dashboard`. Thay các địa chỉ dịch vụ theo môi trường triển khai. API và media phải truy cập được từ máy chạy ứng dụng; signed host phải khớp host/port dùng để ký URL để video hoạt động đúng.

Tài khoản, quyền truy cập và phạm vi dữ liệu được quản lý tại dịch vụ API. Không chia sẻ thông tin đăng nhập, token hoặc URL media đã ký.

## Đóng gói và triển khai

```bash
bash package.sh
```

Gói cài đặt được tạo tại `releases/vtp-packing.zip`, kèm file checksum SHA-256. Giải nén, cấu hình các biến môi trường và chạy `bash run.sh` trong thư mục `vtp-packing/`.

Máy chạy gói cài đặt cần Python 3.10+ cùng uv hoặc venv/pip; không cần Node.js. Ứng dụng cần cả giao diện đã build và Python gateway để phục vụ các đường dẫn `/api` và `/media-proxy`; không triển khai riêng `dist/` lên static hosting.

## Kiểm tra

Trong môi trường phát triển đã cài dependencies:

```bash
npm run build
.venv/bin/python -m unittest discover -s tests -v
```

Các kiểm tra tự động sử dụng dịch vụ giả lập. Trước khi vận hành, xác nhận đăng nhập, truy cập dữ liệu, phát/tải video và xuất Excel với cấu hình dịch vụ thực tế.
