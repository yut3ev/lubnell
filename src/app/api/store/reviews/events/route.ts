import { reviewsBus } from '@/lib/reviews-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial ping to confirm stream opened
      controller.enqueue(encoder.encode(': connected\n\n'));

      const handler = () => {
        try {
          controller.enqueue(encoder.encode('data: update\n\n'));
        } catch {
          // Stream might be closed by client
        }
      };

      reviewsBus.on('change', handler);

      // Heartbeat every 20s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20000);

      // Cleanup
      return () => {
        clearInterval(heartbeat);
        reviewsBus.off('change', handler);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
