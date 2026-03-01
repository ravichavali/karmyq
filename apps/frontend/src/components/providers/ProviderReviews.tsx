import React, { useState } from 'react';
import { providerService } from '../../lib/api';

interface Review {
  id: string;
  reviewer_id: string;
  stars: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

interface ProviderReviewsProps {
  providerId: string;
  reviews: Review[];
  currentUserId?: string;
  onReviewSubmitted?: () => void;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition ${star <= value ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProviderReviews({ providerId, reviews, currentUserId, onReviewSubmitted }: ProviderReviewsProps) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars === 0) { setError('Please select a star rating'); return; }
    setSubmitting(true);
    setError('');
    try {
      await providerService.submitReview({ provider_id: providerId, stars, review_text: text || undefined });
      setSubmitted(true);
      setStars(0);
      setText('');
      onReviewSubmitted?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-text">Reviews</h3>

      {reviews.length === 0 && (
        <p className="text-sm text-text-muted">No reviews yet.</p>
      )}

      <div className="space-y-3">
        {reviews.map(review => (
          <div key={review.id} className="bg-surface-raised rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-gradient-to-br from-karmyq-green-500 to-karmyq-teal-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {(review.reviewer_name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-text">{review.reviewer_name ?? 'Community member'}</span>
              </div>
              <span className="text-xs text-text-subtle">{formatDate(review.created_at)}</span>
            </div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-yellow-500 text-sm">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</span>
            </div>
            {review.review_text && <p className="text-sm text-text-muted">{review.review_text}</p>}
          </div>
        ))}
      </div>

      {currentUserId && !submitted && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium text-text">Leave a review</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <StarPicker value={stars} onChange={setStars} />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Describe your experience (optional)"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit review'}
          </button>
        </form>
      )}

      {submitted && (
        <p className="text-sm text-success font-medium">Review submitted — thank you!</p>
      )}
    </div>
  );
}
