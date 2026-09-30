import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Readable } from 'node:stream';
import type { FileStorage } from './file-storage.interface.js';

/// 一期默认存储后端: 本地磁盘。单机部署没问题, 多实例横向扩展前需要切到 S3StorageService (见
/// s3.storage.ts, 通过 STORAGE_DRIVER=s3 启用)。
export class LocalDiskStorage implements FileStorage {
  constructor(private readonly rootDir: string) {
    // 同步创建是故意的: 构造函数里保证目录存在, 避免每次 save() 都要判断
    mkdirSync(this.rootDir, { recursive: true });
  }

  async save(buffer: Buffer, meta: { originalName: string }): Promise<string> {
    const ext = extname(meta.originalName).toLowerCase();
    const key = `${randomUUID()}${ext}`;
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(join(this.rootDir, key), buffer);
    return key;
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(join(this.rootDir, key));
  }
}
