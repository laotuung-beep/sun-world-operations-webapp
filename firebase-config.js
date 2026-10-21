// ============================================================================
// CẤU HÌNH KẾT NỐI FIREBASE (FIREBASE AUTHENTICATION + CLOUD FIRESTORE)
// Khi apiKey còn trống  -> app chạy CHẾ ĐỘ CỤC BỘ (không bảo mật, chỉ để demo/test).
// Khi đã điền apiKey     -> app BẮT BUỘC đăng nhập Google, quyền do firestore.rules quyết định.
// Lấy cấu hình bằng lệnh: firebase apps:sdkconfig web
// ============================================================================
window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAVHfPs1IsHNpwwVKbnd0LBNhcbM8Wu17g",
  authDomain: "sunworld-ops-laotuung.firebaseapp.com",
  projectId: "sunworld-ops-laotuung",
  storageBucket: "sunworld-ops-laotuung.firebasestorage.app",
  messagingSenderId: "432835347015",
  appId: "1:432835347015:web:421389b25b807c34cfa762"
};

// Gmail chủ sở hữu được toàn quyền Admin.
// PHẢI KHỚP với danh sách trong hàm isSuperAdmin() của firestore.rules.
window.SUPER_ADMIN_EMAILS = [
  "laotuung@gmail.com",
  "laoung1996@gmail.com"
];
