import { EventEmitter } from 'events';

// In-memory event bus for instant storefront reviews updates
const g = globalThis as unknown as {
  __lubnelReviewsBus?: EventEmitter;
};

export const reviewsBus = (g.__lubnelReviewsBus ??= new EventEmitter());
reviewsBus.setMaxListeners(200);

/** Emit an event that approved reviews have changed (added, approved, deleted, or hidden). */
export function notifyReviewsChanged(): void {
  reviewsBus.emit('change');
}
