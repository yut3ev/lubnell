// Helpful votes on published reviews — one vote per anonymous client, toggle to undo.
// POST { reviewId, clientId } → { voted, helpfulCount }
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { emitLive } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ reviewId?: string; clientId?: string }>(req);
    if (!body.reviewId || !body.clientId) return jsonError("طلب غير صالح");
    const review = await db.review.findUnique({ where: { id: body.reviewId } });
    if (!review || !review.approved) return jsonError("التقييم غير متاح", 404);
    const clientId = body.clientId.slice(0, 64);

    const result = await db.$transaction(async tx => {
      const existing = await tx.reviewVote.findUnique({
        where: { reviewId_clientId: { reviewId: body.reviewId!, clientId } },
      });
      if (existing) {
        await tx.reviewVote.delete({ where: { id: existing.id } });
        const updated = await tx.review.update({
          where: { id: body.reviewId! },
          data: { helpfulCount: { decrement: 1 } },
        });
        return { voted: false, helpfulCount: Math.max(0, updated.helpfulCount) };
      }
      await tx.reviewVote.create({ data: { reviewId: body.reviewId!, clientId } });
      const updated = await tx.review.update({
        where: { id: body.reviewId! },
        data: { helpfulCount: { increment: 1 } },
      });
      return { voted: true, helpfulCount: updated.helpfulCount };
    });

    if (result.voted) {
      await emitLive("review:helpful", { productId: review.productId, helpfulCount: result.helpfulCount, name: review.name });
    }
    return jsonOk({ success: true, ...result });
  } catch {
    return jsonError("تعذر تسجيل التصويت", 500);
  }
}
