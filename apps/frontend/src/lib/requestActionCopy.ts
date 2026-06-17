export type OfferActionState = 'idle' | 'pending'

export function isServiceRequest(requestType?: string | null): boolean {
  return String(requestType ?? '') === 'service'
}

export function getOfferActionLabel(
  requestType?: string | null,
  state: OfferActionState = 'idle'
): string {
  if (state === 'pending') return isServiceRequest(requestType) ? 'Offering service...' : 'Offering...'
  return isServiceRequest(requestType) ? 'Offer service' : 'Offer to Help'
}

export function getOfferErrorFallback(requestType?: string | null): string {
  return isServiceRequest(requestType) ? 'Failed to offer service' : 'Failed to offer help'
}
