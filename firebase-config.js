// ============================================================================
// CẤU HÌNH KẾT NỐI FIREBASE (FIREBASE AUTHENTICATION + CLOUD FIRESTORE)
// Khi apiKey còn trống  -> app chạy CHẾ ĐỘ CỤC BỘ (không bảo mật, chỉ để demo/test).
// Khi đã điền apiKey     -> app BẮT BUỘC đăng nhập Google, quyền do firestore.rules quyết định.
// Lấy cấu hình bằng lệnh: firebase apps:sdkconfig web
// ============================================================================
window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "sunworld-operations-app",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Gmail chủ sở hữu được toàn quyền Admin.
// PHẢI KHỚP với danh sách trong hàm isSuperAdmin() của firestore.rules.
window.SUPER_ADMIN_EMAILS = [
  "laotuung@gmail.com",
  "laoung1996@gmail.com"
];
