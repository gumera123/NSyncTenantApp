import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import ConfirmDialog from '../components/ui/confirm-dialog';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';
import {
  removeWorkspaceMemberByAdmin,
  subscribeToWorkspaceMembers,
  updateWorkspaceMemberRoleTitle,
} from '../utils/workspaceInvite';

export default function MyTeamScreen() {
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState({});
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const organizationId = userData?.organizationId || auth.currentUser?.uid || '';
  const isAdmin = (userData?.role || '').toLowerCase() === 'admin';

  const loadUserData = useCallback(async () => {
    if (!auth.currentUser?.uid) {
      setLoading(false);
      setMembersLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      setUserData(userDoc.exists() ? userDoc.data() : null);
    } catch (error) {
      console.log('Error loading team owner data:', error);
      Alert.alert('Error', 'Unable to load your workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (!auth.currentUser?.uid || !organizationId) {
      setWorkspaceMembers([]);
      setMembersLoading(false);
      return undefined;
    }

    setMembersLoading(true);

    const unsubscribe = subscribeToWorkspaceMembers(organizationId, (members) => {
      const sortedMembers = [...members].sort((left, right) => {
        if (left.id === auth.currentUser.uid) {
          return -1;
        }

        if (right.id === auth.currentUser.uid) {
          return 1;
        }

        const leftName = (left.name || left.email || '').toLowerCase();
        const rightName = (right.name || right.email || '').toLowerCase();
        return leftName.localeCompare(rightName);
      });

      setWorkspaceMembers(sortedMembers);
      setMemberRoleDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        const currentMemberIds = new Set(sortedMembers.map((member) => member.id));

        sortedMembers.forEach((member) => {
          if (typeof nextDrafts[member.id] !== 'string') {
            nextDrafts[member.id] = member.workspaceRoleTitle || member.role || 'Member';
          }
        });

        Object.keys(nextDrafts).forEach((memberId) => {
          if (!currentMemberIds.has(memberId)) {
            delete nextDrafts[memberId];
          }
        });

        return nextDrafts;
      });
      setMembersLoading(false);
    });

    return unsubscribe;
  }, [organizationId]);

  const handleAssignMemberRole = useCallback(async (memberUid) => {
    if (!organizationId || !isAdmin) {
      Alert.alert('Admin Only', 'Only admins can update workspace member roles.');
      return;
    }

    const member = workspaceMembers.find((currentMember) => currentMember.id === memberUid);
    const defaultRoleTitle = member?.workspaceRoleTitle || member?.role || 'Member';
    const roleTitle = (memberRoleDrafts[memberUid] ?? defaultRoleTitle).trim();

    if (!roleTitle) {
      Alert.alert('Validation Error', 'Role title cannot be empty.');
      return;
    }

    try {
      setUpdatingMemberId(memberUid);
      await updateWorkspaceMemberRoleTitle({
        memberUid,
        organizationId,
        workspaceRoleTitle: roleTitle,
      });
    } catch (error) {
      console.log('Error updating workspace role:', error);
      Alert.alert('Error', error.message || 'Failed to update member role.');
    } finally {
      setUpdatingMemberId('');
    }
  }, [organizationId, isAdmin, memberRoleDrafts, workspaceMembers]);

  const handleRemoveMember = useCallback((member) => {
    if (!auth.currentUser?.uid || !organizationId || !isAdmin) {
      Alert.alert('Admin Only', 'Only admins can remove members.');
      return;
    }

    const memberLabel = member?.name || member?.email || 'this member';

    setConfirmDialog({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberLabel} from this workspace?`,
      confirmText: 'Remove',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setRemovingMemberId(member.id);
          await removeWorkspaceMemberByAdmin({
            adminUid: auth.currentUser.uid,
            memberUid: member.id,
            organizationId,
          });
          Alert.alert('Success', `${memberLabel} was removed from the workspace.`);
        } catch (error) {
          console.log('Error removing workspace member:', error);
          Alert.alert('Error', error.message || 'Failed to remove member.');
        } finally {
          setRemovingMemberId('');
        }
      },
    });
  }, [isAdmin, organizationId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PALETTE.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Team</Text>

        {membersLoading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color={PALETTE.green} />
          </View>
        ) : null}

        {!membersLoading && workspaceMembers.length === 0 ? (
          <View style={styles.centerCard}>
            <Ionicons name="people-outline" size={34} color={PALETTE.mutedInk} />
            <Text style={styles.emptyText}>No team members found.</Text>
          </View>
        ) : null}

        {workspaceMembers.map((member) => {
          const memberDisplayName = member.name || member.email || 'Unnamed Member';
          const defaultRoleTitle = member.workspaceRoleTitle || member.role || 'Member';
          const roleDraft = memberRoleDrafts[member.id] ?? defaultRoleTitle;
          const isCurrentUser = member.id === auth.currentUser?.uid;

          return (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {memberDisplayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {memberDisplayName}
                    {isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.memberEmail}>{member.email || 'No email'}</Text>
                  <Text style={styles.memberRole}>{defaultRoleTitle}</Text>
                </View>

                {isAdmin && !isCurrentUser ? (
                  <TouchableOpacity
                    style={[styles.removeButton, removingMemberId === member.id && styles.buttonDisabled]}
                    onPress={() => handleRemoveMember(member)}
                    disabled={removingMemberId === member.id}
                  >
                    <Ionicons name="trash-outline" size={17} color="#dc2626" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {isAdmin ? (
                <View style={styles.roleEditor}>
                  <TextInput
                    style={styles.roleInput}
                    placeholder="Type role title"
                    placeholderTextColor="#94a3b8"
                    value={roleDraft}
                    onChangeText={(text) =>
                      setMemberRoleDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [member.id]: text,
                      }))
                    }
                    editable={updatingMemberId !== member.id && removingMemberId !== member.id}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      (updatingMemberId === member.id || !roleDraft.trim() || removingMemberId === member.id) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={() => handleAssignMemberRole(member.id)}
                    disabled={updatingMemberId === member.id || !roleDraft.trim() || removingMemberId === member.id}
                  >
                    <Text style={styles.saveButtonText}>
                      {updatingMemberId === member.id ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

        <ConfirmDialog
          visible={Boolean(confirmDialog)}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmText={confirmDialog?.confirmText}
          tone={confirmDialog?.tone}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            const action = confirmDialog?.onConfirm;
            setConfirmDialog(null);
            if (action) {
              await action();
            }
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.softWhite,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.black,
    marginBottom: 14,
  },
  centerCard: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: PALETTE.mutedInk,
    fontWeight: '600',
  },
  memberCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    padding: 14,
    marginBottom: 10,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: PALETTE.black,
    fontSize: 15,
    fontWeight: '800',
  },
  memberEmail: {
    color: PALETTE.mutedInk,
    fontSize: 12,
    marginTop: 2,
  },
  memberRole: {
    color: PALETTE.green,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  roleInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.softWhite,
    paddingHorizontal: 10,
    color: PALETTE.black,
  },
  saveButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: PALETTE.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: PALETTE.white,
    fontWeight: '800',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
