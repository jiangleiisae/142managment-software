import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

/// CORS_ORIGIN: 逗号分隔的允许来源列表; 未配置时仅放行本地前端开发端口 (Vite 默认 5173)。
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return ['http://localhost:5173'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: parseCorsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
