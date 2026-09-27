import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';

/// QTG/MQTG文档本地磁盘存储 (需求清单5.4: 一期先落地磁盘, 未来可平移为S3/R2对象存储而不改变上层接口)
export const QTG_UPLOAD_DIR = join(process.cwd(), 'uploads', 'qtg-documents');

if (!existsSync(QTG_UPLOAD_DIR)) {
  mkdirSync(QTG_UPLOAD_DIR, { recursive: true });
}

// 允许的文档类型: PDF/Word/Excel/纯文本/图片扫描件, 不允许可执行文件
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg']);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const qtgFileUploadOptions = {
  storage: diskStorage({
    destination: QTG_UPLOAD_DIR,
    // 服务端生成随机文件名, 不采用用户提供的原始文件名, 避免路径穿越/文件名冲突
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
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
