import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/// 存储后端抽象: 上层业务代码(如 FstdService)只感知 "storage key" 这个不透明字符串, 不关心它
/// 究竟是本地磁盘相对路径还是对象存储的 object key, 从而让磁盘<->S3/OSS/R2的切换不影响上层接口。
export interface FileStorage {
  /// 保存文件, 返回一个不透明的 key (供后续 getStream 使用, 也是数据库里持久化的值)。
  save(buffer: Buffer, meta: { originalName: string; mimeType?: string }): Promise<string>;

  /// 按 key 取回文件内容流。
  getStream(key: string): Promise<Readable>;
}
