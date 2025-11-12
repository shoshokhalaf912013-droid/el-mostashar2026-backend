import express from 'express'
import { generateQuestionsFromText } from '../utils/generateQuestions.js'
const router = express.Router()

router.post('/generate-questions', async (req,res)=>{
  try{
    const {text,options} = req.body
    if(!text) return res.status(400).json({error:'no text provided'})
    const questions = await generateQuestionsFromText(text, options)
    return res.json({questions})
  }catch(err){
    console.error(err); res.status(500).json({error:err.message})
  }
})

export default router
