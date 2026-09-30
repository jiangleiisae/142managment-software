import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileStorage } from './file-storage.interface.js';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /// key 前缀, 用于在同一个bucket里按模块分区 (如 'qtg-documents/'), 避免不同用途的文件混在bucket根目录。
  keyPrefix?: string;
}

/// 通用 S3 协议存储后端: 同时兼容 AWS S3、Cloudflare R2、阿里云/腾讯云OSS的S3兼容模式、自建MinIO等,
/// 通过 endpoint + forcePathStyle 适配非AWS的S3兼容服务。通过 STORAGE_DRIVER=s3 启用, 见 storage.module.ts。
export class S3Storage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async save(buffer: Buffer, meta: { originalName: string; mimeType?: string }): Promise<string> {
    const ext = extname(meta.originalName).toLowerCase();
    const key = `${this.config.keyPrefix ?? ''}${randomUUID()}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: meta.mimeType,
      }),
    );
    return key;
  }

  async getStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    // Node运行时下 Body 始终是 Readable (浏览器环境下才会是 ReadableStream/Blob, 此处不适用)
    return result.Body as Readable;
  }
}
