/**
 * Выгрузка DOM-элемента в PDF формата A4.
 * Документ растеризуется (html2canvas-pro поддерживает цвета oklch из Tailwind v4),
 * что корректно передаёт кириллицу без встраивания шрифтов.
 */
export async function exportPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 8
  const imgW = pageW - margin * 2
  const pxPerMm = canvas.width / imgW
  const pagePx = Math.floor((pageH - margin * 2) * pxPerMm)

  for (let y = 0, page = 0; y < canvas.height; y += pagePx, page++) {
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = Math.min(pagePx, canvas.height - y)
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height)
    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', margin, margin, imgW, slice.height / pxPerMm, undefined, 'FAST')
  }
  pdf.save(filename)
}
