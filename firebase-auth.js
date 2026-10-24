// =============================================================================
// SUN WORLD OPERATIONS — FIREBASE AUTH (GOOGLE) + ĐỒNG BỘ CLOUD FIRESTORE
// Chỉ kích hoạt khi firebase-config.js có apiKey. Khi kích hoạt:
//   • Bắt buộc đăng nhập Google mới vào được app (màn chắn toàn trang).
//   • Gmail Super Admin được toàn quyền; user khác phải được Admin duyệt.
//   • NV vận hành bị khóa vào đúng trò chơi được phân công.
//   • Dữ liệu từng trò chơi đồng bộ realtime lên collection "games".
// Quyền thật sự được thực thi phía server bởi firestore.rules.
// =============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot, serverTimestamp
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
  let unsubGames = null;
  let unsubUsers = null;
  let applyingRemote = false;
  let syncTimer = null;
  const dirtyGames = new Set();

  // ---------------------------------------------------------------- UI: màn chắn đăng nhập Google
  const gate = document.createElement("div");
  gate.id = "fbAuthGate";
  gate.style.cssText = "position:fixed;inset:0;z-index:2000;background:var(--bg,#0f172a);display:flex;align-items:center;justify-content:center;padding:16px;";
  gate.innerHTML = `
    <div class="login-modal-card" style="max-width:420px;text-align:center;display:flex;flex-direction:column;gap:14px;padding:24px;">
      <div style="font-size:1.1rem;font-weight:800;color:#C0262D;letter-spacing:0.3px;">SUN WORLD — VẬN HÀNH TRÒ CHƠI</div>
      <div id="fbGateMsg" style="font-size:0.84rem;color:var(--text-muted);line-height:1.5;">Vui lòng đăng nhập bằng tài khoản Google đã được cấp quyền.</div>
      <button type="button" id="fbGateSignIn" class="btn btn-primary" style="justify-content:center;padding:12px;font-size:0.9rem;font-weight:700;display:none;">
        <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right:8px;"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"/></svg>
        Đăng nhập bằng Google
      </button>
      <button type="button" id="fbGateSignOut" class="btn btn-outline" style="justify-content:center;display:none;">Đăng xuất / Đổi tài khoản</button>
    </div>`;
  document.body.appendChild(gate);
  const gateMsg = gate.querySelector("#fbGateMsg");
  const gateIn = gate.querySelector("#fbGateSignIn");
  const gateOut = gate.querySelector("#fbGateSignOut");

  gateIn.onclick = () => signInWithPopup(auth, provider).catch(err => {
    gateMsg.textContent = "Đăng nhập thất bại: " + (err.code || err.message);
  });
  gateOut.onclick = () => signOut(auth);

  function showGate(msg, { signIn = false, signOutBtn = false } = {}) {
    gate.style.display = "flex";
    gateMsg.innerHTML = msg;
    gateIn.style.display = signIn ? "flex" : "none";
    gateOut.style.display = signOutBtn ? "flex" : "none";
  }
  function hideGate() { gate.style.display = "none"; }

  // ---------------------------------------------------------------- UI: modal tài khoản
  function setupAccountModal() {
    const card = document.querySelector("#loginModalBackdrop .login-modal-card");
    if (!card || card.querySelector("#fbAccountPanel")) return;
    Array.from(card.children).forEach((el, i) => { if (i > 0) el.style.display = "none"; });
    const panel = document.createElement("div");
    panel.id = "fbAccountPanel";
    panel.style.cssText = "display:flex;flex-direction:column;gap:10px;";
    card.appendChild(panel);
  }

  function renderAccountPanel(users) {
    const panel = document.getElementById("fbAccountPanel");
    if (!panel || !profile) return;
    const isAdmin = profile.role === "admin";
    const gameOpts = (selected) =>
      `<option value="ALL" ${selected === "ALL" ? "selected" : ""}>Toàn khu (ALL)</option>` +
      ALL_GAMES.map(g => `<option value="${g.id}" ${g.id === selected ? "selected" : ""}>${g.name}</option>`).join("");
    const roleOpts = (selected) => ["pending", "operator", "manager", "admin"]
      .map(r => `<option value="${r}" ${r === selected ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("");

    let html = `
      <div style="font-size:0.8rem;">
        <div><b>${escapeHtml(profile.name || "")}</b></div>
        <div style="color:var(--text-muted);">${escapeHtml(profile.email)} • ${ROLE_LABELS[profile.role] || profile.role}</div>
      </div>
      <button type="button" class="btn btn-outline" id="fbModalSignOut" style="justify-content:center;">Đăng xuất</button>`;

    if (isAdmin && users) {
      const rows = users.map(u => `
        <div class="fb-user-row" data-uid="${u.id}" style="border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:0.75rem;"><b>${escapeHtml(u.name || "")}</b> — ${escapeHtml(u.email || "")}
            ${u.role === "pending" ? '<span style="color:#C0262D;font-weight:700;"> • CHỜ DUYỆT</span>' : ""}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <select class="fb-role" style="flex:1;min-width:120px;">${roleOpts(u.role)}</select>
            <select class="fb-game" style="flex:1;min-width:120px;">${gameOpts(u.assignedGame || "ALL")}</select>
            <label style="font-size:0.72rem;display:flex;gap:4px;align-items:center;"><input type="checkbox" class="fb-active" ${u.active ? "checked" : ""}/>Hoạt động</label>
            <button type="button" class="btn btn-primary fb-save" style="padding:5px 10px;font-size:0.72rem;">Lưu</button>
          </div>
        </div>`).join("");
      html += `
        <div style="font-size:0.78rem;font-weight:800;margin-top:6px;">QUẢN LÝ NGƯỜI DÙNG (${users.length})</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">Nhân viên đăng nhập Google lần đầu sẽ xuất hiện ở đây với trạng thái "Chờ duyệt". Chọn vai trò, trò chơi, tick "Hoạt động" rồi bấm Lưu.</div>
        <div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">${rows}</div>`;
    }
    panel.innerHTML = html;
    panel.querySelector("#fbModalSignOut").onclick = () => signOut(auth);
    panel.querySelectorAll(".fb-save").forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest(".fb-user-row");
        const role = row.querySelector(".fb-role").value;
        try {
          await updateDoc(doc(db, "users", row.dataset.uid), {
            role,
            assignedGame: row.querySelector(".fb-game").value,
            active: role !== "pending" && row.querySelector(".fb-active").checked
          });
          showAppToast("✓ Đã cập nhật phân quyền người dùng.");
        } catch (e) {
          showAppToast("Lỗi phân quyền: " + (e.code || e.message));
        }
      };
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------------------------------------------------------------- Đồng bộ dữ liệu
  function canWrite(gameId) {
    if (!profile) return false;
    if (profile.role === "admin" || profile.role === "manager") return true;
    return profile.role === "operator" && profile.assignedGame === gameId;
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
        if (dirtyGames.has(d.gameId)) return; // đang có thay đổi cục bộ chưa gửi
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
        .sort((a, b) => (a.role === "pending" ? -1 : 0) - (b.role === "pending" ? -1 : 0));
      renderAccountPanel(list);
    });
  }

  // ---------------------------------------------------------------- Áp quyền vào app
  function applyProfileToApp() {
    const isAdmin = profile.role === "admin";
    currentUserAccount = {
      code: isAdmin ? "ADMIN" : profile.role.toUpperCase(),
      email: profile.email,
      name: profile.name || profile.email,
      role: ROLE_LABELS[profile.role] || profile.role,
      assignedGame: profile.assignedGame || "ALL",
      isAdmin
    };
    updateHeaderUserBadgeUI();

    const gameSel = document.getElementById("gameSelect");
    const dashSel = document.getElementById("dashGameSelect");
    if (profile.role === "operator" && profile.assignedGame && profile.assignedGame !== "ALL") {
      gameSel.value = profile.assignedGame;
      gameSel.disabled = true;
      const rec = appStore.games[profile.assignedGame];
      if (rec) { rec.staff = currentUserAccount.name; rec.staffRole = "NV Vận hành"; }
      document.getElementById("staffName").value = currentUserAccount.name;
      onGameChange();
    } else {
      gameSel.disabled = false;
      if (dashSel) dashSel.disabled = false;
    }
  }

  // ---------------------------------------------------------------- Luồng đăng nhập
  const startAuthListener = () => onAuthStateChanged(auth, async user => {
    if (unsubGames) { unsubGames(); unsubGames = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    profile = null;

    if (!user) {
      showGate("Vui lòng đăng nhập bằng tài khoản Google đã được cấp quyền.", { signIn: true });
      return;
    }
    showGate(`Đang xác thực <b>${escapeHtml(user.email)}</b>...`);

    const email = (user.email || "").toLowerCase();
    const isSuper = SUPER_ADMIN_EMAILS.includes(email);
    const ref = doc(db, "users", user.uid);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: user.email,
          name: user.displayName || "",
          photoURL: user.photoURL || "",
          role: isSuper ? "admin" : "pending",
          active: isSuper,
          assignedGame: "ALL",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } else if (isSuper && (snap.data().role !== "admin" || !snap.data().active)) {
        await updateDoc(ref, { role: "admin", active: true, lastLoginAt: serverTimestamp() });
      } else {
        await updateDoc(ref, { lastLoginAt: serverTimestamp() });
      }
      profile = { ...(await getDoc(ref)).data(), uid: user.uid };
    } catch (e) {
      showGate(`Không đọc được hồ sơ người dùng (${escapeHtml(e.code || e.message)}).<br>Kiểm tra Firestore đã được tạo và rules đã deploy.`, { signOutBtn: true });
      return;
    }

    const approved = profile.active === true && ["admin", "manager", "operator"].includes(profile.role);
    if (!approved) {
      showGate(`Tài khoản <b>${escapeHtml(user.email)}</b> đang <b>chờ Admin duyệt</b>.<br>Liên hệ quản trị viên để được cấp quyền.`, { signOutBtn: true });
      return;
    }

    hideGate();
    setupAccountModal();
    applyProfileToApp();
    subscribeGames();
    subscribeUsers();
    showAppToast(`✓ Đã đăng nhập: ${user.email} (${ROLE_LABELS[profile.role]})`);
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
