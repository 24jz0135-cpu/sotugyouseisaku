// A Discord message can contain several receipts. Delete it only after every
// attachment has been saved by its owning PC. Keep failed deletions retryable.
export async function acknowledgeReceipts(state, deviceId, ids, deleteMessage, save) {
  for (const id of ids) {
    const receipt = state.receipts[id];
    if (receipt?.deviceId === deviceId) receipt.acknowledged = true;
  }
  await save();
  const groups = new Map();
  for (const receipt of Object.values(state.receipts)) {
    const key = `${receipt.channelId}/${receipt.messageId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(receipt);
  }
  for (const receipts of groups.values()) {
    if (!receipts.every(item => item.acknowledged)) continue;
    try { await deleteMessage(receipts[0]); }
    catch { continue; }
    for (const receipt of receipts) delete state.receipts[receipt.id];
  }
  await save();
}

export async function expireSessions(state, now, deleteWebhook) {
  for (const [id, session] of Object.entries(state.sessions)) {
    if (session.expiresAt > now) continue;
    try { await deleteWebhook(session.webhookId); }
    catch { continue; }
    delete state.sessions[id];
  }
  for (const [id, pair] of Object.entries(state.pairings)) {
    if (pair.expiresAt > now) continue;
    if (!state.devices[pair.deviceId]?.channelId) delete state.devices[pair.deviceId];
    delete state.pairings[id];
  }
}
