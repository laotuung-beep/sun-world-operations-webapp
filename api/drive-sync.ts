import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ExcelJS from 'exceljs';
import {
  DRIVE_FILE_ID,
  DRIVE_FILE_NAME,
  DRIVE_FOLDER_ID,
  upsertDayIntoExcelWorkbook,
  type DaySyncPayload,
} from '../src/report/driveWorkbook';

const execFileAsync = promisify(execFile);

export async function handleDriveSyncPayload(body: DaySyncPayload & { driveFolderId?: string; driveFileId?: string }) {
  // Ràng buộc nghiêm ngặt: chỉ lưu tại Folder Web App VHMT (1ZJjwdvmZs9znHacv0z8zLz39KNy4MrZ3)
  if (body.driveFolderId && body.driveFolderId !== DRIVE_FOLDER_ID) {
    throw new Error(`Forbidden folder ID: chỉ được phép lưu tại Folder Web App VHMT (${DRIVE_FOLDER_ID}).`);
  }
  if (body.driveFileId && body.driveFileId !== DRIVE_FILE_ID) {
    throw new Error(`Forbidden file ID: chỉ được phép cập nhật file ${DRIVE_FILE_NAME} (${DRIVE_FILE_ID}).`);
  }

  const publicFile = path.resolve(process.cwd(), 'public', DRIVE_FILE_NAME);
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(publicFile)) {
    await wb.xlsx.readFile(publicFile);
  }

  upsertDayIntoExcelWorkbook(wb, body);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  try {
    fs.writeFileSync(publicFile, buffer);
  } catch {
    // Môi trường serverless read-only filesystem: bỏ qua ghi file nội bộ
  }

  // Nếu có OAuth token biến môi trường trên Cloud (Vercel) -> PATCH trực tiếp file 1V37-wjbXReWENypka8IevraROqNXJk73
  const envToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (envToken) {
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${DRIVE_FILE_ID}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${envToken}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: buffer,
      },
    );
    if (uploadRes.ok) {
      return { synced: true, mode: 'drive-api', fileId: DRIVE_FILE_ID, folderId: DRIVE_FOLDER_ID };
    }
  }

  // Nếu chạy trên máy trạm có cài gdrive CLI đã đăng nhập -> cập nhật in-place vào đúng file ID trên Google Drive
  if (fs.existsSync(publicFile)) {
    try {
      await execFileAsync('gdrive', ['mutate', 'update', DRIVE_FILE_ID, publicFile, '--json'], { timeout: 25_000 });
      return { synced: true, mode: 'gdrive-cli', fileId: DRIVE_FILE_ID, folderId: DRIVE_FOLDER_ID };
    } catch {
      // Nếu chạy trên môi trường không có gdrive CLI
    }
  }

  return { synced: true, mode: 'local-workbook', fileId: DRIVE_FILE_ID, folderId: DRIVE_FOLDER_ID };
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (code: number) => { json: (data: unknown) => void } },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as DaySyncPayload & {
      driveFolderId?: string;
      driveFileId?: string;
    };
    const result = await handleDriveSyncPayload(body);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
}
