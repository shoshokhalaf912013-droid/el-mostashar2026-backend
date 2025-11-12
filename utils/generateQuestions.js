import { Configuration, OpenAIApi } from 'openai'
import dotenv from 'dotenv'
dotenv.config()
const configuration = new Configuration({apiKey:process.env.OPENAI_API_KEY})
const openai = new OpenAIApi(configuration)

function buildPrompt(text, options={}){
  const num = options.numQuestions || 10
  const difficulty = options.difficulty || 'mixed'
  return `أنت مولد أسئلة احترافي باللغة العربية. أمامك النص التالي. مهمتك: توليد ${num} سؤالاً متنوعًا (اختياري - قصير - مقالي) باللغة العربية. قدم الناتج بصيغة JSON فقط: {"questions":[{ "question":"...","type":"mcq|short|essay","options":[...],"answer":"..." }, ...]}. لا تضف أي شروح أخرى. النص: '''${text}'''`;
}

export async function generateQuestionsFromText(text,options){
  const prompt = buildPrompt(text,options)
  const resp = await openai.createChatCompletion({model:process.env.OPENAI_MODEL||'gpt-4o-mini', messages:[{role:'user',content:prompt}], max_tokens:1500, temperature:0.0})
  const raw = resp.data.choices[0].message.content.trim()
  // try parse JSON inside raw
  try{
    const first = raw.indexOf('{')
    const last = raw.lastIndexOf('}')
    const jsonStr = first!==-1 && last!==-1 ? raw.slice(first,last+1) : raw
    const parsed = JSON.parse(jsonStr)
    return parsed.questions || parsed
  }catch(e){
    console.error('Failed parse AI response, returning fallback.', e)
    return [{question: raw, type:'short', options:[], answer:''}]
  }
}
