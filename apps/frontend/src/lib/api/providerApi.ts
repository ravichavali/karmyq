import { requestApi } from '../api'

export async function getMyOffers() {
  const response = await requestApi.get('/providers/offers')
  return response.data
}

export async function submitOffer(requestId: string, price: number | null, note: string) {
  const response = await requestApi.post('/providers/offers', { request_id: requestId, price, note })
  return response.data
}

export async function withdrawOffer(offerId: string) {
  const response = await requestApi.put(`/providers/offers/${offerId}/withdraw`)
  return response.data
}

export async function getMatchingRequests() {
  const response = await requestApi.get('/requests', { params: { status: 'open', limit: 20 } })
  return response.data
}
