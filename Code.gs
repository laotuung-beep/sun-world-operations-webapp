// ============================================================================
// GOOGLE APPS SCRIPT CHUẨN KHOA HỌC - SUN WORLD OPERATIONS DATA WAREHOUSE
// Tự động tạo 4 Sheet chuẩn BI, cố định Header màu đỏ #D71920, tạo Bộ lọc Filter
// và cập nhật thông minh theo Khóa chính (Upsert - Không bao giờ bị nhân đôi dòng)
// ============================================================================

function ensureSheetWithSchema(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    var headerRange = sh.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#D71920")
               .setFontColor("#FFFFFF")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
    sh.setFrozenRows(1);
    if (!sh.getFilter()) {
      headerRange.createFilter();
    }
  }
  return sh;
}

// Hàm Upsert thông minh: Nếu Mã ID đã tồn tại thì cập nhật dòng đó, nếu chưa có thì thêm mới
function upsertRowsByKey(sh, rowsData) {
  if (!rowsData || rowsData.length === 0) return;
  var lastRow = sh.getLastRow();
  var keyRowMap = {};
  if (lastRow > 1) {
    var existingKeys = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < existingKeys.length; i++) {
      keyRowMap[String(existingKeys[i][0])] = i + 2;
    }
  }
  var newRows = [];
  rowsData.forEach(function(row) {
    var key = String(row[0]);
    var targetRowIdx = keyRowMap[key];
    if (targetRowIdx) {
      sh.getRange(targetRowIdx, 1, 1, row.length).setValues([row]);
    } else {
      newRows.push(row);
    }
  });
  if (newRows.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = JSON.parse(e.postData.contents);
  var syncTime = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  // 1. SHEET 1: TỔNG HỢP CA TRỰC (25 CỘT KHOA HỌC - CHUẨN PIVOT & LOOKER STUDIO)
  var shShift = ensureSheetWithSchema(ss, "1_TONG_HOP_CA_TRUC", [
    "Ma_Ca_ID", "Ngay_VH", "Thu_Trong_Tuan", "Tuan_ISO", "Thang_Nam",
    "Ma_Tro_Choi", "Ten_Tro_Choi", "Nhom_Tro_Choi",
    "Ma_NV", "Ho_Ten_NV", "Vai_Tro_NV",
    "Gio_Mo_Cua", "Gio_Dong_Cua",
    "Tong_Phut_Mo_Cua", "So_Lan_Dung", "Tong_Phut_Dung", "Phut_VH_Thuc_Te", "Gio_VH_Thuc_Te_Text", "Hieu_Suat_OEE_Pct",
    "Tong_So_Luot", "So_Xe_Don", "So_Xe_Doi", "Tong_Khach",
    "Khach_TB_Moi_Luot", "Nang_Suat_Khach_Gio", "Ty_Le_Khach_Qua_Cong_Pct", "Thoi_Gian_Dong_Bo"
  ]);
  var shiftRows = (payload.shifts || []).map(function(s) {
    return [
      s.shiftId, s.date, s.dayOfWeek, s.isoWeek, s.yearMonth,
      s.gameId, s.gameName, s.gameGroup,
      s.staffCode, s.staff, s.staffRole,
      s.openTime, s.closeTime,
      s.grossMin, s.downtimeCount, s.totalDowntimeMin, s.netMin, s.netHoursText, s.oeePct,
      s.totalCycles, s.singleCars, s.doubleCars, s.totalPax,
      s.avgPaxPerCycle, s.paxPerHour, s.gateSharePct, syncTime
    ];
  });
  upsertRowsByKey(shShift, shiftRows);

  // 2. SHEET 2: NHẬT KÝ NGỪNG VẬN HÀNH (16 CỘT PHÂN TÍCH PARETO SỰ CỐ)
  var shDt = ensureSheetWithSchema(ss, "2_NHAT_KY_NGUNG_VH", [
    "Ma_Su_Co_ID", "Ma_Ca_ID", "Ngay_VH", "Tuan_ISO", "Thang_Nam",
    "Ma_Tro_Choi", "Ten_Tro_Choi", "Ma_NV", "Ho_Ten_NV",
    "Nhom_Nguyen_Nhan", "Loai_Dung_Chi_Tiet",
    "Gio_Bat_Dau", "Gio_Ket_Thuc", "So_Phut_Dung", "Ghi_Chu_Ky_Thuat", "Thoi_Gian_Dong_Bo"
  ]);
  var dtRows = (payload.downtimes || []).map(function(d) {
    return [
      d.id, d.shiftId, d.date, d.isoWeek, d.yearMonth,
      d.gameId, d.gameName, d.staffCode, d.staff,
      d.reasonGroup, d.reason,
      d.start, d.end, d.durationMin, d.note, syncTime
    ];
  });
  upsertRowsByKey(shDt, dtRows);

  // 3. SHEET 3: CHI TIẾT LƯỢT CHƠI & CHU KỲ (16 CỘT ĐO GIỜ CAO ĐIỂM & CÔNG SUẤT TẢI)
  var shCy = ensureSheetWithSchema(ss, "3_CHI_TIET_LUOT_CHOI", [
    "Ma_Luot_ID", "Ma_Ca_ID", "Ngay_VH", "Khung_Gio_Slot",
    "Ma_Tro_Choi", "Ten_Tro_Choi", "Khu_Vuc_Line_Rap",
    "Luot_So", "Phan_Loai_Xe_Dot",
    "Gio_Bat_Dau_Xuat_Phat", "Gio_Ket_Thuc",
    "Chu_Ky_Giay", "Chu_Ky_MMSS", "Cong_Suat_Uoc_Tinh_Gio", "So_Khach", "Ho_Ten_NV"
  ]);
  var cyRows = (payload.cycles || []).map(function(c) {
    return [
      c.id, c.shiftId, c.date, c.hourSlot,
      c.gameId, c.gameName, c.subArea || "Toàn khu",
      c.cycleNo, c.subType,
      c.start, c.end,
      c.durationSec, c.durationMMSS, c.estCapPerHour, c.pax, c.staff
    ];
  });
  upsertRowsByKey(shCy, cyRows);

  // 4. SHEET 4: THỐNG KÊ CHUYÊN SÂU LINE 1-6 (MÁNG TRƯỢT) & RẠP 1-2 (AIRSHIP) (13 CỘT)
  var shLn = ensureSheetWithSchema(ss, "4_THONG_KE_LINE_RAP", [
    "Ma_Line_Ca_ID", "Ngay_VH", "Thang_Nam",
    "Ma_Tro_Choi", "Ten_Tro_Choi", "Khu_Vuc_Line_Rap",
    "Tong_Chuyen_Luot", "So_Xe_Don", "So_Xe_Doi", "Tong_Khach_Line",
    "Gian_Cach_TB_Giay", "Cong_Suat_Xe_Gio", "Ty_Trong_Khach_Line_Pct"
  ]);
  var lnRows = (payload.lineSummaries || []).map(function(l) {
    return [
      l.lineShiftId, l.date, l.yearMonth,
      l.gameId, l.gameName, l.subArea,
      l.totalTrips, l.singleCars, l.doubleCars, l.totalPax,
      l.avgIntervalSec, l.carsPerHour, l.sharePct
    ];
  });
  upsertRowsByKey(shLn, lnRows);

  // 5. SHEET SNAPSHOT ĐỒNG BỘ 2 CHIỀU VỀ MÁY QUẢN LÝ / DASHBOARD
  var shSnap = ss.getSheetByName("0_SNAPSHOT_JSON") || ss.insertSheet("0_SNAPSHOT_JSON");
  shSnap.clear();
  shSnap.getRange(1, 1).setValue(JSON.stringify(payload));

  return ContentService.createTextOutput(JSON.stringify({ status: "ok", syncedAt: syncTime }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shSnap = ss.getSheetByName("0_SNAPSHOT_JSON");
  var raw = (shSnap && shSnap.getLastRow() > 0) ? shSnap.getRange(1, 1).getValue() : "{}";
  return ContentService.createTextOutput(raw).setMimeType(ContentService.MimeType.JSON);
}
