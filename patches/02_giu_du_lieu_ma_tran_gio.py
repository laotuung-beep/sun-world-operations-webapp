"""Patch 02 - stop cloud sync from wiping the hour matrix ("ma trận giờ").

Áp dụng SAU patch 01 (01_google_only.py) lên public/assets/index-mangtruot-*.js.

Lỗi gốc:
  1. Mỗi lần đăng nhập app tự chạy Migration: đẩy số liệu trong máy của MỌI ngày, cả 6 line,
     lên Firestore. Máy trống (máy mới, trình duyệt khác) => số 0 đè lên số thật, rồi realtime
     kéo số 0 về mọi máy. Cờ "đã migrate" chỉ bật khi mọi ngày thành công, nên khi rules còn
     chặn thì nó chạy lại ở MỖI lần tải trang.
  2. Tài khoản quản lý sửa 1 ô là ghi lại cả 6 line từ bản trong máy => line chưa kịp nhận
     dữ liệu từ máy khác bị ghi đè bằng 0.
  3. Bộ nghe realtime ghi đè cả những line đang chờ đẩy lên (hàng đợi ngoại tuyến), và tự
     đặt lastUpdated = bây giờ khiến bản trong máy luôn "mới hơn" Cloud.
  4. Máy chưa có số liệu tạo báo cáo rỗng với lastUpdated = bây giờ => thắng Cloud và đẩy
     số khách / doanh thu = 0 lên.
"""
import sys

path = sys.argv[1]
t = open(path, encoding="utf-8").read()


def replace_once(old, new, label):
    global t
    n = t.count(old)
    if n != 1:
        sys.exit(f"[{label}] expected 1 match, found {n}")
    t = t.replace(old, new)
    print("ok", label)


# 1. Bỏ Migration tự động khi đăng nhập.
replace_once('T&&IY().catch(ie=>console.warn("Lỗi migration:",ie));', "", "no-auto-migration")

# 2. Chỉ ghi những line thực sự thay đổi (và thuộc quyền của tài khoản).
replace_once(
    '(te===1||(ee==null?void 0:ee.role)==="admin")&&(Rr(t,"line1",1,I).catch(()=>{}),Rr(t,"line2",1,I).catch(()=>{})),'
    '(te===2||(ee==null?void 0:ee.role)==="admin")&&(Rr(t,"line3",2,I).catch(()=>{}),Rr(t,"line4",2,I).catch(()=>{})),'
    '(te===3||(ee==null?void 0:ee.role)==="admin")&&(Rr(t,"line5",3,I).catch(()=>{}),Rr(t,"line6",3,I).catch(()=>{}))},E=I=>',
    'const __ad=(ee==null?void 0:ee.role)==="admin",'
    '__w=(l,g)=>(__ad||te===g)&&JSON.stringify(K5(l,n.hourSlots))!==JSON.stringify(K5(l,I))&&Rr(t,l,g,I).catch(()=>{});'
    '__w("line1",1),__w("line2",1),__w("line3",2),__w("line4",2),__w("line5",3),__w("line6",3)},E=I=>',
    "write-changed-lines-only",
)

# 3. Realtime: không đè line đang chờ đẩy lên, không tự nâng lastUpdated.
replace_once(
    'o.docChanges().forEach(m=>{if(m.type==="added"||m.type==="modified"){const p=m.doc.data();c=eH(c,p)}});'
    'const h={...u,hourSlots:c,lastUpdated:Date.now()};da(h),e(h),br("synced")}',
    'const __q=uu();o.docChanges().forEach(m=>{if(m.type==="added"||m.type==="modified"){const p=m.doc.data();'
    '__q.some(__x=>__x.action==="UPDATE_LINE"&&__x.date===t&&__x.lineId===p.lineId)||(c=eH(c,p))}});'
    'const h={...u,hourSlots:c};try{localStorage.setItem($5+t,JSON.stringify(h))}catch{}'
    'e(h),br(__q.length>0?"offline_pending":"synced")}',
    "listener-keep-pending",
)

# 4. Báo cáo rỗng mới tạo không được "mới hơn" Cloud.
replace_once(
    'const e=r2(t);return da(e),e}function pc(',
    'const e=r2(t);da(e),e.lastUpdated=0;try{localStorage.setItem($5+t,JSON.stringify(e))}catch{}return e}function pc(',
    "blank-report-is-oldest",
)

open(path, "w", encoding="utf-8", newline="").write(t)
print("patched", path)
