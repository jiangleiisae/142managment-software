import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg } from './helpers.js';

function hasLog(logs: any[], entityType: string, entityId: string, actionSubstr: string) {
  return logs.some((l) => l.entityType === entityType && l.entityId === entityId && l.action.includes(actionSubstr));
}

/// 多仓库 / 借用跟踪 / 备件检查 / 备件类型字典 的完整闭环。
describe('inventory phase 3: part-type dictionary, multi-warehouse, loans, inspections', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('part type dictionary: built-ins seeded, custom type CRUD, cannot delete built-in or in-use type', async () => {
    const configsRes = await call('GET', `/inventory/part-type-configs?organizationId=${org.id}`, null, token);
    expect(configsRes.status).toBe(200);
    const builtIns = configsRes.body;
    expect(builtIns.some((c: any) => c.code === 'CONSUMABLE' && c.isBuiltIn)).toBe(true);
    expect(builtIns.some((c: any) => c.code === 'ROTABLE' && c.isBuiltIn)).toBe(true);

    const customTypeRes = await call('POST', '/inventory/part-type-configs', { organizationId: org.id, code: `CONSIGNMENT_ITEM_${Date.now()}`, label: '寄售件' }, token);
    expect(customTypeRes.status).toBe(201);
    const customType = customTypeRes.body;

    const relabelRes = await call('POST', `/inventory/part-type-configs/${customType.id}`, { label: '寄售备件(重命名)' }, token);
    expect(relabelRes.status).toBe(201);
    expect(relabelRes.body.label).toBe('寄售备件(重命名)');

    const deleteBuiltInAttempt = await call('POST', `/inventory/part-type-configs/${builtIns.find((c: any) => c.code === 'CONSUMABLE').id}/delete`, null, token);
    expect(deleteBuiltInAttempt.status).toBe(400);

    const deleteUnusedRes = await call('POST', `/inventory/part-type-configs/${customType.id}/delete`, null, token);
    expect(deleteUnusedRes.status).toBe(201);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PartTypeConfig', customType.id, 'create')).toBe(true);
    expect(hasLog(allLogs.body, 'PartTypeConfig', customType.id, 'update')).toBe(true);
    expect(hasLog(allLogs.body, 'PartTypeConfig', customType.id, 'delete')).toBe(true);
  });

  it('spare part category validation: unknown category rejected, custom category accepted, in-use type cannot be deleted', async () => {
    const usedTypeRes = await call('POST', '/inventory/part-type-configs', { organizationId: org.id, code: `EXPENDABLE_TOOL_${Date.now()}`, label: '消耗性工具件' }, token);
    const usedType = usedTypeRes.body;

    const invalidCategoryPart = await call('POST', '/inventory/spare-parts', { organizationId: org.id, partNumber: `PHASE3-INVALID-${Date.now()}`, name: 'Invalid category test', partCategory: 'NOT_A_REAL_CATEGORY' }, token);
    expect(invalidCategoryPart.status).toBe(400);

    const partWithCustomCategory = await call('POST', '/inventory/spare-parts', {
      organizationId: org.id,
      partNumber: `PHASE3-CUSTOM-CAT-${Date.now()}`,
      name: 'Part with custom category',
      partCategory: usedType.code,
      requiresInspection: true,
      inspectionIntervalMonths: 6,
    }, token);
    expect(partWithCustomCategory.status).toBe(201);
    expect(partWithCustomCategory.body.partCategory).toBe(usedType.code);

    const deleteUsedTypeAttempt = await call('POST', `/inventory/part-type-configs/${usedType.id}/delete`, null, token);
    expect(deleteUsedTypeAttempt.status).toBe(400);
  });

  it('multi-warehouse: per-warehouse stock tracking sums to SparePart.currentQuantity', async () => {
    const part = (await call('POST', '/inventory/spare-parts', { organizationId: org.id, partNumber: `PHASE3-WH-${Date.now()}`, name: 'Warehouse test part' }, token)).body;

    const warehouseA = (await call('POST', '/inventory/warehouses', { organizationId: org.id, name: `Main-${Date.now()}`, type: 'OWN' }, token)).body;
    const warehouseBRes = await call('POST', '/inventory/warehouses', { organizationId: org.id, name: `Consignment-${Date.now()}`, type: 'CONSIGNMENT', externalPartyInfo: 'Boeing Spares Co.' }, token);
    expect(warehouseBRes.status).toBe(201);
    expect(warehouseBRes.body.type).toBe('CONSIGNMENT');
    const warehouseB = warehouseBRes.body;

    const listWarehousesRes = await call('GET', `/inventory/warehouses?organizationId=${org.id}`, null, token);
    expect(listWarehousesRes.status).toBe(200);
    expect(listWarehousesRes.body.length).toBeGreaterThanOrEqual(2);

    const inA = await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'IN', quantity: 10, warehouseId: warehouseA.id }, token);
    expect(inA.status).toBe(201);
    const inB = await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'IN', quantity: 4, warehouseId: warehouseB.id }, token);
    expect(inB.status).toBe(201);

    const stockByPart = await call('GET', `/inventory/spare-parts/${part.id}/warehouse-stock`, null, token);
    expect(stockByPart.status).toBe(200);
    const stockA = stockByPart.body.find((s: any) => s.warehouseId === warehouseA.id);
    const stockB = stockByPart.body.find((s: any) => s.warehouseId === warehouseB.id);
    expect(stockA?.quantity).toBe(10);
    expect(stockB?.quantity).toBe(4);

    const partAfterWarehouseMoves = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(partAfterWarehouseMoves.currentQuantity).toBe(14);

    const outFromA = await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'OUT', quantity: 3, warehouseId: warehouseA.id, usageLocation: 'FFS-01 视景系统机柜' }, token);
    expect(outFromA.status).toBe(201);
    expect(outFromA.body.usageLocation).toBe('FFS-01 视景系统机柜');

    const stockAAfterOut = (await call('GET', `/inventory/spare-parts/${part.id}/warehouse-stock`, null, token)).body.find((s: any) => s.warehouseId === warehouseA.id);
    expect(stockAAfterOut.quantity).toBe(7);

    const warehouseStockList = await call('GET', `/inventory/warehouses/${warehouseA.id}/stock`, null, token);
    expect(warehouseStockList.status).toBe(200);
    expect(warehouseStockList.body.some((s: any) => s.sparePartId === part.id)).toBe(true);
  });

  it('loans: create decrements stock, overdue listing, return restores stock and clears overdue', async () => {
    const part = (await call('POST', '/inventory/spare-parts', { organizationId: org.id, partNumber: `PHASE3-LOAN-${Date.now()}`, name: 'Loan test part' }, token)).body;
    await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'IN', quantity: 10 }, token);

    const loanRes = await call('POST', '/inventory/loans', {
      sparePartId: part.id,
      quantity: 2,
      borrowerInfo: 'Test Maintenance Contractor',
      dueDate: new Date(Date.now() - 86400_000).toISOString(),
    }, token);
    expect(loanRes.status).toBe(201);
    const loan = loanRes.body;

    const partAfterLoan = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(partAfterLoan.currentQuantity).toBe(8);

    const overdueLoans = await call('GET', '/inventory/loans/overdue', null, token);
    expect(overdueLoans.status).toBe(200);
    expect(overdueLoans.body.some((l: any) => l.id === loan.id)).toBe(true);

    const returnRes = await call('POST', `/inventory/loans/${loan.id}/return`, null, token);
    expect(returnRes.status).toBe(201);
    expect(returnRes.body.returnedAt).not.toBeNull();

    const partAfterReturn = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(partAfterReturn.currentQuantity).toBe(10);

    const doubleReturn = await call('POST', `/inventory/loans/${loan.id}/return`, null, token);
    expect(doubleReturn.status).toBe(400);

    const overdueLoansAfterReturn = await call('GET', '/inventory/loans/overdue', null, token);
    expect(overdueLoansAfterReturn.body.some((l: any) => l.id === loan.id)).toBe(false);

    const listLoansRes = await call('GET', `/inventory/loans?organizationId=${org.id}`, null, token);
    expect(listLoansRes.status).toBe(200);
    expect(listLoansRes.body.some((l: any) => l.id === loan.id)).toBe(true);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PartLoan', loan.id, 'create')).toBe(true);
    expect(hasLog(allLogs.body, 'PartLoan', loan.id, 'return')).toBe(true);
  });

  it('inspections: recording computes nextDueDate, due-soon respects window, never-inspected parts always show', async () => {
    const part = (await call('POST', '/inventory/spare-parts', {
      organizationId: org.id,
      partNumber: `PHASE3-INSPECT-${Date.now()}`,
      name: 'Inspection test part',
      requiresInspection: true,
      inspectionIntervalMonths: 6,
    }, token)).body;

    const inspectionRes = await call('POST', `/inventory/spare-parts/${part.id}/inspections`, { inspectedAt: new Date().toISOString(), result: 'pass' }, token);
    expect(inspectionRes.status).toBe(201);
    expect(inspectionRes.body.nextDueDate).not.toBeNull();

    const inspectionsList = await call('GET', `/inventory/spare-parts/${part.id}/inspections`, null, token);
    expect(inspectionsList.status).toBe(200);
    expect(inspectionsList.body.length).toBe(1);

    const dueSoonRes = await call('GET', '/inventory/inspections/due-soon?withinDays=9999', null, token);
    expect(dueSoonRes.status).toBe(200);
    expect(dueSoonRes.body.some((p: any) => p.sparePartId === part.id)).toBe(true);

    const dueSoonNarrow = await call('GET', '/inventory/inspections/due-soon?withinDays=1', null, token);
    expect(dueSoonNarrow.body.some((p: any) => p.sparePartId === part.id)).toBe(false);

    const neverInspectedPart = (await call('POST', '/inventory/spare-parts', {
      organizationId: org.id,
      partNumber: `PHASE3-NEVER-INSPECTED-${Date.now()}`,
      name: 'Never inspected part',
      requiresInspection: true,
      inspectionIntervalMonths: 12,
    }, token)).body;
    const dueSoonWithNew = await call('GET', '/inventory/inspections/due-soon?withinDays=1', null, token);
    expect(dueSoonWithNew.body.some((p: any) => p.sparePartId === neverInspectedPart.id)).toBe(true);
  });
});
