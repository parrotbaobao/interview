import { GoogleGenAI, Type } from "@google/genai";
import { InterviewQuestion, TechStack, FollowUp } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GeneratedQuestion {
  category: string;
  question: string;
  difficulty: 'Junior' | 'Mid' | 'Senior' | 'Expert';
}

export const generateQuestions = async (
  stacks: TechStack[],
  description: string,
  totalCount: number = 5
): Promise<InterviewQuestion[]> => {
  const model = "gemini-2.5-flash";
  
  const hasStack = stacks.length > 0;
  const hasProject = description.trim().length > 0;

  if (!hasStack && !hasProject) {
    throw new Error("Either stack or project description is required");
  }

  const stackString = stacks.join(", ");
  
  let prompt = `
    你是一位世界级的前端高级工程师和技术面试官。
    
    任务: 生成前端面试问题。
    
    输入信息:
    ${hasStack ? `- 候选人技术栈: ${stackString}` : ''}
    ${hasProject ? `- 候选人项目背景: "${description}"` : ''}
    - 题目总数量: ${totalCount}
    
    请根据提供的输入生成总共 ${totalCount} 道面试题。
    ${hasStack && hasProject ? '请将问题明确分为两类：“针对技术栈的基础/深度问题” 和 “针对项目经历的实战/架构问题”。两者数量请尽量对半分配。' : ''}
    ${hasStack && !hasProject ? '请生成针对所选技术栈的面试问题，涵盖基础原理到高级特性。' : ''}
    ${!hasStack && hasProject ? '请生成针对该项目描述的面试问题，关注架构设计、难点攻克和解决方案。' : ''}

    要求:
    1. 评估难度等级 (Junior, Mid, Senior, Expert)。
    2. 对其进行分类（例如，“状态管理”、“性能”、“架构”、“安全”）。
    3. **必须使用简体中文输出所有内容。**
    
    请以包含两个数组的对象格式返回响应： 'tech_questions' 和 'project_questions'。
    如果缺少某类输入，则对应的数组为空。
  `;

  // Define the schema for a single question
  const questionSchema = {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING },
      question: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ['Junior', 'Mid', 'Senior', 'Expert'] },
    },
    required: ['category', 'question', 'difficulty'],
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tech_questions: {
              type: Type.ARRAY,
              items: questionSchema,
            },
            project_questions: {
              type: Type.ARRAY,
              items: questionSchema,
            },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data received from Gemini");

    const rawData = JSON.parse(jsonText);
    const techQs: GeneratedQuestion[] = rawData.tech_questions || [];
    const projQs: GeneratedQuestion[] = rawData.project_questions || [];
    
    const timestamp = Date.now();

    const formattedTechQs = techQs.map((q, index) => ({
      id: `q-tech-${timestamp}-${index}`,
      category: q.category,
      question: q.question,
      difficulty: q.difficulty,
      source: 'tech' as const,
      answer: undefined,
      userAnswer: '',
      isAnswerLoading: false,
      followUps: []
    }));

    const formattedProjQs = projQs.map((q, index) => ({
      id: `q-proj-${timestamp}-${index}`,
      category: q.category,
      question: q.question,
      difficulty: q.difficulty,
      source: 'project' as const,
      answer: undefined,
      userAnswer: '',
      isAnswerLoading: false,
      followUps: []
    }));

    return [...formattedTechQs, ...formattedProjQs];

  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};

export const generateAnswer = async (
  question: string,
  stacks: TechStack[],
  context: string,
  userAnswer?: string
): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  // Clean up inputs to avoid undefined/null in prompt
  const stackText = stacks.length > 0 ? stacks.join(", ") : "未指定";
  const contextText = context.trim().length > 0 ? context : "未提供具体项目背景";

  let prompt = `
    你是一位辅导候选人的高级前端工程师。
    
    面试上下文:
    - 涉及技术: ${stackText}
    - 项目背景: ${contextText}
    
    面试问题: "${question}"
  `;

  if (userAnswer && userAnswer.trim().length > 0) {
    prompt += `
    候选人的回答: "${userAnswer}"
    
    请按以下步骤提供反馈（简体中文）：
    1. **点评**: 指出回答中的亮点和不足（准确性、深度）。
    2. **参考答案**: 提供一个清晰、专业的高分回答思路。**必须包含一段具体的代码示例来演示关键逻辑（使用 Markdown 代码块格式）**。
    3. **关键词**: 列出核心术语。
    4. 保持鼓励性，总字数控制在 400 字以内。
    请使用 Markdown 格式（如列表、加粗等）来组织内容，使其易于阅读。
    `;
  } else {
    prompt += `
    请提供一个简明扼要的高分回答指南（简体中文）：
    1. **核心概念**: 简要解释。
    2. **结合场景**: 如果项目背景相关，请结合说明；如果是纯技术题，举例说明。
    3. **代码演示**: **必须包含一段具体的代码示例（使用 Markdown 代码块格式）**。
    4. **关键点**: 候选人必须提到的术语。
    5. 尽可能控制在 300 字以内，使用要点形式。
    请使用 Markdown 格式（如列表、加粗等）来组织内容，使其易于阅读。
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    
    return response.text || "暂时无法生成回答。";
  } catch (error) {
    console.error("Error generating answer:", error);
    return "错误：无法检索 AI 建议。";
  }
};

export const generateFollowUp = async (
  originalQuestion: string,
  stacks: TechStack[],
  context: string,
  userOriginalAnswer: string | undefined,
  aiOriginalFeedback: string | undefined,
  followUpQuestion: string,
  previousFollowUps: FollowUp[]
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const stackText = stacks.length > 0 ? stacks.join(", ") : "未指定";
  const contextText = context.trim().length > 0 ? context : "未提供具体项目背景";

  let prompt = `
    你是一位高级前端技术面试官。我们正在深入讨论一道面试题。

    技术栈: ${stackText}
    项目背景: ${contextText}

    原面试题: "${originalQuestion}"
    候选人原回答: "${userOriginalAnswer || '（未提供）'}"
    你之前的点评/参考答案: "${aiOriginalFeedback || '（未提供）'}"

    之前的追问记录:
    ${previousFollowUps.map(f => `问: ${f.question}\n答: ${f.answer}`).join('\n')}

    候选人现在的追问: "${followUpQuestion}"

    请针对候选人的追问进行解答。如果是在探讨技术细节，请深入浅出。如果涉及到具体用法，**请提供代码示例（使用 Markdown 代码块格式）**。
    保持专业、鼓励性。请使用 Markdown 格式（简体中文）。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    
    return response.text || "暂时无法生成回答。";
  } catch (error) {
    console.error("Error generating follow-up:", error);
    return "错误：无法检索 AI 回复。";
  }
};