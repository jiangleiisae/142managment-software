import { extname } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

/// QTG/MQTG文档上传校验 (需求清单5.4)。缓冲在内存里(而非落盘)后交给 FileStorage 抽象持久化
/// (本地磁盘或S3/OSS, 见 ../storage/), 这样存储后端的切换不需要改这里的 multer 配置。
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg']);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const qtgFileUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new BadRequestException(`不支持的文件类型 ${ext}, 仅支持: ${[...ALLOWED_EXTENSIONS].join(', ')}`), false);
      return;
    }
    cb(null, true);
  },
};
