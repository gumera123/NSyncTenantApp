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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';
import { validatePhilippineMobileNumber, getPhilippineMobileErrorMessage } from '../utils/contactValidation';

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contactError, setContactError] = useState('');

  // Form state for edit mode
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    organizationName: '',
    role: '',
    address: '',
    description: '',
  });

  const userEmail = auth.currentUser?.email || 'No email available';

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
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

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
    if (!imageUri) return;

    try {
      setUploading(true);
      const uploadedImageUrl = await uploadImageToCloudinary(imageUri);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        organizationLogoUrl: uploadedImageUrl,
        updatedAt: serverTimestamp(),
      });

      setUserData(prev => ({ ...prev, organizationLogoUrl: uploadedImageUrl }));
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

    // Validate contact number if provided
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
        organizationName: formData.organizationName.trim(),
        role: formData.role.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
        updatedAt: serverTimestamp(),
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <LinearGradient
          colors={['#ffffff', '#f8f9ff', '#f0f0ff']}
          style={styles.container}
        >
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#ffffff', '#f8f9ff', '#f0f0ff']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Profile Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerCircleLarge} />
        <View style={styles.headerCircleSmall} />
        {userData && userData.organizationLogoUrl ? (
          <Image source={{ uri: userData.organizationLogoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(userData?.name || userEmail).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.organizationName}>
          {userData?.organizationName || 'Organization Profile'}
        </Text>
        <Text style={styles.role}>{userData?.role || 'Member'}</Text>

        {isEditMode ? (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.saveButton]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setIsEditMode(true)}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Logo Upload Section */}
      {isEditMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Logo</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Text style={styles.uploadText}>
              {userData?.organizationLogoUrl ? 'Change Logo' : 'Upload Logo'}
            </Text>
          </TouchableOpacity>

          {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}

          {imageUri && (
            <TouchableOpacity
              style={[styles.confirmButton, uploading && styles.buttonDisabled]}
              onPress={uploadLogo}
              disabled={uploading}
            >
              <Text style={styles.confirmText}>
                {uploading ? 'Uploading...' : 'Confirm Upload'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Account Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoField}>
          <Text style={styles.fieldLabel}>Email</Text>
          {isEditMode ? (
            <Text style={styles.readOnlyValue}>{userEmail}</Text>
          ) : (
            <Text style={styles.fieldValue}>{userEmail}</Text>
          )}
        </View>
      </View>

      {/* Personal Information Section */}
      {isEditMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={formData.name}
              onChangeText={(text) =>
                setFormData({ ...formData, name: text })
              }
              editable={!saving}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="09XXXXXXXXX or +639XXXXXXXXX"
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
            {contactError ? (
              <Text style={styles.errorText}>{contactError}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Role / Position</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Manager, Developer, Admin"
              value={formData.role}
              onChangeText={(text) =>
                setFormData({ ...formData, role: text })
              }
              editable={!saving}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Enter address"
              value={formData.address}
              onChangeText={(text) =>
                setFormData({ ...formData, address: text })
              }
              editable={!saving}
              multiline
            />
          </View>
        </View>
      )}

      {/* Organization Details Section */}
      {isEditMode ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Organization / Team Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter organization name"
              value={formData.organizationName}
              onChangeText={(text) =>
                setFormData({ ...formData, organizationName: text })
              }
              editable={!saving}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Enter organization description"
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              editable={!saving}
              multiline
            />
          </View>
        </View>
      ) : (
        userData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.infoField}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.fieldValue}>{userData.name || 'Not set'}</Text>
            </View>

            <View style={styles.infoField}>
              <Text style={styles.fieldLabel}>Contact Number</Text>
              <Text style={styles.fieldValue}>
                {userData.contactNumber || 'Not set'}
              </Text>
            </View>

            <View style={styles.infoField}>
              <Text style={styles.fieldLabel}>Address</Text>
              <Text style={styles.fieldValue}>
                {userData.address || 'Not set'}
              </Text>
            </View>
          </View>
        )
      )}

      {!isEditMode && userData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Details</Text>

          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Organization Name</Text>
            <Text style={styles.fieldValue}>
              {userData.organizationName || 'Not set'}
            </Text>
          </View>

          <View style={styles.infoField}>
            <Text style={styles.fieldLabel}>Description</Text>
            <Text style={styles.fieldValue}>
              {userData.description || 'Not set'}
            </Text>
          </View>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
    </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header Section */
  headerSection: {
    backgroundColor: '#f5f3ff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  headerCircleLarge: {
    position: 'absolute',
    top: -22,
    right: -20,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  headerCircleSmall: {
    position: 'absolute',
    top: 28,
    left: -18,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  organizationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  role: {
    fontSize: 14,
    color: '#7c3aed',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 'bold',
  },

  /* Section Styles */
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  /* Info Fields (View Mode) */
  infoField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  readOnlyValue: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 6,
  },

  /* Form Fields (Edit Mode) */
  formGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },

  /* Logo Upload */
  uploadButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 12,
  },
  confirmButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  /* Logout Button */
  logoutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  /* Spacer */
  spacer: {
    height: 20,
  },
});