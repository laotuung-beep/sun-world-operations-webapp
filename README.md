# Sun World Ba Na Hills - Hệ Thống Báo Cáo Vận Hành Trò Chơi (Full-Stack Web App)

Ứng dụng quản lý, bấm giờ vận hành, giám sát 28 trò chơi và đồng bộ thời gian thực trên hệ sinh thái **Google Firebase (Firebase Auth + Cloud Firestore + Firebase Hosting)** kết hợp **Google Sheets**.

---

## 🎨 Hệ Thống Giao Diện 2 Chế Độ (Day & Night Theme)
- **☀️ Chế độ Ban ngày (`Light Mode`):** 3 màu chủ đạo **Vàng (`#FFC928`) – Đỏ (`#D71920`) – Trắng (`#FFFFFF`)** tối ưu độ tương phản ngoài trời nắng.
- **🌙 Chế độ Ban đêm (`Dark Mode`):** 3 màu chủ đạo **Xanh Navy (`#071630` / `#0D234A`) – Vàng (`#FFC928`) – Trắng (`#FFFFFF`)** dịu mắt khi vận hành ca tối.

---

## 🔐 Đăng Nhập Google Bắt Buộc & Phân Quyền (`Firebase Auth` + `RBAC`)
- **👔 Cấp Quản lý (`manager`):**
  - Toàn quyền trên cả 4 màn hình: Giám sát Dashboard 30 ô thời gian thực, cấp/đổi quyền tài khoản Google trong bảng `users`, làm mới/xóa lịch sử ca, cấu hình Cloud Firestore & xuất báo cáo tổng hợp.
- **👷 Cấp Nhân viên vận hành (`operator`):**
  - Được phép mở/đóng ca, ghi nhận thời gian dừng, bấm giờ xuất chuyến (Máng trượt 2 Line & 28 trò chơi), đếm khách và xem báo cáo.
  - Bị khóa quyền xóa lịch sử ca trực hoặc thay đổi cấu hình hệ thống.

---

## 🔥 Cấu Trúc File Chuẩn Hệ Sinh Thái Google Firebase
- `index.html`: Ứng dụng Full-Stack tích hợp Firebase SDK (Auth + Firestore + Offline Persistence).
- `firebase-config.js`: Nơi cấu hình thông số Firebase Project (hoặc dán trực tiếp ngay trên giao diện Web).
- `firestore.rules`: Bộ quy tắc bảo mật dữ liệu theo vai trò `manager` / `operator` trên Cloud Firestore.
- `firestore.indexes.json`: Cấu hình chỉ mục tối ưu tốc độ truy vấn theo Ngày + Trò chơi + Khu vực (Line/Rạp).
- `firebase.json` & `.firebaserc`: Cấu hình xuất bản 1 chạm lên **Firebase Hosting**.
- `Code.gs`: Mã Google Apps Script đồng bộ 2 chiều với 4 Sheet chuẩn khoa học trên Google Sheets.

---

## 🚀 Hướng Dẫn Xuất Bản 1 Chạm (`Publish my app`)
Khi bạn muốn đưa Web App lên tên miền chính thức `.web.app` của Google Firebase, chỉ cần nhắn câu lệnh:
> **`Publish my app`**

Hoặc chạy lệnh tự động:
```bash
npx firebase-tools login
npx firebase-tools deploy
```
