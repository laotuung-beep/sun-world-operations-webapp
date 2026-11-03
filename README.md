# Hệ thống vận hành Máng Trượt (Alpine Coaster) – Sun World Ba Na Hills

App v3 (dựng lại): nhân viên **nộp phiếu** số xe đơn / xe đôi theo khung giờ, quản lý **duyệt theo khung giờ**,
số đã duyệt mới vào **báo cáo**. Ô ma trận giờ = tổng cộng dồn các phiếu đã duyệt.

- Web: https://sunworld-ops-laotuung.web.app
- Firebase project: `sunworld-ops-laotuung`
- App cũ (v2, bản build đã vá) nằm ở tag `legacy-v2` – dùng để quay lại nếu cần.

## Màn hình

Giao diện giữ như app cũ (thanh ALPINE COASTER, 3 tab, thanh tab dưới trên điện thoại, màn đăng nhập quả cầu video).

| Tab | Làm gì |
|---|---|
| Nhập 6 Line | Khung giờ, chọn máng (AC 1/2/3 kèm số khách hôm nay), xe đơn / xe đôi 2 line → **Lưu phiếu** (ô về 0). Thời gian vận hành tự lưu. Danh sách phiếu của khung đang chọn. |
| Ma Trận Giờ | Bảng khung giờ × 6 line số **đã duyệt**, số cam **+N** là phiếu chờ. Chạm dòng → xem phiếu, **Duyệt khung**, **Trả lại**. **Duyệt tất cả**, **Xuất Excel**. |
| Báo Cáo Ca | Số đã duyệt: khách chơi máng, doanh thu, tỷ lệ lên cáp, đối soát cáp treo & cổng, vận hành 6 line. **Chép gửi Viber**, **Gửi báo cáo** (Sheets), **Tải xuống** (Excel), **In**, **Chốt ngày**. |

Ngày xem Ma Trận / Báo Cáo chọn ở nút lịch trên thanh trên. Super Admin: menu tài khoản → Tài khoản (duyệt Gmail), Google Sheets.

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
| `days/{YYYY-MM-DD}` | Số liệu đối soát (cáp treo, cổng, doanh thu), `closed` = đã chốt | Gmail đã duyệt (ngày đã chốt: chỉ Super Admin) |
| `days/{date}/entries/{id}` | Phiếu: `slotId`, `mang`, `lines.{lineX}.{single,double}`, `status` | Gửi: trong ngày · Duyệt / trả lại: Gmail đã duyệt |
| `days/{date}/schedules/{1\|2\|3}` | Giờ mở, giờ đóng, phút tạm dừng của máng | Gmail đã duyệt |
| `settings/app` | URL Apps Script Google Sheets | Super Admin |

Phiếu không bao giờ bị sửa số. `status`: `pending` (chờ duyệt) → `approved` / `rejected` (quản lý),
hoặc `cancelled` (người gửi tự huỷ khi còn chờ duyệt).
Báo cáo chỉ tính phiếu `approved`. Gửi Google Sheets giữ đúng khuôn dữ liệu của app cũ (`syncDailyReport6Line`). Số khách = xe đơn × 1 + xe đôi × 2.

## Chạy trên máy

```bash
npm install
npm run dev        # http://localhost:5178
npm run check      # kiểm tra kiểu
npm test           # unit test
npm run build      # build ra dist/
```

Xem giao diện sau đăng nhập mà không cần Gmail: http://localhost:5178/?preview (người dùng giả, chỉ có khi `npm run dev`; thêm `&admin` để xem như Super Admin).

`npm run test:rules` cần Java (Firestore emulator) – chạy tự động trên GitHub Actions (`.github/workflows/ci.yml`).

## Đăng nhập & quyền

Không chia cấp: **mọi Gmail đã được duyệt** thấy và làm được tất cả các tab (trừ Tài khoản).
Super Admin (`SUPER_ADMINS` trong `src/config.ts` **và** `isSuperAdmin()` trong `firestore.rules`) thêm quyền:
duyệt / khoá Gmail, mở lại ngày đã chốt, cấu hình URL Google Sheets.

Người mới đăng nhập Google một lần → Super Admin vào tab **Tài khoản** → **Duyệt**.
Rules vẫn chặn: không ai tự duyệt mình, không ai sửa số trên phiếu, ngày đã chốt thì khoá.

Firebase Console → Authentication → Sign-in method: **Google: bật**, Anonymous / Email-Password: tắt.
Authentication → Settings → Authorized domains phải có tên miền đang mở app.

## Deploy

- **Bản chính:** https://mangtuot-bc.vercel.app – Vercel tự build mỗi lần đẩy lên `main` (cấu hình trong `vercel.json`).
- **Rules:** Firebase Console → Firestore → Rules → dán `firestore.rules` → Publish (mỗi lần file này đổi).
- **Quay lại app cũ:** tag `legacy-v2`.
