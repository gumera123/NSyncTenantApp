import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';

export default function AddBoardScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleRemoveCover = () => {
    setImageUri(null);
  };

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

  const handleAddBoard = async () => {
    if (!auth.currentUser) return;

    if (!title.trim()) {
      Alert.alert('Validation Error', 'Board title is required.');
      return;
    }

    try {
      setUploading(true);
      let uploadedImageUrl = null;
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const organizationId = userData?.organizationId || auth.currentUser.uid;

      if (imageUri) {
        uploadedImageUrl = await uploadImageToCloudinary(imageUri);
      }

      await addDoc(collection(db, 'boards'), {
        title: title.trim(),
        description: description.trim(),
        userId: auth.currentUser.uid,
        createdBy: auth.currentUser.uid,
        organizationId,
        createdAt: serverTimestamp(),
        boardImageUrl: uploadedImageUrl || null,
      });

      Alert.alert('Success', 'Board created successfully.');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('HomeTab');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      console.log('Add board error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Board</Text>
        <Text style={styles.subtitle}>Set up a new workspace.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Board Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Board title"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Optional description"
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>{imageUri ? 'Change Cover' : 'Choose Cover Image'}</Text>
          </TouchableOpacity>

          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}

          {imageUri ? (
            <TouchableOpacity style={styles.removeCoverButton} onPress={handleRemoveCover}>
              <Text style={styles.removeCoverText}>Remove Cover Image</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={[styles.primaryButton, uploading && styles.buttonDisabled]} onPress={handleAddBoard} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Board</Text>}
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
  content: {
    padding: 16,
    paddingBottom: 24,
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
    color: '#0f172a',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  multiline: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  removeCoverButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  removeCoverText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
