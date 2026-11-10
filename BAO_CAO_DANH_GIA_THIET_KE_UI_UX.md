# BÁO CÁO ĐÁNH GIÁ VÀ PHÂN TÍCH THIẾT KẾ UI/UX
## HỆ THỐNG BÁO CÁO VẬN HÀNH MÁNG TRƯỢT — ALPINE COASTER (SUN WORLD BA NA HILLS)

> **Người thực hiện:** Chuyên gia Thiết kế UI/UX & Kiểm duyệt Hệ thống Vận hành (20 năm kinh nghiệm trong ngành Theme Park & Mission-Critical Operational Systems)  
> **Dự án:** Web App Thống Kê Lượt Khách — Alpine Coaster  
> **Tài liệu đối chiếu:** Hình ảnh thiết kế mẫu `media_1794275699907_8d3278e1.jpg` vs. Mã nguồn màn hình hiện tại `src/screens/report/ReportScreen.tsx`  
> **Thời điểm thẩm định:** 10/11/2026  
> **Trạng thái:** Hoàn tất thẩm định & Phê duyệt tiêu chuẩn triển khai (R1 Approval)

---

## 1. TỔNG QUAN VÀ BỐI CẢNH NGHIỆP VỤ (EXECUTIVE SUMMARY)

Trong môi trường vận hành công viên giải trí quy mô lớn (Theme Park) như Sun World Ba Na Hills, hệ thống máng trượt đôi Alpine Coaster là một trong những tuyến điểm thu hút lưu lượng khách đông đảo nhất, đòi hỏi sự phối hợp nhịp nhàng giữa điều hành thực địa, kế toán vé, kỹ thuật vận hành và ban giám đốc. 

Giao diện báo cáo vận hành không chỉ đơn thuần là nơi tổng kết số liệu cuối ngày mà còn là **bảng điều khiển tác nghiệp (Operational Cockpit)**:
1. **Ban Giám đốc & Quản lý vận hành:** Cần nắm bắt tức thì trong 3 giây các chỉ số sống còn: Tổng doanh thu vé tại quầy, tổng lượt khách trải nghiệm máng trượt và tỷ lệ chuyển đổi khách từ cáp treo sang máng trượt.
2. **Trưởng ca & Điều phối viên:** Cần số liệu đối soát chính xác theo phân đoạn cổng (Vé tính phí, Miễn phí, Combo đêm) để khớp lệnh với cáp treo và xuất báo cáo chia sẻ tức thì qua mạng xã hội tác nghiệp (Viber / Zalo) hoặc tải file bảng tính chuẩn phục vụ kiểm toán nội bộ.

Bản phân tích dưới đây đánh giá toàn diện hình ảnh thiết kế mẫu so với màn hình hiện tại, xác lập tiêu chuẩn thiết kế hiện đại, giải pháp phân cấp thị giác và kế hoạch ánh xạ dữ liệu chuẩn xác tuyệt đối vào hệ thống.

---

## 2. PHÂN TÍCH CẤU TRÚC BỐ CỤC VÀ PHÂN CẤP THỊ GIÁC (VISUAL HIERARCHY & LAYOUT ARCHITECTURE)

Thiết kế mẫu thể hiện cấu trúc bố cục **Phân tầng 4 cấp (4-Tier Progressive Disclosure Architecture)** với nhịp điệu thị giác rõ ràng, loại bỏ hoàn toàn tình trạng dàn trải thông tin:

```
┌─────────────────────────────────────────────────────────────────┐
│ TẦNG 0: GLOBAL APP BAR (Logo, Realtime Sync, Date Pill, Avatar) │
├─────────────────────────────────────────────────────────────────┤
│ TẦNG 1: ACTION HEADER CARD (Icon Báo cáo, Ngày, Gửi & Xuất)     │
├─────────────────────────────────────────────────────────────────┤
│ TẦNG 2: PREMIER HERO CARD (DOANH THU - Nền Đỏ Thương Hiệu)      │
├─────────────────────────────────────────────────────────────────┤
│ TẦNG 3: OPERATIONAL KEY INDICATORS (2 Cột Đối Xứng Song Sinh)    │
│  - Cột 1: KHÁCH CHƠI MÁNG (Số lượng, Badge %, Tuyến vận hành)   │
│  - Cột 2: TỶ LỆ CHƠI / CÁP (Tỷ lệ %, Badge %, Progress Bar)      │
├─────────────────────────────────────────────────────────────────┤
│ TẦNG 4: ĐỐI SOÁT CÁP TREO & CỔNG (Lưới 2x2 Cân Bằng Chuẩn Mực)   │
│  - [Khách lên cáp]   [Khách tính phí]                           │
│  - [Khách miễn phí]  [Khách combo đêm]                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1. Chi tiết từng tầng cấu trúc (Zone-by-Zone Breakdown)

#### Tầng 0: Global App Header
* **Branding:** Khối nhận diện bên trái gồm squircle nền đen than chì (`#1C1917`), bo góc `rounded-xl`, viền chỉ vàng kim (`#C8A97E`), biểu tượng máng trượt kèm chấm xanh trạng thái sống (live ping indicator). Chữ `ALPINE` màu xám than đậm và `COASTER` màu vàng kim (`#C8A97E`).
* **Operational Badges:**
  * Chỉ báo đồng bộ: Viên nang bo tròn nền xanh ngọc dịu (`#E8F5E9`), icon đám mây xanh (`#16A34A`), thể hiện trạng thái kết nối realtime với Google Drive và Cloud Firestore.
  * Viên nang ngày: Nền trắng viền xám mảnh, chữ `09/11` in đậm kiểu số kỹ thuật (`tabular-nums`), giúp nhận diện nhanh ngày tác nghiệp.
  * User Avatar: Bo tròn hoàn toàn (32px), thể hiện người dùng hiện tại đang đăng nhập.

#### Tầng 1: Action Header Card (Context & Actions)
* **Khối thẻ nền trắng (`bg-white`):** Bo góc `rounded-2xl` (16px), viền mỏng `#E5E7EB`, bóng đổ mềm nhẹ (`shadow-xs`), tạo một khung chứa độc lập, tinh tế.
* **Cụm tiêu đề bên trái:**
  * Huy hiệu icon: Khối vuông bo góc (`w-10 h-10 rounded-xl`), nền đỏ thương hiệu `#D71920`, chứa icon mũi tên biểu đồ tăng trưởng (`TrendingUp`) màu trắng tinh khiết.
  * Tiêu đề chính: `BÁO CÁO VẬN HÀNH` in hoa, đậm (`text-sm font-bold text-[#1E293B] tracking-wide`).
  * Thông tin phụ: `Ngày 09/11/2026` (`text-[11px] font-medium text-[#64748B]`).
* **Cụm nút hành động bên phải:**
  * Nút chính `Gửi báo cáo`: Nền đỏ thương hiệu (`#D71920`), chữ trắng in đậm, bo góc `rounded-lg`, tối ưu cho tác vụ chạm một chạm để sao chép ảnh gửi Viber điều hành.
  * Nút phụ `Xuất Excel`: Nền trắng viền xám `#E5E7EB`, chữ đen đậm `#20242B`, phục vụ tải bảng tính đa ngày phục vụ đối soát.

#### Tầng 2: Premier Hero Card — Doanh Thu Vé Tại Quầy
* **Diện mạo chủ đạo:** Nền đỏ thương hiệu nguyên khối (Solid Red `#D71920` hoặc dải màu tinh tế `#DC2626` sang `#BE123C`), bo góc rộng `rounded-2xl` (16–20px), padding trong `p-4 sm:p-5`.
* **Hàng trên:**
  * Nhãn danh mục: `DOANH THU` in hoa, chữ trắng đậm, tracking rộng (`tracking-wider`).
  * Tag định danh nghiệp vụ: `✓ Vé tại quầy` nằm trong huy hiệu nền trắng mờ (`bg-white/20 border border-white/30 backdrop-blur-xs`), chữ trắng rõ ràng, khẳng định tính chất nguồn thu.
  * Huy hiệu tăng trưởng: Viên nang nền trắng tinh khiết (`bg-white`), chữ xanh lá rừng đậm (`#15803D`) `▲ +12.5%`, nổi bật trên nền đỏ mà không bị chói mắt.
* **Số liệu trung tâm:**
  * Định dạng số: `542.450.000` với cỡ chữ khổng lồ (`text-3xl sm:text-[44px] font-bold font-numeric text-white tabular-nums tracking-tight`).
  * Đơn vị tiền tệ: `VNĐ` in nghiêng nhẹ (`italic`), font thanh lịch (`text-base sm:text-2xl text-white/90 ml-1.5`).

#### Tầng 3: Operational Key Indicators (2 Cột Đối Xứng Song Sinh)
* Cả hai thẻ đều sử dụng nền trắng phẳng (`bg-white`), bo góc `rounded-2xl`, viền mỏng `#E5E7EB`, chiều cao và lề trong hoàn toàn đồng nhất, tạo tính đối xứng cân bằng thị giác tuyệt đối.
* **Cột 1: KHÁCH CHƠI MÁNG (Sản lượng vận hành)**
  * Hàng trên: Nhãn `KHÁCH CHƠI MÁNG` (`text-xs sm:text-sm font-bold text-[#64748B] uppercase`) + Huy hiệu % `▲ +7.4%` (nền `#F0FDF4`, viền `#DCFCE7`, chữ `#15803D`).
  * Số liệu trung tâm: `5.755` (`text-3xl sm:text-4xl font-bold font-numeric text-[#20242B]`) kèm đơn vị `khách` (`text-xs sm:text-sm font-normal italic text-[#64748B]`).
  * Chỉ số trạng thái: Chấm tròn xanh lá sống động `●` (`#16A34A`) đi kèm dòng trạng thái cô đọng: `3 tuyến vận hành`.
* **Cột 2: TỶ LỆ CHƠI / CÁP (Tỷ lệ chuyển đổi)**
  * Hàng trên: Nhãn `TỶ LỆ CHƠI / CÁP` (`text-xs sm:text-sm font-bold text-[#64748B] uppercase`) + Huy hiệu % `▲ +4.2%`.
  * Số liệu trung tâm: `60.3%` (`text-3xl sm:text-4xl font-bold font-numeric text-[#20242B]`).
  * Thanh tiến trình trực quan phân đoạn (Segmented Progress Bar): Thanh ray dài bo tròn (`rounded-full h-2 sm:h-2.5 bg-[#E5E7EB]`), phần đã đạt tô màu đỏ thương hiệu (`#D71920`) chuẩn xác theo tỷ lệ 60.3%.
  * Dòng diễn giải chi tiết: `5.755 chơi / 9.540 cáp` với các con số in đậm, đơn vị in xám rõ ràng.

#### Tầng 4: Đối Soát Cáp Treo & Cổng (Lưới 2x2 Chuẩn Mực)
* **Tiêu đề phân khu:** `ĐỐI SOÁT CÁP TREO & CỔNG` in hoa đậm (`text-xs sm:text-sm font-bold tracking-wide text-[#20242B] mb-2 sm:mb-2.5`).
* **Lưới 4 ô (2 hàng × 2 cột):**
  * Ô 1 (Góc trên trái): `Khách lên cáp` ➔ `9.540` *khách*
  * Ô 2 (Góc trên phải): `Khách tính phí` ➔ `5.558` *khách*
  * Ô 3 (Góc dưới trái): `Khách miễn phí` ➔ `197` *khách*
  * Ô 4 (Góc dưới phải): `Khách combo đêm` ➔ `53` *khách*
* **Phong cách thẻ đối soát:**
  * Nền thẻ xám nhạt cao cấp (`bg-[#FAFAFA]` hoặc `bg-white`), bo góc `rounded-xl` (12px), viền `#E5E7EB`.
  * Không dùng icon màu mè để tránh làm xao nhãng việc kiểm toán số.
  * Tên chỉ số ở phía trên (`text-xs font-medium text-[#64748B]`), số liệu lớn phía dưới (`text-2xl sm:text-[28px] font-bold font-numeric text-[#20242B]`) kèm đuôi `khách` in nghiêng.

---

## 3. BẢNG MÀU SẮC, DESIGN TOKENS VÀ ĐÁNH GIÁ ĐỘ TƯƠNG PHẢN (COLOR PALETTE & CONTRAST RATIOS)

### 3.1. Bảng mã màu chuẩn xác (Hex & Semantic Role)

| Thành phần giao diện | Mã màu Hex | Vai trò cảm xúc & Chức năng thị giác | Tiêu chuẩn WCAG |
|---|---|---|---|
| **Brand Primary Red** | `#D71920` | Màu đỏ thương hiệu Sun World Alpine Coaster, sử dụng cho Thẻ Hero Doanh Thu, icon báo cáo, thanh tiến trình và nút chính. Tạo cảm giác năng lượng, sự chú ý hàng đầu. | 4.9:1 đối với chữ trắng (Đạt WCAG AA & AAA chữ lớn) |
| **Dark Red Accents** | `#B9151B` | Màu đỏ đậm cho trạng thái hover/active của nút và viền nổi bật. | > 5.5:1 |
| **Primary Ink (Dark Slate)** | `#20242B` / `#1E293B` | Màu chữ số liệu chính, tiêu đề section. Độ tương phản cực cao trên nền trắng mà không bị gắt như màu đen thuần túy `#000000`. | 14.1:1 trên nền trắng (Vượt chuẩn AAA) |
| **Secondary Slate** | `#64748B` / `#6B7280` | Nhãn mục, chú thích, đơn vị đo lường (*khách*, *cáp*). | 4.8:1 trên nền trắng (Đạt WCAG AA) |
| **Page Canvas** | `#F5F6F8` / `#F8FAFC` | Nền toàn trang, giảm lóa mắt khi nhân viên theo dõi màn hình ngoài trời hoặc phòng điều hành ánh sáng mạnh. | — |
| **Card Surface** | `#FFFFFF` | Nền thẻ nổi bật chính, tạo chiều sâu thị giác sạch sẽ. | — |
| **Secondary Surface** | `#FAFAFA` | Nền cho 4 thẻ đối soát cáp treo & cổng, phân biệt nhẹ với nền trang và thẻ cấp 1. | — |
| **Positive Trend Green** | `#15803D` / `#16A34A` | Màu chữ và mũi tên tăng trưởng dương, chấm tròn trạng thái vận hành. | 5.8:1 trên nền `#F0FDF4` (Đạt WCAG AAA) |
| **Positive Trend Surface** | `#F0FDF4` (Viền `#DCFCE7`) | Nền viên nang tăng trưởng, mang lại cảm giác tích cực, thân thiện. | — |
| **Negative Trend Red** | `#DC2626` (Nền `#FEF2F2`) | Dự phòng cho chỉ số suy giảm so với kỳ trước. | 5.2:1 trên nền `#FEF2F2` (Đạt WCAG AA) |
| **Neutral Trend Gray** | `#64748B` (Nền `#F1F5F9`) | Dự phòng cho trường hợp không có kỳ đối chiếu hoặc biến động 0.0%. | 4.6:1 trên nền `#F1F5F9` |
| **Progress Track Gray** | `#E5E7EB` | Rãnh trượt của thanh tiến trình, tương phản rõ rệt với dải đỏ `#D71920`. | — |

---

## 4. PHÂN TÍCH SO SÁNH ĐỐI CHIẾU VỚI MÀN HÌNH HIỆN TẠI (CONTRAST ANALYSIS)

### 4.1. Bảng đối chiếu trực quan (Current Code vs. Reference Design)

| Tiêu chí so sánh | Màn hình hiện tại (`ReportScreen.tsx`) | Thiết kế mẫu tham chiếu (`media_...8d3278e1.jpg`) | Đánh giá chuyên gia UI/UX (20 năm kinh nghiệm) |
|---|---|---|---|
| **Cấu trúc Action & Header** | Các nút "Chép gửi Viber", "Xuất dữ liệu" nằm tách rời bên ngoài thẻ báo cáo; nút "Chốt ngày" và link Drive chen ngang gây rối mắt. Khi chụp ảnh, header chỉ là dòng chữ đơn giản. | Tích hợp thành một Thẻ Header thống nhất (`Action Header Card`) gồm Icon biểu đồ đỏ nổi bật, Tiêu đề, Ngày tác nghiệp và 2 nút hành động trực quan "Gửi báo cáo" & "Xuất Excel". | **Vượt trội hoàn toàn về tính chuyên nghiệp:** Khung hình khi chụp gửi đi trông như một bản báo cáo điều hành hoàn chỉnh của tập đoàn, không bị khuyết tật bố cục. |
| **Thẻ Doanh Thu (Hero Card)** | Đã có nền đỏ và số tiền, nhưng bố cục lề trong chưa tối ưu, số liệu % tăng trưởng bị fix cứng `const growthRate = 12.5`. | Nền đỏ thương hiệu rực rỡ, bo góc `rounded-2xl` mềm mại, tag `✓ Vé tại quầy` mờ ảo sang trọng, huy hiệu % trắng nổi bật, số tiền định dạng chuẩn `VNĐ` nghiêng nhẹ. | **Thẩm mỹ hiện đại đẳng cấp (Executive Polish):** Nâng tầm nhận diện thương hiệu, tôn vinh chỉ số doanh thu như một "North Star Metric". |
| **Tầng 2: Khách chơi & Tỷ lệ cáp** | Phân chia 2 chế độ responsive khác nhau (`md:hidden` gộp 1 khung có đường chia đôi; `md:grid` tách 2 thẻ riêng biệt). Dòng text dài dòng "Tổng sản lượng vận hành cả 3 tuyến máng trượt", format subtext khác nhau giữa mobile và desktop. | Luôn duy trì dạng 2 cột song sinh đối xứng cân bằng hoàn hảo trên mọi thiết bị. Dòng trạng thái cô đọng: `● 3 tuyến vận hành`. Tỷ lệ hiển thị rõ ràng: `X chơi / Y cáp`. Có thanh tiến trình phân đoạn đỏ trực quan. | **Tối ưu hóa tải nhận thức (Cognitive Ergonomics):** Nhân viên thực địa chỉ cần liếc mắt 0.5s là đọc được ngay số khách và tỷ lệ chơi/cáp mà không cần đọc những câu chữ rườm rà. |
| **Tầng 3: Đối soát cáp treo & cổng** | Trên desktop kéo dài thành 4 cột ngang hẹp (`md:grid-cols-4`). Có chèn icon minh họa lớn (`Mountain`, `Ticket`, `UserCheck`, `Moon`). Thiếu đơn vị `khách` sau con số. | Duy trì chuẩn mực **Lưới 2 hàng × 2 cột (2x2 Grid)** trên cả mobile và desktop. Bỏ các icon trang trí thừa thãi, chỉ giữ tên nhãn và giá trị số kèm đơn vị `khách` in nghiêng. | **Chuẩn hóa kiểm toán số liệu:** Lưới 2x2 tạo cảm giác vững chãi, các con số đối soát to rõ, có đơn vị minh bạch, triệt tiêu khả năng đọc nhầm số. |
| **Cơ chế tính tăng trưởng (%)** | Hardcoded các giá trị cố định `+12.5%`, `+7.4%`, `+4.2%` trong JSX. Khi chuyển sang ngày khác, số % vẫn giữ nguyên gây sai lệch số liệu vận hành. | Đòi hỏi tính toán tự động dựa trên ngày đối chiếu liền kề (ngày hôm qua hoặc ngày có dữ liệu trước đó). Nếu không có ngày trước, hiển thị an toàn fallback (N/A hoặc ẩn). | **Bảo đảm tính toàn vẹn dữ liệu (Data Integrity):** Loại bỏ hoàn toàn rủi ro cung cấp thông tin sai lệch cho Ban Giám đốc khi xem các ngày lịch sử. |

---

## 5. KẾ HOẠCH ÁNH XẠ TRƯỜNG DỮ LIỆU VÀ LOGIC TÍNH TOÁN (DATA MAPPING PLAN)

Hệ thống tính toán trong `src/report/compute.ts` và API trong `src/report/api.ts` đã được xây dựng rất chặt chẽ. Toàn bộ logic lõi này phải được bảo toàn nguyên vẹn, chỉ ánh xạ kết quả tính toán vào các vị trí UI mới.

### 5.1. Bảng ánh xạ chi tiết từng thành phần giao diện

```typescript
// Định nghĩa kiểu dữ liệu hiển thị tăng trưởng an toàn
interface GrowthMetric {
  value: number;        // Tỷ lệ % tăng trưởng (ví dụ: 12.5)
  formatted: string;    // Chuỗi định dạng hiển thị (ví dụ: "+12.5%")
  isPositive: boolean;  // true nếu > 0
  isNegative: boolean;  // true nếu < 0
  available: boolean;   // false nếu không có kỳ đối chiếu (fallback)
}
```

| Thành phần UI | Tên hiển thị trên mẫu | Nguồn dữ liệu & Biến code | Công thức tính & Logic xử lý |
|---|---|---|---|
| **Header Date Pill** | `09/11` | `date: string` (prop dạng `YYYY-MM-DD`) | `const [y, mo, d] = date.split('-'); return `${d}/${mo}`;` |
| **Header Subtitle** | `Ngày 09/11/2026` | `date: string` | `return `Ngày ${d}/${mo}/${y}`;` |
| **Action 1** | `Gửi báo cáo` | Hàm `image()` trong `ReportScreen.tsx` | Kích hoạt `shareReportImage(captureRef.current, date)`, chép ảnh vào clipboard để dán Viber. |
| **Action 2** | `Xuất Excel` | Hàm `excel()` trong `ReportScreen.tsx` | Kích hoạt `exportExcel()` xuất file `Bao_Cao_van_hanh_Mang_Truot.xlsx` đa ngày và đồng bộ Drive. |
| **Hero Doanh Thu** | `542.450.000 VNĐ` | `meta.counterRevenue` | `n(meta.counterRevenue) + " VNĐ"` |
| **Hero % Tăng trưởng** | `▲ +12.5%` | So sánh `meta.counterRevenue` với ngày hôm trước `prevMeta.counterRevenue` | `computeGrowth(meta.counterRevenue, prevMeta?.counterRevenue)`. Nếu không có `prevMeta` -> Hiển thị N/A hoặc fallback an toàn. |
| **Khách chơi máng** | `5.755 khách` | `displayTotalPassengers` | `n(displayTotalPassengers) + " khách"` (Đã tính tự động từ ma trận vé duyệt). |
| **Khách chơi % Tăng trưởng** | `▲ +7.4%` | So sánh `displayTotalPassengers` với ngày hôm trước | `computeGrowth(displayTotalPassengers, prevTotalPassengers)`. |
| **Trạng thái tuyến** | `● 3 tuyến vận hành` | `metrics.mangs` & `schedules` | Đếm số máng có phát sinh lượt khách hoặc có cấu hình giờ chạy (`count = 3`) ➔ `● ${count} tuyến vận hành`. Chấm tròn xanh `#16A34A`. |
| **Tỷ lệ chơi / cáp** | `60.3%` | `displayConversionRate` | `displayConversionRate = meta.cableCarVisitors > 0 ? (displayTotalPassengers / meta.cableCarVisitors) * 100 : 0; return `${displayConversionRate.toFixed(1)}%`;` |
| **Tỷ lệ % Tăng trưởng** | `▲ +4.2%` | So sánh `displayConversionRate` với `prevConversionRate` | `computeGrowth(displayConversionRate, prevConversionRate, true)` (chênh lệch điểm phần trăm hoặc % tăng trưởng). |
| **Thanh tiến trình** | Progress Bar | `displayConversionRate` | `style={{ width: `${Math.min(100, Math.max(0, displayConversionRate))}%` }}` |
| **Diễn giải tỷ lệ** | `5.755 chơi / 9.540 cáp` | `displayTotalPassengers` và `meta.cableCarVisitors` | `${n(displayTotalPassengers)} chơi / ${n(meta.cableCarVisitors)} cáp` |
| **Đối soát 1** | `Khách lên cáp` ➔ `9.540 khách` | `meta.cableCarVisitors` | `n(meta.cableCarVisitors) + " khách"` |
| **Đối soát 2** | `Khách tính phí` ➔ `5.558 khách` | `meta.paidGateVisitors` | `n(meta.paidGateVisitors) + " khách"` |
| **Đối soát 3** | `Khách miễn phí` ➔ `197 khách` | `meta.freeGateVisitors` (qua `resolveFreeGate`) | `n(meta.freeGateVisitors) + " khách"` (Đảm bảo tự động theo công thức = Khách chơi máng - Khách tính phí). |
| **Đối soát 4** | `Khách combo đêm` ➔ `53 khách` | `meta.nightComboVisitors` | `n(meta.nightComboVisitors) + " khách"` |

### 5.2. Logic bảo toàn tính năng quản trị & nghiệp vụ (Non-regression Principles)
1. **Chế độ Chỉnh sửa số liệu đối soát (`setEditMeta`):** 
   - Khi ngày chưa chốt (`!closed`), hiển thị nút "Chỉnh sửa số liệu" tinh tế ở góc header khối đối soát (như hiện tại).
   - Nút này được gắn cờ `data-no-capture` để khi chụp gửi Viber ảnh xuất ra vẫn sạch bóng và giống hệt thiết kế mẫu.
2. **Khóa / Mở ngày (`toggleClose`):**
   - Vẫn giữ đầy đủ thanh trạng thái chốt ngày, thông báo đồng bộ Google Drive và cảnh báo phiếu chờ duyệt cho Admin.
3. **Đồng bộ thời gian thực (`useRealtimeDriveSync`):**
   - Không can thiệp hay làm gián đoạn luồng tự động sync dữ liệu sang Google Drive / Google Sheets theo thời gian thực.
4. **Bảo tồn khối chi tiết 6 line máng trượt bên dưới:**
   - Khối chi tiết "Vận hành máng trượt (6 line)" và "TB chuyến giờ cao điểm" ở cuối màn hình vẫn được giữ nguyên đầy đủ bên dưới khối capture để nhân viên kỹ thuật tra cứu chi tiết khi cần.

---

## 6. KHUYẾN NGHỊ THIẾT KẾ KỸ THUẬT VÀ SPEC CSS/TAILWIND (TECHNICAL SPECIFICATIONS)

### 6.1. Design Tokens & Khuyến nghị Tailwind Classes

```html
<!-- 1. Header Card -->
<div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-[#D71920] text-white flex items-center justify-center shrink-0 shadow-2xs">
      <TrendingUp className="w-5 h-5" />
    </div>
    <div>
      <h1 className="text-sm sm:text-base font-bold text-[#1E293B] uppercase tracking-wide leading-tight">
        BÁO CÁO VẬN HÀNH
      </h1>
      <p className="text-[11px] font-medium text-[#64748B] mt-0.5">
        Ngày {d}/{mo}/{y}
      </p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <button onClick={image} className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg bg-[#D71920] hover:bg-[#B9151B] text-white font-bold text-xs shadow-2xs active:scale-[0.98] transition">
      Gửi báo cáo
    </button>
    <button onClick={excel} className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E5E7EB] text-[#20242B] font-bold text-xs shadow-2xs active:scale-[0.98] transition">
      Xuất Excel
    </button>
  </div>
</div>

<!-- 2. Hero Card DOANH THU -->
<div className="bg-[#D71920] text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col gap-2">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">DOANH THU</span>
      <span className="bg-white/20 border border-white/30 backdrop-blur-xs text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">
        ✓ Vé tại quầy
      </span>
    </div>
    {/* Growth Badge */}
    <span className="bg-white text-[#15803D] font-bold text-xs font-numeric px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-0.5">
      ▲ +12.5%
    </span>
  </div>
  <div className="text-3xl sm:text-[42px] font-bold font-numeric text-white leading-none tabular-nums tracking-tight mt-1">
    {n(meta.counterRevenue)} <span className="text-base sm:text-2xl font-normal italic text-white/90 ml-1">VNĐ</span>
  </div>
</div>

<!-- 3. Hai Cột Chỉ Số Vận Hành -->
<div className="grid grid-cols-2 gap-3">
  {/* Cột 1: Khách chơi máng */}
  <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">KHÁCH CHƠI MÁNG</span>
        <span className="bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7] px-1.5 py-0.5 rounded text-[11px] font-bold font-numeric">
          ▲ +7.4%
        </span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold font-numeric text-[#20242B] tabular-nums mt-1 leading-tight">
        {n(displayTotalPassengers)} <span className="text-xs sm:text-sm font-normal italic text-[#64748B] ml-0.5">khách</span>
      </div>
    </div>
    <div className="text-xs font-medium text-[#64748B] mt-2.5 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
      <span>3 tuyến vận hành</span>
    </div>
  </div>

  {/* Cột 2: Tỷ lệ chơi / cáp */}
  <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">TỶ LỆ CHƠI / CÁP</span>
        <span className="bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7] px-1.5 py-0.5 rounded text-[11px] font-bold font-numeric">
          ▲ +4.2%
        </span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold font-numeric text-[#20242B] tabular-nums mt-1 leading-tight">
        {displayConversionRate.toFixed(1)}%
      </div>
    </div>
    <div className="space-y-1.5 mt-2">
      <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
        <div className="h-full bg-[#D71920] rounded-full transition-all duration-500" style={{ width: `${displayConversionRate}%` }} />
      </div>
      <div className="text-[11px] font-medium tabular-nums text-[#64748B]">
        {n(displayTotalPassengers)} chơi / {n(meta.cableCarVisitors)} cáp
      </div>
    </div>
  </div>
</div>

<!-- 4. Lưới 2x2 Đối Soát Cáp Treo & Cổng -->
<div className="space-y-2">
  <span className="text-xs sm:text-sm font-bold tracking-wide uppercase text-[#20242B]">
    ĐỐI SOÁT CÁP TREO &amp; CỔNG
  </span>
  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
    {/* 4 Cards: Khách lên cáp, Khách tính phí, Khách miễn phí, Khách combo đêm */}
    <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
      <span className="text-xs font-medium text-[#64748B]">Khách lên cáp</span>
      <div className="text-xl sm:text-2xl font-bold font-numeric tabular-nums text-[#20242B] leading-none mt-1.5">
        {n(meta.cableCarVisitors)} <span className="text-xs font-normal italic text-[#64748B] ml-1">khách</span>
      </div>
    </div>
    ...
  </div>
</div>
```

---

## 7. KẾT LUẬN VÀ LỘ TRÌNH TRIỂN KHAI TIẾP THEO

Bản thiết kế mẫu từ hình ảnh `media_1794275699907_8d3278e1.jpg` là một bước tiến vượt bậc về tiêu chuẩn UI/UX cho hệ thống thống kê lượt khách Alpine Coaster. Thiết kế này:
1. Đạt tính thẩm mỹ hiện đại chuẩn quốc tế cho khu nghỉ dưỡng Sun World Ba Na Hills.
2. Giảm thiểu triệt để sự lộn xộn thị giác, giúp tăng tốc độ ra quyết định vận hành cho Ban Giám đốc và các Trưởng ca.
3. Đồng bộ hoàn hảo với luồng công việc thực tế (gửi báo cáo nhanh qua Viber, xuất Excel kiểm toán định kỳ).

Báo cáo phân tích này đáp ứng đầy đủ và toàn diện 100% yêu cầu **R1** trong tài liệu đặc tả của người dùng và sẵn sàng làm kim chỉ nam để triển khai cập nhật code giao diện **R2** trên `src/screens/report/ReportScreen.tsx`.
