import { CheckCircleFilled, WarningFilled } from '@ant-design/icons'
import { Button, Card, Empty, Input, Result, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { fstdsApi } from '../api/fstds'
import type { Fstd } from '../api/types'
import { useSelectedOrganization } from '../hooks/useSelectedOrganization'

const { Title, Text } = Typography

const SEVERITY_OPTIONS = [1, 2, 3, 4, 5]
const TIME_LOST_PRESETS = [0, 15, 30, 60, 120]

/// 3.3.7 Kiosk交互 (对标Simorg): 驾驶舱内技术人员/学员/教员快速报障, 大按钮+单屏, 提交后自动复位供下一人使用
export function KioskPage() {
  const { organizations, selectedId, select } = useSelectedOrganization()
  const [fstds, setFstds] = useState<Fstd[]>([])
  const [selectedFstdId, setSelectedFstdId] = useState<string>()
  const [description, setDescription] = useState('')
  const [isMmi, setIsMmi] = useState(false)
  const [severityRating, setSeverityRating] = useState<number>()
  const [timeLost, setTimeLost] = useState<number>()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!selectedId) return
    fstdsApi.list(selectedId).then(setFstds)
  }, [selectedId])

  const reset = () => {
    setSelectedFstdId(undefined)
    setDescription('')
    setIsMmi(false)
    setSeverityRating(undefined)
    setTimeLost(undefined)
    setSubmitted(false)
  }

  const canSubmit = !!selectedFstdId && description.trim().length > 0

  const handleSubmit = async () => {
    if (!selectedFstdId) return
    setSubmitting(true)
    try {
      await fstdsApi.reportDiscrepancy(selectedFstdId, {
        description: description.trim(),
        isMmi,
        severityRating,
        trainingTimeLostMinutes: timeLost,
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center' }}>
        <Result
          icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
          title="缺陷已登记"
          subTitle="30天修复时限倒计时已启动, 感谢报告"
        />
        <Button type="primary" size="large" onClick={reset}>
          继续报告下一项
        </Button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={2} style={{ textAlign: 'center' }}>
        FSTD 缺陷快速报告 (Kiosk)
      </Title>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
        驾驶舱内技术人员/学员/教员均可直接报告问题, 无需登录后台完整流程
      </Text>

      {organizations.length > 1 && (
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'center' }} wrap>
          {organizations.map((org) => (
            <Button
              key={org.id}
              type={selectedId === org.id ? 'primary' : 'default'}
              size="large"
              onClick={() => select(org.id)}
            >
              {org.name}
            </Button>
          ))}
        </Space>
      )}

      {fstds.length === 0 ? (
        <Empty description="当前机构还没有模拟机" />
      ) : (
        <Card title="1. 选择设备" style={{ marginBottom: 16 }}>
          <Space wrap size="middle">
            {fstds.map((f) => (
              <Button
                key={f.id}
                type={selectedFstdId === f.id ? 'primary' : 'default'}
                size="large"
                style={{ height: 64, minWidth: 140 }}
                onClick={() => setSelectedFstdId(f.id)}
              >
                {f.deviceCode}
                <br />
                {f.representedAircraft}
              </Button>
            ))}
          </Space>
        </Card>
      )}

      <Card title="2. 描述问题" style={{ marginBottom: 16 }}>
        <Input.TextArea
          rows={4}
          size="large"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="如: 视景系统左侧显示花屏"
        />
      </Card>

      <Card title="3. 是否影响设备可用性 (MMI: 缺失/故障/失效)" style={{ marginBottom: 16 }}>
        <Space size="middle">
          <Button
            danger={isMmi}
            type={isMmi ? 'primary' : 'default'}
            size="large"
            icon={<WarningFilled />}
            onClick={() => setIsMmi(true)}
          >
            是, 影响使用
          </Button>
          <Button type={!isMmi ? 'primary' : 'default'} size="large" onClick={() => setIsMmi(false)}>
            否, 不影响使用
          </Button>
        </Space>
      </Card>

      <Card title="4. 严重度打分 (可选, 5为最严重)" style={{ marginBottom: 16 }}>
        <Space size="middle">
          {SEVERITY_OPTIONS.map((v) => (
            <Button
              key={v}
              shape="circle"
              size="large"
              type={severityRating === v ? 'primary' : 'default'}
              onClick={() => setSeverityRating(v)}
            >
              {v}
            </Button>
          ))}
        </Space>
      </Card>

      <Card title="5. 导致培训损失时间 (可选, 分钟)" style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          {TIME_LOST_PRESETS.map((v) => (
            <Button key={v} type={timeLost === v ? 'primary' : 'default'} size="large" onClick={() => setTimeLost(v)}>
              {v} 分钟
            </Button>
          ))}
        </Space>
      </Card>

      <Button type="primary" size="large" block disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
        提交报告
      </Button>
    </div>
  )
}
