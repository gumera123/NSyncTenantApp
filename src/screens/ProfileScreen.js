import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';
import {
  getPhilippineMobileErrorMessage,
  validatePhilippineMobileNumber,
} from '../utils/contactValidation';
import {
  leaveCurrentWorkspace,
  switchToPersonalWorkspace,
  switchToWorkspaceMembership,
} from '../utils/workspaceInvite';
import ConfirmDialog from '../components/ui/confirm-dialog';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';

export default function ProfileScreen({ navigation, route }) {
  const [userData, setUserData] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [leavingWorkspace, setLeavingWorkspace] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [returnToMyProfileAfterEdit, setReturnToMyProfileAfterEdit] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    organizationName: '',
    role: '',
    workspaceRoleTitle: '',
    address: '',
    birthday: '',
    description: '',
  });

  const userEmail = auth.currentUser?.email || 'No email available';
  const organizationId = userData?.organizationId || auth.currentUser?.uid || '';
  const linkedOrganizationId = userData?.linkedOrganizationId || '';
  const isAdmin = (userData?.role || '').toLowerCase() === 'admin';
  const canLeaveWorkspace = organizationId && organizationId !== auth.currentUser?.uid;
  const canSwitchToPersonalWorkspace = organizationId && organizationId !== auth.currentUser?.uid;

  const normalizeText = (value) => (value || '').trim();
  const hasProfileChanges = Boolean(
    userData && (
      normalizeText(formData.name) !== normalizeText(userData.name) ||
      normalizeText(formData.contactNumber) !== normalizeText(userData.contactNumber) ||
      normalizeText(formData.address) !== normalizeText(userData.address) ||
      normalizeText(formData.birthday) !== normalizeText(userData.birthday) ||
      normalizeText(formData.organizationName) !== normalizeText(userData.organizationName) ||
      (isAdmin && normalizeText(formData.workspaceRoleTitle) !== normalizeText(userData.workspaceRoleTitle))
    )
  );

  const workspaceMemberships = (() => {
    const memberships = Array.isArray(userData?.workspaceMemberships)
      ? userData.workspaceMemberships.filter(Boolean)
      : [];

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

    const ownerPersonalWorkspaceId = auth.currentUser?.uid || '';

    const mergedMemberships = [...memberships, ...fallbackMemberships].filter(
      (membership, index, array) =>
        membership.organizationId &&
        membership.organizationId !== ownerPersonalWorkspaceId &&
        array.findIndex((item) => item.organizationId === membership.organizationId) === index
    );

    return mergedMemberships.sort((left, right) => {
      if (left.organizationId === organizationId) {
        return -1;
      }

      if (right.organizationId === organizationId) {
        return 1;
      }

      return (left.organizationName || left.workspaceRoleTitle || '').localeCompare(
        right.organizationName || right.workspaceRoleTitle || ''
      );
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
          birthday: data.birthday || '',
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
    if (route?.params?.startEdit) {
      setReturnToMyProfileAfterEdit(Boolean(route?.params?.returnToMyProfile));
      setIsEditMode(true);
      navigation.setParams({
        startEdit: undefined,
        returnToMyProfile: undefined,
        isEditingProfile: true,
      });
    }
  }, [navigation, route?.params?.returnToMyProfile, route?.params?.startEdit]);

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
    if (!imageUri || !auth.currentUser) {
      return;
    }

    try {
      setUploading(true);
      const uploadedImageUrl = await uploadImageToCloudinary(imageUri);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        organizationLogoUrl: uploadedImageUrl,
        updatedAt: serverTimestamp(),
      });

      setUserData((previous) => ({
        ...previous,
        organizationLogoUrl: uploadedImageUrl,
      }));
      setImageUri(null);
      Alert.alert('Success', 'Logo uploaded successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to upload logo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) {
      return;
    }

    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    const contactNumberValue = formData.contactNumber.trim();
    if (contactNumberValue && !validatePhilippineMobileNumber(contactNumberValue)) {
      const errorMessage = getPhilippineMobileErrorMessage();
      setContactError(errorMessage);
      Alert.alert('Invalid Contact Number', errorMessage);
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: formData.name.trim(),
        contactNumber: contactNumberValue,
        address: formData.address.trim(),
        birthday: formData.birthday.trim(),
        description: formData.description.trim(),
        updatedAt: serverTimestamp(),
        ...(isAdmin
          ? {
              organizationName: formData.organizationName.trim(),
              workspaceRoleTitle: formData.workspaceRoleTitle.trim(),
            }
          : {}),
      });

      setUserData((previous) => ({
        ...previous,
        ...formData,
        contactNumber: contactNumberValue,
        birthday: formData.birthday.trim(),
      }));

      const shouldReturnToMyProfile = returnToMyProfileAfterEdit;
      setIsEditMode(false);
      setReturnToMyProfileAfterEdit(false);
      setContactError('');
      navigation.setParams({ isEditingProfile: undefined });
      if (shouldReturnToMyProfile) {
        navigation.navigate('MyProfile');
      }
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.log('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile.');
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
        birthday: userData.birthday || '',
        description: userData.description || '',
      });
    }

    const shouldReturnToMyProfile = returnToMyProfileAfterEdit;
    setIsEditMode(false);
    setReturnToMyProfileAfterEdit(false);
    setImageUri(null);
    setContactError('');
    navigation.setParams({ isEditingProfile: undefined });
    if (shouldReturnToMyProfile) {
      navigation.navigate('MyProfile');
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      title: 'Logout',
      message: 'Are you sure you want to log out of this account?',
      confirmText: 'Logout',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await signOut(auth);
        } catch (error) {
          console.log('Error signing out:', error);
          Alert.alert('Error', 'Failed to sign out');
        }
      },
    });
  };

  const handleLeaveWorkspace = async () => {
    if (!auth.currentUser || !canLeaveWorkspace) {
      return;
    }

    setConfirmDialog({
      title: 'Leave Workspace',
      message:
        'Do you really want to leave this workspace? You will lose access to this workspace and return to your personal workspace.',
      confirmText: 'Yes, Leave',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setLeavingWorkspace(true);
          await leaveCurrentWorkspace(auth.currentUser.uid);
          await fetchUserData();
          Alert.alert('Success', 'You have left the workspace.');
        } catch (error) {
          console.log('Error leaving workspace:', error);
          Alert.alert('Error', error.message || 'Failed to leave workspace.');
        } finally {
          setLeavingWorkspace(false);
        }
      },
    });
  };

  const handleSwitchToPersonalWorkspace = () => {
    if (!auth.currentUser || !canSwitchToPersonalWorkspace) {
      return;
    }

    setConfirmDialog({
      title: 'Switch Workspace',
      message: 'Switch to your personal workspace now? You can switch back later without leaving this workspace.',
      confirmText: 'Switch',
      tone: 'primary',
      onConfirm: async () => {
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
    });
  };

  const handleSwitchToWorkspaceMembership = (membership) => {
    if (!auth.currentUser || !membership?.organizationId) {
      return;
    }

    setConfirmDialog({
      title: 'Switch Workspace',
      message: `Switch to ${membership.organizationName || membership.workspaceRoleTitle || 'this workspace'}?`,
      confirmText: 'Switch',
      tone: 'primary',
      onConfirm: async () => {
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
    });
  };

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

  if (isEditMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={0}
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
                  if (contactError) {
                    setContactError('');
                  }
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

              <Text style={styles.label}>Birthday</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. January 1, 2000"
                placeholderTextColor="#94a3b8"
                value={formData.birthday}
                onChangeText={(text) => setFormData({ ...formData, birthday: text })}
                editable={!saving}
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
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.flexButton,
                    (!hasProfileChanges || saving) && styles.buttonDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={saving || !hasProfileChanges}
                >
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

  const profileName = userData?.name || 'Your Name';
  const profileInitial = (profileName || userEmail.charAt(0)).charAt(0).toUpperCase();
  const roleLabel = userData?.workspaceRoleTitle || userData?.role || 'Member';
  const compactEmail = userEmail.length > 18 ? `${userEmail.slice(0, 16)}...` : userEmail;

  const renderSettingsRow = ({ icon, title, value, onPress, isFirst = false }) => (
    <TouchableOpacity
      key={title}
      style={[styles.settingsRow, isFirst && styles.settingsRowFirst]}
      activeOpacity={0.86}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingsIconWrap}>
        <Ionicons name={icon} size={18} color="#111827" />
      </View>
      <Text style={styles.settingsRowTitle} numberOfLines={1}>{title}</Text>
      {value ? <Text style={styles.settingsRowValue} numberOfLines={1}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={17} color="#c4ccd6" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Settings</Text>

          <View style={styles.settingsProfileHeader}>
            <View style={styles.settingsAvatarWrap}>
              <TouchableOpacity
                onLongPress={() => setIsPhotoExpanded(true)}
                delayLongPress={280}
                activeOpacity={0.9}
              >
                {userData?.organizationLogoUrl ? (
                  <Image source={{ uri: userData.organizationLogoUrl }} style={styles.settingsAvatar} />
                ) : (
                  <View style={styles.settingsAvatarFallback}>
                    <Text style={styles.settingsAvatarFallbackText}>{profileInitial}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.settingsProfileName}>{profileName}</Text>
            <TouchableOpacity
              style={styles.settingsViewProfileTouch}
              activeOpacity={0.78}
              onPress={() => navigation.navigate('MyProfile')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="View profile"
            >
              <Text style={styles.settingsViewProfile}>View profile</Text>
            </TouchableOpacity>
            <Text style={styles.settingsProfileRole}>{roleLabel}</Text>
          </View>

          {isPhotoExpanded ? (
            <View style={styles.expandedPhotoCard}>
              {userData?.organizationLogoUrl ? (
                <Image source={{ uri: userData.organizationLogoUrl }} style={styles.avatarExpanded} />
              ) : (
                <View style={styles.avatarFallbackExpanded}>
                  <Text style={styles.avatarFallbackExpandedText}>{profileInitial}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.photoActionButton, uploading && styles.buttonDisabled]}
                onPress={pickImage}
                disabled={uploading}
              >
                <Text style={styles.photoActionButtonText}>Change Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoCloseButton} onPress={() => setIsPhotoExpanded(false)}>
                <Text style={styles.photoCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {imageUri ? <Image source={{ uri: imageUri }} style={styles.logoPreview} /> : null}

          {imageUri ? (
            <TouchableOpacity
              style={[styles.primaryButton, uploading && styles.buttonDisabled]}
              onPress={uploadLogo}
              disabled={uploading}
            >
              <Text style={styles.primaryButtonText}>{uploading ? 'Uploading...' : 'Upload Logo'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.teamCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('MyTeam')}
          >
            <View style={styles.teamIconBubble}>
              <Ionicons name="people" size={22} color="#ffffff" />
            </View>
            <View style={styles.teamCardTextWrap}>
              <Text style={styles.teamCardTitle}>My team</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: 'person-circle-outline',
              title: 'Account settings',
              value: compactEmail,
              isFirst: true,
            })}
            {renderSettingsRow({
              icon: 'notifications-outline',
              title: 'Notification Settings',
            })}
            {renderSettingsRow({
              icon: 'globe-outline',
              title: 'Language',
              value: 'English',
            })}
            {renderSettingsRow({
              icon: 'sunny-outline',
              title: 'Theme',
              value: 'Light',
            })}
          </View>

          <View style={styles.card}>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.softWhite,
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
    color: PALETTE.black,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: PALETTE.mutedInk,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 14,
  },
  settingsProfileHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20,
  },
  settingsAvatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingsAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  settingsAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsAvatarFallbackText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#0f172a',
  },
  settingsProfileName: {
    color: PALETTE.black,
    fontSize: 21,
    fontWeight: '800',
  },
  settingsViewProfile: {
    marginTop: 4,
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  settingsViewProfileTouch: {
    marginTop: 4,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsProfileRole: {
    marginTop: 4,
    color: PALETTE.mutedInk,
    fontSize: 12,
  },
  teamCard: {
    minHeight: 64,
    borderRadius: 10,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: '#eef2f7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  teamIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f43f9e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamCardTextWrap: {
    flex: 1,
  },
  teamCardTitle: {
    color: PALETTE.black,
    fontSize: 14,
    fontWeight: '800',
  },
  settingsCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
    marginBottom: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#edf1f5',
  },
  settingsRowFirst: {
    borderTopWidth: 0,
  },
  settingsIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  settingsRowTitle: {
    flex: 1,
    color: PALETTE.black,
    fontSize: 13,
    fontWeight: '600',
  },
  settingsRowValue: {
    maxWidth: 118,
    color: PALETTE.mutedInk,
    fontSize: 12,
    marginRight: 8,
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
    color: PALETTE.black,
  },
  role: {
    marginTop: 2,
    color: PALETTE.mutedInk,
  },
  infoRow: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: PALETTE.mutedInk,
    marginBottom: 2,
  },
  infoValue: {
    color: PALETTE.black,
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontWeight: '600',
    color: PALETTE.black,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: PALETTE.softWhite,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: PALETTE.black,
  },
  readOnly: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: PALETTE.softWhite,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
    color: PALETTE.mutedInk,
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
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: PALETTE.white,
    fontWeight: '700',
  },
  workspaceSwitcherCard: {
    marginTop: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 14,
  },
  workspaceSwitcherTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.black,
  },
  workspaceSwitcherSubtitle: {
    marginTop: 4,
    marginBottom: 10,
    color: PALETTE.mutedInk,
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
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceSwitchButtonText: {
    color: PALETTE.white,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.softWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: PALETTE.black,
    fontWeight: '600',
  },
  memberEmail: {
    color: PALETTE.mutedInk,
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  photoHint: {
    marginTop: 6,
    fontSize: 12,
    color: PALETTE.mutedInk,
  },
  expandedPhotoCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  avatarExpanded: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  avatarFallbackExpanded: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackExpandedText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#0f172a',
  },
  photoActionButton: {
    width: '70%',
    maxWidth: 260,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 14,
  },
  photoActionButtonText: {
    color: PALETTE.white,
    fontWeight: '700',
    fontSize: 16,
  },
  photoCloseButton: {
    width: '70%',
    maxWidth: 260,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
  },
  photoCloseButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
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
  switchWorkspaceButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  switchWorkspaceText: {
    color: PALETTE.green,
    fontWeight: '700',
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
  leaveWorkspaceHint: {
    marginTop: 6,
    color: '#92400e',
    fontSize: 12,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  confirmIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmIcon: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  confirmTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  confirmMessage: {
    marginTop: 8,
    color: '#475569',
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  confirmCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  confirmPrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDangerButton: {
    backgroundColor: '#dc2626',
  },
  confirmPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  confirmDangerText: {
    color: '#fff',
  },
  membersCard: {
    marginTop: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 14,
  },
  membersTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.black,
  },
  membersSubtitle: {
    marginTop: 4,
    color: PALETTE.mutedInk,
    fontSize: 12,
    marginBottom: 10,
  },
  membersLoadingWrap: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: PALETTE.black,
    fontWeight: '700',
    fontSize: 14,
  },
  memberMeta: {
    color: PALETTE.mutedInk,
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
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    color: PALETTE.black,
  },
  memberRoleSaveButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberRoleSaveButtonDisabled: {
    opacity: 0.6,
  },
  memberRoleSaveButtonText: {
    color: PALETTE.white,
    fontWeight: '700',
    fontSize: 12,
  },
});
