import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInspectionDto, SaveMeetingDto, SaveSurveyDto, SaveTrainingDto, UpdateMeetingDto, UpdateSurveyDto, UpdateTrainingDto } from './dto/quality.dto.js';

const MAX_LIST = 500;

export interface SurveyQuestion {
  id: string;
  type: 'SINGLE' | 'MULTI' | 'RATING' | 'TEXT';
  text: string;
  required: boolean;
  options?: string[];
}

function parseDay(value: string, label: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} "${value}" 不是有效的日历日 (YYYY-MM-DD)`);
  }
  return parsed;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

/// 质量管理 (R6): 会议记录、培训管理、其他检查、问卷。
@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private requireOrganizationId(organizationId: string | undefined): string {
    if (!organizationId) throw new BadRequestException('缺少 organizationId');
    return organizationId;
  }

  private async personnelNames(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map<string, string>();
    const people = await this.prisma.personnel.findMany({ where: { tenantId, id: { in: unique } } });
    return new Map(people.map((p) => [p.id, `${p.lastName}${p.firstName}`.trim()]));
  }

  /// 校验一组人员ID都属于当前租户 (主持人/记录人/参与人/执行人)
  private async assertPersonnel(tenantId: string, ids: (string | undefined | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (unique.length === 0) return;
    const found = await this.prisma.personnel.count({ where: { tenantId, id: { in: unique } } });
    if (found !== unique.length) throw new BadRequestException('包含不属于当前租户的人员');
  }

  private assertTimeRange(startAt: Date, endAt: Date) {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw new BadRequestException('时间格式无效');
    if (endAt <= startAt) throw new BadRequestException('结束时间必须晚于开始时间');
  }

  // ================= 会议记录 =================

  async createMeeting(tenantId: string, email: string, dto: SaveMeetingDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertTimeRange(startAt, endAt);
    await this.assertPersonnel(tenantId, [dto.hostPersonnelId, dto.recorderPersonnelId, ...(dto.attendeeIds ?? [])]);
    const created = await this.prisma.qualityMeeting.create({
      data: {
        organizationId: dto.organizationId,
        subject: dto.subject.trim(),
        startAt,
        endAt,
        method: dto.method ?? 'ONSITE',
        department: dto.department,
        location: dto.location,
        hostPersonnelId: dto.hostPersonnelId,
        recorderPersonnelId: dto.recorderPersonnelId,
        attendeeIds: [...new Set(dto.attendeeIds ?? [])],
        topics: dto.topics,
        lastWeekReport: dto.lastWeekReport,
        thisWeekTasksJson: (dto.thisWeekTasks ?? []) as unknown as Prisma.InputJsonValue,
        faultAnalysis: dto.faultAnalysis,
        suggestions: dto.suggestions,
        createdByEmail: email,
      },
    });
    await this.auditLog.write(tenantId, 'QualityMeeting', created.id, 'create', null, created);
    return created;
  }

  private async findMeeting(id: string, tenantId: string) {
    const m = await this.prisma.qualityMeeting.findFirst({ where: { id, organization: { tenantId } } });
    if (!m) throw new NotFoundException('会议记录不存在');
    return m;
  }

  async updateMeeting(tenantId: string, id: string, dto: UpdateMeetingDto) {
    const before = await this.findMeeting(id, tenantId);
    const startAt = dto.startAt ? new Date(dto.startAt) : before.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : before.endAt;
    this.assertTimeRange(startAt, endAt);
    await this.assertPersonnel(tenantId, [dto.hostPersonnelId, dto.recorderPersonnelId, ...(dto.attendeeIds ?? [])]);
    const updated = await this.prisma.qualityMeeting.update({
      where: { id },
      data: {
        subject: dto.subject?.trim(),
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt ? endAt : undefined,
        method: dto.method,
        department: dto.department,
        location: dto.location,
        hostPersonnelId: dto.hostPersonnelId,
        recorderPersonnelId: dto.recorderPersonnelId,
        attendeeIds: dto.attendeeIds ? [...new Set(dto.attendeeIds)] : undefined,
        topics: dto.topics,
        lastWeekReport: dto.lastWeekReport,
        thisWeekTasksJson: dto.thisWeekTasks ? (dto.thisWeekTasks as unknown as Prisma.InputJsonValue) : undefined,
        faultAnalysis: dto.faultAnalysis,
        suggestions: dto.suggestions,
      },
    });
    await this.auditLog.write(tenantId, 'QualityMeeting', id, 'update', before, updated);
    return updated;
  }

  async deleteMeeting(tenantId: string, id: string) {
    const before = await this.findMeeting(id, tenantId);
    await this.prisma.qualityMeeting.delete({ where: { id } });
    await this.auditLog.write(tenantId, 'QualityMeeting', id, 'delete', before, null);
    return { deleted: true };
  }

  async listMeetings(tenantId: string, organizationId: string | undefined, f: { from?: string; to?: string; keyword?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    const where: Prisma.QualityMeetingWhereInput = { organizationId: orgId };
    if (f.from || f.to) where.startAt = { ...(f.from ? { gte: new Date(`${f.from}T00:00:00+08:00`) } : {}), ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00+08:00`).getTime() + 86400000) } : {}) };
    const kw = f.keyword?.trim();
    if (kw) where.OR = [{ subject: { contains: kw, mode: 'insensitive' } }, { topics: { contains: kw, mode: 'insensitive' } }];
    const rows = await this.prisma.qualityMeeting.findMany({ where, orderBy: { startAt: 'desc' }, take: MAX_LIST });
    const names = await this.personnelNames(tenantId, rows.flatMap((r) => [r.hostPersonnelId, r.recorderPersonnelId, ...r.attendeeIds]).filter((x): x is string => !!x));
    return rows.map((r) => ({
      ...r,
      host: r.hostPersonnelId ? (names.get(r.hostPersonnelId) ?? null) : null,
      recorder: r.recorderPersonnelId ? (names.get(r.recorderPersonnelId) ?? null) : null,
      attendees: r.attendeeIds.map((id) => names.get(id) ?? id),
    }));
  }

  // ================= 培训管理 =================

  async createTraining(tenantId: string, email: string, dto: SaveTrainingDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertTimeRange(startAt, endAt);
    await this.assertPersonnel(tenantId, dto.attendeeIds ?? []);
    const created = await this.prisma.qualityTraining.create({
      data: {
        organizationId: dto.organizationId,
        subject: dto.subject.trim(),
        startAt,
        endAt,
        location: dto.location,
        trainerName: dto.trainerName,
        content: dto.content,
        attendeeIds: [...new Set(dto.attendeeIds ?? [])],
        createdByEmail: email,
      },
    });
    await this.auditLog.write(tenantId, 'QualityTraining', created.id, 'create', null, created);
    return created;
  }

  private async findTraining(id: string, tenantId: string) {
    const t = await this.prisma.qualityTraining.findFirst({ where: { id, organization: { tenantId } } });
    if (!t) throw new NotFoundException('培训记录不存在');
    return t;
  }

  async updateTraining(tenantId: string, id: string, dto: UpdateTrainingDto) {
    const before = await this.findTraining(id, tenantId);
    const startAt = dto.startAt ? new Date(dto.startAt) : before.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : before.endAt;
    this.assertTimeRange(startAt, endAt);
    await this.assertPersonnel(tenantId, dto.attendeeIds ?? []);
    const updated = await this.prisma.qualityTraining.update({
      where: { id },
      data: {
        subject: dto.subject?.trim(),
        startAt: dto.startAt ? startAt : undefined,
        endAt: dto.endAt ? endAt : undefined,
        location: dto.location,
        trainerName: dto.trainerName,
        content: dto.content,
        attendeeIds: dto.attendeeIds ? [...new Set(dto.attendeeIds)] : undefined,
      },
    });
    await this.auditLog.write(tenantId, 'QualityTraining', id, 'update', before, updated);
    return updated;
  }

  async deleteTraining(tenantId: string, id: string) {
    const before = await this.findTraining(id, tenantId);
    await this.prisma.qualityTraining.delete({ where: { id } });
    await this.auditLog.write(tenantId, 'QualityTraining', id, 'delete', before, null);
    return { deleted: true };
  }

  async listTrainings(tenantId: string, organizationId: string | undefined, f: { from?: string; to?: string; keyword?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    const where: Prisma.QualityTrainingWhereInput = { organizationId: orgId };
    if (f.from || f.to) where.startAt = { ...(f.from ? { gte: new Date(`${f.from}T00:00:00+08:00`) } : {}), ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00+08:00`).getTime() + 86400000) } : {}) };
    const kw = f.keyword?.trim();
    if (kw) where.OR = [{ subject: { contains: kw, mode: 'insensitive' } }, { content: { contains: kw, mode: 'insensitive' } }];
    const rows = await this.prisma.qualityTraining.findMany({ where, orderBy: { startAt: 'desc' }, take: MAX_LIST });
    const names = await this.personnelNames(tenantId, rows.flatMap((r) => r.attendeeIds));
    return rows.map((r) => ({ ...r, attendees: r.attendeeIds.map((id) => names.get(id) ?? id) }));
  }

  // ================= 其他检查 =================

  listInspectionItems(organizationId: string | undefined) {
    return this.prisma.inspectionItem.findMany({ where: { organizationId: this.requireOrganizationId(organizationId) }, orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  }

  /// 整体替换检查项: 名称去重去空; 不在新列表里的已有项被停用(历史记录里是名称快照, 不受影响); 在列表里的启用并按顺序排序
  async setInspectionItems(tenantId: string, organizationId: string, names: string[]) {
    const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const existing = await this.prisma.inspectionItem.findMany({ where: { organizationId } });
    await this.prisma.$transaction(async (tx) => {
      for (const item of existing) {
        if (!cleaned.includes(item.name) && item.isActive) await tx.inspectionItem.update({ where: { id: item.id }, data: { isActive: false } });
      }
      for (const [index, name] of cleaned.entries()) {
        const found = existing.find((e) => e.name === name);
        if (found) await tx.inspectionItem.update({ where: { id: found.id }, data: { isActive: true, sortOrder: index } });
        else await tx.inspectionItem.create({ data: { organizationId, name, sortOrder: index } });
      }
    });
    await this.auditLog.write(tenantId, 'InspectionItem', organizationId, 'update', existing.filter((e) => e.isActive).map((e) => e.name), cleaned);
    return this.listInspectionItems(organizationId);
  }

  async createInspection(tenantId: string, email: string, dto: CreateInspectionDto) {
    const inspectedOn = parseDay(dto.inspectedOn, 'inspectedOn');
    await this.assertPersonnel(tenantId, [dto.performedByPersonnelId]);
    const active = await this.prisma.inspectionItem.findMany({ where: { organizationId: dto.organizationId, isActive: true } });
    const byName = new Map(dto.results.map((r) => [r.name, r]));
    if (byName.size !== dto.results.length) throw new BadRequestException('检查结果里有重复的检查项');
    const unknown = dto.results.filter((r) => !active.some((a) => a.name === r.name));
    if (unknown.length) throw new BadRequestException(`不是启用中的检查项: ${unknown.map((u) => u.name).join('、')}`);
    const snapshot = dto.results.map((r) => ({ name: r.name, passed: r.passed, notes: r.notes ?? null }));
    const created = await this.prisma.otherInspection.create({
      data: {
        organizationId: dto.organizationId,
        inspectedOn,
        title: dto.title.trim(),
        performedByPersonnelId: dto.performedByPersonnelId,
        itemsJson: snapshot as unknown as Prisma.InputJsonValue,
        overallResult: snapshot.every((s) => s.passed) ? 'pass' : 'issues_found',
        notes: dto.notes,
        createdByEmail: email,
      },
    });
    await this.auditLog.write(tenantId, 'OtherInspection', created.id, 'create', null, created);
    return created;
  }

  async listInspections(tenantId: string, organizationId: string | undefined, f: { from?: string; to?: string; result?: string }) {
    const orgId = this.requireOrganizationId(organizationId);
    const where: Prisma.OtherInspectionWhereInput = { organizationId: orgId };
    if (f.from || f.to) where.inspectedOn = { ...(f.from ? { gte: parseDay(f.from, 'from') } : {}), ...(f.to ? { lte: parseDay(f.to, 'to') } : {}) };
    if (f.result === 'pass' || f.result === 'issues_found') where.overallResult = f.result;
    else if (f.result) throw new BadRequestException('result 只能是 pass 或 issues_found');
    const rows = await this.prisma.otherInspection.findMany({ where, orderBy: [{ inspectedOn: 'desc' }, { createdAt: 'desc' }], take: MAX_LIST });
    const names = await this.personnelNames(tenantId, rows.map((r) => r.performedByPersonnelId).filter((x): x is string => !!x));
    return rows.map((r) => ({
      id: r.id,
      inspectedOn: ymd(r.inspectedOn),
      title: r.title,
      performedBy: r.performedByPersonnelId ? (names.get(r.performedByPersonnelId) ?? null) : null,
      overallResult: r.overallResult,
      notes: r.notes,
      items: r.itemsJson as unknown as { name: string; passed: boolean; notes: string | null }[],
    }));
  }

  // ================= 问卷 =================

  private normalizeQuestions(input: { type: string; text: string; required?: boolean; options?: string[] }[]): SurveyQuestion[] {
    return input.map((q, i) => {
      const text = q.text.trim();
      if (!text) throw new BadRequestException(`第 ${i + 1} 题题目不能为空`);
      const base = { id: `q${i + 1}`, type: q.type as SurveyQuestion['type'], text, required: q.required ?? false };
      if (q.type === 'SINGLE' || q.type === 'MULTI') {
        const options = [...new Set((q.options ?? []).map((o) => o.trim()).filter(Boolean))];
        if (options.length < 2) throw new BadRequestException(`第 ${i + 1} 题至少需要 2 个不同的选项`);
        return { ...base, options };
      }
      return base;
    });
  }

  async createSurvey(tenantId: string, email: string, dto: SaveSurveyDto) {
    const created = await this.prisma.survey.create({
      data: {
        organizationId: dto.organizationId,
        title: dto.title.trim(),
        description: dto.description,
        anonymous: dto.anonymous ?? false,
        questionsJson: this.normalizeQuestions(dto.questions) as unknown as Prisma.InputJsonValue,
        createdByEmail: email,
      },
    });
    await this.auditLog.write(tenantId, 'Survey', created.id, 'create', null, created);
    return created;
  }

  private async findSurvey(id: string, tenantId: string) {
    const s = await this.prisma.survey.findFirst({ where: { id, organization: { tenantId } } });
    if (!s) throw new NotFoundException('问卷不存在');
    return s;
  }

  async updateSurvey(tenantId: string, id: string, dto: UpdateSurveyDto) {
    const before = await this.findSurvey(id, tenantId);
    if (before.status !== 'DRAFT') throw new BadRequestException('只有草稿状态的问卷可以修改');
    const updated = await this.prisma.survey.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        anonymous: dto.anonymous,
        questionsJson: dto.questions ? (this.normalizeQuestions(dto.questions) as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.auditLog.write(tenantId, 'Survey', id, 'update', before, updated);
    return updated;
  }

  async deleteSurvey(tenantId: string, id: string) {
    const s = await this.findSurvey(id, tenantId);
    if (s.status !== 'DRAFT') throw new BadRequestException('已发布的问卷不能删除, 请关闭它');
    await this.prisma.survey.delete({ where: { id } });
    await this.auditLog.write(tenantId, 'Survey', id, 'delete', s, null);
    return { deleted: true };
  }

  /// 发布: 同租户所有启用账号都会收到一条站内通知
  async publishSurvey(tenantId: string, email: string, id: string) {
    const s = await this.findSurvey(id, tenantId);
    if (s.status !== 'DRAFT') throw new BadRequestException('只有草稿状态的问卷可以发布');
    if ((s.questionsJson as unknown as SurveyQuestion[]).length === 0) throw new BadRequestException('问卷至少需要一道题');
    const updated = await this.prisma.survey.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const users = await this.prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
    if (users.length) {
      await this.prisma.notification.createMany({
        data: users.map((u) => ({ tenantId, recipientUserId: u.id, title: '新问卷', message: `请填写问卷「${s.title}」`, entityType: 'Survey', entityId: id })),
      });
    }
    await this.auditLog.write(tenantId, 'Survey', id, 'status_change', { status: 'DRAFT' }, { status: 'PUBLISHED', by: email });
    return updated;
  }

  async closeSurvey(tenantId: string, email: string, id: string) {
    const s = await this.findSurvey(id, tenantId);
    if (s.status !== 'PUBLISHED') throw new BadRequestException('只有已发布的问卷可以关闭');
    const updated = await this.prisma.survey.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    await this.auditLog.write(tenantId, 'Survey', id, 'status_change', { status: 'PUBLISHED' }, { status: 'CLOSED', by: email });
    return updated;
  }

  async listSurveys(organizationId: string | undefined) {
    const orgId = this.requireOrganizationId(organizationId);
    const rows = await this.prisma.survey.findMany({ where: { organizationId: orgId }, include: { _count: { select: { responses: true } } }, orderBy: { createdAt: 'desc' }, take: MAX_LIST });
    return rows.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      anonymous: s.anonymous,
      status: s.status,
      questions: s.questionsJson as unknown as SurveyQuestion[],
      publishedAt: s.publishedAt,
      closedAt: s.closedAt,
      responseCount: s._count.responses,
      createdAt: s.createdAt,
    }));
  }

  /// 统计: 单选/多选按选项统计人数与占比(占回答人数), 打分题统计平均分与分布, 文本题列出全部回答; 另附填写记录(匿名问卷不含姓名)
  async surveyStats(tenantId: string, id: string) {
    const s = await this.findSurvey(id, tenantId);
    const questions = s.questionsJson as unknown as SurveyQuestion[];
    const responses = await this.prisma.surveyResponse.findMany({ where: { surveyId: id }, orderBy: { submittedAt: 'asc' } });
    const total = responses.length;
    const answerOf = (r: (typeof responses)[number], qid: string) => (r.answersJson as Record<string, unknown>)[qid];

    const stats = questions.map((q) => {
      const answers = responses.map((r) => answerOf(r, q.id)).filter((a) => a !== undefined && a !== null && a !== '' && !(Array.isArray(a) && a.length === 0));
      const answered = answers.length;
      if (q.type === 'SINGLE' || q.type === 'MULTI') {
        const counts = new Map((q.options ?? []).map((o) => [o, 0]));
        for (const a of answers) for (const o of Array.isArray(a) ? a : [a]) if (counts.has(o as string)) counts.set(o as string, (counts.get(o as string) ?? 0) + 1);
        return { id: q.id, type: q.type, text: q.text, answered, options: [...counts.entries()].map(([option, count]) => ({ option, count, percent: answered > 0 ? round((count / answered) * 100) : 0 })) };
      }
      if (q.type === 'RATING') {
        const scores = answers.map(Number);
        const dist = [1, 2, 3, 4, 5].map((score) => ({ score, count: scores.filter((x) => x === score).length }));
        return { id: q.id, type: q.type, text: q.text, answered, average: answered > 0 ? round(scores.reduce((a, b) => a + b, 0) / answered) : null, distribution: dist };
      }
      return { id: q.id, type: q.type, text: q.text, answered, texts: answers.map(String) };
    });

    return {
      id: s.id,
      title: s.title,
      status: s.status,
      anonymous: s.anonymous,
      totalResponses: total,
      stats,
      records: responses.map((r) => ({ respondent: s.anonymous ? null : r.userEmail, submittedAt: r.submittedAt })),
    };
  }

  // ---- 填写 (任意已登录用户) ----

  /// 本租户内已发布的问卷 (含当前用户是否已填写); 不带答案
  async mySurveys(tenantId: string, userId: string) {
    const rows = await this.prisma.survey.findMany({
      where: { organization: { tenantId }, status: 'PUBLISHED' },
      include: { organization: { select: { name: true } }, responses: { where: { userId }, select: { id: true } } },
      orderBy: { publishedAt: 'desc' },
      take: MAX_LIST,
    });
    return rows.map((s) => ({ id: s.id, title: s.title, description: s.description, anonymous: s.anonymous, organizationName: s.organization.name, publishedAt: s.publishedAt, answered: s.responses.length > 0, questions: s.questionsJson as unknown as SurveyQuestion[] }));
  }

  async respond(tenantId: string, userId: string, email: string, surveyId: string, answers: Record<string, unknown>) {
    const s = await this.findSurvey(surveyId, tenantId);
    if (s.status !== 'PUBLISHED') throw new BadRequestException('该问卷当前不接收回答');
    const questions = s.questionsJson as unknown as SurveyQuestion[];
    const clean: Record<string, unknown> = {};
    for (const q of questions) {
      const raw = answers[q.id];
      const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        if (q.required) throw new BadRequestException(`第 ${q.id.slice(1)} 题必填`);
        continue;
      }
      if (q.type === 'SINGLE') {
        if (typeof raw !== 'string' || !q.options?.includes(raw)) throw new BadRequestException(`第 ${q.id.slice(1)} 题的答案不是有效选项`);
        clean[q.id] = raw;
      } else if (q.type === 'MULTI') {
        if (!Array.isArray(raw) || raw.some((o) => typeof o !== 'string' || !q.options?.includes(o))) throw new BadRequestException(`第 ${q.id.slice(1)} 题的答案不是有效选项`);
        clean[q.id] = [...new Set(raw as string[])];
      } else if (q.type === 'RATING') {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw new BadRequestException(`第 ${q.id.slice(1)} 题请打 1-5 分`);
        clean[q.id] = n;
      } else {
        if (typeof raw !== 'string') throw new BadRequestException(`第 ${q.id.slice(1)} 题的答案必须是文本`);
        if (raw.length > 2000) throw new BadRequestException(`第 ${q.id.slice(1)} 题的答案过长`);
        clean[q.id] = raw.trim();
      }
    }
    const unknownKeys = Object.keys(answers).filter((k) => !questions.some((q) => q.id === k));
    if (unknownKeys.length) throw new BadRequestException(`包含不存在的题目: ${unknownKeys.join(', ')}`);
    const existing = await this.prisma.surveyResponse.findUnique({ where: { surveyId_userId: { surveyId, userId } } });
    if (existing) throw new BadRequestException('你已经填写过这份问卷');
    await this.prisma.surveyResponse.create({ data: { surveyId, userId, userEmail: s.anonymous ? null : email, answersJson: clean as Prisma.InputJsonValue } });
    return { submitted: true };
  }
}
