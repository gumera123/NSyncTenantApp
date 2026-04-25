import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';
import { validatePhilippineMobileNumber, getPhilippineMobileErrorMessage } from '../utils/contactValidation';
import {
  leaveCurrentWorkspace,
  removeWorkspaceMemberByAdmin,
  subscribeToWorkspaceMembers,
  switchToPersonalWorkspace,
  switchToWorkspaceMembership,
  updateWorkspaceMemberRoleTitle,
} from '../utils/workspaceInvite';

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [leavingWorkspace, setLeavingWorkspace] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [memberRoleDrafts, setMemberRoleDrafts] = useState({});
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    organizationName: '',
    role: '',
    workspaceRoleTitle: '',
    address: '',
    description: '',
  });

  const userEmail = auth.currentUser?.email || 'No email available';
  const isAdmin = (userData?.role || '').toLowerCase() === 'admin';
  const organizationId = userData?.organizationId || auth.currentUser?.uid || '';
  const linkedOrganizationId = userData?.linkedOrganizationId || '';
  const canLeaveWorkspace = organizationId && organizationId !== auth.currentUser?.uid;
  const canSwitchToPersonalWorkspace = organizationId && organizationId !== auth.currentUser?.uid;

  const workspaceMemberships = (() => {
    const memberships = Array.isArray(userData?.workspaceMemberships) ? userData.workspaceMemberships.filter(Boolean) : [];
    const fallbackMemberships = [
      {
        organizationId: organizationId || auth.currentUser?.uid || '',
        organizationName: userData?.organizationName || userData?.homeOrganizationName || userData?.name || '',
        role: userData?.role || 'Member',
        workspaceRoleTitle: userData?.workspaceRoleTitle || 'Member',
        invitedBy: userData?.invitedBy || '',
      },
    ];

    if (linkedOrganizationId) {
      fallbackMemberships.push({
        organizationId: linkedOrganizationId,
        organizationName: userData?.linkedOrganizationName || '',
        role: userData?.linkedRole || 'Member',
        workspaceRoleTitle: userData?.linkedWorkspaceRoleTitle || 'Member',
        invitedBy: userData?.linkedInvitedBy || '',
      });
    }

    const mergedMemberships = [...memberships, ...fallbackMemberships].filter((membership, index, array) =>
      membership.organizationId && array.findIndex((item) => item.organizationId === membership.organizationId) === index
    );

    return mergedMemberships.sort((left, right) => {
      if (left.organizationId === organizationId) {
        return -1;
      }

      if (right.organizationId === organizationId) {
        return 1;
      }

      return (left.organizationName || left.workspaceRoleTitle || '').localeCompare(right.organizationName || right.workspaceRoleTitle || '');
    });
  })();

  const fetchUserData = useCallback(async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setFormData((currentFormData) => ({
          ...currentFormData,
          name: data.name || '',
          contactNumber: data.contactNumber || '',
          organizationName: data.organizationName || '',
          role: data.role || '',
          workspaceRoleTitle: data.workspaceRoleTitle || '',
          address: data.address || '',
          description: data.description || '',
        }));
      }
    } catch (error) {
      console.log('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  useEffect(() => {
    if (!auth.currentUser?.uid || !isAdmin || !organizationId) {
      setWorkspaceMembers([]);
      setMembersLoading(false);
      setMemberRoleDrafts({});
      return;
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
  }, [isAdmin, organizationId]);

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

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberLabel} from this workspace?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
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
        },
      ]
    );
  }, [isAdmin, organizationId]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadLogo = async () => {
    if (!imageUri || !auth.currentUser) return;

    try {
      setUploading(true);
      const uploadedImageUrl = await uploadImageToCloudinary(imageUri);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        organizationLogoUrl: uploadedImageUrl,
        updatedAt: serverTimestamp(),
      });

      setUserData((prev) => ({ ...prev, organizationLogoUrl: uploadedImageUrl }));
      setImageUri(null);
      Alert.alert('Success', 'Logo uploaded successfully.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;

    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    const contactNumberValue = formData.contactNumber.trim();

    if (contactNumberValue && !validatePhilippineMobileNumber(contactNumberValue)) {
      const errorMsg = getPhilippineMobileErrorMessage();
      setContactError(errorMsg);
      Alert.alert('Invalid Contact Number', errorMsg);
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: formData.name.trim(),
        contactNumber: contactNumberValue,
        address: formData.address.trim(),
        description: formData.description.trim(),
        updatedAt: serverTimestamp(),
        ...(isAdmin
          ? {
              organizationName: formData.organizationName.trim(),
              workspaceRoleTitle: formData.workspaceRoleTitle.trim(),
            }
          : {}),
      });

      setUserData((prev) => ({
        ...prev,
        ...formData,
        contactNumber: contactNumberValue,
      }));

      setIsEditMode(false);
      setContactError('');
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.log('Error saving profile:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        contactNumber: userData.contactNumber || '',
        organizationName: userData.organizationName || '',
        role: userData.role || '',
        workspaceRoleTitle: userData.workspaceRoleTitle || '',
        address: userData.address || '',
        description: userData.description || '',
      });
    }

    setIsEditMode(false);
    setImageUri(null);
    setContactError('');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out of this account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.log('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleLeaveWorkspace = async () => {
    if (!auth.currentUser || !canLeaveWorkspace) {
      return;
    }

    Alert.alert(
      'Leave Workspace',
      'Do you really want to leave this workspace? You will lose access to this workspace and return to your personal workspace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setLeavingWorkspace(true);
              await leaveCurrentWorkspace(auth.currentUser.uid);

              const refreshedUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
              if (refreshedUserDoc.exists()) {
                const refreshedData = refreshedUserDoc.data();
                setUserData(refreshedData);
                setFormData((prev) => ({
                  ...prev,
                  organizationName: refreshedData.organizationName || prev.organizationName,
                  role: refreshedData.role || prev.role,
                  workspaceRoleTitle: refreshedData.workspaceRoleTitle || prev.workspaceRoleTitle,
                }));
              }

              Alert.alert('Success', 'You have left the workspace.');
            } catch (error) {
              console.log('Error leaving workspace:', error);
              Alert.alert('Error', error.message);
            } finally {
              setLeavingWorkspace(false);
            }
          },
        },
      ]
    );
  };

  const handleSwitchToPersonalWorkspace = () => {
    if (!auth.currentUser || !canSwitchToPersonalWorkspace) {
      return;
    }

    Alert.alert(
      'Switch Workspace',
      'Switch to your personal workspace now? You can switch back later without leaving this workspace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              setSwitchingWorkspace(true);
              await switchToPersonalWorkspace(auth.currentUser.uid);
              await fetchUserData();
              Alert.alert('Success', 'You are now in your personal workspace.');
            } catch (error) {
              console.log('Error switching to personal workspace:', error);
              Alert.alert('Error', error.message || 'Failed to switch workspace.');
            } finally {
              setSwitchingWorkspace(false);
            }
          },
        },
      ]
    );
  };

  const handleSwitchToWorkspaceMembership = (membership) => {
    if (!auth.currentUser || !membership?.organizationId) {
      return;
    }

    Alert.alert(
      'Switch Workspace',
      `Switch to ${membership.organizationName || membership.workspaceRoleTitle || 'this workspace'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              setSwitchingWorkspaceId(membership.organizationId);
              await switchToWorkspaceMembership(auth.currentUser.uid, membership);
              await fetchUserData();
              Alert.alert('Success', 'Workspace switched successfully.');
            } catch (error) {
              console.log('Error switching workspace:', error);
              Alert.alert('Error', error.message || 'Failed to switch workspace.');
            } finally {
              setSwitchingWorkspaceId('');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (isEditMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Update your account details.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#94a3b8"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              editable={!saving}
            />

            <Text style={styles.label}>Email</Text>
            <Text style={styles.readOnly}>{userEmail}</Text>

            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="09XXXXXXXXX"
              placeholderTextColor="#94a3b8"
              value={formData.contactNumber}
              onChangeText={(text) => {
                setFormData({ ...formData, contactNumber: text });
                if (contactError) setContactError('');
              }}
              editable={!saving}
              keyboardType="phone-pad"
            />
            {contactError ? <Text style={styles.errorText}>{contactError}</Text> : null}

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Enter address"
              placeholderTextColor="#94a3b8"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              editable={!saving}
              multiline
            />

            <Text style={styles.label}>Organization</Text>
            <TextInput
              style={isAdmin ? styles.input : styles.readOnly}
              placeholder="Organization name"
              placeholderTextColor="#94a3b8"
              value={formData.organizationName}
              onChangeText={(text) => setFormData({ ...formData, organizationName: text })}
              editable={isAdmin && !saving}
            />

            {isAdmin ? (
              <>
                <Text style={styles.label}>Workspace Role Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex. UI/UX Designer"
                  placeholderTextColor="#94a3b8"
                  value={formData.workspaceRoleTitle}
                  onChangeText={(text) => setFormData({ ...formData, workspaceRoleTitle: text })}
                  editable={!saving}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Workspace Role</Text>
                <Text style={styles.readOnly}>{userData?.workspaceRoleTitle || userData?.role || 'Member'}</Text>
              </>
            )}

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.primaryButton, styles.flexButton]} onPress={handleSaveProfile} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, styles.flexButton]} onPress={handleCancel}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your account summary.</Text>

        <View style={styles.card}>
          <View style={styles.profileTop}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
              {userData?.organizationLogoUrl ? (
                <Image source={{ uri: userData.organizationLogoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{(userData?.name || userEmail.charAt(0)).charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileMeta}>
              <Text style={styles.name}>{userData?.name || 'Your Name'}</Text>
              <Text style={styles.role}>{userData?.role || 'Member'}</Text>
              <Text style={styles.memberEmail}>{userData?.workspaceRoleTitle || 'No workspace role title yet'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userEmail}</Text>
          </View>

          {userData?.contactNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{userData.contactNumber}</Text>
            </View>
          ) : null}

          {userData?.address ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{userData.address}</Text>
            </View>
          ) : null}

          {imageUri ? <Image source={{ uri: imageUri }} style={styles.logoPreview} /> : null}

          {imageUri ? (
            <TouchableOpacity style={[styles.primaryButton, uploading && styles.buttonDisabled]} onPress={uploadLogo} disabled={uploading}>
              <Text style={styles.primaryButtonText}>{uploading ? 'Uploading...' : 'Upload Logo'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.primaryButton} onPress={() => setIsEditMode(true)}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          {workspaceMemberships.length > 0 ? (
            <View style={styles.workspaceSwitcherCard}>
              <Text style={styles.workspaceSwitcherTitle}>Workspace Switcher</Text>
              <Text style={styles.workspaceSwitcherSubtitle}>Switch between the workspaces you belong to.</Text>

              {workspaceMemberships.map((membership) => {
                const isActiveWorkspace = membership.organizationId === organizationId;

                return (
                  <View key={membership.organizationId} style={styles.workspaceSwitcherItem}>
                    <View style={styles.workspaceSwitcherInfo}>
                      <Text style={styles.workspaceSwitcherName} numberOfLines={1}>
                        {membership.organizationName || membership.workspaceRoleTitle || 'Workspace'}
                      </Text>
                      <Text style={styles.workspaceSwitcherMeta} numberOfLines={1}>
                        {membership.workspaceRoleTitle || membership.role || 'Member'}
                      </Text>
                    </View>

                    {isActiveWorkspace ? (
                      <View style={styles.workspaceActiveBadge}>
                        <Text style={styles.workspaceActiveBadgeText}>Active</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.workspaceSwitchButton,
                          switchingWorkspaceId === membership.organizationId && styles.buttonDisabled,
                        ]}
                        onPress={() => handleSwitchToWorkspaceMembership(membership)}
                        disabled={switchingWorkspaceId === membership.organizationId}
                      >
                        <Text style={styles.workspaceSwitchButtonText}>
                          {switchingWorkspaceId === membership.organizationId ? 'Switching...' : 'Switch'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          {canSwitchToPersonalWorkspace ? (
            <TouchableOpacity
              style={[styles.switchWorkspaceButton, switchingWorkspace && styles.buttonDisabled]}
              onPress={handleSwitchToPersonalWorkspace}
              disabled={switchingWorkspace}
            >
              <Text style={styles.switchWorkspaceText}>{switchingWorkspace ? 'Switching...' : 'Switch to Personal Workspace'}</Text>
            </TouchableOpacity>
          ) : null}

          {canLeaveWorkspace ? (
            <>
              <TouchableOpacity
                style={[styles.leaveWorkspaceButton, leavingWorkspace && styles.buttonDisabled]}
                onPress={handleLeaveWorkspace}
                disabled={leavingWorkspace}
              >
                <Text style={styles.leaveWorkspaceText}>{leavingWorkspace ? 'Leaving...' : 'Leave Workspace'}</Text>
              </TouchableOpacity>
              <Text style={styles.leaveWorkspaceHint}>Leaving will return you to your personal workspace.</Text>
            </>
          ) : null}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {isAdmin && workspaceMembers.length > 0 ? (
          <View style={styles.membersCard}>
            <Text style={styles.membersTitle}>Current Workspace Members</Text>
            <Text style={styles.membersSubtitle}>Real-time list. Members disappear here immediately after leaving.</Text>

            {membersLoading ? (
              <View style={styles.membersLoadingWrap}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            ) : (
              workspaceMembers.map((member) => {
                const memberDisplayName = member.name || member.email || 'Unnamed Member';
                const defaultRoleTitle = member.workspaceRoleTitle || member.role || 'Member';
                const roleDraft = memberRoleDrafts[member.id] ?? defaultRoleTitle;
                const isCurrentUser = member.id === auth.currentUser?.uid;

                return (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberTopRow}>
                      <View style={styles.memberInfoWrap}>
                        <Text style={styles.memberName}>{memberDisplayName}{isCurrentUser ? ' (You)' : ''}</Text>
                        <Text style={styles.memberMeta}>{member.email || 'No email'}</Text>
                      </View>

                      {!isCurrentUser ? (
                        <TouchableOpacity
                          style={[
                            styles.removeMemberButton,
                            removingMemberId === member.id && styles.buttonDisabled,
                          ]}
                          onPress={() => handleRemoveMember(member)}
                          disabled={removingMemberId === member.id}
                        >
                          <Text style={styles.removeMemberButtonText}>
                            {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={styles.memberRoleRow}>
                      <TextInput
                        style={styles.memberRoleInput}
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
                          styles.memberRoleSaveButton,
                          (updatingMemberId === member.id || !roleDraft.trim() || removingMemberId === member.id) && styles.memberRoleSaveButtonDisabled,
                        ]}
                        onPress={() => handleAssignMemberRole(member.id)}
                        disabled={updatingMemberId === member.id || !roleDraft.trim() || removingMemberId === member.id}
                      >
                        <Text style={styles.memberRoleSaveButtonText}>
                          {updatingMemberId === member.id ? 'Saving...' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 200,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileMeta: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  role: {
    marginTop: 2,
    color: '#64748b',
  },
  infoRow: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#0f172a',
  },
  readOnly: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
    color: '#64748b',
  },
  multiline: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  errorText: {
    color: '#dc2626',
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  workspaceSwitcherCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  workspaceSwitcherTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  workspaceSwitcherSubtitle: {
    marginTop: 4,
    marginBottom: 10,
    color: '#64748b',
    fontSize: 12,
  },
  workspaceSwitcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  workspaceSwitcherInfo: {
    flex: 1,
  },
  workspaceSwitcherName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  workspaceSwitcherMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  workspaceActiveBadge: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceActiveBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  workspaceSwitchButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceSwitchButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  memberEmail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  logoPreview: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logoutButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  leaveWorkspaceButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  leaveWorkspaceText: {
    color: '#b45309',
    fontWeight: '700',
  },
  switchWorkspaceButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  switchWorkspaceText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  leaveWorkspaceHint: {
    marginTop: 6,
    color: '#92400e',
    fontSize: 12,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  membersCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  membersTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  membersSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    marginBottom: 10,
  },
  membersLoadingWrap: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMembersText: {
    color: '#64748b',
    fontSize: 13,
  },
  memberRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  memberInfoWrap: {
    flex: 1,
    marginRight: 8,
    marginBottom: 6,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  removeMemberButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMemberButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  memberName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  memberMeta: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 12,
  },
  memberRoleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  memberRoleInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    color: '#0f172a',
  },
  memberRoleSaveButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberRoleSaveButtonDisabled: {
    opacity: 0.6,
  },
  memberRoleSaveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});
