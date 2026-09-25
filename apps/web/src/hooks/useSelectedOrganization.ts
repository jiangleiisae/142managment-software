import { useEffect, useState } from 'react'
import { organizationsApi } from '../api/organizations'
import type { Organization } from '../api/types'

const STORAGE_KEY = 'tcms.selectedOrganizationId'

/// 一期没有登录态, 用 localStorage 记住当前操作的机构 (多机构切换的临时方案, 认证接入后改为从会话读取)
export function useSelectedOrganization() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => localStorage.getItem(STORAGE_KEY) ?? undefined,
  )

  useEffect(() => {
    organizationsApi.list().then((orgs) => {
      setOrganizations(orgs)
      if (!selectedId && orgs.length > 0) {
        setSelectedId(orgs[0].id)
      }
    })
  }, [])

  const select = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return { organizations, selectedId, select }
}
