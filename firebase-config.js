// ============================================================================
// CẤU HÌNH KẾT NỐI FIREBASE (FIREBASE AUTHENTICATION + CLOUD FIRESTORE)
// Bạn có thể dán trực tiếp cấu hình Firebase Project tại đây HOẶC dán ngay trên
// giao diện Web App (nút "⚙️ Cấu hình Firebase" ở màn hình Đăng nhập / Kho dữ liệu)
// ============================================================================
window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "sunworld-operations-app",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Danh sách email mặc định được cấp quyền Quản lý (Manager) ngay khi đăng nhập Google
window.DEFAULT_MANAGER_EMAILS = [
  "admin@sunworld.vn",
  "quanly.vanhanh@sunworld.vn"
];
