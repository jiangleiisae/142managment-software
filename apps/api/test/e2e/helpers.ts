import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

export type ApiCall = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, token?: string) => Promise<ApiResult>;

/// 每个测试文件独立创建一个 Nest 应用实例 (含全局 ValidationPipe, 与 main.ts 保持一致), 复用 app.module 的完整依赖图。
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export function apiFor(app: INestApplication): ApiCall {
  return async (method, path, body, token) => {
    let req = request(app.getHttpServer())[method.toLowerCase() as 'get'](path);
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    if (body !== undefined && body !== null) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body };
  };
}

let uniqueCounter = 0;
export function unique(prefix = 'test'): string {
  uniqueCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/// 注册全新租户 + OWNER 账户, 每个测试用例/文件都用独立租户以避免互相污染共享的 tcms_test 数据库。
export async function registerTenant(call: ApiCall, tenantName = 'E2E Test ATO') {
  const email = `${unique('owner')}@example.com`;
  const res = await call('POST', '/auth/register', { tenantName: unique(tenantName), email, password: 'TestPass12345' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, tenantId: res.body.tenant.id as string, userId: res.body.user.id as string, email };
}

export async function createOrg(call: ApiCall, token: string, name = 'E2E Test Org', overrides: Record<string, unknown> = {}) {
  const res = await call('POST', '/organizations', { name: unique(name), ...overrides }, token);
  if (res.status !== 201) throw new Error(`create org failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createPersonnel(call: ApiCall, token: string, overrides: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/personnel',
    { firstName: 'Test', lastName: unique('Person'), ...overrides },
    token,
  );
  if (res.status !== 201) throw new Error(`create personnel failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createStudent(call: ApiCall, token: string, organizationId: string, overrides: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/students',
    { organizationId, firstName: 'Test', lastName: unique('Student'), ...overrides },
    token,
  );
  if (res.status !== 201) throw new Error(`create student failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/// 在班表里新建一名排班人员 (默认维护部门)
export async function createStaff(call: ApiCall, token: string, organizationId: string, name: string, overrides: Record<string, unknown> = {}) {
  const res = await call('POST', '/roster/staff', { organizationId, department: 'MAINTENANCE', name, ...overrides }, token);
  if (res.status !== 201) throw new Error(`create staff failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createFstd(call: ApiCall, token: string, organizationId: string, overrides: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/fstds',
    { organizationId, deviceCode: unique('FSTD'), representedAircraft: 'A320', deviceType: 'FFS', ...overrides },
    token,
  );
  if (res.status !== 201) throw new Error(`create fstd failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createSparePart(call: ApiCall, token: string, organizationId: string, overrides: Record<string, unknown> = {}) {
  const res = await call(
    'POST',
    '/inventory/spare-parts',
    { organizationId, partNumber: unique('PART'), name: 'Test Spare Part', ...overrides },
    token,
  );
  if (res.status !== 201) throw new Error(`create spare part failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createSupplier(call: ApiCall, token: string, organizationId: string, overrides: Record<string, unknown> = {}) {
  const res = await call('POST', '/inventory/suppliers', { organizationId, name: unique('Supplier'), ...overrides }, token);
  if (res.status !== 201) throw new Error(`create supplier failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
