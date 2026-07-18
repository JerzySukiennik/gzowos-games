import { createHash, randomBytes } from 'node:crypto';

// Durable repository over firebase-admin Firestore + RTDB.
// Collection layout mirrors what the dashboard subscribes to (games, threads,
// parentConsents, reports for admins); trusted-only state lives in collections
// with no security rules, which Firestore denies to every client by default
// (launchJtis, eventChannels, sdkChallenges, evidence, messageIndex, admins,
// monitorRuns).
export class FirestoreRepository {
  constructor({ firestore, rtdb, timestampFromMillis }) {
    if (!firestore || !rtdb || !timestampFromMillis) throw new Error('firestore, rtdb and timestampFromMillis are required');
    this.db = firestore;
    this.rtdb = rtdb;
    this.ts = timestampFromMillis;
  }

  async getGame(id) {
    const snapshot = await this.db.collection('games').doc(id).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  async saveTrustedGameCheck(id, check) {
    const ref = this.db.collection('games').doc(id);
    return this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error('Game not found');
      tx.update(ref, check);
      return { id, ...snapshot.data(), ...check };
    });
  }

  async setAgeBand(uid, band) {
    await this.db.collection('ageBands').doc(uid).set({ band });
    await this.rtdb.ref(`ageBands/${uid}`).set(band);
    return { uid, band };
  }

  async getAgeBand(uid) {
    const snapshot = await this.db.collection('ageBands').doc(uid).get();
    return snapshot.exists ? snapshot.data().band : null;
  }

  async provisionIdentity(record) {
    const identityRef = this.db.collection('users').doc(record.uid).collection('private').doc('identity');
    const bandRef = this.db.collection('ageBands').doc(record.uid);
    const consentRef = this.db.collection('parentConsents').doc(record.uid);
    const result = await this.db.runTransaction(async tx => {
      const existing = await tx.get(identityRef);
      if (existing.exists) throw Object.assign(new Error('Identity is already provisioned'), { status: 409 });
      tx.set(identityRef, { uid: record.uid, dateOfBirth: record.dateOfBirth, ageBand: record.ageBand, parentEmail: record.parentEmail || '', createdAt: record.createdAt });
      tx.set(bandRef, { band: record.ageBand });
      if (record.parentConsent) tx.set(consentRef, { ...record.parentConsent, createdAt: this.ts(record.parentConsent.createdAt) });
      return { uid: record.uid, ageBand: record.ageBand, parentConsentStatus: record.parentConsent?.status || 'not-required' };
    });
    await this.rtdb.ref(`ageBands/${record.uid}`).set(record.ageBand);
    return result;
  }

  async isAcceptedFriendship(a, b) {
    if (a === b) return true;
    const snapshot = await this.db.collection('friendships').doc([a, b].sort().join('_')).get();
    return snapshot.exists && snapshot.data().status === 'accepted';
  }

  async getAuthorizedPartyMembers(uid, requested) {
    const checks = await Promise.all(requested.filter(id => id !== uid).slice(0, 8).map(async id => (await this.isAcceptedFriendship(uid, id)) ? id : null));
    return checks.filter(Boolean);
  }

  async authorizeLaunchSession(uid, gameId, requested) {
    const sessionId = typeof requested?.sessionId === 'string' && requested.sessionId.length <= 128 ? requested.sessionId : null;
    if (sessionId) {
      const snapshot = await this.rtdb.ref(`sessions/${sessionId}`).get();
      const session = snapshot.val();
      if (session && session.gameId === gameId && (session.hostId === uid || await this.isAcceptedFriendship(uid, session.hostId))) {
        return { sessionId, joinData: { mode: 'join', ...(requested.joinData || {}) } };
      }
    }
    return { sessionId: randomBytes(16).toString('hex'), joinData: { mode: 'create' } };
  }

  async setAdmin(uid, enabled) {
    await this.db.collection('admins').doc(uid).set({ admin: Boolean(enabled) });
    return { uid, admin: Boolean(enabled) };
  }

  async writeAudit(entry) {
    await this.db.collection('audit').add({ ...entry, createdAt: this.ts(entry.at || Date.now()) });
    return entry;
  }

  async consumeLaunchJti({ jti, exp, gameId, userId, origin, permissions, now }) {
    const jtiRef = this.db.collection('launchJtis').doc(jti);
    const token = randomBytes(32).toString('base64url');
    const channelRef = this.db.collection('eventChannels').doc(createHash('sha256').update(token).digest('hex'));
    try {
      await this.db.runTransaction(async tx => {
        const existing = await tx.get(jtiRef);
        if (existing.exists) throw Object.assign(new Error('consumed'), { code: 'consumed' });
        tx.set(jtiRef, { expiresAt: exp * 1000 });
        tx.set(channelRef, { gameId, userId, origin, permissions, lastSequence: 0, expiresAt: exp * 1000, createdAt: now });
      });
    } catch (error) {
      if (error.code === 'consumed') return null;
      throw error;
    }
    return token;
  }

  async recordLaunchEvent({ channelToken, sequence, type, payload, origin, now }) {
    const ref = this.db.collection('eventChannels').doc(createHash('sha256').update(channelToken).digest('hex'));
    try {
      return await this.db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const channel = snapshot.exists ? snapshot.data() : null;
        if (!channel || channel.expiresAt <= now || origin !== channel.origin || sequence !== channel.lastSequence + 1) throw Object.assign(new Error('invalid'), { code: 'invalid-event' });
        if (['ready', 'presence'].includes(type) && payload.gameId !== channel.gameId) throw Object.assign(new Error('invalid'), { code: 'invalid-event' });
        if (type === 'session' && payload.gameId && payload.gameId !== channel.gameId) throw Object.assign(new Error('invalid'), { code: 'invalid-event' });
        if (type === 'presence' && !channel.permissions.includes('presence:write')) throw Object.assign(new Error('invalid'), { code: 'invalid-event' });
        if (type === 'session' && !channel.permissions.some(permission => permission === 'session:create' || permission === 'session:join')) throw Object.assign(new Error('invalid'), { code: 'invalid-event' });
        tx.update(ref, { lastSequence: sequence });
        return { gameId: channel.gameId, userId: channel.userId, sequence, type, payload, at: now };
      });
    } catch (error) {
      if (error.code === 'invalid-event') return null;
      throw error;
    }
  }

  async canCreateSdkChallenge(gameId, ownerId) {
    const game = await this.getGame(gameId);
    return !game || game.ownerId === ownerId;
  }

  async isTrustedCorsOrigin(origin) {
    const games = await this.db.collection('games').where('origin', '==', origin).limit(10).get();
    if (games.docs.some(doc => { const game = doc.data(); return game.status === 'published' && game.sdkPassed === true; })) return true;
    const challenges = await this.db.collection('sdkChallenges').where('origin', '==', origin).where('status', '==', 'pending').limit(10).get();
    return challenges.docs.some(doc => doc.data().expiresAt > Date.now());
  }

  async createSdkChallenge(challenge) {
    await this.db.collection('sdkChallenges').doc(challenge.id).set(challenge);
    return { ...challenge };
  }

  async getSdkChallenge(id, ownerId) {
    const snapshot = await this.db.collection('sdkChallenges').doc(id).get();
    const item = snapshot.exists ? snapshot.data() : null;
    return item && item.ownerId === ownerId ? { ...item } : null;
  }

  async completeSdkChallenge(id, origin, now) {
    const ref = this.db.collection('sdkChallenges').doc(id);
    try {
      await this.db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const item = snapshot.exists ? snapshot.data() : null;
        if (!item || item.origin !== origin || item.expiresAt <= now || item.status !== 'pending') throw Object.assign(new Error('invalid'), { code: 'invalid-challenge' });
        tx.update(ref, { status: 'passed', passedAt: now });
      });
      return true;
    } catch (error) {
      if (error.code === 'invalid-challenge') return false;
      throw error;
    }
  }

  async claimSdkChallenge(id, ownerId, gameData, now) {
    const challengeRef = this.db.collection('sdkChallenges').doc(id);
    const gameRef = this.db.collection('games').doc(gameData.id);
    try {
      return await this.db.runTransaction(async tx => {
        const [challengeSnapshot, gameSnapshot] = await Promise.all([tx.get(challengeRef), tx.get(gameRef)]);
        const item = challengeSnapshot.exists ? challengeSnapshot.data() : null;
        const current = gameSnapshot.exists ? { id: gameSnapshot.id, ...gameSnapshot.data() } : null;
        if (!item || item.ownerId !== ownerId || item.status !== 'passed' || item.gameId !== gameData.id || item.url !== gameData.url || (current && current.ownerId !== ownerId)) throw Object.assign(new Error('invalid'), { code: 'invalid-claim' });
        let game;
        if (current?.status === 'published') {
          game = { ...current, title: gameData.title, ageRating: gameData.ageRating, notes: gameData.notes, pendingUrl: item.url, pendingSdkHandshakeOrigin: item.origin, pendingSdkCheckedAt: item.passedAt || now };
        } else {
          game = { ...current, ...gameData, ownerId, status: 'submitted', sdkHandshakeOrigin: item.origin, sdkPassed: true, sdkCheckedAt: item.passedAt || now, origin: item.origin, visibility: current?.visibility || 'visible' };
        }
        const { id: gameId, ...gameFields } = game;
        tx.set(gameRef, gameFields);
        tx.update(challengeRef, { status: 'claimed' });
        return { ...game, id: gameData.id };
      });
    } catch (error) {
      if (error.code === 'invalid-claim') return null;
      throw error;
    }
  }

  async findMessage(messageId) {
    const indexSnapshot = await this.db.collection('messageIndex').doc(messageId).get();
    if (!indexSnapshot.exists) return null;
    const { threadId } = indexSnapshot.data();
    const messageSnapshot = await this.db.collection('threads').doc(threadId).collection('messages').doc(messageId).get();
    return messageSnapshot.exists ? { ...messageSnapshot.data(), threadId } : null;
  }

  async canAccessReportTarget(reporterId, targetKind, targetId) {
    if (targetKind !== 'message') return true;
    const message = await this.findMessage(targetId);
    if (!message) return false;
    const thread = await this.db.collection('threads').doc(message.threadId).get();
    return thread.exists && (thread.data().members || []).includes(reporterId);
  }

  async captureReport({ id, reporterId, targetKind, targetId, reason, createdAt, retentionUntil }) {
    let evidence = null;
    if (targetKind === 'message') {
      const message = await this.findMessage(targetId);
      if (message) evidence = { kind: 'message', id: message.id, threadId: message.threadId, authorId: message.authorId, text: message.text, createdAt: message.createdAtMillis || createdAt, retentionUntil, legalHold: true, sha256: createHash('sha256').update(JSON.stringify({ id: message.id, threadId: message.threadId, authorId: message.authorId, text: message.text })).digest('hex') };
    }
    const report = { id, reporterId, targetKind, targetId, reason, retentionUntil, status: 'open', evidenceId: evidence ? `evidence-${id}` : null };
    await this.db.collection('reports').doc(id).set({ ...report, target: targetId, createdAt: this.ts(createdAt) });
    if (evidence) await this.db.collection('evidence').doc(report.evidenceId).set({ ...evidence, reportId: id, preservedAt: createdAt });
    return { ...report, createdAt, evidence };
  }

  async chatPolicyAllows(uid) {
    const band = await this.getAgeBand(uid);
    if (!band) return false;
    if (band !== 'U13') return true;
    const [consent, controls] = await Promise.all([
      this.db.collection('parentConsents').doc(uid).get(),
      this.db.collection('parentControls').doc(uid).get()
    ]);
    return consent.exists && consent.data().status === 'approved' && controls.exists && controls.data().chatEnabled === true;
  }

  async createThread({ id, ownerId, members, name, createdAt }) {
    const unique = [...new Set(members)];
    if (!unique.includes(ownerId) || unique.length < 2 || unique.length > 8) return null;
    for (const member of unique) {
      if (!await this.chatPolicyAllows(member)) return null;
      if (member !== ownerId && !await this.isAcceptedFriendship(ownerId, member)) return null;
    }
    const thread = { ownerId, members: unique, name, createdAt: this.ts(createdAt) };
    await this.db.collection('threads').doc(id).set(thread);
    return { id, ownerId, members: unique, name, createdAt };
  }

  async sendMessage({ id, threadId, authorId, text, kind, createdAt, expiresAt }) {
    const threadSnapshot = await this.db.collection('threads').doc(threadId).get();
    const thread = threadSnapshot.exists ? threadSnapshot.data() : null;
    if (!thread?.members?.includes(authorId)) return null;
    for (const member of thread.members) if (!await this.chatPolicyAllows(member)) return null;
    const batch = this.db.batch();
    batch.set(this.db.collection('threads').doc(threadId).collection('messages').doc(id), { id, authorId, text, kind, createdAt: this.ts(createdAt), createdAtMillis: createdAt, expiresAt: expiresAt || null });
    batch.set(this.db.collection('messageIndex').doc(id), { threadId, kind, expiresAt: expiresAt || null });
    await batch.commit();
    return { id, threadId, authorId, text, kind, createdAt, expiresAt };
  }

  async approveParentConsent(childUid, parent) {
    const ref = this.db.collection('parentConsents').doc(childUid);
    try {
      return await this.db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const consent = snapshot.exists ? snapshot.data() : null;
        if (!consent || consent.status !== 'pending' || parent.emailVerified !== true || consent.parentEmail !== parent.email?.toLowerCase()) throw Object.assign(new Error('denied'), { code: 'consent-denied' });
        tx.update(ref, { status: 'approved', approvedAt: parent.now, approvedBy: parent.uid });
        return { ...consent, status: 'approved', approvedAt: parent.now };
      });
    } catch (error) {
      if (error.code === 'consent-denied') return null;
      throw error;
    }
  }

  async moderateReport({ reportId, action, actorId, now }) {
    const ref = this.db.collection('reports').doc(reportId);
    let report;
    try {
      report = await this.db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const current = snapshot.exists ? snapshot.data() : null;
        if (!current || current.status !== 'open') throw Object.assign(new Error('closed'), { code: 'report-closed' });
        const status = action === 'dismiss' ? 'dismissed' : 'resolved';
        tx.update(ref, { status, action, resolvedAt: now });
        return { ...current, status, action, resolvedAt: now };
      });
    } catch (error) {
      if (error.code === 'report-closed') return null;
      throw error;
    }
    await this.writeAudit({ action: `report-${action}`, actorId, targetId: reportId, at: now });
    return report;
  }

  async cleanupExpired({ now }) {
    let evidenceDeleted = 0, messagesDeleted = 0, gamesDeleted = 0;
    const expiredEvidence = await this.db.collection('evidence').where('retentionUntil', '<=', now).limit(200).get();
    for (const doc of expiredEvidence.docs) {
      const report = await this.db.collection('reports').doc(doc.data().reportId).get();
      if (report.exists && report.data().status === 'open') continue;
      await doc.ref.delete();
      evidenceDeleted += 1;
    }
    const expiredMessages = await this.db.collection('messageIndex').where('expiresAt', '<=', now).limit(500).get();
    for (const doc of expiredMessages.docs) {
      if (doc.data().kind !== 'session' || !doc.data().expiresAt) continue;
      const held = await this.db.collection('evidence').where('id', '==', doc.id).where('legalHold', '==', true).limit(1).get();
      if (!held.empty) continue;
      await this.db.collection('threads').doc(doc.data().threadId).collection('messages').doc(doc.id).delete();
      await doc.ref.delete();
      messagesDeleted += 1;
    }
    const expiredGames = await this.db.collection('games').where('deleteAt', '<=', now).limit(100).get();
    for (const doc of expiredGames.docs) {
      if (!doc.data().deleteAt) continue;
      await doc.ref.delete();
      gamesDeleted += 1;
    }
    const expiredJtis = await this.db.collection('launchJtis').where('expiresAt', '<=', now).limit(500).get();
    for (const doc of expiredJtis.docs) await doc.ref.delete();
    const expiredChannels = await this.db.collection('eventChannels').where('expiresAt', '<=', now).limit(500).get();
    for (const doc of expiredChannels.docs) await doc.ref.delete();
    return { messagesDeleted, evidenceDeleted, gamesDeleted };
  }

  async recordMonitor(id, result) {
    const entry = { gameId: id, ...result };
    await this.db.collection('monitorRuns').add({ ...entry, createdAt: this.ts(Date.now()) });
    return entry;
  }
}
