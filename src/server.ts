import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { TokenZipProxy } from './proxy';
import { OpenAIChatCompletionRequest, TokenZipStats } from './types';

export function createServer(proxy: TokenZipProxy, targetModel: string) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'token-zip' });
  });

  app.get('/v1/models', (_req, res) => {
    res.json({
      object: 'list',
      data: [
        {
          id: `token-zip/${targetModel}`,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'token-zip',
        },
      ],
    });
  });

  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const body = req.body as OpenAIChatCompletionRequest;

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        res.status(400).json({
          error: { message: 'messages is required and must be a non-empty array', type: 'invalid_request_error' },
        });
        return;
      }

      const options = {
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        topP: body.top_p,
      };

      if (body.stream) {
        await handleStream(res, proxy, body, options, targetModel);
      } else {
        await handleNonStream(res, proxy, body, options, targetModel);
      }
    } catch (err: any) {
      console.error('[token-zip] Request error:', err);
      res.status(500).json({
        error: {
          message: err.message || 'Internal server error',
          type: 'server_error',
        },
      });
    }
  });

  return app;
}

async function handleNonStream(
  res: Response,
  proxy: TokenZipProxy,
  body: OpenAIChatCompletionRequest,
  options: any,
  targetModel: string,
) {
  const result = await proxy.process(body.messages, options);
  const id = `chatcmpl-tz-${crypto.randomUUID().slice(0, 12)}`;

  res.json({
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: `token-zip/${targetModel}`,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: result.content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: result.stats.compressedInputTokens,
      completion_tokens: result.stats.compressedOutputTokens,
      total_tokens: result.stats.compressedInputTokens + result.stats.compressedOutputTokens,
    },
    token_zip_stats: result.stats,
  });
}

async function handleStream(
  res: Response,
  proxy: TokenZipProxy,
  body: OpenAIChatCompletionRequest,
  options: any,
  targetModel: string,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const id = `chatcmpl-tz-${crypto.randomUUID().slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);

  const sendChunk = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await proxy.processStream(body.messages, options);

    sendChunk({
      id,
      object: 'chat.completion.chunk',
      created,
      model: `token-zip/${targetModel}`,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    });

    for await (const text of result.stream) {
      if (text) {
        sendChunk({
          id,
          object: 'chat.completion.chunk',
          created,
          model: `token-zip/${targetModel}`,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        });
      }
    }

    const stats = await result.getStats();

    sendChunk({
      id,
      object: 'chat.completion.chunk',
      created,
      model: `token-zip/${targetModel}`,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: stats.compressedInputTokens,
        completion_tokens: stats.compressedOutputTokens,
        total_tokens: stats.compressedInputTokens + stats.compressedOutputTokens,
      },
      token_zip_stats: stats,
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[token-zip] Stream error:', err);
    sendChunk({
      id,
      object: 'chat.completion.chunk',
      created,
      model: `token-zip/${targetModel}`,
      choices: [
        {
          index: 0,
          delta: { content: `\n\n[token-zip error: ${err.message}]` },
          finish_reason: 'stop',
        },
      ],
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
