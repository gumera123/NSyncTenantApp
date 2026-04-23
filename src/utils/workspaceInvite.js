import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

export async function getPendingInviteForEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const inviteQuery = query(
    collection(db, 'invites'),
    where('invitedEmail', '==', normalizedEmail),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(inviteQuery);

  if (snapshot.empty) {
    return null;
  }

  const sortedInvites = snapshot.docs
    .map((inviteDoc) => ({ id: inviteDoc.id, ...inviteDoc.data() }))
    .sort((left, right) => {
      const leftSeconds = left.createdAt?.seconds || 0;
      const rightSeconds = right.createdAt?.seconds || 0;
      return rightSeconds - leftSeconds;
    });

  return sortedInvites[0] || null;
}

export async function getRegisteredUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const userQuery = query(
    collection(db, 'users'),
    where('email', '==', normalizedEmail)
  );

  const snapshot = await getDocs(userQuery);

  if (snapshot.empty) {
    return null;
  }

  const userDoc = snapshot.docs[0];

  return {
    id: userDoc.id,
    ...userDoc.data(),
  };
}

export async function createNotification({
  targetUserId,
  title,
  message,
  type,
  actorUid = '',
  organizationId = '',
  metadata = {},
}) {
  if (!targetUserId) {
    return null;
  }

  return addDoc(collection(db, 'notifications'), {
    targetUserId,
    title,
    message,
    type,
    actorUid,
    organizationId,
    metadata,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function loadUserNotifications(userUid) {
  if (!userUid) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, 'notifications'), where('targetUserId', '==', userUid))
  );

  return snapshot.docs
    .map((notificationDoc) => ({
      id: notificationDoc.id,
      ...notificationDoc.data(),
    }))
    .sort((left, right) => {
      const leftSeconds = left.createdAt?.seconds || 0;
      const rightSeconds = right.createdAt?.seconds || 0;
      return rightSeconds - leftSeconds;
    });
}

export async function markNotificationsAsRead(notificationIds = []) {
  const validNotificationIds = notificationIds.filter(Boolean);

  if (validNotificationIds.length === 0) {
    return;
  }

  const batch = writeBatch(db);

  validNotificationIds.forEach((notificationId) => {
    batch.update(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function deleteNotificationById(notificationId) {
  if (!notificationId) {
    throw new Error('Notification not found.');
  }

  await deleteDoc(doc(db, 'notifications', notificationId));
}

export async function deleteAllNotificationsForUser(userUid) {
  if (!userUid) {
    throw new Error('User not found.');
  }

  const snapshot = await getDocs(
    query(collection(db, 'notifications'), where('targetUserId', '==', userUid))
  );

  if (snapshot.empty) {
    return 0;
  }

  const batch = writeBatch(db);

  snapshot.docs.forEach((notificationDoc) => {
    batch.delete(doc(db, 'notifications', notificationDoc.id));
  });

  await batch.commit();

  return snapshot.docs.length;
}

async function notifyAdminMemberLogin({
  user,
  userData,
  userRef,
  organizationId,
}) {
  if (!organizationId || organizationId === user.uid) {
    return;
  }

  const signInKey = user.metadata?.lastSignInTime || '';

  if (!signInKey || userData.lastNotifiedSignInAt === signInKey) {
    return;
  }

  const actorName = userData.name || user.email || 'A member';

  await createNotification({
    targetUserId: organizationId,
    title: 'Member logged in',
    message: `${actorName} logged in to your workspace.`,
    type: 'member_login',
    actorUid: user.uid,
    organizationId,
    metadata: {
      memberUid: user.uid,
      memberEmail: normalizeEmail(user.email || ''),
      signInAt: signInKey,
    },
  });

  await updateDoc(userRef, {
    lastNotifiedSignInAt: signInKey,
    updatedAt: serverTimestamp(),
  });
}

export async function syncWorkspaceAccessForUser(user) {
  if (!user?.email || !user?.uid) {
    return null;
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    return null;
  }

  const userData = userSnapshot.data();
  const currentRole = (userData.role || '').toLowerCase();
  const currentOrganizationId = userData.organizationId || '';

  // Ensure every account has a remembered home workspace to support leave/rejoin flows.
  if (!userData.homeOrganizationId) {
    await updateDoc(userRef, {
      homeOrganizationId: user.uid,
      homeOrganizationName: userData.homeOrganizationName || userData.organizationName || userData.name || '',
      updatedAt: serverTimestamp(),
    });
  }

  const invite = await getPendingInviteForEmail(user.email);

  if (invite) {
    return { appliedInvite: false, role: userData.role || null, invitePending: true, invite };
  }

  if (currentRole === 'admin') {
    if (!currentOrganizationId) {
      await updateDoc(userRef, {
        organizationId: user.uid,
        updatedAt: serverTimestamp(),
      });
    }

    return { appliedInvite: false, role: 'Admin' };
  }

  if (!currentRole && !currentOrganizationId) {
    await updateDoc(userRef, {
      role: 'Admin',
      workspaceRoleTitle: userData.workspaceRoleTitle || 'Workspace Owner',
      organizationId: user.uid,
      organizationName: userData.organizationName || userData.name || '',
      updatedAt: serverTimestamp(),
    });

    return { appliedInvite: false, role: 'Admin' };
  }

  await notifyAdminMemberLogin({
    user,
    userData,
    userRef,
    organizationId: currentOrganizationId,
  });

  return { appliedInvite: false, role: userData.role || null };
}

export async function createWorkspaceInvite({
  invitedEmail,
  role,
  invitedByUid,
  invitedByName,
  organizationId,
  organizationName,
}) {
  const normalizedEmail = normalizeEmail(invitedEmail);

  if (!normalizedEmail) {
    throw new Error('Invitation email is required.');
  }

  const registeredUser = await getRegisteredUserByEmail(normalizedEmail);

  if (!registeredUser) {
    throw new Error('This email must already be registered before it can be invited.');
  }

  const inviteRef = await addDoc(collection(db, 'invites'), {
    invitedEmail: normalizedEmail,
    role,
    invitedBy: invitedByUid,
    invitedByName: invitedByName || '',
    organizationId,
    organizationName: organizationName || '',
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  await createNotification({
    targetUserId: registeredUser.id,
    title: 'Workspace invitation',
    message: `${invitedByName || 'An admin'} invited you to join a workspace as ${role}.`,
    type: 'invite_received',
    actorUid: invitedByUid,
    organizationId,
    metadata: {
      inviteId: inviteRef.id,
      invitedEmail: normalizedEmail,
      role,
    },
  });

  return inviteRef;
}

export async function respondToWorkspaceInvite({
  inviteId,
  notificationId,
  userUid,
  response,
}) {
  if (!inviteId || !userUid) {
    throw new Error('Invitation details are incomplete.');
  }

  if (!['accepted', 'declined'].includes(response)) {
    throw new Error('Invalid invitation response.');
  }

  const inviteRef = doc(db, 'invites', inviteId);
  const userRef = doc(db, 'users', userUid);

  const [inviteSnapshot, userSnapshot] = await Promise.all([
    getDoc(inviteRef),
    getDoc(userRef),
  ]);

  if (!inviteSnapshot.exists()) {
    throw new Error('Invitation no longer exists.');
  }

  if (!userSnapshot.exists()) {
    throw new Error('User profile was not found.');
  }

  const invite = inviteSnapshot.data();
  const userData = userSnapshot.data();
  const normalizedUserEmail = normalizeEmail(userData.email || '');

  if (invite.status !== 'pending') {
    throw new Error(`This invitation was already ${invite.status || 'processed'}.`);
  }

  if (normalizedUserEmail && invite.invitedEmail !== normalizedUserEmail) {
    throw new Error('This invitation does not belong to the current user.');
  }

  const actorName = userData.name || userData.email || 'A member';
  const organizationId = invite.organizationId || userUid;

  if (response === 'accepted') {
    const workspaceRoleTitle = invite.role || userData.workspaceRoleTitle || 'Member';

    await updateDoc(userRef, {
      role: 'Member',
      workspaceRoleTitle,
      organizationId,
      organizationName: invite.organizationName || userData.organizationName || '',
      invitedBy: invite.invitedBy || '',
      homeOrganizationId: userData.homeOrganizationId || userUid,
      homeOrganizationName: userData.homeOrganizationName || userData.organizationName || userData.name || '',
      updatedAt: serverTimestamp(),
    });

    await updateDoc(inviteRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedByUid: userUid,
      acceptedByEmail: normalizedUserEmail,
      respondedAt: serverTimestamp(),
    });

    if (invite.invitedBy) {
      await createNotification({
        targetUserId: invite.invitedBy,
        title: 'Invitation accepted',
        message: `${actorName} accepted your workspace invitation.`,
        type: 'invite_accepted',
        actorUid: userUid,
        organizationId,
        metadata: {
          inviteId,
          memberUid: userUid,
          memberEmail: normalizedUserEmail,
          role: workspaceRoleTitle,
        },
      });
    }
  } else {
    await updateDoc(inviteRef, {
      status: 'declined',
      declinedAt: serverTimestamp(),
      declinedByUid: userUid,
      declinedByEmail: normalizedUserEmail,
      respondedAt: serverTimestamp(),
    });

    if (invite.invitedBy) {
      await createNotification({
        targetUserId: invite.invitedBy,
        title: 'Invitation declined',
        message: `${actorName} declined your workspace invitation.`,
        type: 'invite_declined',
        actorUid: userUid,
        organizationId,
        metadata: {
          inviteId,
          memberUid: userUid,
          memberEmail: normalizedUserEmail,
          role: invite.role || 'Member',
        },
      });
    }
  }

  if (notificationId) {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      respondedAt: serverTimestamp(),
      response,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    inviteId,
    response,
  };
}

export async function loadWorkspaceMembers(organizationId, currentUserUid) {
  if (!organizationId) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, 'users'), where('organizationId', '==', organizationId))
  );

  const members = snapshot.docs.map((userDoc) => ({
    id: userDoc.id,
    ...userDoc.data(),
  }));

  if (currentUserUid && !members.some((member) => member.id === currentUserUid)) {
    const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
    if (currentUserDoc.exists()) {
      members.unshift({ id: currentUserDoc.id, ...currentUserDoc.data() });
    }
  }

  return members;
}

export async function loadWorkspaceInvites(organizationId) {
  if (!organizationId) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, 'invites'), where('organizationId', '==', organizationId), where('status', '==', 'pending'))
  );

  return snapshot.docs.map((inviteDoc) => ({
    id: inviteDoc.id,
    ...inviteDoc.data(),
  }));
}

export async function leaveCurrentWorkspace(userUid) {
  if (!userUid) {
    throw new Error('User not found.');
  }

  const userRef = doc(db, 'users', userUid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error('User profile was not found.');
  }

  const userData = userSnapshot.data();
  const currentOrganizationId = userData.organizationId || userUid;

  if (currentOrganizationId === userUid) {
    throw new Error('You are already in your own workspace.');
  }

  const homeOrganizationId = userData.homeOrganizationId || userUid;
  const homeOrganizationName = userData.homeOrganizationName || userData.name || 'My Workspace';

  await updateDoc(userRef, {
    role: 'Admin',
    workspaceRoleTitle: 'Workspace Owner',
    organizationId: homeOrganizationId,
    organizationName: homeOrganizationName,
    invitedBy: '',
    updatedAt: serverTimestamp(),
  });

  if (currentOrganizationId && currentOrganizationId !== userUid) {
    const actorName = userData.name || userData.email || 'A member';
    await createNotification({
      targetUserId: currentOrganizationId,
      title: 'Member left workspace',
      message: `${actorName} left your workspace.`,
      type: 'member_left_workspace',
      actorUid: userUid,
      organizationId: currentOrganizationId,
      metadata: {
        memberUid: userUid,
        memberEmail: normalizeEmail(userData.email || ''),
      },
    });
  }
}
