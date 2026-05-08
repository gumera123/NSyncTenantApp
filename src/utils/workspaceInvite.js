import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

function createWorkspaceInviteToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function encodeWorkspaceInvitePayload(inviteId, inviteToken) {
  return `nsync://workspace-invite?inviteId=${encodeURIComponent(inviteId)}&inviteToken=${encodeURIComponent(inviteToken)}`;
}

export function parseWorkspaceInviteQrPayload(value = '') {
  const text = String(value || '').trim();

  if (!text) {
    return null;
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.inviteId && parsed?.inviteToken) {
        return {
          inviteId: String(parsed.inviteId),
          inviteToken: String(parsed.inviteToken),
        };
      }
    } catch (_error) {
      return null;
    }
  }

  const queryIndex = text.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }

  const params = new URLSearchParams(text.slice(queryIndex + 1));
  const inviteId = params.get('inviteId') || '';
  const inviteToken = params.get('inviteToken') || '';

  if (!inviteId || !inviteToken) {
    return null;
  }

  return { inviteId, inviteToken };
}

export function buildWorkspaceInviteQrPayload(inviteId, inviteToken) {
  if (!inviteId || !inviteToken) {
    return '';
  }

  return encodeWorkspaceInvitePayload(inviteId, inviteToken);
}

export function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function upsertWorkspaceMembership(memberships = [], membership = {}) {
  const organizationId = membership.organizationId || '';

  if (!organizationId) {
    return Array.isArray(memberships) ? memberships.filter(Boolean) : [];
  }

  const normalizedMemberships = Array.isArray(memberships) ? memberships.filter(Boolean) : [];
  const filteredMemberships = normalizedMemberships.filter((currentMembership) => currentMembership.organizationId !== organizationId);

  return [
    ...filteredMemberships,
    {
      organizationId,
      organizationName: membership.organizationName || '',
      role: membership.role || 'Member',
      workspaceRoleTitle: membership.workspaceRoleTitle || membership.role || 'Member',
      invitedBy: membership.invitedBy || '',
    },
  ];
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
      workspaceMemberships: upsertWorkspaceMembership(userData.workspaceMemberships, {
        organizationId: user.uid,
        organizationName: userData.homeOrganizationName || userData.organizationName || userData.name || '',
        role: userData.role || 'Admin',
        workspaceRoleTitle: userData.workspaceRoleTitle || 'Workspace Owner',
        invitedBy: '',
      }),
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
        workspaceMemberships: upsertWorkspaceMembership(userData.workspaceMemberships, {
          organizationId: user.uid,
          organizationName: userData.organizationName || userData.name || '',
          role: 'Admin',
          workspaceRoleTitle: userData.workspaceRoleTitle || 'Workspace Owner',
          invitedBy: '',
        }),
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
      workspaceMemberships: upsertWorkspaceMembership(userData.workspaceMemberships, {
        organizationId: user.uid,
        organizationName: userData.organizationName || userData.name || '',
        role: 'Admin',
        workspaceRoleTitle: userData.workspaceRoleTitle || 'Workspace Owner',
        invitedBy: '',
      }),
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
  workspaceRoleTitle = '',
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
    workspaceRoleTitle: workspaceRoleTitle.trim() || role || 'Member',
    invitedBy: invitedByUid,
    invitedByName: invitedByName || '',
    organizationId,
    organizationName: organizationName || '',
    inviteType: 'email',
    inviteToken: createWorkspaceInviteToken(),
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

export async function createWorkspaceQrInvite({
  role = 'Member',
  workspaceRoleTitle = 'Member',
  invitedByUid,
  invitedByName,
  organizationId,
  organizationName,
}) {
  if (!invitedByUid || !organizationId) {
    throw new Error('Workspace details are incomplete.');
  }

  const inviteToken = createWorkspaceInviteToken();

  const inviteRef = await addDoc(collection(db, 'invites'), {
    invitedEmail: '',
    role,
    workspaceRoleTitle: (workspaceRoleTitle || role || 'Member').trim(),
    invitedBy: invitedByUid,
    invitedByName: invitedByName || '',
    organizationId,
    organizationName: organizationName || '',
    inviteType: 'qr',
    inviteToken,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return {
    inviteRef,
    invitePayload: encodeWorkspaceInvitePayload(inviteRef.id, inviteToken),
  };
}

export async function respondToWorkspaceInvite({
  inviteId,
  inviteToken = '',
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

  if (invite.inviteType === 'qr' && invite.inviteToken && invite.inviteToken !== inviteToken) {
    throw new Error('This QR invitation is invalid or has expired.');
  }

  if (invite.status !== 'pending') {
    throw new Error(`This invitation was already ${invite.status || 'processed'}.`);
  }

  if (invite.invitedEmail && normalizedUserEmail && invite.invitedEmail !== normalizedUserEmail) {
    throw new Error('This invitation does not belong to the current user.');
  }

  const actorName = userData.name || userData.email || 'A member';
  const organizationId = invite.organizationId || userUid;

  if (response === 'accepted') {
    const workspaceRoleTitle = invite.workspaceRoleTitle || invite.role || userData.workspaceRoleTitle || 'Member';

    await updateDoc(userRef, {
      role: 'Member',
      workspaceRoleTitle,
      organizationId,
      organizationName: invite.organizationName || userData.organizationName || '',
      invitedBy: invite.invitedBy || '',
      workspaceMemberships: upsertWorkspaceMembership(userData.workspaceMemberships, {
        organizationId: userData.organizationId || userUid,
        organizationName: userData.organizationName || '',
        role: userData.role || 'Member',
        workspaceRoleTitle: userData.workspaceRoleTitle || 'Member',
        invitedBy: userData.invitedBy || '',
      }).concat(
        upsertWorkspaceMembership([], {
          organizationId,
          organizationName: invite.organizationName || '',
          role: 'Member',
          workspaceRoleTitle,
          invitedBy: invite.invitedBy || '',
        })
      ),
      homeOrganizationId: userData.homeOrganizationId || userUid,
      homeOrganizationName: userData.homeOrganizationName || userData.organizationName || userData.name || '',
      linkedOrganizationId: '',
      linkedOrganizationName: '',
      linkedWorkspaceRoleTitle: '',
      linkedRole: '',
      linkedInvitedBy: '',
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

export function subscribeToWorkspaceMembers(organizationId, onMembersUpdate) {
  if (!organizationId || !onMembersUpdate) {
    return () => {};
  }

  const membersQuery = query(
    collection(db, 'users'),
    where('organizationId', '==', organizationId)
  );

  const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
    const members = snapshot.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data(),
    }));

    onMembersUpdate(members);
  });

  return unsubscribe;
}

export async function updateWorkspaceMemberRoleTitle({
  memberUid,
  organizationId,
  workspaceRoleTitle,
}) {
  if (!memberUid || !organizationId) {
    throw new Error('Member details are incomplete.');
  }

  const cleanedRoleTitle = (workspaceRoleTitle || '').trim();

  if (!cleanedRoleTitle) {
    throw new Error('Role title is required.');
  }

  const memberRef = doc(db, 'users', memberUid);
  const memberSnapshot = await getDoc(memberRef);

  if (!memberSnapshot.exists()) {
    throw new Error('Member not found.');
  }

  const memberData = memberSnapshot.data();

  if ((memberData.organizationId || '') !== organizationId) {
    throw new Error('Member is not in this workspace.');
  }

  await updateDoc(memberRef, {
    workspaceRoleTitle: cleanedRoleTitle,
    updatedAt: serverTimestamp(),
  });
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
    linkedOrganizationId: '',
    linkedOrganizationName: '',
    linkedWorkspaceRoleTitle: '',
    linkedRole: '',
    linkedInvitedBy: '',
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

export async function switchToPersonalWorkspace(userUid) {
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
    throw new Error('You are already in your personal workspace.');
  }

  const homeOrganizationId = userData.homeOrganizationId || userUid;
  const homeOrganizationName = userData.homeOrganizationName || userData.name || 'My Workspace';

  await updateDoc(userRef, {
    role: 'Admin',
    workspaceRoleTitle: 'Workspace Owner',
    organizationId: homeOrganizationId,
    organizationName: homeOrganizationName,
    invitedBy: '',
    linkedOrganizationId: currentOrganizationId,
    linkedOrganizationName: userData.organizationName || '',
    linkedWorkspaceRoleTitle: userData.workspaceRoleTitle || 'Member',
    linkedRole: userData.role || 'Member',
    linkedInvitedBy: userData.invitedBy || '',
    updatedAt: serverTimestamp(),
  });
}

export async function switchBackToLinkedWorkspace(userUid) {
  if (!userUid) {
    throw new Error('User not found.');
  }

  const userRef = doc(db, 'users', userUid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error('User profile was not found.');
  }

  const userData = userSnapshot.data();
  const linkedOrganizationId = userData.linkedOrganizationId || '';

  if (!linkedOrganizationId) {
    throw new Error('No linked workspace found.');
  }

  await updateDoc(userRef, {
    role: userData.linkedRole || 'Member',
    workspaceRoleTitle: userData.linkedWorkspaceRoleTitle || 'Member',
    organizationId: linkedOrganizationId,
    organizationName: userData.linkedOrganizationName || userData.organizationName || '',
    invitedBy: userData.linkedInvitedBy || userData.invitedBy || '',
    updatedAt: serverTimestamp(),
  });
}

export async function switchToWorkspaceMembership(userUid, membership) {
  if (!userUid || !membership?.organizationId) {
    throw new Error('Workspace details are incomplete.');
  }

  const userRef = doc(db, 'users', userUid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error('User profile was not found.');
  }

  const userData = userSnapshot.data();
  const currentOrganizationId = userData.organizationId || userUid;
  const targetOrganizationId = membership.organizationId;

  if (currentOrganizationId === targetOrganizationId) {
    return;
  }

  await updateDoc(userRef, {
    role: membership.role || userData.role || 'Member',
    workspaceRoleTitle: membership.workspaceRoleTitle || membership.role || userData.workspaceRoleTitle || 'Member',
    organizationId: targetOrganizationId,
    organizationName: membership.organizationName || '',
    invitedBy: membership.invitedBy || '',
    linkedOrganizationId: currentOrganizationId,
    linkedOrganizationName: userData.organizationName || '',
    linkedWorkspaceRoleTitle: userData.workspaceRoleTitle || 'Member',
    linkedRole: userData.role || 'Member',
    linkedInvitedBy: userData.invitedBy || '',
    updatedAt: serverTimestamp(),
  });
}

export async function removeWorkspaceMemberByAdmin({ adminUid, memberUid, organizationId }) {
  if (!adminUid || !memberUid || !organizationId) {
    throw new Error('Member removal details are incomplete.');
  }

  if (adminUid === memberUid) {
    throw new Error('Use Leave Workspace to remove yourself from this workspace.');
  }

  if (memberUid === organizationId) {
    throw new Error('Workspace owner cannot be removed.');
  }

  const adminRef = doc(db, 'users', adminUid);
  const memberRef = doc(db, 'users', memberUid);

  const [adminSnapshot, memberSnapshot] = await Promise.all([
    getDoc(adminRef),
    getDoc(memberRef),
  ]);

  if (!adminSnapshot.exists() || !memberSnapshot.exists()) {
    throw new Error('User profile was not found.');
  }

  const adminData = adminSnapshot.data();
  const memberData = memberSnapshot.data();

  const adminOrganizationId = adminData.organizationId || adminUid;
  const adminRole = (adminData.role || '').toLowerCase();

  if (adminOrganizationId !== organizationId || adminRole !== 'admin') {
    throw new Error('Only workspace admins can remove members.');
  }

  const memberOrganizationId = memberData.organizationId || memberUid;
  if (memberOrganizationId !== organizationId) {
    throw new Error('Member is not in this workspace.');
  }

  const homeOrganizationId = memberData.homeOrganizationId || memberUid;
  const homeOrganizationName = memberData.homeOrganizationName || memberData.name || 'My Workspace';

  await updateDoc(memberRef, {
    role: 'Admin',
    workspaceRoleTitle: 'Workspace Owner',
    organizationId: homeOrganizationId,
    organizationName: homeOrganizationName,
    invitedBy: '',
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    targetUserId: memberUid,
    title: 'Removed from workspace',
    message: 'You have been removed from a workspace and returned to your personal workspace.',
    type: 'member_removed_workspace',
    actorUid: adminUid,
    organizationId,
    metadata: {
      memberUid,
      memberEmail: normalizeEmail(memberData.email || ''),
    },
  });
}

export async function sendTeamMessage({ senderUid, senderName, senderEmail, organizationId, message }) {
  if (!organizationId || !senderUid || !message?.trim()) {
    throw new Error('Message details are incomplete.');
  }

  if (message.length > 5000) {
    throw new Error('Message is too long (max 5000 characters).');
  }

  return addDoc(collection(db, 'teamMessages'), {
    organizationId,
    senderUid,
    senderName: senderName || 'Unknown',
    senderEmail: normalizeEmail(senderEmail || ''),
    message: message.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function loadTeamMessagesOnce(organizationId) {
  if (!organizationId) {
    return [];
  }

  const messageQuery = query(
    collection(db, 'teamMessages'),
    where('organizationId', '==', organizationId)
  );

  const snapshot = await getDocs(messageQuery);

  return snapshot.docs
    .map((messageDoc) => ({
      id: messageDoc.id,
      ...messageDoc.data(),
    }))
    .sort((left, right) => {
      const leftSeconds = left.createdAt?.seconds || 0;
      const rightSeconds = right.createdAt?.seconds || 0;
      return leftSeconds - rightSeconds;
    });
}

export function subscribeToTeamMessages(organizationId, onMessagesUpdate) {
  if (!organizationId || !onMessagesUpdate) {
    return () => {};
  }

  const messageQuery = query(
    collection(db, 'teamMessages'),
    where('organizationId', '==', organizationId)
  );

  const unsubscribe = onSnapshot(messageQuery, (snapshot) => {
    const messages = snapshot.docs
      .map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
      }))
      .sort((left, right) => {
        const leftSeconds = left.createdAt?.seconds || 0;
        const rightSeconds = right.createdAt?.seconds || 0;
        return leftSeconds - rightSeconds;
      });

    onMessagesUpdate(messages);
  });

  return unsubscribe;
}
