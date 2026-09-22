import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
export async function generateCertificatePdf(data){ 
  const {name='اسم الطالب', course='الكورس', grade='--', date=new Date().toLocaleDateString()} = data||{}
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 420])
  const font = await pdfDoc.embedFont(StandardFonts.ArialUnicodeMS || StandardFonts.Helvetica)
  page.drawText('شهادة تقدير', { x: 40, y: 330, size: 30 })
  page.drawText(`يمنح ${name} شهادة إتمام ${course}`, { x: 40, y: 280, size: 14 })
  page.drawText(`الدرجة: ${grade}`, { x: 40, y: 250, size: 12 })
  page.drawText(`التاريخ: ${date}`, { x: 40, y: 220, size: 12 })
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
