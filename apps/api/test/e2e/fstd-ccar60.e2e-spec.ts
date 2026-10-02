import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createOrg, createTestApp, registerTenant, unique } from './helpers.js';

/// 鉴定基础 CCAR_60: 等级范围、与 EASA legacy 的互斥、能力判定与 legacy 同走"已鉴定科目清单"。
describe('FSTD CCAR-60 qualification basis', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };

  const create = (body: Record<string, unknown>) =>
    call('POST', '/fstds', { organizationId: org.id, deviceCode: unique('DEV'), representedAircraft: 'B737', deviceType: 'FFS', ...body }, token);

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token, 'CAAC Org', { regulatoryStandard: 'CAAC' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('CCAR_60 接受 FFS A-D 与 FTD 1-7, 拒绝 FNPT/BITD; EASA legacy 拒绝 FTD 3-7', async () => {
    const ffs = await create({ qualificationBasisType: 'CCAR_60', legacyLevel: 'FFS_D' });
    expect(ffs.status).toBe(201);
    expect(ffs.body.qualificationBasisType).toBe('CCAR_60');
    expect(ffs.body.legacyLevel.level).toBe('FFS_D');

    const ftd = await create({ qualificationBasisType: 'CCAR_60', deviceType: 'FTD', legacyLevel: 'FTD_5' });
    expect(ftd.status).toBe(201);
    expect(ftd.body.legacyLevel.level).toBe('FTD_5');

    const noLevel = await create({ qualificationBasisType: 'CCAR_60' });
    expect(noLevel.status).toBe(201); // 等级可以先不填

    const badCcar = await create({ qualificationBasisType: 'CCAR_60', legacyLevel: 'FNPT_II' });
    expect(badCcar.status).toBe(400);
    expect(badCcar.body.message).toContain('CCAR-60');
    expect((await create({ qualificationBasisType: 'CCAR_60', legacyLevel: 'BITD' })).status).toBe(400);

    const badEasa = await create({ qualificationBasisType: 'EASA_LEGACY_LEVEL', deviceType: 'FTD', legacyLevel: 'FTD_5' });
    expect(badEasa.status).toBe(400);
    expect((await create({ deviceType: 'FTD', legacyLevel: 'FTD_7' })).status).toBe(400); // 默认基础也是 EASA legacy
    expect((await create({ qualificationBasisType: 'EASA_LEGACY_LEVEL', legacyLevel: 'FFS_C' })).status).toBe(201);
    expect((await create({ qualificationBasisType: 'NOT_A_BASIS' })).status).toBe(400);
  });

  it('CCAR_60 设备的能力判定按已鉴定科目清单: 有的可排课, 没有的被拒', async () => {
    const dev = (await create({ qualificationBasisType: 'CCAR_60', legacyLevel: 'FFS_C' })).body;
    expect((await call('POST', `/fstds/${dev.id}/qualified-tasks`, { taskCode: 'LOFT', taskName: 'LOFT 训练' }, token)).status).toBe(201);

    const book = (taskCode: string, hour: number) =>
      call('POST', '/bookings', {
        organizationId: org.id,
        resourceType: 'FSTD',
        resourceId: dev.id,
        startAt: new Date(Date.UTC(2031, 0, 10, hour)).toISOString(),
        endAt: new Date(Date.UTC(2031, 0, 10, hour + 1)).toISOString(),
        taskCode,
      }, token);
    expect((await book('LOFT', 1)).status).toBe(201);
    const refused = await book('UNKNOWN', 3);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('未鉴定训练科目');
  });
});
