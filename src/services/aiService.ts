import { GoogleGenAI } from '@google/genai';
import { Evaluation, Employee } from '../types';

// The API key is supplied locally by Vite and is never committed to source control.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export interface AiAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
  summary: string;
}

export class AiService {
  static async analyzeEmployeePerformance(employee: Employee, evaluation: Evaluation): Promise<AiAnalysisResult | null> {
    if (!apiKey) {
      console.error('Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your .env file.');
      return null;
    }

    const prompt = `
أنت الآن خبير استشاري في الموارد البشرية وتقييم الأداء المؤسسي.
أريدك أن تحلل بيانات تقييم الموظف التالي وتقدم لي تحليلاً دقيقاً يشمل نقاط القوة، نقاط الضعف (الفجوات)، وخطة عمل وتطوير (Action Plan) لتحسين أدائه.

### بيانات الموظف:
- الاسم: ${employee.name}
- الوظيفة: ${employee.role}
- المستوى: ${employee.level}
- القسم: ${employee.departmentName}

### نتائج التقييم:
- التقييم النهائي: ${evaluation.finalScore}%
- التصنيف: ${evaluation.classification}
- درجة القسم (المهارات الفنية): ${evaluation.departmentScore}
- درجة المهارات العامة (التواصل، الالتزام، إلخ): ${evaluation.commonScore}
${evaluation.leadershipScore ? `- درجة القيادة: ${evaluation.leadershipScore}` : ''}

### ملاحظات المقيّم (Team Leader):
- نقاط القوة: ${evaluation.strengths || 'لم تُكتب'}
- مجالات التحسين: ${evaluation.improvements || 'لم تُكتب'}
- خطة التطوير الحالية: ${evaluation.developmentActions || 'لم تُكتب'}

### المطلوب:
بناءً على الأرقام والملاحظات أعلاه، قم بإرجاع النتيجة بصيغة JSON فقط (بدون أي نصوص إضافية أو Markdown formatting خارج الـ JSON)، بحيث يكون الهيكل كالتالي:
{
  "summary": "ملخص عام لأداء الموظف في سطرين",
  "strengths": ["نقطة قوة 1", "نقطة قوة 2", ...],
  "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2", ...],
  "actionPlan": ["خطوة عملية 1", "خطوة عملية 2", ...]
}
يجب أن تكون التوصيات وخطة العمل دقيقة ومخصصة لطبيعة وظيفته (${employee.role}).
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        }),
      });

      if (!res.ok) {
        console.error('API Error:', await res.text());
        return null;
      }

      const data = await res.json();
      const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // Clean up the markdown JSON if it exists
      const cleanJsonStr = jsonStr.replace(/```json\\n/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(cleanJsonStr) as AiAnalysisResult;
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return null;
    }
  }
}
