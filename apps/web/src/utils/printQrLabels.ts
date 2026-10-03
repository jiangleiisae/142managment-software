import QRCode from 'qrcode'

export interface QrLabel {
  title: string
  subtitle?: string
  url: string
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/// 打开一个可打印的标签页: 每张标签 = 二维码 + 设备编号 + 机型 + 扫码提示, 一行排两张, 可直接打印后贴在设备上。
/// 必须在点击事件里同步调用 (先同步打开窗口再异步生成二维码, 否则会被浏览器当成弹窗拦截)。
export async function printQrLabels(labels: QrLabel[], heading: string, hint: string): Promise<boolean> {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write('<p style="font-family:sans-serif">...</p>')
  const images = await Promise.all(labels.map((l) => QRCode.toDataURL(l.url, { width: 360, margin: 1, errorCorrectionLevel: 'M' })))
  const cards = labels
    .map(
      (l, i) => `<div class="card"><img src="${images[i]}" alt="" /><div class="title">${escapeHtml(l.title)}</div>${l.subtitle ? `<div class="sub">${escapeHtml(l.subtitle)}</div>` : ''}<div class="hint">${escapeHtml(hint)}</div></div>`,
    )
    .join('')
  win.document.open()
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title><style>
    body { font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; margin: 16px; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .card { border: 1px dashed #999; border-radius: 6px; padding: 12px; text-align: center; break-inside: avoid; }
    .card img { width: 200px; height: 200px; }
    .title { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .sub { font-size: 14px; color: #555; }
    .hint { font-size: 12px; color: #888; margin-top: 4px; }
    @media print { h1 { display: none; } body { margin: 0; } }
  </style></head><body><h1>${escapeHtml(heading)}</h1><div class="grid">${cards}</div></body></html>`)
  win.document.close()
  win.focus()
  // 等图片加载完再弹打印对话框
  setTimeout(() => win.print(), 400)
  return true
}
