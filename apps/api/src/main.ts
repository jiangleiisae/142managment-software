import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

/// CORS_ORIGIN: 逗号分隔的允许来源列表; 未配置时仅放行本地前端开发端口 (Vite 默认 5173)。
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return ['http://localhost:5173'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/// TRUST_PROXY_HOPS: API 前面有几层反向代理 (生产是 Caddy → nginx, 共 2 层)。
/// 不设置时 req.ip 是最近一层代理的地址, 限流(ThrottlerGuard)会把所有访客当成同一个人共用一个额度;
/// 设置后按真实客户端 IP 限流。本地开发没有代理, 保持默认 0。
function parseTrustProxyHops(): number {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const hops = parseTrustProxyHops();
  if (hops > 0) app.set('trust proxy', hops);
  app.use(helmet());
  app.enableCors({ origin: parseCorsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
