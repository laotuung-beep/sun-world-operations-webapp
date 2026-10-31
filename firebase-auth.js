// ============================================================================
// SUN WORLD BA NA HILLS — FIREBASE AUTH, RBAC & CLOUD FIRESTORE SYNC MODULE
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

function getActiveBrandLogoSrc() {
  const headerLogo = document.getElementById("headerBrandLogoImg");
  if (headerLogo && headerLogo.src) return headerLogo.src;
  if (window.LIGHT_LOGO_URI) return window.LIGHT_LOGO_URI;
  return "";
}

// Inject CSS tương thích 100% với bố cục, bảng màu Sáng/Tối bên trong Web App
// và đáp ứng đầy đủ trên Điện thoại (<=680px), Máy tính bảng (681-1080px), PC (>1080px)
const styleEl = document.createElement("style");
styleEl.textContent = `
  #fbAuthGate {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: var(--bg, #F4F6F9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    font-family: var(--font-main, 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif);
    color: var(--text, #1E293B);
    overflow-y: auto;
  }

  .sw-login-card {
    width: 100%;
    max-width: 440px;
    background: var(--surface, #FFFFFF);
    border: 1px solid var(--border, #E2E8F0);
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    overflow: hidden;
    margin: auto;
  }

  /* Thanh tiêu đề Đỏ Sun World (#C0262D) đồng bộ với Header bên trong Web App */
  .sw-login-header {
    background: #C0262D;
    border-bottom: 3px solid #FFC928;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  body[data-theme="dark"] .sw-login-header {
    background: #151F32;
    border-bottom: 2px solid #FFC928;
  }

  .sw-login-header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .sw-login-logo-img {
    height: 40px;
    width: auto;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
  }

  .sw-login-brand-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .sw-login-brand-sub {
    font-size: 0.68rem;
    font-weight: 700;
    color: #FFC928;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sw-login-brand-main {
    font-size: 0.92rem;
    font-weight: 800;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sw-login-theme-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.12);
    color: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }
  .sw-login-theme-btn:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  .sw-login-body {
    padding: 20px 22px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sw-login-section-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text, #1E293B);
    margin: 0;
  }

  .sw-login-section-desc {
    font-size: 0.82rem;
    color: var(--text-muted, #64748B);
    line-height: 1.45;
    margin: 0;
  }

  /* Danh sách các bước thao tác cụ thể, tinh gọn */
  .sw-action-steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--surface-alt, #F8FAFC);
    border: 1px solid var(--border, #E2E8F0);
    border-radius: 12px;
    padding: 12px 14px;
  }

  .sw-step-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text, #1E293B);
  }

  .sw-step-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #C0262D;
    color: #FFFFFF;
    font-size: 0.7rem;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Nút đăng nhập Google chính */
  .sw-google-btn {
    width: 100%;
    min-height: 46px;
    padding: 11px 16px;
    border-radius: 10px;
    border: none;
    background: #C0262D;
    color: #FFFFFF;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(192, 38, 45, 0.25);
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .sw-google-btn:hover {
    background: #9E1C22;
  }
  .sw-google-btn:active {
    transform: scale(0.99);
  }
  .sw-google-btn:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .sw-google-icon-box {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sw-secondary-btn {
    width: 100%;
    min-height: 42px;
    padding: 9px 14px;
    border-radius: 10px;
    border: 1.5px solid var(--border, #CBD5E1);
    background: var(--surface, #FFFFFF);
    color: var(--text, #1E293B);
    font-size: 0.82rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .sw-secondary-btn:hover {
    border-color: #C0262D;
    color: #C0262D;
    background: var(--surface-alt, #F8FAFC);
  }

  /* Khung hiển thị tài khoản Gmail đang đăng nhập */
  .sw-user-profile-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--surface-alt, #F8FAFC);
    border: 1.5px solid var(--border, #E2E8F0);
  }

  .sw-user-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #C0262D;
    color: #FFFFFF;
    font-weight: 800;
    font-size: 0.95rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    object-fit: cover;
    border: 2px solid #FFC928;
  }

  .sw-user-meta {
    min-width: 0;
    flex: 1;
  }

  .sw-user-name {
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--text, #1E293B);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sw-user-email {
    font-size: 0.76rem;
    color: var(--text-muted, #64748B);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sw-status-badge-pending {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    background: #FFF8E1;
    color: #B45309;
    border: 1px solid #FFC928;
  }

  .sw-login-footer {
    padding: 10px 20px;
    background: var(--surface-alt, #F8FAFC);
    border-top: 1px solid var(--border, #E2E8F0);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--text-muted, #64748B);
    font-weight: 600;
  }

  /* Bảng Quản trị Phê duyệt Tài khoản bên trong Modal */
  .sw-admin-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .sw-admin-stat-box {
    background: var(--surface-alt, #F8FAFC);
    border: 1px solid var(--border, #E2E8F0);
    border-radius: 10px;
    padding: 8px 10px;
    text-align: center;
  }
  .sw-admin-stat-num {
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1.1;
  }
  .sw-admin-stat-lbl {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted, #64748B);
    margin-top: 2px;
  }

  .sw-admin-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
  .sw-admin-search {
    flex: 1;
    min-width: 160px;
    padding: 7px 11px !important;
    font-size: 0.78rem !important;
    border-radius: 8px !important;
    border: 1px solid var(--border, #CBD5E1) !important;
    background: var(--surface, #FFFFFF) !important;
    color: var(--text, #1E293B) !important;
    height: 34px !important;
  }
  .sw-admin-filter-pills {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .sw-filter-pill {
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    border: 1px solid var(--border, #CBD5E1);
    background: var(--surface, #FFFFFF);
    color: var(--text-muted, #64748B);
    cursor: pointer;
  }
  .sw-filter-pill.active {
    background: #C0262D;
    color: #FFFFFF;
    border-color: #C0262D;
  }

  .fb-user-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 340px;
    overflow-y: auto;
    padding-right: 2px;
  }
  .fb-user-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 11px 12px;
    border-radius: 10px;
    background: var(--surface, #FFFFFF);
    border: 1px solid var(--border, #E2E8F0);
  }
  .fb-user-row.is-pending {
    border-left: 4px solid #F59E0B;
    background: rgba(245, 158, 11, 0.04);
  }
  .fb-user-row.is-approved {
    border-left: 4px solid #16A34A;
  }
  .fb-user-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .fb-user-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1.25fr 0.9fr auto;
    gap: 6px;
    align-items: center;
  }
  .fb-user-controls-grid select {
    padding: 6px 8px !important;
    font-size: 0.76rem !important;
    border-radius: 8px !important;
    height: 34px !important;
  }

  /* Responsive cho Máy tính bảng (681px - 1080px) */
  @media (max-width: 1080px) {
    .fb-user-controls-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Responsive cho Điện thoại (<= 680px) */
  @media (max-width: 680px) {
    #fbAuthGate {
      padding: 10px;
    }
    .sw-login-card {
      max-width: 100%;
      border-radius: 14px;
    }
    .sw-login-header {
      padding: 12px 14px;
    }
    .sw-login-logo-img {
      height: 34px;
    }
    .sw-login-brand-main {
      font-size: 0.84rem;
    }
    .sw-login-body {
      padding: 16px 14px 18px;
      gap: 12px;
    }
    .sw-admin-stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .fb-user-controls-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(styleEl);

// Tạo cổng đăng nhập (#fbAuthGate) sử dụng đúng Logo & màu sắc bên trong Web App
const gateEl = document.createElement("div");
gateEl.id = "fbAuthGate";
gateEl.style.display = isConfigured ? "flex" : "none";

function renderAuthGateShell(innerBodyHtml) {
  const logoSrc = getActiveBrandLogoSrc();
  gateEl.innerHTML = `
    <div class="sw-login-card">
      <div class="sw-login-header">
        <div class="sw-login-header-brand">
          ${logoSrc ? `<img src="${logoSrc}" alt="Sun World Ba Na Hills" class="sw-login-logo-img" id="swAuthGateLogoImg" />` : ""}
          <div class="sw-login-brand-titles">
            <span class="sw-login-brand-sub">SUN WORLD BA NA HILLS</span>
            <span class="sw-login-brand-main">VẬN HÀNH TRÒ CHƠI</span>
          </div>
        </div>
        <button type="button" class="sw-login-theme-btn" id="swLoginThemeToggleBtn" title="Đổi giao diện Sáng / Tối">
          🌓
        </button>
      </div>
      <div class="sw-login-body" id="fbGateContent">
        ${innerBodyHtml}
      </div>
      <div class="sw-login-footer">
        <span>🔒 Xác thực tài khoản Gmail</span>
        <span>Sun World Ops</span>
      </div>
    </div>
  `;

  const themeBtn = gateEl.querySelector("#swLoginThemeToggleBtn");
  if (themeBtn) {
    themeBtn.onclick = () => {
      if (typeof window.toggleTheme === "function") {
        window.toggleTheme();
      }
    };
  }
}

renderAuthGateShell(`
  <h2 class="sw-login-section-title">Đang kiểm tra phiên đăng nhập...</h2>
  <p class="sw-login-section-desc">Vui lòng chờ giây lát để đồng bộ tài khoản Gmail.</p>
`);

document.addEventListener("DOMContentLoaded", () => {
  document.body.appendChild(gateEl);
  const logoEl = document.getElementById("swAuthGateLogoImg");
  if (logoEl && !logoEl.getAttribute("src")) {
    logoEl.src = getActiveBrandLogoSrc();
  }
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

function showSignInPrompt(errorMessage = "") {
  gateEl.style.display = "flex";
  renderAuthGateShell(`
    <div>
      <h2 class="sw-login-section-title">Đăng nhập ca vận hành</h2>
      <p class="sw-login-section-desc" style="margin-top:4px;">
        Sử dụng tài khoản Google (Gmail) để vào giao diện trò chơi được phân công.
      </p>
    </div>

    ${
      errorMessage
        ? `<div style="padding:10px 12px;border-radius:10px;background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C;font-size:0.78rem;font-weight:600;line-height:1.4;">⚠️ ${errorMessage}</div>`
        : ""
    }

    <div class="sw-action-steps">
      <div class="sw-step-row">
        <span class="sw-step-num">1</span>
        <span>Nhấn <strong>Đăng nhập bằng Gmail</strong> và chọn tài khoản của bạn.</span>
      </div>
      <div class="sw-step-row">
        <span class="sw-step-num">2</span>
        <span>Admin duyệt tài khoản và chọn <strong>Trò chơi phụ trách</strong>.</span>
      </div>
      <div class="sw-step-row">
        <span class="sw-step-num">3</span>
        <span>Thao tác tại <strong>Thông tin chung</strong> &amp; <strong>Nhập liệu</strong> (Tên NV tự động lấy theo tên Gmail).</span>
      </div>
    </div>

    <button type="button" class="sw-google-btn" id="fbSignInBtn">
      <span class="sw-google-icon-box">
        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
      </span>
      <span>Đăng nhập bằng tài khoản Gmail</span>
    </button>
  `);

  const btn = document.getElementById("fbSignInBtn");
  if (btn) btn.onclick = triggerGoogleSignIn;
}

function showPendingPrompt(user, profile) {
  gateEl.style.display = "flex";
  const displayName = (user.displayName || (profile && profile.name) || user.email.split("@")[0]).trim();
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarHtml = user.photoURL
    ? `<img src="${user.photoURL}" alt="" class="sw-user-avatar" />`
    : `<span class="sw-user-avatar">${initials}</span>`;

  renderAuthGateShell(`
    <div>
      <h2 class="sw-login-section-title">Tài khoản đang chờ Admin duyệt</h2>
      <p class="sw-login-section-desc" style="margin-top:4px;">
        Đã ghi nhận Gmail đăng nhập. Vui lòng thực hiện theo hướng dẫn dưới đây:
      </p>
    </div>

    <div class="sw-user-profile-box">
      ${avatarHtml}
      <div class="sw-user-meta">
        <div class="sw-user-name">${displayName}</div>
        <div class="sw-user-email">${user.email}</div>
        <span class="sw-status-badge-pending">⏳ Chờ Admin phê duyệt</span>
      </div>
    </div>

    <div class="sw-action-steps">
      <div class="sw-step-row">
        <span class="sw-step-num">1</span>
        <span>Báo Admin mở mục <strong>Tài khoản</strong> → chọn <strong>Trò chơi phụ trách</strong> → bấm <strong>Duyệt &amp; Kích hoạt</strong>.</span>
      </div>
      <div class="sw-step-row">
        <span class="sw-step-num">2</span>
        <span>Màn hình sẽ <strong>tự động mở vào ứng dụng</strong> ngay khi Admin bấm duyệt.</span>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px;">
      <button type="button" class="sw-google-btn" id="fbRefreshApprovalBtn">
        🔄 Kiểm tra trạng thái duyệt ngay
      </button>
      <button type="button" class="sw-secondary-btn" id="fbPendingSignOutBtn">
        Đổi tài khoản Gmail khác
      </button>
    </div>
  `);

  const refreshBtn = document.getElementById("fbRefreshApprovalBtn");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Đang kiểm tra trạng thái...";
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
        refreshBtn.textContent = "⏳ Chưa được duyệt — Nhấn để kiểm tra lại";
      } catch (e) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "🔄 Kiểm tra trạng thái duyệt ngay";
      }
    };
  }

  const outBtn = document.getElementById("fbPendingSignOutBtn");
  if (outBtn) outBtn.onclick = () => signOut(auth);
}

async function triggerGoogleSignIn() {
  if (!auth) return;
  const btn = document.getElementById("fbSignInBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Đang mở cửa sổ đăng nhập Gmail...</span>`;
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
        : `Đã hủy hoặc chưa hoàn tất đăng nhập Gmail (${err.code || err.message}).`
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
    // Hồ sơ mới: Thử tạo với quyền tương ứng, nếu Firestore Rules từ chối admin thì tự động tạo ở trạng thái pending
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
      // Fallback sang hồ sơ pending hợp lệ theo Firestore Rules cho mọi tài khoản Gmail
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
    // Chỉ cập nhật các trường được phép theo Firestore Rules
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
      } catch (e) {
        // Bỏ qua nếu không cần thiết
      }
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
  // Tên nhân viên vận hành LUÔN cố định trùng với tên tài khoản Gmail đăng nhập
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

  // Khóa cố định ô Nhân viên vận hành (#staffName) trùng với tên Gmail đăng nhập
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

// Render bảng Quản lý Tài khoản & Phê duyệt trong Modal
function renderAccountModalControls() {
  const modalCard = document.querySelector("#loginModalBackdrop .login-modal-card");
  if (!modalCard || !currentAuthUser || !currentProfile) return;

  let container = document.getElementById("fbAccountPanel");
  if (!container) {
    container = document.createElement("div");
    container.id = "fbAccountPanel";
    container.style.marginTop = "10px";
    modalCard.insertBefore(container, modalCard.lastElementChild);
  }

  const isAdmin = currentProfile.role === "admin";
  const gmailName = window.loggedInGoogleName || currentAuthUser.displayName || currentProfile.name || currentAuthUser.email;
  const gameTitle = getGameTitleById(currentProfile.assignedGame);
  const subTitle = currentProfile.assignedSubArea ? ` • ${currentProfile.assignedSubArea}` : "";

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:var(--surface-alt);border:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        ${
          currentAuthUser.photoURL
            ? `<img src="${currentAuthUser.photoURL}" style="width:38px;height:38px;border-radius:50%;border:2px solid #FFC928;flex-shrink:0;" alt="" />`
            : `<span style="width:38px;height:38px;border-radius:50%;background:#C0262D;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;">${gmailName.slice(0, 2).toUpperCase()}</span>`
        }
        <div style="min-width:0;">
          <div style="font-size:0.88rem;font-weight:800;color:var(--text);">${gmailName}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${currentAuthUser.email}</div>
          <div style="font-size:0.72rem;font-weight:700;color:#C0262D;margin-top:2px;">
            ${isAdmin ? "👑 Admin Toàn Khu (25 Trò Chơi)" : `🎯 Phụ trách: ${gameTitle}${subTitle}`}
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-outline" id="fbModalSignOutBtn" style="font-size:0.76rem;padding:7px 12px;border-color:#C0262D;color:#C0262D;">
        Đăng xuất Gmail
      </button>
    </div>

    ${
      isAdmin
        ? `
      <div style="border-top:1px solid var(--border);padding-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
          <div style="font-size:0.86rem;font-weight:800;color:var(--text);">
            👥 Phê duyệt tài khoản Gmail &amp; Gán trò chơi phụ trách
          </div>
          <span style="font-size:0.72rem;color:var(--text-muted);">Chọn trò chơi và bấm Duyệt để mở quyền nhập liệu</span>
        </div>

        <div class="sw-admin-stats-grid" id="fbAdminStatsGrid">
          <div class="sw-admin-stat-box">
            <div class="sw-admin-stat-num" id="statTotalUsers">0</div>
            <div class="sw-admin-stat-lbl">Tổng tài khoản</div>
          </div>
          <div class="sw-admin-stat-box">
            <div class="sw-admin-stat-num" style="color:#D97706;" id="statPendingUsers">0</div>
            <div class="sw-admin-stat-lbl">Chờ duyệt</div>
          </div>
          <div class="sw-admin-stat-box">
            <div class="sw-admin-stat-num" style="color:#16A34A;" id="statApprovedUsers">0</div>
            <div class="sw-admin-stat-lbl">Đã duyệt</div>
          </div>
          <div class="sw-admin-stat-box">
            <div class="sw-admin-stat-num" style="color:#C0262D;" id="statAdminUsers">0</div>
            <div class="sw-admin-stat-lbl">Quản trị viên</div>
          </div>
        </div>

        <div class="sw-admin-toolbar">
          <input type="text" class="sw-admin-search" id="fbUserSearchInput" placeholder="🔍 Tìm theo tên hoặc email Gmail..." value="${adminSearchQuery}" />
          <div class="sw-admin-filter-pills">
            <button type="button" class="sw-filter-pill ${adminFilterMode === "all" ? "active" : ""}" data-filter="all">Tất cả</button>
            <button type="button" class="sw-filter-pill ${adminFilterMode === "pending" ? "active" : ""}" data-filter="pending">⏳ Chờ duyệt</button>
            <button type="button" class="sw-filter-pill ${adminFilterMode === "approved" ? "active" : ""}" data-filter="approved">✓ Đã duyệt</button>
          </div>
        </div>

        <div id="fbUsersListContainer" class="fb-user-list">
          <div style="font-size:0.78rem;color:var(--text-muted);padding:12px;text-align:center;">Đang tải danh sách tài khoản...</div>
        </div>
      </div>
    `
        : `
      <div style="padding:10px 12px;border-radius:10px;background:var(--surface-alt);border:1px solid var(--border);font-size:0.78rem;color:var(--text-muted);line-height:1.5;">
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
    listEl.innerHTML = `<div style="padding:16px;text-align:center;font-size:0.78rem;color:var(--text-muted);">Không có tài khoản nào khớp bộ lọc.</div>`;
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

      return `
        <div class="fb-user-row ${isPending ? "is-pending" : "is-approved"}" data-uid="${u.uid}">
          <div class="fb-user-top">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;">
              <span style="width:28px;height:28px;border-radius:50%;background:${isPending ? "#F59E0B" : "#16A34A"};color:#fff;font-size:0.7rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${(u.name || u.email || "U").slice(0, 2).toUpperCase()}
              </span>
              <div style="min-width:0;">
                <div style="font-size:0.8rem;font-weight:800;color:var(--text);">${u.name || "Nhân viên"}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);">${u.email}</div>
              </div>
            </div>
            <span style="font-size:0.68rem;font-weight:800;padding:2px 8px;border-radius:999px;background:${
              isPending ? "#FFF8E1" : "rgba(22,163,74,0.12)"
            };color:${isPending ? "#B45309" : "#15803D"};">
              ${isPending ? "⏳ Chờ duyệt" : u.role === "admin" ? "👑 Admin" : `✓ Đã duyệt • ${getGameTitleById(u.assignedGame)}`}
            </span>
          </div>

          <div class="fb-user-controls-grid">
            <select data-role-uid="${u.uid}" title="Vai trò">
              <option value="pending" ${u.role === "pending" ? "selected" : ""}>⏳ Chờ duyệt</option>
              <option value="operator" ${u.role === "operator" || u.role === "pending" ? "selected" : ""}>🎯 Nhân viên vận hành</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>👑 Quản trị viên (Admin)</option>
            </select>

            <select data-game-uid="${u.uid}" title="Trò chơi được phép thao tác">
              <option value="ALL" ${u.assignedGame === "ALL" ? "selected" : ""}>-- Chọn trò chơi phụ trách --</option>
              ${gameOptions
                .map(
                  (g) =>
                    `<option value="${g.value}" ${u.assignedGame === g.value ? "selected" : ""}>${g.label}</option>`
                )
                .join("")}
            </select>

            <select data-subarea-uid="${u.uid}" title="Vị trí Line / Rạp">
              ${subAreaOptsHtml}
            </select>

            <button type="button" class="btn ${isPending ? "btn-primary" : "btn-outline"}" data-save-uid="${u.uid}" style="padding:6px 12px;font-size:0.74rem;white-space:nowrap;">
              ${isPending ? "✓ Duyệt & Kích hoạt" : "Lưu phân quyền"}
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
          () => {
            // Giữ nguyên trạng thái initialProfile nếu listener gặp giới hạn quyền tạm thời
          }
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
