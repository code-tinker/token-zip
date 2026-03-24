import { ChatMessage } from './types';

export const COMPRESS_SYSTEM_PROMPT = `你是文言文翻译器。把用户发来的每条消息翻译成精炼文言文。

严格要求：
- 保留 [N|role] 标签，原样输出
- 只输出翻译结果，禁止任何解释、分析、注释
- 代码、术语、数字、URL 保持原样
- 输出长度必须短于或等于输入长度

示例输入：
[1|system]
You are a helpful coding assistant who writes clean Python code.
[2|user]
Please explain how Python decorators work, including the @ syntax and how they can accept arguments.

示例输出：
[1|system]
汝为编程善助，擅书简洁Python代码。
[2|user]
请释Python decorator之理，含@语法及受参之法。`;

export const DECOMPRESS_SYSTEM_PROMPT = `你是一个精准的翻译引擎。你的任务是将文言文回答翻译为与用户原始问题相同的语言。

核心规则：
1. 输出语言必须与"原始问题"的语言严格一致（英文问则英文答，中文问则中文答）
2. 完整保留所有语义信息、技术细节、代码块和数据
3. 翻译要自然流畅，符合目标语言的表达习惯，不可有翻译腔
4. 保持原回答的结构和格式（标题层级、有序/无序列表、代码块、表格等）
5. 直接输出翻译结果，不加任何解释、前缀、后缀或"以下是翻译"之类的元说明
6. 若原回答中有代码，代码及其注释保持原样`;

export const TARGET_SYSTEM_PREFIX =
  '[核心指令] 以极简文言文作答，惜字如金，不可赘述。代码、术语、数字保持原样。\n\n';

export function buildCompressionUserMessage(messages: ChatMessage[]): string {
  return messages
    .map((m, i) => `[${i + 1}|${m.role}]\n${m.content}`)
    .join('\n\n');
}

export function parseCompressedMessages(
  compressed: string,
  originalMessages: ChatMessage[],
): ChatMessage[] {
  const parts = compressed.split(/(?=\[\d+\|(?:system|user|assistant)\])/).filter(p => p.trim());

  const parsed: ChatMessage[] = parts.map(part => {
    const match = part.match(/^\[(\d+)\|(system|user|assistant)\]\n?([\s\S]*)/);
    if (!match) return null;
    return {
      role: match[2] as ChatMessage['role'],
      content: match[3].trim(),
    };
  }).filter((m): m is ChatMessage => m !== null);

  if (parsed.length !== originalMessages.length) {
    console.warn(
      `[token-zip] Compressed message count mismatch: expected ${originalMessages.length}, got ${parsed.length}. Falling back to original.`,
    );
    return originalMessages;
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].role !== originalMessages[i].role) {
      console.warn(`[token-zip] Role mismatch at message ${i}. Falling back to original.`);
      return originalMessages;
    }
  }

  return parsed;
}

export function buildDecompressionUserMessage(
  originalMessages: ChatMessage[],
  classicalResponse: string,
): string {
  const lastUserMsg = [...originalMessages].reverse().find(m => m.role === 'user');
  const originalQuestion = lastUserMsg?.content || '';

  return `## 原始问题\n${originalQuestion}\n\n## 文言文回答\n${classicalResponse}\n\n请将上述文言文回答翻译为与原始问题相同的语言。`;
}

export function injectTargetSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
  const result = [...messages];
  const systemIdx = result.findIndex(m => m.role === 'system');

  if (systemIdx >= 0) {
    result[systemIdx] = {
      ...result[systemIdx],
      content: TARGET_SYSTEM_PREFIX + result[systemIdx].content,
    };
  } else {
    result.unshift({
      role: 'system',
      content: TARGET_SYSTEM_PREFIX.trim(),
    });
  }

  return result;
}
