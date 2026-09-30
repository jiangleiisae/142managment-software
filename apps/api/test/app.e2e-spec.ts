import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // 根路由未标记 @Public(), 全局 JwtAuthGuard 会拒绝未认证请求 - 这是预期行为, 不是回归。
  it('/ (GET) requires authentication', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
