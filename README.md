# Hệ thống vận hành Máng Trượt (Alpine Coaster) – Sun World Ba Na Hills

Web app nhập số xe theo giờ cho 3 máng / 6 line, đồng bộ realtime qua Firebase.

- Web: https://sunworld-ops-laotuung.web.app
- Firebase project: `sunworld-ops-laotuung`

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `public/` | Bản build của app (React/Vite) – thư mục được deploy lên Firebase Hosting |
| `firestore.rules` | Quyền đọc/ghi Firestore |
| `firebase.json` | Cấu hình Hosting + Firestore |

> Source React gốc được dựng trong Firebase Studio / AI Studio, chưa có trong repo này.
> `public/assets/index-mangtruot-gauth.js` là bản build đã vá: chỉ đăng nhập Google,
> bỏ đăng nhập mật khẩu trạm và đăng nhập ẩn danh, báo lỗi khi Gmail chưa được duyệt.
> Khi lấy được source gốc, cần sửa lại đúng các điểm này trong source rồi build đè `public/`.

## Đăng nhập & phân quyền

1. Mở app → chọn máng đang trực → **Đăng nhập với Google**.
2. Super Admin (toàn quyền, không cần duyệt) – khai báo ở **cả hai** nơi:
   `firestore.rules` (hàm `isSuperAdmin`) và trong bundle (`__sa`):
   `phongbanana96@gmail.com`, `laotuung@gmail.com`, `laoung1996@gmail.com`, `dieuhanh.mangtruot@gmail.com`.
3. Nhân viên khác: đăng nhập Google một lần để app tạo hồ sơ `users/{uid}`, sau đó quản lý vào
   Firebase Console → Firestore → `users` → hồ sơ đó → thêm field `approved` (boolean) = `true`.
   Khóa tài khoản: đổi `approved` thành `false`.

Cài đặt cần có trong Firebase Console → Authentication → Sign-in method:
**Google: bật**, **Anonymous: tắt**, **Email/Password: tắt**.

## Deploy

```bash
firebase deploy --only hosting,firestore:rules --project sunworld-ops-laotuung
```
