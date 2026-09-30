import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiCall, apiFor, createTestApp, registerTenant, createOrg, createFstd, createPersonnel, createSparePart, createSupplier } from './helpers.js';

function hasLog(logs: any[], entityType: string, entityId: string, actionSubstr: string) {
  return logs.some((l) => l.entityType === entityType && l.entityId === entityId && l.action.includes(actionSubstr));
}

/// 3.4.4 故障件 / 3.4.5 报废 / 3.4.6 需求申请 / 3.4.7 盘点 的完整闭环。
describe('inventory phase 2: faulty parts, scrap, demand, stocktake', () => {
  let app: INestApplication;
  let call: ApiCall;
  let token: string;
  let org: { id: string };
  let approver: { id: string };
  let fstd: { id: string };
  let supplier: { id: string };
  let part: any;

  beforeAll(async () => {
    app = await createTestApp();
    call = apiFor(app);
    ({ token } = await registerTenant(call));
    org = await createOrg(call, token);
    approver = await createPersonnel(call, token);
    fstd = await createFstd(call, token, org.id);
    supplier = await createSupplier(call, token, org.id);

    part = await createSparePart(call, token, org.id, { partCategory: 'ROTABLE', minQuantity: 2 });
    await call('POST', `/inventory/spare-parts/${part.id}/movements`, { type: 'IN', quantity: 20 }, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it('3.4.4 faulty parts: report -> send for repair -> restock increments stock', async () => {
    const faultyRes = await call('POST', '/inventory/faulty-parts', {
      sparePartId: part.id,
      removedFromFstdId: fstd.id,
      faultDescription: 'Servo valve found leaking during inspection',
      quantity: 1,
    }, token);
    expect(faultyRes.status).toBe(201);
    const faulty = faultyRes.body;
    expect(faulty.status).toBe('PENDING_DECISION');

    const sendForRepair = await call('POST', `/inventory/faulty-parts/${faulty.id}/status`, { status: 'SENT_FOR_REPAIR', supplierId: supplier.id }, token);
    expect(sendForRepair.status).toBe(201);
    expect(sendForRepair.body.sentAt).not.toBeNull();

    const stockBefore = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    const restock = await call('POST', `/inventory/faulty-parts/${faulty.id}/status`, { status: 'REPAIRED_RETURNED_TO_STOCK' }, token);
    expect(restock.status).toBe(201);
    const stockAfter = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(stockAfter.currentQuantity).toBe(stockBefore.currentQuantity + faulty.quantity);

    const faultyList = await call('GET', `/inventory/faulty-parts?organizationId=${org.id}`, null, token);
    expect(faultyList.status).toBe(200);
    expect(faultyList.body.some((f: any) => f.id === faulty.id)).toBe(true);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'FaultyPartRecord', faulty.id, 'create')).toBe(true);
    expect(hasLog(allLogs.body, 'FaultyPartRecord', faulty.id, 'status_change')).toBe(true);
  });

  it('3.4.5 scrap: PENDING holds stock, reject leaves stock unchanged, approve decrements, over-quantity rejected', async () => {
    const stockBeforeScrap = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id).currentQuantity;

    const scrapRes = await call('POST', '/inventory/scrap-requests', { sparePartId: part.id, quantity: 3, reasonCode: 'DAMAGED' }, token);
    expect(scrapRes.status).toBe(201);
    const scrap = scrapRes.body;
    expect(scrap.status).toBe('PENDING');

    const stockDuringPending = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(stockDuringPending.currentQuantity).toBe(stockBeforeScrap);

    const rejectRes = await call('POST', `/inventory/scrap-requests/${scrap.id}/reject`, { rejectedReason: 'insufficient justification' }, token);
    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.status).toBe('REJECTED');

    const stockAfterReject = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(stockAfterReject.currentQuantity).toBe(stockBeforeScrap);

    const scrap2Res = await call('POST', '/inventory/scrap-requests', { sparePartId: part.id, quantity: 3, reasonCode: 'DAMAGED' }, token);
    const scrap2 = scrap2Res.body;
    const approveRes = await call('POST', `/inventory/scrap-requests/${scrap2.id}/approve`, { approvedById: approver.id }, token);
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe('APPROVED');

    const stockAfterApprove = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(stockAfterApprove.currentQuantity).toBe(stockBeforeScrap - 3);

    const overScrap = await call('POST', '/inventory/scrap-requests', { sparePartId: part.id, quantity: 999999, reasonCode: 'DAMAGED' }, token);
    expect(overScrap.status).toBe(400);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PartScrapRequest', scrap2.id, 'status_change:PENDING->APPROVED')).toBe(true);
  });

  it('3.4.6 demand requests: cataloged + uncataloged creation, conversion to PO, cancellation rules', async () => {
    const demandRes = await call('POST', '/inventory/demand-requests', { organizationId: org.id, sparePartId: part.id, quantity: 5, notes: 'anticipate need for next quarter overhaul' }, token);
    expect(demandRes.status).toBe(201);
    const demand = demandRes.body;

    const uncatalogedDemand = await call('POST', '/inventory/demand-requests', { organizationId: org.id, partNumber: 'NEW-PART-NOT-YET-CATALOGED', name: 'Some new part', quantity: 2 }, token);
    expect(uncatalogedDemand.status).toBe(201);

    const missingBoth = await call('POST', '/inventory/demand-requests', { organizationId: org.id, quantity: 1 }, token);
    expect(missingBoth.status).toBe(400);

    const convertUncataloged = await call('POST', `/inventory/demand-requests/${uncatalogedDemand.body.id}/convert`, { supplierId: supplier.id }, token);
    expect(convertUncataloged.status).toBe(400);

    const convertRes = await call('POST', `/inventory/demand-requests/${demand.id}/convert`, { supplierId: supplier.id }, token);
    expect(convertRes.status).toBe(201);
    expect(convertRes.body.status).toBe('CONVERTED');
    expect(convertRes.body.purchaseOrderId).toBeTruthy();

    const poCheck = await call('GET', `/inventory/purchase-orders?organizationId=${org.id}`, null, token);
    expect(poCheck.body.some((po: any) => po.id === convertRes.body.purchaseOrderId)).toBe(true);

    const cancelDemandRes = await call('POST', `/inventory/demand-requests/${uncatalogedDemand.body.id}/cancel`, null, token);
    expect(cancelDemandRes.status).toBe(201);
    expect(cancelDemandRes.body.status).toBe('CANCELLED');

    const alreadyConvertedCancel = await call('POST', `/inventory/demand-requests/${demand.id}/cancel`, null, token);
    expect(alreadyConvertedCancel.status).toBe(400);

    const demandList = await call('GET', `/inventory/demand-requests?organizationId=${org.id}`, null, token);
    expect(demandList.status).toBe(200);
    expect(demandList.body.length).toBeGreaterThanOrEqual(2);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'PartDemandRequest', demand.id, 'status_change:PENDING->CONVERTED')).toBe(true);
  });

  it('3.4.7 stocktake: snapshot, count, reconcile adjusts stock, cannot double-reconcile', async () => {
    const stockBeforeStocktake = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);

    const sessionRes = await call('POST', '/inventory/stocktakes', { organizationId: org.id, title: 'Phase2 verification stocktake' }, token);
    expect(sessionRes.status).toBe(201);
    const session = sessionRes.body;
    expect(session.status).toBe('IN_PROGRESS');
    const item = session.items.find((i: any) => i.sparePartId === part.id);
    expect(item).toBeTruthy();
    expect(item.systemQuantity).toBe(stockBeforeStocktake.currentQuantity);

    const countedQuantity = item.systemQuantity - 2;
    const countRes = await call('POST', `/inventory/stocktakes/items/${item.id}/count`, { countedQuantity }, token);
    expect(countRes.status).toBe(201);
    expect(countRes.body.countedQuantity).toBe(countedQuantity);

    const reconcileRes = await call('POST', `/inventory/stocktakes/${session.id}/reconcile`, { reconciledById: approver.id }, token);
    expect(reconcileRes.status).toBe(201);
    expect(reconcileRes.body.status).toBe('RECONCILED');

    const stockAfterStocktake = (await call('GET', `/inventory/spare-parts?organizationId=${org.id}`, null, token)).body.find((p: any) => p.id === part.id);
    expect(stockAfterStocktake.currentQuantity).toBe(countedQuantity);

    const movementsAfterReconcile = await call('GET', `/inventory/spare-parts/${part.id}/movements`, null, token);
    expect(movementsAfterReconcile.body.some((m: any) => m.type === 'ADJUSTMENT' && m.quantity === -2 && m.note.includes('盘点对账调整'))).toBe(true);

    const doubleReconcile = await call('POST', `/inventory/stocktakes/${session.id}/reconcile`, {}, token);
    expect(doubleReconcile.status).toBe(400);

    const countAfterReconcile = await call('POST', `/inventory/stocktakes/items/${item.id}/count`, { countedQuantity: 999 }, token);
    expect(countAfterReconcile.status).toBe(400);

    const sessionList = await call('GET', `/inventory/stocktakes?organizationId=${org.id}`, null, token);
    expect(sessionList.status).toBe(200);
    expect(sessionList.body.some((s: any) => s.id === session.id)).toBe(true);

    const sessionDetail = await call('GET', `/inventory/stocktakes/${session.id}`, null, token);
    expect(sessionDetail.status).toBe(200);
    expect(sessionDetail.body.items.length).toBe(session.items.length);

    const allLogs = await call('GET', '/audit-logs', null, token);
    expect(hasLog(allLogs.body, 'StocktakeSession', session.id, 'reconcile')).toBe(true);
  });
});
