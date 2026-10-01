import { useTranslation } from 'react-i18next'
import type { Organization, RegulatoryStandard } from '../api/types'

/// EASA/CAAC 界面文案切换的基础机制 (大升级第一阶段, 仅做标准选择器+文案切换, 具体CAAC合规逻辑后续批次再补齐)
/// CAAC 在 EASA 现有要求基础上叠加要求, 因此文案默认沿用 EASA 版本, 仅在确有差异的地方提供 "_CAAC" 后缀的覆盖文案
export function useStandardText(regulatoryStandard: RegulatoryStandard | undefined) {
  const { t } = useTranslation()

  // i18next 的数组回退: 优先尝试 CAAC 专用 key, 不存在则回退到通用 key
  const ts = (key: string, options?: Record<string, unknown>) =>
    regulatoryStandard === 'CAAC' ? t([`${key}_CAAC`, key], options) : t(key, options)

  return { ts }
}

export function resolveStandard(organizations: Organization[], selectedId: string | undefined): RegulatoryStandard | undefined {
  return organizations.find((o) => o.id === selectedId)?.regulatoryStandard
}
