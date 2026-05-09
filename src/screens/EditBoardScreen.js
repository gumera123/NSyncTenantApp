import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';

export default function EditBoardScreen({ route, navigation }) {
  const { board } = route.params;

  const [title, setTitle] = useState(board.title || '');
  const [description, setDescription] = useState(board.description || '');
  const [existingCoverUrl, setExistingCoverUrl] = useState(board.boardImageUrl || '');
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const normalizeText = (value) => (value || '').trim();
  const hasBoardChanges = Boolean(
    normalizeText(title) !== normalizeText(board.title) ||
    normalizeText(description) !== normalizeText(board.description) ||
    imageUri !== null ||
    (existingCoverUrl === '' && board.boardImageUrl)
  );

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

  const handleRemoveCover = () => {
    if (imageUri) {
      setImageUri(null);
      return;
    }

    if (existingCoverUrl) {
      setExistingCoverUrl('');
    }
  };

  const handleUpdateBoard = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Board title is required.');
      return;
    }

    try {
      setUploading(true);
      const updatedData = {
        title: title.trim(),
        description: description.trim(),
      };

      if (imageUri) {
        const uploadedImageUrl = await uploadImageToCloudinary(imageUri);
        updatedData.boardImageUrl = uploadedImageUrl;
      } else if (!existingCoverUrl && board.boardImageUrl) {
        updatedData.boardImageUrl = null;
      }

      await updateDoc(doc(db, 'boards', board.id), updatedData);
      Alert.alert('Success', 'Board updated.');
      navigation.goBack();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Board Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Board title" />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            multiline
          />

          {existingCoverUrl && !imageUri ? <Image source={{ uri: existingCoverUrl }} style={styles.previewImage} /> : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>{imageUri ? 'Change Cover' : 'Pick New Cover'}</Text>
          </TouchableOpacity>

          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}

          {existingCoverUrl || imageUri ? (
            <TouchableOpacity style={styles.removeCoverButton} onPress={handleRemoveCover}>
              <Text style={styles.removeCoverText}>Remove Cover Image</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (uploading || !hasBoardChanges) && styles.buttonDisabled,
            ]}
            onPress={handleUpdateBoard}
            disabled={uploading || !hasBoardChanges}
          >
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update Board</Text>}
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
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#0f172a',
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
    height: 140,
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
