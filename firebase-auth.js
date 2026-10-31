// ============================================================================
// SUN WORLD BA NA HILLS — FIREBASE AUTH, RBAC & CLOUD FIRESTORE SYNC MODULE
// Giao diện Đăng nhập Wabi-sabi tối giản, ấm áp (Quy tắc màu 60-30-10)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG || window.DEFAULT_FIREBASE_CONFIG || {};
const SUPER_ADMIN_EMAILS = (
  window.SUPER_ADMIN_EMAILS || ["laotuung@gmail.com", "laoung1996@gmail.com"]
).map((e) => e.toLowerCase().trim());

const isConfigured = Boolean(
  cfg.apiKey &&
    cfg.projectId &&
    !String(cfg.apiKey).includes("PASTE_YOUR") &&
    !String(cfg.projectId).includes("PASTE_YOUR")
);

// Tự động nạp Google Fonts 'Lora' & 'Plus Jakarta Sans' nếu chưa có
if (!document.querySelector('link[href*="Plus+Jakarta+Sans"]')) {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(fontLink);
}

// Inject CSS chuẩn Wabi-sabi (60% #F5F2EB - 30% #FAF8F5/#E6DFD3 - 10% #7C5A43/#634632)
// Kết hợp cùng các lớp tiện ích Tailwind CSS (Mobile-first)
const styleEl = document.createElement("style");
styleEl.textContent = `
  #fbAuthGate {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background-color: #F5F2EB;
    background-image:
      radial-gradient(circle at 15% 15%, rgba(230, 223, 211, 0.55) 0%, transparent 45%),
      radial-gradient(circle at 85% 85%, rgba(124, 90, 67, 0.06) 0%, transparent 50%);
    color: #2C2623;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 20px 16px;
    overflow-y: auto;
    -webkit-font-smoothing: antialiased;
  }

  #fbAuthGate * {
    box-sizing: border-box;
  }

  .wabi-card {
    width: 100%;
    max-width: 440px;
    background-color: #FAF8F5;
    border: 1px solid #E6DFD3;
    border-radius: 1rem; /* rounded-2xl */
    box-shadow:
      0 20px 50px -12px rgba(44, 38, 35, 0.08),
      0 4px 16px -4px rgba(124, 90, 67, 0.04);
    padding: 28px 24px;
    margin: auto;
    position: relative;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  @media (min-width: 640px) {
    #fbAuthGate {
      padding: 40px 24px;
    }
    .wabi-card {
      padding: 40px 38px;
    }
  }

  .wabi-serif-title {
    font-family: 'Lora', Georgia, Cambria, serif;
    color: #2C2623;
    font-weight: 600;
    font-size: 1.65rem;
    line-height: 1.25;
    letter-spacing: -0.01em;
    margin: 0;
  }

  @media (min-width: 640px) {
    .wabi-serif-title {
      font-size: 1.85rem;
    }
  }

  .wabi-subtitle {
    font-family: 'Plus Jakarta Sans', sans-serif;
    color: #787067;
    font-size: 0.875rem;
    line-height: 1.55;
    margin-top: 8px;
  }

  .wabi-label {
    display: block;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #2C2623;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }

  /* Override toàn cục cho input bên trong #fbAuthGate để không bị ảnh hưởng bởi CSS bên trong app */
  #fbAuthGate .wabi-input {
    width: 100% !important;
    height: 46px !important;
    padding: 11px 14px !important;
    border-radius: 0.75rem !important;
    border: 1px solid #E6DFD3 !important;
    background-color: #FFFFFF !important;
    color: #2C2623 !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.9rem !important;
    font-weight: 400 !important;
    line-height: 1.4 !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease !important;
    outline: none !important;
  }

  #fbAuthGate .wabi-input::placeholder {
    color: #A39B90 !important;
    font-weight: 400 !important;
  }

  #fbAuthGate .wabi-input:hover {
    border-color: #D2C7B6 !important;
  }

  #fbAuthGate .wabi-input:focus {
    border-color: #7C5A43 !important;
    background-color: #FFFFFF !important;
    box-shadow: 0 0 0 3.5px rgba(124, 90, 67, 0.14) !important;
  }

  #fbAuthGate .wabi-input-pwd {
    padding-right: 44px !important;
  }

  .wabi-pwd-toggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #787067;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
  }

  .wabi-pwd-toggle:hover {
    color: #2C2623;
    background-color: rgba(230, 223, 211, 0.45);
  }

  .wabi- pwd-toggle:focus-visible {
    outline: 2px solid #7C5A43;
    outline-offset: 1px;
  }

  .wabi-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #C8BCAE;
    accent-color: #7C5A43;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .wabi-link {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #7C5A43;
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .wabi-link:hover {
    color: #634632;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Điểm nhấn CTA (10%): Nút Đăng nhập màu nâu đất trầm (#7C5A43), hover (#634632) */
  .wabi-btn-primary {
    width: 100%;
    height: 46px;
    padding: 0 20px;
    border-radius: 0.75rem;
    border: 1px solid transparent;
    background-color: #7C5A43;
    color: #FAF8F5;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.925rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px -4px rgba(124, 90, 67, 0.32);
    transition: background-color 0.22s ease, transform 0.15s ease, box-shadow 0.22s ease;
  }

  .wabi-btn-primary:hover {
    background-color: #634632;
    box-shadow: 0 10px 22px -4px rgba(99, 70, 50, 0.38);
    transform: translateY(-1px);
  }

  .wabi-btn-primary:active {
    transform: translateY(0);
  }

  .wabi-btn-primary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3.5px rgba(124, 90, 67, 0.28);
  }

  .wabi-btn-primary:disabled {
    opacity: 0.65;
    cursor: wait;
    transform: none;
  }

  /* Nút Tiếp tục với Google */
  .wabi-btn-google {
    width: 100%;
    height: 46px;
    padding: 0 18px;
    border-radius: 0.75rem;
    border: 1px solid #E6DFD3;
    background-color: #FFFFFF;
    color: #2C2623;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(44, 38, 35, 0.03);
    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  }

  .wabi-btn-google:hover {
    background-color: #F5F2EB;
    border-color: #D2C7B6;
    box-shadow: 0 4px 12px rgba(44, 38, 35, 0.06);
    transform: translateY(-1px);
  }

  .wabi-btn-google:active {
    transform: translateY(0);
  }

  .wabi-btn-google:focus-visible {
    outline: none;
    border-color: #7C5A43;
    box-shadow: 0 0 0 3.5px rgba(124, 90, 67, 0.15);
  }

  .wabi-btn-google:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .wabi-divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 22px 0;
  }

  .wabi-divider-line {
    flex: 1;
    height: 1px;
    background-color: #E6DFD3;
  }

  .wabi-divider-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: #787067;
    letter-spacing: 0.04em;
    text-transform: lowercase;
  }

  .wabi-alert {
    padding: 11px 14px;
    border-radius: 0.75rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    margin-bottom: 18px;
    border: 1px solid #E6DFD3;
    background-color: #F5F2EB;
    color: #2C2623;
  }

  .wabi-alert-error {
    background-color: #FDF6F4;
    border-color: #EBCBC4;
    color: #8C3A2B;
  }

  .wabi-alert-success {
    background-color: #F4F7F2;
    border-color: #C9D8C0;
    color: #3B5932;
  }

  /* Bảng Quản trị Phê duyệt Tài khoản bên trong Modal Drawer (Card-based Design) */
  #fbAccountPanel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sw-personal-account-card {
    background: var(--surface, #FFFFFF);
    border: 1px solid #E2E8F0;
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
  }

  /* Khối thống kê nhanh (KPI Metrics): Grid 2 cột gồm 4 ô đếm số liệu */
  .sw-admin-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .sw-admin-stat-box {
    background: var(--surface, #FFFFFF);
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.025);
  }
  .sw-admin-stat-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .sw-admin-stat-num {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--text, #0F172A);
  }
  .sw-admin-stat-lbl {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted, #64748B);
  }

  /* Thanh tìm kiếm kính lúp & 3 Tab lọc */
  .sw-admin-toolbar-card {
    background: var(--surface, #FFFFFF);
    border: 1px solid #E2E8F0;
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
  }
  .sw-search-input-wrap {
    position: relative;
    width: 100%;
  }
  .sw-search-icon-svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #64748B;
    pointer-events: none;
    display: inline-flex;
    align-items: center;
  }
  .sw-admin-search {
    width: 100% !important;
    padding: 9px 12px 9px 36px !important;
    font-size: 0.82rem !important;
    border-radius: 10px !important;
    border: 1px solid #E2E8F0 !important;
    background: var(--surface-alt, #F8FAFC) !important;
    color: var(--text, #1E293B) !important;
    height: 38px !important;
    transition: border-color 0.18s ease, background 0.18s ease;
  }
  .sw-admin-search:focus {
    border-color: #C0262D !important;
    background: var(--surface, #FFFFFF) !important;
  }
  .sw-admin-filter-pills {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    background: var(--surface-alt, #F1F5F9);
    padding: 4px;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
  }
  .sw-filter-pill {
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 0.76rem;
    font-weight: 700;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted, #64748B);
    cursor: pointer;
    text-align: center;
    transition: all 0.16s ease;
  }
  .sw-filter-pill:hover {
    color: var(--text, #0F172A);
  }
  .sw-filter-pill.active {
    background: #C0262D;
    color: #FFFFFF;
    border-color: #C0262D;
    box-shadow: 0 2px 6px rgba(192, 38, 45, 0.25);
  }

  /* Danh sách thẻ tài khoản người dùng */
  .fb-user-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fb-user-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background: var(--surface, #FFFFFF);
    border: 1px solid #E2E8F0;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .fb-user-row:hover {
    border-color: #CBD5E1;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  }
  .fb-user-row.is-pending {
    border-left: 4px solid #F59E0B;
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, rgba(255, 255, 255, 0) 100%), var(--surface, #FFFFFF);
  }
  .fb-user-row.is-approved {
    border-left: 4px solid #16A34A;
  }
  .fb-user-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }
  .fb-user-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: center;
    padding-top: 8px;
    border-top: 1px dashed #E2E8F0;
  }
  .fb-user-controls-grid .fb-game-select-full {
    grid-column: 1 / -1;
  }
  .fb-user-controls-grid select {
    padding: 7px 10px !important;
    font-size: 0.78rem !important;
    border-radius: 10px !important;
    border: 1px solid #E2E8F0 !important;
    height: 36px !important;
  }
  .fb-save-perm-btn {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: center;
    height: 38px;
    border-radius: 10px !important;
    font-size: 0.8rem !important;
    font-weight: 700 !important;
  }

  @media (max-width: 520px) {
    .fb-user-controls-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(styleEl);

// Tạo cổng đăng nhập (#fbAuthGate) theo phong cách Wabi-sabi
const gateEl = document.createElement("div");
gateEl.id = "fbAuthGate";
gateEl.className = "min-h-screen w-full bg-[#F5F2EB] text-[#2C2623] flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8";
gateEl.style.display = isConfigured ? "flex" : "none";

function renderAuthGateShell(innerBodyHtml) {
  gateEl.innerHTML = `
    <div class="wabi-card w-full max-w-[440px] bg-[#FAF8F5] border border-[#E6DFD3] rounded-2xl p-6 sm:p-10">
      <!-- Biểu tượng Wabi-sabi tối giản, tinh tế -->
      <div class="flex flex-col items-center text-center mb-7" style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:26px;">
        <div style="width:44px;height:44px;border-radius:9999px;background:#F5F2EB;border:1px solid #E6DFD3;display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:#7C5A43;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>
            <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/>
          </svg>
        </div>
        <span style="font-size:0.7rem;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#787067;margin-bottom:6px;">
          SUN WORLD BA NA HILLS
        </span>
        <div id="fbGateHeaderSlot"></div>
      </div>

      <div id="fbGateContent">
        ${innerBodyHtml}
      </div>
    </div>
  `;
}

renderAuthGateShell(`
  <div style="text-align:center;padding:12px 0;">
    <h1 class="wabi-serif-title">Đang đồng bộ phiên</h1>
    <p class="wabi-subtitle">Vui lòng chờ giây lát...</p>
  </div>
`);

document.addEventListener("DOMContentLoaded", () => {
  document.body.appendChild(gateEl);
});

let app = null;
let auth = null;
let db = null;
let currentAuthUser = null;
let currentProfile = null;
let unsubRemoteShift = null;
let unsubUsersList = null;
let unsubMyProfile = null;
let isApplyingRemote = false;
let cachedAllUsers = [];
let adminFilterMode = "all";
let adminSearchQuery = "";

const SUB_AREAS_BY_GAME = {
  MANG_TRUOT_1: ["Line 1", "Line 2"],
  MANG_TRUOT_2: ["Line 3", "Line 4"],
  MANG_TRUOT_3: ["Line 5", "Line 6"],
  AIRSHIP_1: ["Rạp 1"],
  AIRSHIP_2: ["Rạp 2"],
  RAP_3D_1: ["Rạp 1"],
  RAP_3D_2: ["Rạp 2"]
};

function getGameTitleById(gameId) {
  if (!gameId || gameId === "ALL") return "Toàn bộ 25 trò chơi";
  if (typeof ALL_GAMES !== "undefined" && Array.isArray(ALL_GAMES)) {
    const found = ALL_GAMES.find((g) => g.id === gameId);
    if (found) return found.name;
  }
  return gameId;
}

function lockStaffNameToGmail(gmailDisplayName) {
  if (!gmailDisplayName) return;
  window.loggedInGoogleName = gmailDisplayName;
  if (typeof currentUserAccount !== "undefined" && currentUserAccount) {
    currentUserAccount.name = gmailDisplayName;
  }
  const staffInput = document.getElementById("staffName");
  if (staffInput) {
    staffInput.value = gmailDisplayName;
    staffInput.readOnly = true;
    staffInput.title = `Tên nhân viên vận hành cố định theo Gmail: ${gmailDisplayName}`;
  }
  if (typeof appStore !== "undefined" && appStore && appStore.games) {
    const activeGameId = appStore.currentGameId || "MANG_TRUOT_1";
    if (appStore.games[activeGameId]) {
      appStore.games[activeGameId].staff = gmailDisplayName;
    }
  }
}

function showSignInPrompt(errorMessage = "", successMessage = "") {
  gateEl.style.display = "flex";
  let rememberedEmail = "";
  try {
    rememberedEmail = localStorage.getItem("SW_WABI_REMEMBER_EMAIL") || "";
  } catch (e) {}

  renderAuthGateShell(`
    <div style="text-align:center;margin-bottom:24px;margin-top:-18px;">
      <h1 class="wabi-serif-title font-serif text-[#2C2623]">Chào mừng trở lại</h1>
      <p class="wabi-subtitle font-sans text-[#787067]">
        Đăng nhập nhẹ nhàng để bắt đầu ca vận hành của bạn
      </p>
    </div>

    <div id="wabiAlertBox">
      ${
        errorMessage
          ? `<div class="wabi-alert wabi-alert-error">${errorMessage}</div>`
          : successMessage
          ? `<div class="wabi-alert wabi-alert-success">${successMessage}</div>`
          : ""
      }
    </div>

    <form id="wabiLoginForm" class="space-y-5" style="display:flex;flex-direction:column;gap:18px;" novalidate>
      <!-- Ô nhập Email -->
      <div>
        <label for="wabiEmailInput" class="wabi-label">Email</label>
        <input
          type="email"
          id="wabiEmailInput"
          class="wabi-input"
          placeholder="tenban@gmail.com"
          value="${rememberedEmail.replace(/"/g, "&quot;")}"
          autocomplete="email"
          required
        />
      </div>

      <!-- Ô nhập Mật khẩu (có nút ẩn/hiện) -->
      <div>
        <label for="wabiPasswordInput" class="wabi-label">Mật khẩu</label>
        <div style="position:relative;">
          <input
            type="password"
            id="wabiPasswordInput"
            class="wabi-input wabi-input-pwd"
            placeholder="Nhập mật khẩu của bạn"
            autocomplete="current-password"
            required
          />
          <button
            type="button"
            id="wabiTogglePwdBtn"
            class="wabi-pwd-toggle"
            aria-label="Ẩn hoặc hiện mật khẩu"
            title="Hiện / Ẩn mật khẩu"
          >
            <!-- Eye icon (mặc định) -->
            <svg id="wabiEyeOpenIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <!-- Eye-off icon (ẩn) -->
            <svg id="wabiEyeClosedIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
              <line x1="2" x2="22" y1="2" y2="22"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Checkbox 'Ghi nhớ tôi' & Link 'Quên mật khẩu?' -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:2px;">
        <label for="wabiRememberCheck" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:0.8125rem;color:#787067;user-select:none;">
          <input
            type="checkbox"
            id="wabiRememberCheck"
            class="wabi-checkbox"
            ${rememberedEmail ? "checked" : ""}
          />
          <span>Ghi nhớ tôi</span>
        </label>
        <a href="#forgot-password" id="wabiForgotPwdLink" class="wabi-link">
          Quên mật khẩu?
        </a>
      </div>

      <!-- Điểm nhấn CTA (10%): Nút 'Đăng nhập' màu nâu đất trầm (#7C5A43), hover (#634632) -->
      <button
        type="submit"
        id="wabiSubmitLoginBtn"
        class="wabi-btn-primary bg-[#7C5A43] hover:bg-[#634632] text-[#FAF8F5] rounded-xl"
      >
        Đăng nhập
      </button>
    </form>

    <!-- Đường phân cách tinh tế -->
    <div class="wabi-divider">
      <span class="wabi-divider-line"></span>
      <span class="wabi-divider-text">hoặc</span>
      <span class="wabi-divider-line"></span>
    </div>

    <!-- Nút 'Tiếp tục với Google' -->
    <button
      type="button"
      id="fbSignInBtn"
      class="wabi-btn-google rounded-xl border border-[#E6DFD3]"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
      </svg>
      <span>Tiếp tục với Google</span>
    </button>
  `);

  // Gắn sự kiện Ẩn / Hiện mật khẩu
  const pwdInput = document.getElementById("wabiPasswordInput");
  const togglePwdBtn = document.getElementById("wabiTogglePwdBtn");
  const eyeOpen = document.getElementById("wabiEyeOpenIcon");
  const eyeClosed = document.getElementById("wabiEyeClosedIcon");
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.onclick = () => {
      const isHidden = pwdInput.type === "password";
      pwdInput.type = isHidden ? "text" : "password";
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isHidden ? "none" : "block";
        eyeClosed.style.display = isHidden ? "block" : "none";
      }
      pwdInput.focus();
    };
  }

  // Gắn sự kiện Quên mật khẩu?
  const forgotLink = document.getElementById("wabiForgotPwdLink");
  if (forgotLink) {
    forgotLink.onclick = async (ev) => {
      ev.preventDefault();
      const emailEl = document.getElementById("wabiEmailInput");
      const emailVal = emailEl ? emailEl.value.trim() : "";
      if (!emailVal || !emailVal.includes("@")) {
        showSignInPrompt("Vui lòng nhập địa chỉ Email của bạn vào ô Email trước khi nhấn 'Quên mật khẩu?'.");
        const newEmailEl = document.getElementById("wabiEmailInput");
        if (newEmailEl) newEmailEl.focus();
        return;
      }
      try {
        await sendPasswordResetEmail(auth, emailVal);
        showSignInPrompt("", `Đã gửi liên kết đặt lại mật khẩu tới ${emailVal}. Vui lòng kiểm tra hộp thư.`);
      } catch (err) {
        showSignInPrompt(
          `Bạn có thể nhấn nút "Tiếp tục với Google" bên dưới để đăng nhập nhanh bằng tài khoản ${emailVal} mà không cần mật khẩu.`
        );
      }
    };
  }

  // Gắn sự kiện Submit form Email / Mật khẩu
  const loginForm = document.getElementById("wabiLoginForm");
  if (loginForm) {
    loginForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const emailEl = document.getElementById("wabiEmailInput");
      const passEl = document.getElementById("wabiPasswordInput");
      const rememberEl = document.getElementById("wabiRememberCheck");
      const submitBtn = document.getElementById("wabiSubmitLoginBtn");

      const emailVal = emailEl ? emailEl.value.trim() : "";
      const passVal = passEl ? passEl.value : "";

      if (!emailVal || !emailVal.includes("@")) {
        showSignInPrompt("Vui lòng nhập địa chỉ Email hợp lệ.");
        return;
      }
      if (!passVal) {
        showSignInPrompt("Vui lòng nhập mật khẩu hoặc chọn 'Tiếp tục với Google'.");
        return;
      }

      try {
        if (rememberEl && rememberEl.checked) {
          localStorage.setItem("SW_WABI_REMEMBER_EMAIL", emailVal);
          await setPersistence(auth, browserLocalPersistence);
        } else {
          localStorage.removeItem("SW_WABI_REMEMBER_EMAIL");
          await setPersistence(auth, browserSessionPersistence);
        }
      } catch (e) {}

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang đăng nhập...";
      }

      try {
        await signInWithEmailAndPassword(auth, emailVal, passVal);
      } catch (err) {
        // Nếu tài khoản chưa có mật khẩu và mật khẩu >= 6 ký tự, thử khởi tạo hoặc chuyển sang Google OAuth
        if (
          passVal.length >= 6 &&
          err &&
          (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential")
        ) {
          try {
            await createUserWithEmailAndPassword(auth, emailVal, passVal);
            return;
          } catch (createErr) {
            // Nếu Email/Password chưa bật trên Firebase hoặc email đã dùng Google OAuth
          }
        }
        showSignInPrompt(
          `Tài khoản ${emailVal} sử dụng xác thực Google. Vui lòng nhấn nút "Tiếp tục với Google" bên dưới để đăng nhập.`
        );
      }
    };
  }

  // Gắn sự kiện nút Tiếp tục với Google
  const googleBtn = document.getElementById("fbSignInBtn");
  if (googleBtn) googleBtn.onclick = triggerGoogleSignIn;
}

function showPendingPrompt(user, profile) {
  gateEl.style.display = "flex";
  const displayName = (user.displayName || (profile && profile.name) || user.email.split("@")[0]).trim();
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarHtml = user.photoURL
    ? `<img src="${user.photoURL}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1.5px solid #E6DFD3;flex-shrink:0;" />`
    : `<span style="width:44px;height:44px;border-radius:50%;background:#7C5A43;color:#FAF8F5;font-weight:600;font-size:0.9rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</span>`;

  renderAuthGateShell(`
    <div style="text-align:center;margin-bottom:22px;margin-top:-18px;">
      <h1 class="wabi-serif-title font-serif text-[#2C2623]">Chờ phê duyệt</h1>
      <p class="wabi-subtitle font-sans text-[#787067]">
        Tài khoản của bạn đã được ghi nhận và đang chờ Quản trị viên gán trò chơi phụ trách.
      </p>
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:#F5F2EB;border:1px solid #E6DFD3;margin-bottom:18px;">
      ${avatarHtml}
      <div style="min-width:0;flex:1;">
        <div style="font-size:0.92rem;font-weight:600;color:#2C2623;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${displayName}
        </div>
        <div style="font-size:0.78rem;color:#787067;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${user.email}
        </div>
        <span style="display:inline-flex;align-items:center;gap:4px;margin-top:5px;padding:2px 9px;border-radius:999px;font-size:0.7rem;font-weight:600;background:#FAF8F5;color:#7C5A43;border:1px solid #E6DFD3;">
          ⏳ Đang chờ Admin duyệt
        </span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <button type="button" class="wabi-btn-primary" id="fbRefreshApprovalBtn">
        Kiểm tra trạng thái duyệt
      </button>
      <button type="button" class="wabi-btn-google" id="fbPendingSignOutBtn">
        Đổi tài khoản khác
      </button>
    </div>
  `);

  const refreshBtn = document.getElementById("fbRefreshApprovalBtn");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Đang kiểm tra...";
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.active && data.role !== "pending") {
            applyFirebaseProfileToLegacyApp(user, data);
            return;
          }
        }
        refreshBtn.disabled = false;
        refreshBtn.textContent = "Chưa được duyệt — Nhấn để kiểm tra lại";
      } catch (e) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "Kiểm tra trạng thái duyệt";
      }
    };
  }

  const outBtn = document.getElementById("fbPendingSignOutBtn");
  if (outBtn) outBtn.onclick = () => signOut(auth);
}

async function triggerGoogleSignIn() {
  if (!auth) return;
  const btn = document.getElementById("fbSignInBtn");
  const emailInput = document.getElementById("wabiEmailInput");
  const rememberEl = document.getElementById("wabiRememberCheck");
  if (emailInput && emailInput.value.trim() && rememberEl && rememberEl.checked) {
    try {
      localStorage.setItem("SW_WABI_REMEMBER_EMAIL", emailInput.value.trim());
    } catch (e) {}
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Đang kết nối với Google...</span>`;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (
      err &&
      (err.code === "auth/popup-blocked" ||
        err.code === "auth/cancelled-popup-request" ||
        err.code === "auth/operation-not-supported-in-this-environment")
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    showSignInPrompt(
      err && err.code === "auth/unauthorized-domain"
        ? `Tên miền ${location.hostname} chưa được thêm vào Authorized Domains trên Firebase.`
        : `Chưa hoàn tất đăng nhập với Google (${err.code || err.message}).`
    );
  }
}

// Đồng bộ hồ sơ người dùng an toàn tuyệt đối (không bao giờ gây lỗi permission-denied)
async function ensureUserProfile(user) {
  const email = (user.email || "").toLowerCase().trim();
  const isSuper = SUPER_ADMIN_EMAILS.includes(email);
  const gmailName = (user.displayName || email.split("@")[0] || "Nhân viên").trim();
  const ref = doc(db, "users", user.uid);

  let snap = null;
  try {
    snap = await getDoc(ref);
  } catch (readErr) {
    console.warn("Firestore getDoc fallback:", readErr);
  }

  if (!snap || !snap.exists()) {
    const initialProfile = {
      uid: user.uid,
      email,
      name: gmailName,
      photoURL: user.photoURL || "",
      code: isSuper ? "ADMIN01" : "NV_" + user.uid.slice(0, 5).toUpperCase(),
      role: isSuper ? "admin" : "pending",
      assignedGame: "ALL",
      assignedSubArea: "",
      active: isSuper ? true : false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    try {
      await setDoc(ref, initialProfile);
      return initialProfile;
    } catch (writeErr) {
      const safePendingProfile = {
        ...initialProfile,
        code: "NV_" + user.uid.slice(0, 5).toUpperCase(),
        role: "pending",
        active: false
      };
      try {
        await setDoc(ref, safePendingProfile);
      } catch (e2) {
        console.warn("Firestore safePendingProfile fallback:", e2);
      }
      return safePendingProfile;
    }
  } else {
    const data = snap.data();
    if (isSuper && (data.role !== "admin" || !data.active)) {
      try {
        await updateDoc(ref, {
          role: "admin",
          active: true,
          assignedGame: "ALL",
          name: gmailName,
          photoURL: user.photoURL || "",
          lastLoginAt: serverTimestamp()
        });
        data.role = "admin";
        data.active = true;
        data.assignedGame = "ALL";
      } catch (e) {
        console.warn("Skip super admin promotion:", e);
      }
    } else {
      try {
        await updateDoc(ref, {
          name: gmailName,
          photoURL: user.photoURL || "",
          lastLoginAt: serverTimestamp()
        });
      } catch (e) {}
    }
    data.name = gmailName;
    return data;
  }
}

function applyFirebaseProfileToLegacyApp(user, profile) {
  currentAuthUser = user;
  currentProfile = profile;

  const isAdmin = profile.role === "admin";
  const isApproved = Boolean(profile.active) && profile.role !== "pending";
  const gmailDisplayName = (user.displayName || profile.name || user.email.split("@")[0]).trim();
  window.loggedInGoogleName = gmailDisplayName;

  if (!isApproved && !isAdmin) {
    showPendingPrompt(user, profile);
    return;
  }

  gateEl.style.display = "none";

  let mappedGame = profile.assignedGame || "ALL";
  let mappedSubArea = profile.assignedSubArea || "";

  if (!isAdmin && mappedGame === "ALL") {
    mappedGame = "MANG_TRUOT_1";
  }

  if (typeof currentUserAccount !== "undefined") {
    currentUserAccount = {
      uid: user.uid,
      code: profile.code || (isAdmin ? "ADMIN01" : "SW_USER"),
      email: user.email,
      name: gmailDisplayName,
      photoURL: user.photoURL || "",
      role: isAdmin
        ? "Quản Trị Viên Toàn Khu (Admin)"
        : `Nhân Viên Vận Hành • ${getGameTitleById(mappedGame)}${mappedSubArea ? " (" + mappedSubArea + ")" : ""}`,
      assignedGame: isAdmin ? "ALL" : mappedGame,
      assignedSubArea: isAdmin ? "" : mappedSubArea,
      isAdmin
    };
  }

  lockStaffNameToGmail(gmailDisplayName);

  const badgeTextEl = document.getElementById("headerAdminBadgeText");
  const avatarEl = document.getElementById("headerUserAvatar");
  if (badgeTextEl) {
    badgeTextEl.textContent = isAdmin
      ? `ADMIN • ${gmailDisplayName}`
      : `${gmailDisplayName} • ${getGameTitleById(mappedGame)}`;
  }
  if (avatarEl && user.photoURL) {
    avatarEl.innerHTML = `<img src="${user.photoURL}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  }

  if (typeof updateHeaderUserBadgeUI === "function") updateHeaderUserBadgeUI();
  if (typeof applyAccountPrivileges === "function") applyAccountPrivileges();

  if (!isAdmin && mappedGame && mappedGame !== "ALL") {
    const gameSel = document.getElementById("gameSelect");
    if (gameSel) {
      let targetVal = mappedGame;
      if (mappedGame === "AIRSHIP") targetVal = mappedSubArea === "Rạp 2" ? "AIRSHIP_2" : "AIRSHIP_1";
      if (mappedGame === "RAP_3D") targetVal = mappedSubArea === "Rạp 2" ? "RAP_3D_2" : "RAP_3D_1";
      Array.from(gameSel.options).forEach((opt) => {
        const allowed = opt.value === targetVal;
        opt.hidden = !allowed;
        opt.disabled = !allowed;
      });
      gameSel.value = targetVal;
      gameSel.disabled = true;
    }
    if (mappedSubArea && typeof selectedSubAreaByGame !== "undefined") {
      selectedSubAreaByGame[mappedGame] = mappedSubArea;
    }
    if (typeof onGameChange === "function") onGameChange();
    if (typeof switchScreen === "function") switchScreen("time");
  }

  lockStaffNameToGmail(gmailDisplayName);

  const liveTestSec = document.getElementById("liveTestMonitorSection");
  if (liveTestSec) liveTestSec.style.display = "none";

  subscribeActiveShiftFromFirestore();
  renderAccountModalControls();
  if (typeof renderAll === "function") renderAll();
}

function getCurrentShiftDocId() {
  if (typeof appStore === "undefined") return null;
  const dateStr =
    appStore.activeDate ||
    (document.getElementById("opDate") ? document.getElementById("opDate").value : "") ||
    new Date().toISOString().slice(0, 10);
  const gameId =
    appStore.currentGameId ||
    (document.getElementById("gameSelect") ? document.getElementById("gameSelect").value : "MANG_TRUOT_1");
  return `${dateStr}__${gameId}`;
}

function subscribeActiveShiftFromFirestore() {
  if (!db || !currentAuthUser) return;
  if (unsubRemoteShift) {
    unsubRemoteShift();
    unsubRemoteShift = null;
  }

  const shiftId = getCurrentShiftDocId();
  if (!shiftId) return;

  const ref = doc(db, "shifts", shiftId);
  unsubRemoteShift = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data || typeof appStore === "undefined") return;
      isApplyingRemote = true;
      try {
        const gId = data.gameId || appStore.currentGameId;
        if (appStore.games && gId) {
          const fixedStaff = window.loggedInGoogleName || data.staff || "Nhân viên";
          appStore.games[gId] = {
            gameId: gId,
            gameName: data.gameName || (appStore.games[gId] && appStore.games[gId].gameName) || gId,
            mode: data.mode || "coaster",
            date: data.date || appStore.activeDate,
            staffCode: data.staffCode || "SW001",
            staff: fixedStaff,
            staffRole: data.staffRole || "Vận hành viên",
            openTime: data.openTime || "08:00",
            closeTime: data.closeTime || null,
            downtimes: Array.isArray(data.downtimes) ? data.downtimes : [],
            cycles: Array.isArray(data.cycles) ? data.cycles : []
          };
          if (gId === appStore.currentGameId) {
            if (typeof syncShiftDropdownsFromRecord === "function") {
              syncShiftDropdownsFromRecord(appStore.games[gId]);
            }
            lockStaffNameToGmail(window.loggedInGoogleName);
          }
          if (typeof renderAll === "function") renderAll();
        }
      } finally {
        isApplyingRemote = false;
      }
    },
    () => {}
  );
}

let syncTimer = null;
function queueFirestoreShiftSync() {
  if (!db || !currentAuthUser || isApplyingRemote) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      if (typeof getCurrentRecord !== "function") return;
      const rec = getCurrentRecord();
      if (!rec) return;
      if (window.loggedInGoogleName) {
        rec.staff = window.loggedInGoogleName;
      }
      const dateStr =
        rec.date ||
        (typeof appStore !== "undefined" ? appStore.activeDate : "") ||
        new Date().toISOString().slice(0, 10);
      const shiftId = `${dateStr}__${rec.gameId}`;
      await setDoc(
        doc(db, "shifts", shiftId),
        {
          ...rec,
          date: dateStr,
          staff: window.loggedInGoogleName || rec.staff || "",
          updatedByUid: currentAuthUser.uid,
          updatedByEmail: currentAuthUser.email || "",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Firestore sync warning:", e);
    }
  }, 350);
}

function renderAccountModalControls() {
  const modalCard = document.querySelector("#loginModalBackdrop .login-modal-card");
  if (!modalCard || !currentAuthUser || !currentProfile) return;

  let container = document.getElementById("fbAccountPanel");
  if (!container) {
    container = document.createElement("div");
    container.id = "fbAccountPanel";
    const scrollBody = document.getElementById("adminDrawerScrollBody") || modalCard;
    scrollBody.appendChild(container);
  }

  const isAdmin = currentProfile.role === "admin";
  const gmailName = window.loggedInGoogleName || currentAuthUser.displayName || currentProfile.name || currentAuthUser.email;
  const gameTitle = getGameTitleById(currentProfile.assignedGame);
  const subTitle = currentProfile.assignedSubArea ? ` • ${currentProfile.assignedSubArea}` : "";

  const superBannerCard = document.getElementById("superAdminBannerCard");
  const superBannerAcc = document.getElementById("superAdminBannerAccountText");
  const exportBtn = document.getElementById("adminExportAllCsvBtn");
  if (superBannerCard) {
    superBannerCard.style.display = isAdmin ? "" : "none";
  }
  if (superBannerAcc && isAdmin) {
    superBannerAcc.textContent = `Tài khoản đang thao tác: ${gmailName} (${currentAuthUser.email})`;
  }
  if (exportBtn) {
    exportBtn.style.display = isAdmin ? "" : "none";
  }

  container.innerHTML = `
    <!-- 3. KHỐI TÀI KHOẢN CÁ NHÂN: Avatar tròn, thông tin email, nút đăng xuất -->
    <div class="sw-personal-account-card">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        ${
          currentAuthUser.photoURL
            ? `<img src="${currentAuthUser.photoURL}" style="width:44px;height:44px;border-radius:50%;border:2px solid #FFC928;object-fit:cover;flex-shrink:0;" alt="" />`
            : `<span style="width:44px;height:44px;border-radius:50%;background:#C0262D;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:800;flex-shrink:0;border:2px solid #FFC928;">${gmailName.slice(0, 2).toUpperCase()}</span>`
        }
        <div style="min-width:0;">
          <div style="font-size:0.92rem;font-weight:800;color:var(--text);line-height:1.25;">${gmailName}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);word-break:break-all;margin-top:2px;">${currentAuthUser.email}</div>
          <div style="font-size:0.72rem;font-weight:700;color:#C0262D;margin-top:3px;">
            ${isAdmin ? "👑 Quản trị viên toàn khu (25 trò chơi)" : `🎯 Trò chơi phụ trách: ${gameTitle}${subTitle}`}
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-outline" id="fbModalSignOutBtn" style="font-size:0.78rem;padding:8px 14px;border-radius:10px;border-color:#C0262D;color:#C0262D;display:inline-flex;align-items:center;gap:6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Đăng xuất</span>
      </button>
    </div>

    ${
      isAdmin
        ? `
      <!-- 4. KHỐI THỐNG KÊ NHANH (KPI METRICS): Grid 2 cột gồm 4 ô đếm số liệu -->
      <div class="sw-admin-stats-grid" id="fbAdminStatsGrid">
        <div class="sw-admin-stat-box">
          <div class="sw-admin-stat-top">
            <span class="sw-admin-stat-lbl">Tổng tài khoản</span>
            <span style="width:26px;height:26px;border-radius:8px;background:rgba(15,23,42,0.06);color:#334155;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;">👥</span>
          </div>
          <div class="sw-admin-stat-num" id="statTotalUsers">0</div>
        </div>
        <div class="sw-admin-stat-box">
          <div class="sw-admin-stat-top">
            <span class="sw-admin-stat-lbl">Chờ duyệt</span>
            <span style="width:26px;height:26px;border-radius:8px;background:rgba(217,119,6,0.12);color:#D97706;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;">⏳</span>
          </div>
          <div class="sw-admin-stat-num" style="color:#D97706;" id="statPendingUsers">0</div>
        </div>
        <div class="sw-admin-stat-box">
          <div class="sw-admin-stat-top">
            <span class="sw-admin-stat-lbl">Đã duyệt</span>
            <span style="width:26px;height:26px;border-radius:8px;background:rgba(22,163,74,0.12);color:#16A34A;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;">✓</span>
          </div>
          <div class="sw-admin-stat-num" style="color:#16A34A;" id="statApprovedUsers">0</div>
        </div>
        <div class="sw-admin-stat-box">
          <div class="sw-admin-stat-top">
            <span class="sw-admin-stat-lbl">Quản trị viên</span>
            <span style="width:26px;height:26px;border-radius:8px;background:rgba(192,38,45,0.12);color:#C0262D;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;">👑</span>
          </div>
          <div class="sw-admin-stat-num" style="color:#C0262D;" id="statAdminUsers">0</div>
        </div>
      </div>

      <!-- 5. THANH TÌM KIẾM & TAB LỌC: Ô input search kính lúp + 3 nút toggle lọc -->
      <div class="sw-admin-toolbar-card">
        <div class="sw-search-input-wrap">
          <span class="sw-search-icon-svg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input type="text" class="sw-admin-search" id="fbUserSearchInput" placeholder="Tìm theo tên hoặc email..." value="${adminSearchQuery}" />
        </div>
        <div class="sw-admin-filter-pills" role="tablist" aria-label="Bộ lọc trạng thái tài khoản">
          <button type="button" class="sw-filter-pill ${adminFilterMode === "all" ? "active" : ""}" data-filter="all">Tất cả</button>
          <button type="button" class="sw-filter-pill ${adminFilterMode === "pending" ? "active" : ""}" data-filter="pending">Chờ duyệt</button>
          <button type="button" class="sw-filter-pill ${adminFilterMode === "approved" ? "active" : ""}" data-filter="approved">Đã duyệt</button>
        </div>
      </div>

      <!-- 6. DANH SÁCH THẺ TÀI KHOẢN -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 2px;">
          <span style="font-size:0.82rem;font-weight:800;color:var(--text);">Danh sách thẻ tài khoản nhân sự</span>
          <span style="font-size:0.72rem;color:var(--text-muted);">Chọn trò chơi phụ trách &amp; Lưu phân quyền</span>
        </div>
        <div id="fbUsersListContainer" class="fb-user-list">
          <div style="font-size:0.78rem;color:var(--text-muted);padding:16px;text-align:center;background:var(--surface,#fff);border-radius:12px;border:1px solid #E2E8F0;">Đang tải danh sách tài khoản...</div>
        </div>
      </div>
    `
        : `
      <div style="padding:14px 16px;border-radius:14px;background:var(--surface,#FFFFFF);border:1px solid #E2E8F0;font-size:0.8rem;color:var(--text-muted);line-height:1.55;">
        🔒 <strong>Quyền hạn vận hành:</strong> Tài khoản của bạn được cố định tên nhân viên <strong>${gmailName}</strong> và thao tác tại <strong>Thông tin chung</strong> &amp; <strong>Nhập liệu</strong> của trò chơi <strong>${gameTitle}${subTitle}</strong>. Lịch sử ca trực được bảo vệ chống xóa.
      </div>
    `
    }
  `;

  const signOutBtn = document.getElementById("fbModalSignOutBtn");
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      if (typeof closeLoginModal === "function") closeLoginModal();
      await signOut(auth);
    };
  }

  if (isAdmin) {
    const searchInput = document.getElementById("fbUserSearchInput");
    if (searchInput) {
      searchInput.oninput = (e) => {
        adminSearchQuery = e.target.value || "";
        renderFilteredAdminUserList();
      };
    }
    container.querySelectorAll(".sw-filter-pill").forEach((pill) => {
      pill.onclick = () => {
        adminFilterMode = pill.getAttribute("data-filter") || "all";
        container.querySelectorAll(".sw-filter-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        renderFilteredAdminUserList();
      };
    });
    subscribeAllUsersForAdmin();
  }
}

function subscribeAllUsersForAdmin() {
  if (!db) return;
  if (unsubUsersList) unsubUsersList();

  const gameSel = document.getElementById("gameSelect");
  const gameOptions = gameSel
    ? Array.from(gameSel.options).map((o) => ({ value: o.value, label: o.textContent }))
    : [];

  unsubUsersList = onSnapshot(collection(db, "users"), (snap) => {
    const users = [];
    snap.forEach((d) => users.push(d.data()));
    users.sort((a, b) => {
      const aPending = !a.active || a.role === "pending" ? 0 : 1;
      const bPending = !b.active || b.role === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (a.email || "").localeCompare(b.email || "");
    });
    cachedAllUsers = users;
    window.__SW_GAME_OPTIONS = gameOptions;
    renderFilteredAdminUserList();
  });
}

function renderFilteredAdminUserList() {
  const listEl = document.getElementById("fbUsersListContainer");
  if (!listEl) return;

  const gameOptions = window.__SW_GAME_OPTIONS || [];
  const totalCount = cachedAllUsers.length;
  const pendingCount = cachedAllUsers.filter((u) => !u.active || u.role === "pending").length;
  const approvedCount = cachedAllUsers.filter((u) => u.active && u.role !== "pending").length;
  const adminCount = cachedAllUsers.filter((u) => u.role === "admin").length;

  const elTotal = document.getElementById("statTotalUsers");
  const elPend = document.getElementById("statPendingUsers");
  const elAppr = document.getElementById("statApprovedUsers");
  const elAdm = document.getElementById("statAdminUsers");
  if (elTotal) elTotal.textContent = totalCount;
  if (elPend) elPend.textContent = pendingCount;
  if (elAppr) elAppr.textContent = approvedCount;
  if (elAdm) elAdm.textContent = adminCount;

  const q = adminSearchQuery.trim().toLowerCase();
  const filtered = cachedAllUsers.filter((u) => {
    const isPend = !u.active || u.role === "pending";
    if (adminFilterMode === "pending" && !isPend) return false;
    if (adminFilterMode === "approved" && isPend) return false;
    if (q) {
      const hay = `${u.name || ""} ${u.email || ""} ${u.assignedGame || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="padding:18px;text-align:center;font-size:0.8rem;color:var(--text-muted);background:var(--surface,#fff);border-radius:14px;border:1px solid #E2E8F0;">Không có tài khoản nào khớp bộ lọc tìm kiếm.</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((u) => {
      const isPending = !u.active || u.role === "pending";
      const subAreas = SUB_AREAS_BY_GAME[u.assignedGame] || [];
      const subAreaOptsHtml = [
        `<option value="">-- Tất cả Line/Rạp --</option>`,
        ...subAreas.map(
          (sa) => `<option value="${sa}" ${u.assignedSubArea === sa ? "selected" : ""}>${sa}</option>`
        )
      ].join("");

      const avatarHtml = u.photoURL
        ? `<img src="${u.photoURL}" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1.5px solid ${isPending ? "#F59E0B" : "#16A34A"};flex-shrink:0;" />`
        : `<span style="width:38px;height:38px;border-radius:50%;background:${isPending ? "#F59E0B" : u.role === "admin" ? "#C0262D" : "#16A34A"};color:#fff;font-size:0.78rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${(u.name || u.email || "U").slice(0, 2).toUpperCase()}
          </span>`;

      return `
        <div class="fb-user-row ${isPending ? "is-pending" : "is-approved"}" data-uid="${u.uid}">
          <div class="fb-user-top">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              ${avatarHtml}
              <div style="min-width:0;">
                <div style="font-size:0.86rem;font-weight:800;color:var(--text);line-height:1.25;">${u.name || "Nhân viên"}</div>
                <div style="font-size:0.74rem;color:var(--text-muted);word-break:break-all;margin-top:2px;">${u.email}</div>
              </div>
            </div>
            <span style="font-size:0.7rem;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;border:1px solid ${
              isPending ? "rgba(245,158,11,0.35)" : u.role === "admin" ? "rgba(192,38,45,0.28)" : "rgba(22,163,74,0.28)"
            };background:${
              isPending ? "#FFFBEB" : u.role === "admin" ? "rgba(192,38,45,0.08)" : "rgba(22,163,74,0.1)"
            };color:${isPending ? "#B45309" : u.role === "admin" ? "#C0262D" : "#15803D"};">
              ${isPending ? "⏳ Chờ duyệt" : u.role === "admin" ? "👑 Quản trị viên" : `✓ Đã duyệt • ${getGameTitleById(u.assignedGame)}`}
            </span>
          </div>

          <div class="fb-user-controls-grid">
            <div class="fb-game-select-full">
              <label style="display:block;font-size:0.7rem;font-weight:700;color:var(--text-muted);margin-bottom:4px;">Trò chơi phụ trách</label>
              <select data-game-uid="${u.uid}" title="Chọn trò chơi phụ trách">
                <option value="ALL" ${u.assignedGame === "ALL" ? "selected" : ""}>-- Chọn trò chơi phụ trách (Hoặc Toàn Khu cho Admin) --</option>
                ${gameOptions
                  .map(
                    (g) =>
                      `<option value="${g.value}" ${u.assignedGame === g.value ? "selected" : ""}>${g.label}</option>`
                  )
                  .join("")}
              </select>
            </div>

            <div>
              <label style="display:block;font-size:0.7rem;font-weight:700;color:var(--text-muted);margin-bottom:4px;">Vai trò &amp; Trạng thái</label>
              <select data-role-uid="${u.uid}" title="Vai trò">
                <option value="pending" ${u.role === "pending" ? "selected" : ""}>⏳ Chờ duyệt</option>
                <option value="operator" ${u.role === "operator" || u.role === "pending" ? "selected" : ""}>🎯 Nhân viên vận hành</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>👑 Quản trị viên (Admin)</option>
              </select>
            </div>

            <div>
              <label style="display:block;font-size:0.7rem;font-weight:700;color:var(--text-muted);margin-bottom:4px;">Vị trí Line / Rạp</label>
              <select data-subarea-uid="${u.uid}" title="Vị trí Line / Rạp">
                ${subAreaOptsHtml}
              </select>
            </div>

            <button type="button" class="btn ${isPending ? "btn-primary" : "btn-outline"} fb-save-perm-btn" data-save-uid="${u.uid}">
              ${isPending ? "✓ Duyệt & Lưu phân quyền" : "Lưu phân quyền"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-game-uid]").forEach((gameSelectEl) => {
    gameSelectEl.onchange = () => {
      const uid = gameSelectEl.getAttribute("data-game-uid");
      const subSel = listEl.querySelector(`[data-subarea-uid="${uid}"]`);
      if (!subSel) return;
      const areas = SUB_AREAS_BY_GAME[gameSelectEl.value] || [];
      subSel.innerHTML = [
        `<option value="">-- Tất cả Line/Rạp --</option>`,
        ...areas.map((sa) => `<option value="${sa}">${sa}</option>`)
      ].join("");
    };
  });

  listEl.querySelectorAll("[data-save-uid]").forEach((btn) => {
    btn.onclick = async () => {
      const uid = btn.getAttribute("data-save-uid");
      const roleEl = listEl.querySelector(`[data-role-uid="${uid}"]`);
      const gameEl = listEl.querySelector(`[data-game-uid="${uid}"]`);
      const subEl = listEl.querySelector(`[data-subarea-uid="${uid}"]`);

      let chosenRole = roleEl ? roleEl.value : "operator";
      const chosenGame = gameEl ? gameEl.value : "MANG_TRUOT_1";
      const chosenSub = subEl ? subEl.value : "";

      if (chosenRole === "pending" && chosenGame !== "ALL") {
        chosenRole = "operator";
      }
      const isActivating = chosenRole !== "pending";

      btn.disabled = true;
      btn.textContent = "Đang lưu...";
      try {
        await updateDoc(doc(db, "users", uid), {
          role: chosenRole,
          assignedGame: chosenRole === "admin" ? "ALL" : chosenGame === "ALL" ? "MANG_TRUOT_1" : chosenGame,
          assignedSubArea: chosenRole === "admin" ? "" : chosenSub,
          active: isActivating,
          approvedAt: serverTimestamp()
        });
        if (typeof showAppToast === "function") {
          showAppToast(
            isActivating
              ? `✓ Đã duyệt tài khoản & gán trò chơi ${getGameTitleById(chosenGame)}!`
              : "Đã chuyển tài khoản về trạng thái chờ duyệt."
          );
        }
      } catch (err) {
        alert("Lỗi cập nhật phân quyền: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "✓ Đã lưu";
      }
    };
  });
}

window.SWFirebase = {
  enabled: isConfigured,
  queueSync: queueFirestoreShiftSync,
  resubscribeShift: subscribeActiveShiftFromFirestore,
  signOut: () => (auth ? signOut(auth) : Promise.resolve())
};

if (isConfigured) {
  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);

    getRedirectResult(auth).catch(() => {});

    onAuthStateChanged(auth, async (user) => {
      if (unsubMyProfile) {
        unsubMyProfile();
        unsubMyProfile = null;
      }
      if (!user) {
        currentAuthUser = null;
        currentProfile = null;
        window.loggedInGoogleName = "";
        showSignInPrompt();
        return;
      }
      try {
        const initialProfile = await ensureUserProfile(user);
        applyFirebaseProfileToLegacyApp(user, initialProfile);
        unsubMyProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snap) => {
            if (snap.exists()) {
              applyFirebaseProfileToLegacyApp(user, snap.data());
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Firebase profile load fallback:", err);
        showPendingPrompt(user, {
          name: user.displayName || user.email.split("@")[0],
          role: "pending",
          active: false
        });
      }
    });
  } catch (err) {
    console.error("Firebase init error:", err);
  }
}
