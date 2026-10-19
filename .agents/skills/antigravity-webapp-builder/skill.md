## name: antigravity-webapp-builder
description: Quy trình xây dựng, kiểm thử và triển khai Web App trọn gói trên Google Antigravity đồng bộ toàn diện hệ sinh thái Google (Firebase, Google Workspace, Chrome DevTools, Google Cloud) dành cho người không biết lập trình. Sử dụng khi người dùng muốn tạo web app mới, kết nối cơ sở dữ liệu Firebase hoặc Google Sheets, chạy thử giao diện trên trình duyệt hoặc đưa web lên mạng.

# Antigravity Webapp Builder

Quy trình hướng dẫn AI Agent tự động hóa toàn bộ vòng đời làm Web App trên Google Antigravity (từ khâu phỏng vấn ý tưởng, thiết kế giao diện, kết nối dữ liệu Firebase và Google Workspace đến kiểm thử trình duyệt và xuất bản lên mạng) dành cho người dùng không có kiến thức lập trình.

## When to Use

* Người dùng muốn tạo một Web App hoàn chỉnh từ ý tưởng ban đầu mà không cần tự viết code.

* Người dùng yêu cầu đồng bộ Web App với hệ sinh thái Google bao gồm Firebase (Authentication, Firestore, App Hosting), Google Workspace (Google Sheets, Docs, Calendar, Drive qua MCP) hoặc Google Cloud.

* Người dùng gọi lệnh `/antigravity-webapp-builder` hoặc yêu cầu AI dẫn dắt từng bước để làm trang web bán hàng, quản lý công việc, báo cáo vận hành hoặc công cụ nội bộ.

* Người dùng cần kiểm tra giao diện web trên trình duyệt tự động và xuất bản trang web lên Internet chỉ với một câu lệnh.

## Steps

### 1. Phỏng vấn và chốt yêu cầu bằng ngôn ngữ đời thường

Tránh dùng thuật ngữ kỹ thuật phức tạp. Chủ động phỏng vấn người dùng (tương tự chế độ `/grill-me`) với tối đa 3 đến 4 câu hỏi ngắn gọn để làm rõ:

* Mục tiêu chính của Web App và đối tượng sử dụng (ví dụ: quản lý đơn hàng, báo cáo vận hành, đặt lịch hẹn).

* Các màn hình và thao tác quan trọng nhất trên trang web.

* Nguồn lưu trữ và đồng bộ dữ liệu mong muốn trong hệ sinh thái Google: dùng Cloud Firestore (cho dữ liệu ứng dụng thời gian thực) hay đồng bộ hai chiều với Google Sheets (`gsheets` plugin), Google Docs (`gdocs` plugin) và Google Calendar (`gcalendar` plugin).

* Yêu cầu đăng nhập: có cần đăng nhập bằng tài khoản Google (Google Sign-In qua Firebase Authentication) hay trang web công khai.

### 2. Kích hoạt và đồng bộ hệ sinh thái Google

Trước khi viết mã nguồn, kiểm tra và kích hoạt các gói công cụ chính thống của Google trong workspace:

* Gói tích hợp **Build with Google**: Đảm bảo đã bật `Modern Web Guidance` (chuẩn giao diện web hiện đại, responsive, bảo mật), `Firebase Bundle` (quản lý Auth, Firestore, Security Rules, App Hosting) và `Chrome DevTools` (kiểm thử giao diện và hiệu năng). Nếu ứng dụng cần bản đồ, bật thêm `Google Maps Platform` với Maps Demo Key.

* Kết nối **Google Workspace MCP & Plugins**: Nếu người dùng cần đồng bộ với bảng tính hoặc tài liệu văn phòng, kiểm tra và cài đặt các plugin chính thống từ `antigravity-plugins-official` gồm `workspace`, `gsheets`, `gdocs`, `google_slides` hoặc `gcalendar` thông qua `/plugin install <ten-plugin>`.

### 3. Lập bản kế hoạch trực quan (Implementation Plan Artifact)

Tạo bản kế hoạch thực thi (Implementation Plan) trong khung Artifacts trước khi sửa đổi file:

* Trình bày danh sách tính năng, bố cục màn hình và luồng dữ liệu bằng ngôn ngữ tự nhiên, dễ hiểu.

* Liệt kê rõ các dịch vụ Google sẽ được khởi tạo (ví dụ: Firebase Project, Firestore Collections, Google Sheets ID).

* Tạm dừng để người dùng xem và bấm phê duyệt (Approve) hoặc góp ý chỉnh sửa ngay trên Artifact.

### 4. Tự động xây dựng Full-Stack Web App

Sau khi kế hoạch được duyệt, tự động thực thi toàn bộ phần kỹ thuật mà không bắt người dùng can thiệp vào code:

* Khởi tạo cấu trúc dự án web hiện đại, gọn nhẹ và dễ bảo trì.

* Thiết kế giao diện trực quan, hiện đại, tương thích tốt trên cả máy tính và điện thoại (Mobile-first).

* Tự động cấu hình Firebase SDK, thiết lập đăng nhập Google (Authentication), tạo cơ sở dữ liệu Cloud Firestore và viết quy tắc bảo mật (`firestore.rules`) chặt chẽ.

* Nếu có yêu cầu đồng bộ Google Workspace, tích hợp luồng đọc/ghi dữ liệu tự động sang Google Sheets, Google Docs hoặc Google Calendar.

### 5. Chạy thử và kiểm thử tự động trên trình duyệt (Browser Verification)

Không giao sản phẩm chưa qua kiểm thử cho người dùng:

* Tự động khởi chạy máy chủ thử nghiệm cục bộ (local dev server).

* Kích hoạt Browser Subagent (`/browser`) và Chrome DevTools MCP để mở trang web trên trình duyệt Chrome cô lập.

* Tự động thao tác thử các nút bấm, biểu mẫu, kiểm tra lỗi hiển thị trên màn hình máy tính và điện thoại, đồng thời lưu lại ảnh chụp màn hình (screenshots) và video quay màn hình (browser recordings) vào khung Artifacts để người dùng xem trực tiếp.

* Tự động sửa triệt để mọi lỗi console hoặc lỗi giao diện phát sinh trước khi báo cáo hoàn thành.

### 6. Xuất bản Web App lên Internet và đồng bộ điều khiển từ xa

Khi người dùng hài lòng với bản xem trước (hoặc khi người dùng nhắn `Publish my app`):

* Sử dụng kỹ năng trong Firebase Bundle để đóng gói ứng dụng (`npm run build`) và triển khai lên Firebase App Hosting hoặc Firebase Hosting (`firebase deploy`).

* Trả về đường link trang web chính thức (`https://...`) để người dùng truy cập ngay trên mọi thiết bị.

* Nhắc người dùng có thể bật tính năng **Remote Control** (`Settings > App > Enable Remote Control` hoặc lệnh `/remote-control`) để tiếp tục theo dõi và yêu cầu AI cập nhật Web App từ điện thoại di động.

## Gotchas

* Người dùng không biết code rất dễ bị rối nếu AI hỏi về công nghệ (như chọn Vite hay Webpack, Redux hay Zustand). Luôn tự chọn phương án ổn định nhất theo chuẩn `Modern Web Guidance` và `Firebase Bundle` của Google, chỉ hỏi người dùng về nhu cầu sử dụng thực tế.

* Khi triển khai Firebase lần đầu, nếu người dùng chưa đăng nhập Firebase CLI hoặc chưa chọn Google Cloud Project, hãy hướng dẫn họ bấm xác nhận trên trình duyệt từng bước ngắn gọn thay vì in ra đoạn log lỗi dài dòng.

* Luôn kiểm tra quyền truy cập dữ liệu (Firebase Security Rules) trước khi xuất bản (`Publish my app`) để tránh lộ dữ liệu người dùng hoặc bị chặn quyền đọc/ghi sau khi đưa lên mạng.