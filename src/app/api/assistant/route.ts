import { NextRequest, NextResponse } from 'next/server';
import { askAssistant, type ChatMessage } from '@/lib/ai-agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const clean: ChatMessage[] = messages
      .filter(
        (m: ChatMessage) =>
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0
      )
      .slice(-10)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    if (clean.length === 0 || clean[clean.length - 1].role !== 'user') {
      return NextResponse.json(
        { ok: false, error: 'invalid conversation' },
        { status: 400 }
      );
    }

    const result = await askAssistant(clean);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[assistant]', err);
    return NextResponse.json(
      { ok: false, error: 'assistant unavailable' },
      { status: 500 }
    );
  }
}
