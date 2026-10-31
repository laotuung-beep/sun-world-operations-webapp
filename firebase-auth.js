// =============================================================================
// SUN WORLD OPERATIONS — FIREBASE AUTH (GOOGLE) + ĐỒNG BỘ CLOUD FIRESTORE
// Thiết kế giao diện Đăng nhập & Quản trị Phê duyệt chuẩn SaaS hiện đại (Mobbin Web)
//   • Bắt buộc đăng nhập Google mới vào được hệ thống (Màn chắn Split-Card).
//   • Tự động lắng nghe trạng thái duyệt thời gian thực (onSnapshot hồ sơ cá nhân).
//   • Tài khoản được duyệt:
//       - Chỉ xem và thao tác tại giao diện "Thông tin chung" & "Nhập liệu" của đúng trò chơi được duyệt.
//       - Tên nhân viên vận hành trong Thông tin chung tự động lấy tên đăng nhập Google (khóa chỉnh sửa).
//       - Chỉ được xem lịch sử dừng & lịch sử lượt chơi, không được xóa nội dung.
//   • Tài khoản Admin: Toàn quyền quản trị, phê duyệt 1 chạm, lọc/tìm kiếm người dùng.
// =============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = window.DEFAULT_FIREBASE_CONFIG || {};
const SUPER_ADMIN_EMAILS = (window.SUPER_ADMIN_EMAILS || []).map(e => e.toLowerCase());
const ROLE_LABELS = {
  admin: "Admin Hệ Thống (Toàn Quyền)",
  manager: "Quản lý khu trò chơi",
  operator: "NV Vận hành",
  pending: "Chờ duyệt"
};

if (cfg.apiKey) {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  let profile = null;          // hồ sơ /users/{uid}
  let unsubSelfProfile = null; // lắng nghe realtime hồ sơ của chính mình
  let unsubGames = null;
  let unsubUsers = null;
  let cachedUsersList = [];
  let userFilterMode = "all";  // 'all' | 'pending' | 'active' | 'locked'
  let userSearchQuery = "";
  let applyingRemote = false;
  let syncTimer = null;
  const dirtyGames = new Set();

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function getInitials(nameOrEmail) {
    const clean = String(nameOrEmail || "SW").trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getGameNameById(gameId) {
    if (!gameId || gameId === "ALL") return "Toàn khu (Tất cả trò chơi)";
    const found = (typeof ALL_GAMES !== "undefined" ? ALL_GAMES : []).find(g => g.id === gameId);
    return found ? found.name : gameId;
  }

  // ---------------------------------------------------------------- CSS Giao diện Mobbin SaaS Login & Admin Approval
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    #fbAuthGate {
      position: fixed;
      inset: 0;
      z-index: 2500;
      background: radial-gradient(125% 62% at 50% -10%, rgba(4, 6, 15, 0.72) 0%, rgba(4, 6, 15, 0.88) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: 'Inter', 'Montserrat', system-ui, -apple-system, sans-serif;
    }
    .mobbin-auth-shell {
      width: 100%;
      max-width: 940px;
      min-height: 520px;
      background: rgba(12, 18, 38, 0.76);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 183, 3, 0.28);
      border-radius: 24px;
      box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.85), 0 0 45px rgba(255, 183, 3, 0.15);
      display: grid;
      grid-template-columns: 1.08fr 1fr;
      overflow: hidden;
      color: #f8fafc;
    }
    @media (max-width: 760px) {
      .mobbin-auth-shell {
        grid-template-columns: 1fr;
        max-width: 440px;
        min-height: auto;
      }
      .mobbin-auth-showcase {
      background: linear-gradient(160deg, rgba(192, 38, 45, 0.94) 0%, rgba(120, 20, 30, 0.92) 50%, rgba(12, 18, 38, 0.96) 100%);
      padding: 38px 34px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .mobbin-auth-showcase::after {
      content: "";
      position: absolute;
      width: 280px;
      height: 280px;
      right: -80px;
      bottom: -80px;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.24) 0%, transparent 70%);
      pointer-events: none;
    }
    .mobbin-brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 13px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #fde68a;
      width: fit-content;
    }
    .mobbin-feature-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin: 26px 0;
    }
    .mobbin-feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(15, 23, 42, 0.32);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 14px;
      border-radius: 12px;
    }
    .mobbin-feature-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.14);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;
    }
    .mobbin-auth-panel {
      padding: 38px 34px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      background: rgba(15, 23, 42, 0.94);
    }
    .mobbin-google-btn {
      width: 100%;
      padding: 13px 18px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: #ffffff;
      color: #0f172a;
      font-size: 0.92rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.18s ease;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    }
    .mobbin-google-btn:hover {
      background: #f1f5f9;
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    }
    .mobbin-secondary-btn {
      width: 100%;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(30, 41, 59, 0.7);
      color: #e2e8f0;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .mobbin-secondary-btn:hover {
      background: rgba(51, 65, 85, 0.9);
      border-color: rgba(148, 163, 184, 0.5);
    }
    .mobbin-pending-card {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(245, 158, 11, 0.38);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* Nâng cấp Bảng Quản lý & Duyệt Tài Khoản */
    .sw-admin-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 4px;
    }
    .sw-admin-stat-box {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sw-admin-toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }
    .sw-filter-pills {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    .sw-filter-pill {
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 0.73rem;
      font-weight: 700;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .sw-filter-pill.active {
      background: #C0262D;
      color: #fff;
      border-color: #C0262D;
    }
    .fb-user-row {
      border: 1px solid var(--border);
      background: var(--surface-2);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 0.15s;
    }
    .fb-user-row.is-pending {
      border-color: rgba(245, 158, 11, 0.65);
      background: rgba(245, 158, 11, 0.05);
    }
    .fb-user-controls-grid {
      display: grid;
      grid-template-columns: 1.15fr 1.45fr auto auto;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 640px) {
      .fb-user-controls-grid {
        grid-template-columns: 1fr;
      }
      .sw-admin-stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // ---------------------------------------------------------------- UI: Màn chắn đăng nhập Google (Mobbin Split-Card)
  const gate = document.createElement("div");
  gate.id = "fbAuthGate";
  gate.innerHTML = `
    <div class="mobbin-auth-shell">
      <!-- Cột trái: Brand & Tính năng vận hành -->
      <div class="mobbin-auth-showcase">
        <div>
          <div class="mobbin-brand-pill">
            <span>☀️</span> SUN WORLD BA NA HILLS • ĐƯỜNG LÊN TIÊN CẢNH
          </div>
          <h1 style="font-size:1.62rem;font-weight:800;line-height:1.28;margin:18px 0 10px;color:#fff;">
            Hệ Thống Quản Trị & Nhập Liệu Vận Hành Trò Chơi
          </h1>
          <p style="font-size:0.84rem;color:rgba(255,255,255,0.82);line-height:1.55;margin:0;">
            Nền tảng đồng bộ số liệu ca trực, công suất phục vụ và nhật ký vận hành thời gian thực theo tiêu chuẩn Sun World.
          </p>

          <div class="mobbin-feature-list">
            <div class="mobbin-feature-item">
              <div class="mobbin-feature-icon">🔐</div>
              <div>
                <div style="font-size:0.82rem;font-weight:700;color:#fff;">Định Danh Google Chính Thức</div>
                <div style="font-size:0.74rem;color:rgba(255,255,255,0.75);line-height:1.4;">Tự động ghi nhận tên nhân viên vận hành theo tài khoản Google đã đăng nhập.</div>
              </div>
            </div>
            <div class="mobbin-feature-item">
              <div class="mobbin-feature-icon">🎯</div>
              <div>
                <div style="font-size:0.82rem;font-weight:700;color:#fff;">Giao Diện Chuyên Biệt Theo Trò Chơi</div>
                <div style="font-size:0.74rem;color:rgba(255,255,255,0.75);line-height:1.4;">Tài khoản được duyệt truy cập trực tiếp vào Thông tin chung & Nhập liệu của trò chơi phụ trách.</div>
              </div>
            </div>
            <div class="mobbin-feature-item">
              <div class="mobbin-feature-icon">🛡️</div>
              <div>
                <div style="font-size:0.82rem;font-weight:700;color:#fff;">Bảo Toàn Lịch Sử Ca Trực</div>
                <div style="font-size:0.74rem;color:rgba(255,255,255,0.75);line-height:1.4;">Lịch sử lượt chơi và thông tin dừng được bảo vệ chống xóa, đồng bộ an toàn lên Cloud.</div>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.73rem;color:rgba(255,255,255,0.7);border-top:1px solid rgba(255,255,255,0.14);padding-top:14px;">
          <span>🔒 Bảo mật bởi Google Cloud Firestore</span>
          <span>v2.5 Enterprise</span>
        </div>
      </div>

      <!-- Cột phải: Khung Xác thực & Trạng thái Phê duyệt -->
      <div class="mobbin-auth-panel">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <span style="background:#C0262D;color:#fff;font-weight:800;font-size:0.75rem;padding:4px 9px;border-radius:6px;letter-spacing:0.5px;">SUN WORLD</span>
            <span style="font-size:0.76rem;color:#94a3b8;font-weight:600;">Cổng Xác Thực Nội Bộ</span>
          </div>
          <h2 id="fbGateHeading" style="font-size:1.35rem;font-weight:800;margin:4px 0 0;color:#f8fafc;">Đăng nhập hệ thống</h2>
          <div id="fbGateMsg" style="font-size:0.84rem;color:#94a3b8;line-height:1.55;">
            Sử dụng tài khoản Google cá nhân hoặc công việc để truy cập vào trò chơi được phân công.
          </div>
        </div>

        <div id="fbGatePendingBox" style="display:none;"></div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
          <button type="button" id="fbGateSignIn" class="mobbin-google-btn" style="display:none;">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"/></svg>
            <span>Tiếp tục với tài khoản Google</span>
          </button>

          <button type="button" id="fbGateSignOut" class="mobbin-secondary-btn" style="display:none;">
            Đăng xuất / Đổi tài khoản Google khác
          </button>
        </div>

        <div style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);font-size:0.74rem;color:#64748b;line-height:1.45;">
          💡 <b>Quy trình cấp quyền:</b> Nhân viên đăng nhập lần đầu sẽ tự động gửi yêu cầu phê duyệt. Sau khi Admin chọn trò chơi và duyệt, màn hình sẽ tự động mở khóa tức thời.
        </div>
      </div>
    </div>`;
  document.body.appendChild(gate);

  const gateHeading = gate.querySelector("#fbGateHeading");
  const gateMsg = gate.querySelector("#fbGateMsg");
  const gatePendingBox = gate.querySelector("#fbGatePendingBox");
  const gateIn = gate.querySelector("#fbGateSignIn");
  const gateOut = gate.querySelector("#fbGateSignOut");

  gateIn.onclick = () => {
    gateIn.disabled = true;
    gateIn.style.opacity = "0.75";
    signInWithPopup(auth, provider)
      .catch(err => {
        gateMsg.innerHTML = `<span style="color:#f87171;font-weight:600;">Đăng nhập thất bại: ${escapeHtml(err.code || err.message)}</span>`;
      })
      .finally(() => {
        gateIn.disabled = false;
        gateIn.style.opacity = "1";
      });
  };
  gateOut.onclick = () => signOut(auth);

  function showGate(msg, { heading = "Đăng nhập hệ thống", signIn = false, signOutBtn = false, pendingUser = null } = {}) {
    gate.style.display = "flex";
    if (gateHeading) gateHeading.textContent = heading;
    gateMsg.innerHTML = msg;
    gateIn.style.display = signIn ? "flex" : "none";
    gateOut.style.display = signOutBtn ? "block" : "none";

    if (pendingUser && gatePendingBox) {
      gatePendingBox.style.display = "block";
      const avatarHtml = pendingUser.photoURL
        ? `<img src="${escapeHtml(pendingUser.photoURL)}" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #f59e0b;" />`
        : `<div style="width:42px;height:42px;border-radius:50%;background:#f59e0b;color:#0f172a;font-weight:800;display:flex;align-items:center;justify-content:center;">${escapeHtml(getInitials(pendingUser.name || pendingUser.email))}</div>`;
      gatePendingBox.innerHTML = `
        <div class="mobbin-pending-card">
          <div style="display:flex;align-items:center;gap:12px;">
            ${avatarHtml}
            <div style="overflow:hidden;">
              <div style="font-size:0.9rem;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pendingUser.name || "Nhân viên mới")}</div>
              <div style="font-size:0.76rem;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pendingUser.email)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);font-size:0.75rem;">
            <span style="color:#fbbf24;font-weight:700;">⏳ Trạng thái: ${ pendingUser.role === "pending" ? "Chờ Admin duyệt" : "Đang tạm khóa" }</span>
            <span style="color:#94a3b8;">Tự động mở khi được duyệt</span>
          </div>
        </div>`;
    } else if (gatePendingBox) {
      gatePendingBox.style.display = "none";
      gatePendingBox.innerHTML = "";
    }
  }
  function hideGate() { gate.style.display = "none"; }

  // ---------------------------------------------------------------- UI: Modal Tài khoản & Quản trị Phê duyệt Nâng cấp
  function setupAccountModal() {
    const card = document.querySelector("#loginModalBackdrop .login-modal-card");
    if (!card || card.querySelector("#fbAccountPanel")) return;
    Array.from(card.children).forEach((el, i) => { if (i > 0) el.style.display = "none"; });
    const panel = document.createElement("div");
    panel.id = "fbAccountPanel";
    panel.style.cssText = "display:flex;flex-direction:column;gap:12px;margin-top:4px;";
    card.appendChild(panel);
  }

  function renderAccountPanel(users) {
    if (Array.isArray(users)) {
      cachedUsersList = users;
    }
    const panel = document.getElementById("fbAccountPanel");
    if (!panel || !profile) return;
    const isAdmin = profile.role === "admin";
    const listGames = typeof ALL_GAMES !== "undefined" ? ALL_GAMES : [];

    const gameOpts = (selected) =>
      `<option value="ALL" ${selected === "ALL" ? "selected" : ""}>Toàn khu (ALL)</option>` +
      listGames.map(g => `<option value="${g.id}" ${g.id === selected ? "selected" : ""}>${g.name}</option>`).join("");

    const roleOpts = (selected) => ["pending", "operator", "manager", "admin"]
      .map(r => `<option value="${r}" ${r === selected ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("");

    const myGameLabel = getGameNameById(profile.assignedGame || "ALL");
    const myAvatar = profile.photoURL
      ? `<img src="${escapeHtml(profile.photoURL)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #C0262D;" />`
      : `<div style="width:44px;height:44px;border-radius:50%;background:#C0262D;color:#fff;font-weight:800;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">${escapeHtml(getInitials(profile.name || profile.email))}</div>`;

    let html = `
      <!-- Thông tin tài khoản đang đăng nhập -->
      <div style="background:var(--surface-2);border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${myAvatar}
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:0.92rem;font-weight:800;color:var(--text);">${escapeHtml(profile.name || "")}</span>
              <span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${isAdmin ? 'rgba(192,38,45,0.15)' : 'rgba(22,163,74,0.15)'};color:${isAdmin ? '#C0262D' : '#16a34a'};">
                ${escapeHtml(ROLE_LABELS[profile.role] || profile.role)}
              </span>
            </div>
            <div style="font-size:0.77rem;color:var(--text-muted);margin-top:2px;">
              ${escapeHtml(profile.email)} • Trò chơi được duyệt: <strong style="color:var(--text);">${escapeHtml(myGameLabel)}</strong>
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-outline" id="fbModalSignOut" style="padding:7px 14px;font-size:0.78rem;font-weight:700;">
          Đăng xuất Google
        </button>
      </div>`;

    if (isAdmin && cachedUsersList) {
      const totalCount = cachedUsersList.length;
      const pendingCount = cachedUsersList.filter(u => u.role === "pending" || !u.active).length;
      const activeCount = cachedUsersList.filter(u => u.active && u.role !== "pending").length;

      // Lọc danh sách theo tab và từ khóa tìm kiếm
      const q = userSearchQuery.trim().toLowerCase();
      const filtered = cachedUsersList.filter(u => {
        const isPend = u.role === "pending";
        const isAct = Boolean(u.active) && !isPend;
        const isLock = !u.active && !isPend;
        if (userFilterMode === "pending" && !isPend && u.active) return false;
        if (userFilterMode === "active" && !isAct) return false;
        if (userFilterMode === "locked" && !isLock) return false;
        if (q) {
          const hay = `${u.name || ""} ${u.email || ""} ${getGameNameById(u.assignedGame)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const rows = filtered.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.82rem;border:1px dashed var(--border);border-radius:10px;">Không có tài khoản nào khớp với bộ lọc hiện tại.</div>`
        : filtered.map(u => {
            const isSuperUser = SUPER_ADMIN_EMAILS.includes(String(u.email || "").toLowerCase());
            const isPending = u.role === "pending" || !u.active;
            const statusBadge = u.role === "pending"
              ? `<span style="background:rgba(245,158,11,0.16);color:#f59e0b;font-weight:800;font-size:0.68rem;padding:2px 8px;border-radius:999px;">⏳ CHỜ DUYỆT</span>`
              : (u.active
                  ? `<span style="background:rgba(22,163,74,0.16);color:#16a34a;font-weight:800;font-size:0.68rem;padding:2px 8px;border-radius:999px;">✓ ĐÃ DUYỆT (${escapeHtml(getGameNameById(u.assignedGame || "ALL"))})</span>`
                  : `<span style="background:rgba(239,68,68,0.16);color:#ef4444;font-weight:800;font-size:0.68rem;padding:2px 8px;border-radius:999px;">🔒 TẠM KHÓA</span>`);

            const uAvatar = u.photoURL
              ? `<img src="${escapeHtml(u.photoURL)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
              : `<div style="width:32px;height:32px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;">${escapeHtml(getInitials(u.name || u.email))}</div>`;

            return `
              <div class="fb-user-row ${isPending ? 'is-pending' : ''}" data-uid="${u.id}" data-email="${escapeHtml(u.email || "")}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="display:flex;align-items:center;gap:9px;">
                    ${uAvatar}
                    <div>
                      <div style="font-size:0.83rem;font-weight:800;color:var(--text);">
                        ${escapeHtml(u.name || "Chưa cập nhật tên")}
                        ${isSuperUser ? '<span style="font-size:0.68rem;color:#C0262D;margin-left:4px;">(Chủ sở hữu)</span>' : ''}
                      </div>
                      <div style="font-size:0.74rem;color:var(--text-muted);">${escapeHtml(u.email || "")}</div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    ${statusBadge}
                  </div>
                </div>

                <div class="fb-user-controls-grid">
                  <div>
                    <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-bottom:3px;">Vai trò tài khoản</div>
                    <select class="fb-role" style="width:100%;padding:7px 9px;font-size:0.78rem;border-radius:8px;">${roleOpts(u.role)}</select>
                  </div>
                  <div>
                    <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-bottom:3px;">Trò chơi được duyệt</div>
                    <select class="fb-game" style="width:100%;padding:7px 9px;font-size:0.78rem;border-radius:8px;">${gameOpts(u.assignedGame || "ALL")}</select>
                  </div>
                  <div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;">
                    <label style="font-size:0.76rem;font-weight:700;display:flex;gap:5px;align-items:center;cursor:pointer;padding:7px 6px;">
                      <input type="checkbox" class="fb-active" ${u.active ? "checked" : ""} style="width:15px;height:15px;"/>
                      Hoạt động
                    </label>
                  </div>
                  <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:14px;">
                    ${isPending ? `<button type="button" class="btn btn-success fb-quick-approve" style="padding:7px 11px;font-size:0.74rem;font-weight:800;" title="Duyệt làm NV Vận hành trò chơi đang chọn">✓ Duyệt nhanh</button>` : ""}
                    <button type="button" class="btn btn-primary fb-save" style="padding:7px 12px;font-size:0.74rem;font-weight:700;">Lưu</button>
                    ${!isSuperUser ? `<button type="button" class="del-btn fb-delete" style="padding:5px 8px;font-size:0.8rem;" title="Xóa tài khoản này">🗑</button>` : ""}
                  </div>
                </div>
              </div>`;
          }).join("");

      html += `
        <div class="sw-admin-stats-grid">
          <div class="sw-admin-stat-box">
            <span style="font-size:0.7rem;color:var(--text-muted);font-weight:700;">TỔNG TÀI KHOẢN</span>
            <span style="font-size:1.15rem;font-weight:800;color:var(--text);">${totalCount}</span>
          </div>
          <div class="sw-admin-stat-box" style="border-color:${pendingCount > 0 ? 'rgba(245,158,11,0.5)' : 'var(--border)'};">
            <span style="font-size:0.7rem;color:#f59e0b;font-weight:700;">CHỜ DUYỆT / TẠM KHÓA</span>
            <span style="font-size:1.15rem;font-weight:800;color:#f59e0b;">${pendingCount}</span>
          </div>
          <div class="sw-admin-stat-box">
            <span style="font-size:0.7rem;color:#16a34a;font-weight:700;">ĐANG HOẠT ĐỘNG</span>
            <span style="font-size:1.15rem;font-weight:800;color:#16a34a;">${activeCount}</span>
          </div>
        </div>

        <div class="sw-admin-toolbar">
          <div class="sw-filter-pills">
            <button type="button" class="sw-filter-pill ${userFilterMode === 'all' ? 'active' : ''}" data-filter="all">Tất cả (${totalCount})</button>
            <button type="button" class="sw-filter-pill ${userFilterMode === 'pending' ? 'active' : ''}" data-filter="pending">Chờ duyệt (${pendingCount})</button>
            <button type="button" class="sw-filter-pill ${userFilterMode === 'active' ? 'active' : ''}" data-filter="active">Đang hoạt động (${activeCount})</button>
          </div>
          <input type="text" id="fbUserSearchInput" value="${escapeHtml(userSearchQuery)}" placeholder="🔍 Tìm tên, email hoặc trò chơi..." style="flex:1;min-width:190px;max-width:260px;padding:6px 11px;font-size:0.76rem;border-radius:999px;" />
        </div>

        <div style="font-size:0.73rem;color:var(--text-muted);line-height:1.4;">
          Chọn <b>Trò chơi được duyệt</b> rồi bấm <b>✓ Duyệt nhanh</b> (hoặc chỉnh Vai trò + tick Hoạt động + bấm <b>Lưu</b>). Người đăng nhập sẽ chỉ nhìn thấy giao diện Thông tin chung & Nhập liệu của đúng trò chơi đó.
        </div>

        <div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;">
          ${rows}
        </div>`;
    }

    panel.innerHTML = html;

    // Gắn sự kiện Đăng xuất
    const signOutBtn = panel.querySelector("#fbModalSignOut");
    if (signOutBtn) signOutBtn.onclick = () => signOut(auth);

    // Gắn sự kiện lọc & tìm kiếm
    panel.querySelectorAll(".sw-filter-pill").forEach(btn => {
      btn.onclick = () => {
        userFilterMode = btn.dataset.filter || "all";
        renderAccountPanel();
      };
    });

    const searchInput = panel.querySelector("#fbUserSearchInput");
    if (searchInput) {
      searchInput.oninput = (e) => {
        userSearchQuery = e.target.value;
        const pos = searchInput.selectionStart;
        renderAccountPanel();
        const newInput = document.getElementById("fbUserSearchInput");
        if (newInput) {
          newInput.focus();
          try { newInput.setSelectionRange(pos, pos); } catch (_) {}
        }
      };
    }

    // Sự kiện Duyệt nhanh 1 chạm
    panel.querySelectorAll(".fb-quick-approve").forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest(".fb-user-row");
        const roleSel = row.querySelector(".fb-role");
        const gameSel = row.querySelector(".fb-game");
        const chosenRole = roleSel.value === "pending" ? "operator" : roleSel.value;
        const chosenGame = gameSel.value || "MANG_TRUOT_1";
        btn.disabled = true;
        btn.textContent = "Đang duyệt...";
        try {
          await updateDoc(doc(db, "users", row.dataset.uid), {
            role: chosenRole,
            assignedGame: chosenGame,
            active: true
          });
          showAppToast(`✓ Đã duyệt tài khoản ${row.dataset.email} vào trò chơi: ${getGameNameById(chosenGame)}`);
        } catch (e) {
          showAppToast("Lỗi khi duyệt: " + (e.code || e.message));
          btn.disabled = false;
          btn.textContent = "✓ Duyệt nhanh";
        }
      };
    });

    // Sự kiện Lưu phân quyền
    panel.querySelectorAll(".fb-save").forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest(".fb-user-row");
        const role = row.querySelector(".fb-role").value;
        const assignedGame = row.querySelector(".fb-game").value;
        const active = role !== "pending" && row.querySelector(".fb-active").checked;
        btn.disabled = true;
        try {
          await updateDoc(doc(db, "users", row.dataset.uid), {
            role,
            assignedGame,
            active
          });
          showAppToast(`✓ Đã lưu phân quyền cho ${row.dataset.email} (${getGameNameById(assignedGame)})`);
        } catch (e) {
          showAppToast("Lỗi phân quyền: " + (e.code || e.message));
        } finally {
          btn.disabled = false;
        }
      };
    });

    // Sự kiện Xóa người dùng
    panel.querySelectorAll(".fb-delete").forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest(".fb-user-row");
        const email = row.dataset.email || "";
        if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${email}" khỏi danh sách người dùng?`)) return;
        try {
          await deleteDoc(doc(db, "users", row.dataset.uid));
          showAppToast(`✓ Đã xóa tài khoản ${email}`);
        } catch (e) {
          showAppToast("Không thể xóa tài khoản: " + (e.code || e.message));
        }
      };
    });
  }

  // ---------------------------------------------------------------- Đồng bộ dữ liệu
  function canWrite(gameId) {
    if (!profile) return false;
    if (profile.role === "admin" || profile.role === "manager") return true;
    if (profile.role === "operator") {
      if (profile.assignedGame === "ALL" || profile.assignedGame === gameId) return true;
      if (profile.assignedGame === "AIRSHIP" && (gameId === "AIRSHIP_1" || gameId === "AIRSHIP_2")) return true;
      if (profile.assignedGame === "RAP_3D" && (gameId === "RAP_3D_1" || gameId === "RAP_3D_2")) return true;
    }
    return false;
  }

  async function flushSync() {
    const ids = Array.from(dirtyGames);
    dirtyGames.clear();
    for (const gameId of ids) {
      const rec = appStore.games[gameId];
      if (!rec || !canWrite(gameId)) continue;
      if (Array.isArray(rec.cycles)) {
        rec.cycles = rec.cycles.filter(c => !c.bulkCycles && !(c.subType && c.subType.toLowerCase().includes("kế")));
      }
      try {
        await setDoc(doc(db, "games", gameId), {
          gameId,
          recordJson: JSON.stringify(rec),
          updatedBy: auth.currentUser.email,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Firestore sync error", gameId, e);
        showAppToast(`Không đồng bộ được ${gameId}: ${e.code || e.message}`);
      }
    }
  }

  function subscribeGames() {
    if (unsubGames) unsubGames();
    unsubGames = onSnapshot(collection(db, "games"), snap => {
      let changed = false;
      snap.docChanges().forEach(ch => {
        if (ch.type === "removed" || ch.doc.metadata.hasPendingWrites) return;
        const d = ch.doc.data();
        if (dirtyGames.has(d.gameId)) return;
        try {
          const rec = JSON.parse(d.recordJson);
          if (Array.isArray(rec.cycles)) {
            rec.cycles = rec.cycles.filter(c => !c.bulkCycles && !(c.subType && c.subType.toLowerCase().includes("kế")));
          }
          const recDate = rec.date || appStore.activeDate || new Date().toISOString().slice(0, 10);
          if (!appStore.historyByDate) appStore.historyByDate = {};
          if (!appStore.historyByDate[recDate]) appStore.historyByDate[recDate] = {};
          appStore.historyByDate[recDate][d.gameId] = rec;
          if (recDate === appStore.activeDate) {
            appStore.games[d.gameId] = rec;
          }
          changed = true;
        } catch (e) { console.warn("Bản ghi hỏng", d.gameId); }
      });
      if (changed) {
        applyingRemote = true;
        try {
          safeSetStorage(STORAGE_KEY, JSON.stringify(appStore));
          renderAll();
        } finally { applyingRemote = false; }
      }
    }, err => showAppToast("Lỗi đọc dữ liệu Cloud: " + (err.code || err.message)));
  }

  function subscribeUsers() {
    if (unsubUsers) unsubUsers();
    if (profile.role !== "admin") { renderAccountPanel(null); return; }
    unsubUsers = onSnapshot(collection(db, "users"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aPend = (a.role === "pending" || !a.active) ? 0 : 1;
          const bPend = (b.role === "pending" || !b.active) ? 0 : 1;
          return aPend - bPend;
        });
      renderAccountPanel(list);

      // Hiển thị số lượng chờ duyệt trên nút Admin ở Header nếu có
      const pendingCount = list.filter(u => u.role === "pending" || !u.active).length;
      const badgeTextEl = document.getElementById("headerAdminBadgeText");
      if (badgeTextEl && profile && profile.role === "admin") {
        badgeTextEl.textContent = pendingCount > 0
          ? `ADMIN (${pendingCount} chờ duyệt) • ${profile.name || profile.email}`
          : `ADMIN • ${profile.name || profile.email}`;
      }
    });
  }

  // ---------------------------------------------------------------- Áp quyền vào giao diện Web App
  function applyProfileToApp() {
    const isAdmin = profile.role === "admin";
    const googleName = (auth.currentUser && auth.currentUser.displayName) || profile.name || profile.email.split("@")[0];

    currentUserAccount = {
      code: isAdmin ? "ADMIN" : "NV",
      email: profile.email,
      name: googleName,
      role: ROLE_LABELS[profile.role] || profile.role,
      assignedGame: profile.assignedGame || "ALL",
      isAdmin
    };
    updateHeaderUserBadgeUI();

    // Áp dụng quy tắc phân quyền giao diện:
    // - Người đăng nhập chỉ xem giao diện tương ứng trò chơi được duyệt
    // - Chỉ thao tác tại Thông tin chung & Nhập liệu, khóa nút Xóa lịch sử
    // - Tên nhân viên vận hành trong Thông tin chung là tên đăng nhập của Google
    if (typeof applyAccountPrivileges === "function") {
      applyAccountPrivileges();
    }

    const assigned = profile.assignedGame || "ALL";
    let targetGame = assigned !== "ALL" ? assigned : (appStore.currentGameId || "MANG_TRUOT_1");
    if (targetGame === "AIRSHIP") targetGame = "AIRSHIP_1";
    if (targetGame === "RAP_3D") targetGame = "RAP_3D_1";

    const rec = appStore.games[targetGame];
    if (rec) {
      rec.staff = googleName;
      rec.staffRole = ROLE_LABELS[profile.role] || "NV Vận hành";
    }
    const staffInput = document.getElementById("staffName");
    if (staffInput) {
      staffInput.value = googleName;
      staffInput.readOnly = !isAdmin;
    }

    onGameChange();
    renderAll();
  }

  // ---------------------------------------------------------------- Luồng đăng nhập & lắng nghe phê duyệt Realtime
  const startAuthListener = () => onAuthStateChanged(auth, async user => {
    if (unsubSelfProfile) { unsubSelfProfile(); unsubSelfProfile = null; }
    if (unsubGames) { unsubGames(); unsubGames = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    profile = null;

    if (!user) {
      showGate("Sử dụng tài khoản Google cá nhân hoặc công việc để truy cập vào trò chơi được phân công.", {
        heading: "Đăng nhập hệ thống",
        signIn: true
      });
      return;
    }

    const googleDisplayName = user.displayName || user.email.split("@")[0];
    showGate(`Đang kiểm tra thông tin định danh <b>${escapeHtml(googleDisplayName)}</b> (${escapeHtml(user.email)})...`, {
      heading: "Đang xác thực..."
    });

    const email = (user.email || "").toLowerCase();
    const isSuper = SUPER_ADMIN_EMAILS.includes(email);
    const ref = doc(db, "users", user.uid);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: user.email,
          name: googleDisplayName,
          photoURL: user.photoURL || "",
          role: isSuper ? "admin" : "pending",
          active: isSuper,
          assignedGame: "ALL",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } else {
        const curData = snap.data() || {};
        const updates = { lastLoginAt: serverTimestamp() };
        if (user.displayName && curData.name !== user.displayName) {
          updates.name = user.displayName;
        }
        if (user.photoURL && curData.photoURL !== user.photoURL) {
          updates.photoURL = user.photoURL;
        }
        if (isSuper && (curData.role !== "admin" || !curData.active)) {
          updates.role = "admin";
          updates.active = true;
        }
        await updateDoc(ref, updates);
      }
    } catch (e) {
      showGate(`Không đọc được hồ sơ người dùng (${escapeHtml(e.code || e.message)}).<br>Kiểm tra kết nối mạng hoặc quyền truy cập Cloud Firestore.`, {
        heading: "Lỗi kết nối dữ liệu",
        signOutBtn: true
      });
      return;
    }

    // Lắng nghe thời gian thực hồ sơ của chính người đăng nhập:
    // Ngay khi Admin bấm Duyệt hoặc đổi Trò chơi phân công, giao diện tự động cập nhật ngay lập tức!
    let wasApproved = false;
    unsubSelfProfile = onSnapshot(ref, docSnap => {
      if (!docSnap.exists()) {
        showGate("Hồ sơ tài khoản của bạn đã bị xóa bởi Quản trị viên.", {
          heading: "Tài khoản không tồn tại",
          signOutBtn: true
        });
        return;
      }
      profile = { ...docSnap.data(), uid: user.uid };
      if (user.displayName) profile.name = user.displayName;

      const approved = profile.active === true && ["admin", "manager", "operator"].includes(profile.role);
      if (!approved) {
        wasApproved = false;
        if (unsubGames) { unsubGames(); unsubGames = null; }
        if (unsubUsers) { unsubUsers(); unsubUsers = null; }
        showGate(
          `Yêu cầu đăng nhập của bạn đã được gửi tới Quản trị viên (Admin).<br>Vui lòng chờ Admin chọn trò chơi phụ trách và kích hoạt tài khoản.`,
          {
            heading: "Chờ Admin phê duyệt",
            signOutBtn: true,
            pendingUser: profile
          }
        );
        return;
      }

      hideGate();
      setupAccountModal();
      applyProfileToApp();
      renderAccountPanel();

      if (!wasApproved) {
        wasApproved = true;
        subscribeGames();
        subscribeUsers();
        const gameLabel = getGameNameById(profile.assignedGame || "ALL");
        showAppToast(`✓ Xin chào ${profile.name}! Đã mở giao diện: ${gameLabel}`);
      }
    }, err => {
      showGate(`Lỗi đồng bộ hồ sơ (${escapeHtml(err.code || err.message)}).`, {
        heading: "Lỗi xác thực",
        signOutBtn: true
      });
    });
  });

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => setTimeout(startAuthListener, 0));
  } else {
    startAuthListener();
  }

  // ---------------------------------------------------------------- API cho index.html
  window.SWFirebase = {
    enabled: true,
    signInGoogle: () => signInWithPopup(auth, provider).catch(err => {
      showAppToast("Đăng nhập Google thất bại: " + (err.code || err.message));
    }),
    queueSync() {
      if (applyingRemote || !profile) return;
      if (appStore.currentGameId) dirtyGames.add(appStore.currentGameId);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(flushSync, 1200);
    },
    signOut: () => signOut(auth)
  };
}
