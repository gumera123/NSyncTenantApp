import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';
import { validatePhilippineMobileNumber, getPhilippineMobileErrorMessage } from '../utils/contactValidation';
import {
  leaveCurrentWorkspace,
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
  const canLeaveWorkspace = !isAdmin && organizationId && organizationId !== auth.currentUser?.uid;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setFormData({
            name: data.name || '',
            contactNumber: data.contactNumber || '',
            organizationName: data.organizationName || '',
            role: data.role || '',
            workspaceRoleTitle: data.workspaceRoleTitle || '',
            address: data.address || '',
            description: data.description || '',
          });
        }
      } catch (error) {
        console.log('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!auth.currentUser || !canLeaveWorkspace) {
      return;
    }

    Alert.alert(
      'Leave Workspace',
      'Are you sure you want to leave this workspace? You will return to your own workspace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
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

          {canLeaveWorkspace ? (
            <TouchableOpacity
              style={[styles.leaveWorkspaceButton, leavingWorkspace && styles.buttonDisabled]}
              onPress={handleLeaveWorkspace}
              disabled={leavingWorkspace}
            >
              <Text style={styles.leaveWorkspaceText}>{leavingWorkspace ? 'Leaving...' : 'Leave Workspace'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
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
  logoutText: {
    color: '#dc2626',
    fontWeight: '700',
  },
});
