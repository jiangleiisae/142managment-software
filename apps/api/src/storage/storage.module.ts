import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import { S3Storage } from './s3.storage.js';

/// STORAGE_DRIVER=local(默认) | s3. 见 DEPLOYMENT.md 里对应的环境变量说明。
function createFileStorage() {
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 's3') {
    const required = (name: string) => {
      const value = process.env[name];
      if (!value) throw new Error(`STORAGE_DRIVER=s3 需要设置环境变量 ${name}`);
      return value;
    };
    return new S3Storage({
      bucket: required('S3_BUCKET'),
      region: process.env.S3_REGION ?? 'auto',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      keyPrefix: 'qtg-documents/',
    });
  }
  return new LocalDiskStorage(join(process.cwd(), 'uploads', 'qtg-documents'));
}

@Module({
  providers: [{ provide: FILE_STORAGE, useFactory: createFileStorage }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
