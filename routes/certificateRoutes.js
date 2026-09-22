import express from 'express'
import { generateCertificatePdf } from '../utils/generateCertificate.js'
const router = express.Router()

router.post('/generate-certificate', async (req,res)=>{
  try{
    const data = req.body
    const pdfBuffer = await generateCertificatePdf(data)
    res.setHeader('Content-Type','application/pdf')
    res.send(pdfBuffer)
  }catch(e){ console.error(e); res.status(500).json({error:e.message}) }
})

export default router
