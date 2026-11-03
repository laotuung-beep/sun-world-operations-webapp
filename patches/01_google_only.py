"""Patch the built Máng Trượt bundle: Google sign-in only, no station password / anonymous auth."""
import sys

path = sys.argv[1]
t = open(path, encoding="utf-8").read()

SUPER_ADMINS = '["phongbanana96@gmail.com","laotuung@gmail.com","laoung1996@gmail.com","dieuhanh.mangtruot@gmail.com"]'
PERM_TOAST = ('h&&h.code==="permission-denied"&&vs.error("Gmail này chưa được cấp quyền ghi số liệu. '
              'Nhờ quản lý duyệt tài khoản trong Firestore (users → approved = true).",{id:"perm-denied"}),')


def replace_once(old, new, label):
    global t
    n = t.count(old)
    if n != 1:
        sys.exit(f"[{label}] expected 1 match, found {n}")
    t = t.replace(old, new)
    print("ok", label)


def cut_between(start, end, label):
    """Remove text from `start` (inclusive) up to `end` (exclusive)."""
    global t
    if t.count(start) != 1:
        sys.exit(f"[{label}] start matched {t.count(start)} times")
    i = t.index(start)
    j = t.index(end, i)
    t = t[:i] + t[j:]
    print("ok", label, f"({j - i} chars removed)")


# 1. Station login no longer signs in to Firebase (no password / anonymous fallback).
#    It is still used by the header to switch máng locally.
replace_once(
    'return q5(o),GB(r.id,i).catch(u=>{console.warn("Lỗi đồng bộ Firebase Auth cho trạm:",u)}),{success:!0',
    'return q5(o),{success:!0',
    "l2-no-firebase",
)

# 2. Google sign-in picks the operator account of the chosen máng (admin for super admins),
#    so the app knows which lines this device writes and the session survives reloads.
replace_once(
    'let V=e;N.email==="phongbanana96@gmail.com"&&(V=1),',
    'let V=e;const __sa=' + SUPER_ADMINS + '.includes((N.email||"").toLowerCase());'
    'q5(__sa?Z0.find(__o=>__o.role==="admin"):Z0.find(__o=>__o.role==="operator"&&__o.mang===V)),',
    "google-login-account",
)

# 3. Login card: drop the ID / password fields, the "Let's Go" button and the "HOẶC" divider.
cut_between(
    'C.jsxs("div",{children:[C.jsx("label",{className:"text-[11px] font-medium text-zinc-300 block mb-1",children:"Tên đăng nhập (ID)"})',
    'v&&C.jsxs(qn.div,{initial:{opacity:0,y:-4}',
    "remove-id-password-fields",
)
cut_between(
    'C.jsxs("button",{type:"submit",className:"w-full py-3 rounded-xl font-bold text-sm',
    'C.jsxs("button",{type:"button",onClick:k,disabled:R',
    "remove-letsgo-and-divider",
)
replace_once(
    'children:"CHỌN NHANH MÁNG TRỰC:"',
    'children:"1. CHỌN MÁNG TRỰC — 2. ĐĂNG NHẬP GOOGLE:"',
    "login-hint",
)

# 4. No Firebase user (signed out / session expired) -> back to the login screen.
replace_once('KB(ie=>{v(ie)})', 'KB(ie=>{v(ie),ie||q5(null)})', "auth-null-logout")

# 5. Surface permission errors instead of silently queueing forever.
replace_once(
    'console.warn(`Lỗi ghi trực tiếp ${e}, chuyển vào hàng đợi ngoại tuyến:`,h),',
    PERM_TOAST + 'console.warn(`Lỗi ghi trực tiếp ${e}, chuyển vào hàng đợi ngoại tuyến:`,h),',
    "toast-line-write",
)
replace_once(
    'console.warn("Lỗi ghi thông số quản lý, chuyển vào hàng đợi:",r),',
    PERM_TOAST.replace("h&&h.code", "r&&r.code") + 'console.warn("Lỗi ghi thông số quản lý, chuyển vào hàng đợi:",r),',
    "toast-meta-write",
)
replace_once(
    'console.warn("Realtime Listener lines fallback:",o)',
    'o&&o.code==="permission-denied"&&vs.error("Gmail này chưa được cấp quyền xem số liệu. Nhờ quản lý duyệt tài khoản.",{id:"perm-denied"}),console.warn("Realtime Listener lines fallback:",o)',
    "toast-listener",
)

open(path, "w", encoding="utf-8", newline="").write(t)
print("patched", path)
