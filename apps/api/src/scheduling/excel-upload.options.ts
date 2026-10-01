import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { memoryStorage } from 'multer';

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, 远超单个排班登记表的合理大小

export const scheduleExcelUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new BadRequestException(`不支持的文件类型 ${ext}, 仅支持 .xlsx / .xls`), false);
      return;
    }
    cb(null, true);
  },
};
