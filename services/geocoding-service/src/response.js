function sendSuccess(res, data, message) {
  const body = { success: true, data }
  if (message) body.message = message
  return res.json(body)
}

function sendError(res, status, error, message) {
  return res.status(status).json({ success: false, message, error })
}

module.exports = { sendSuccess, sendError }
