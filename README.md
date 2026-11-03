# Hệ thống vận hành Máng Trượt (Alpine Coaster) – Sun World Ba Na Hills

App v3 (dựng lại): nhân viên **nộp phiếu** số xe đơn / xe đôi theo khung giờ, quản lý **duyệt theo khung giờ**,
số đã duyệt mới vào **báo cáo**. Ô ma trận giờ = tổng cộng dồn các phiếu đã duyệt.

- Web: https://sunworld-ops-laotuung.web.app
- Firebase project: `sunworld-ops-laotuung`
- App cũ (v2, bản build đã vá) nằm ở tag `legacy-v2` – dùng để quay lại nếu cần.

## Tiến độ

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Khung app, đăng nhập Google, phân quyền, màn Tài khoản | ✅ |
| 2 | Nhân viên nhập phiếu, giờ chạy máng | ✅ |
| 3 | Quản lý duyệt theo khung giờ | ⏳ |
| 4 | Báo cáo, chốt ngày, xuất Excel / Sheets / ảnh Viber | ⏳ |
| 5 | Chạy song song với app cũ rồi chuyển hẳn | ⏳ |

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/config.ts` | Super Admin, 3 máng / 6 line |
| `src/auth/` | Đăng nhập, hồ sơ `users/{uid}`, quyết định quyền (`access.ts`) |
| `src/screens/` | Các màn hình |
| `public/` | Logo, avatar, video nền (copy nguyên vào bản build) |
| `firestore.rules` | Quyền đọc/ghi Firestore |
| `tests/rules/` | Kiểm thử rules (chạy trên Firestore emulator) |

## Dữ liệu Firestore

| Đường dẫn | Nội dung | Ai ghi |
|---|---|---|
| `users/{uid}` | Hồ sơ, `approved`, `appRole`, `mang` | Chính người đó (trừ quyền) · Super Admin (quyền) |
| `days/{YYYY-MM-DD}` | Ngày vận hành, `closed` = đã chốt | Quản lý (giai đoạn 4) |
| `days/{date}/entries/{id}` | Phiếu: `slotId`, `mang`, `lines.{lineX}.{single,double}`, `status` | Nhân viên của máng, trong ngày |
| `days/{date}/schedules/{1\|2\|3}` | Giờ mở, giờ đóng, phút tạm dừng của máng | Nhân viên của máng (trong ngày) · Quản lý |

Phiếu không bao giờ bị sửa số. `status`: `pending` (chờ duyệt) → `approved` / `rejected` (quản lý),
hoặc `cancelled` (người gửi tự huỷ khi còn chờ duyệt). Số khách = xe đơn × 1 + xe đôi × 2.

## Chạy trên máy

```bash
npm install
npm run dev        # http://localhost:5178
npm run check      # kiểm tra kiểu
npm test           # unit test
npm run build      # build ra dist/
```

Xem giao diện sau đăng nhập mà không cần Gmail: http://localhost:5178/?preview (người dùng giả, chỉ có khi `npm run dev`).

`npm run test:rules` cần Java (Firestore emulator) – chạy tự động trên GitHub Actions (`.github/workflows/ci.yml`).

## Đăng nhập & phân quyền

| Cấp | Điều kiện | Thấy |
|---|---|---|
| Super Admin | Gmail nằm trong `SUPER_ADMINS` (`src/config.ts`) **và** `isSuperAdmin()` (`firestore.rules`) | Chờ duyệt, Báo cáo, Tài khoản |
| Quản lý | `users/{uid}`: `approved = true`, `appRole = 'manager'` | Chờ duyệt, Báo cáo |
| Nhân viên | `users/{uid}`: `approved = true`, `appRole = 'staff'`, `mang = 1/2/3` | Nhập phiếu của máng được giao |

Người mới đăng nhập Google một lần → Super Admin vào tab **Tài khoản** → chọn vai trò (và máng) → **Duyệt**.
Người dùng không tự sửa được `approved / appRole / mang` (rules chặn).

Firebase Console → Authentication → Sign-in method: **Google: bật**, Anonymous / Email-Password: tắt.
Authentication → Settings → Authorized domains phải có tên miền đang mở app.

## Deploy

- **Xem thử:** mở Pull Request → GitHub Actions deploy lên kênh xem thử riêng (cần secret `FIREBASE_SERVICE_ACCOUNT`).
- **Rules:** Firebase Console → Firestore → Rules → dán `firestore.rules` → Publish.
  Bản rules này vẫn giữ quyền cho app cũ nên publish không làm hỏng app đang chạy.
- **Bản chính:** chỉ thay khi xong giai đoạn 5.
