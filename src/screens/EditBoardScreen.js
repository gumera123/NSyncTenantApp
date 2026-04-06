import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { uploadImageToCloudinary } from '../utils/cloudinaryHelper';

export default function EditBoardScreen({ route, navigation }) {
  const { board } = route.params;

  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description);
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  const handleUpdateBoard = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Board title is required.');
      return;
    }

    try {
      setUploading(true);
      let updatedData = {
        title: title.trim(),
        description: description.trim(),
      };

      if (imageUri) {
        const uploadedImageUrl = await uploadImageToCloudinary(imageUri);
        updatedData.boardImageUrl = uploadedImageUrl;
      }

      await updateDoc(doc(db, 'boards', board.id), updatedData);

      Alert.alert('Success', 'Board updated');
      navigation.goBack();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Board Title"
      />

      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        multiline
      />

      {board.boardImageUrl && !imageUri && (
        <Image source={{ uri: board.boardImageUrl }} style={styles.currentImage} />
      )}

      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>
          {imageUri ? 'Change Wallpaper' : 'Pick New Wallpaper'}
        </Text>
      </TouchableOpacity>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}

      <TouchableOpacity
        style={[styles.button, uploading && styles.buttonDisabled]}
        onPress={handleUpdateBoard}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>
          {uploading ? 'Updating...' : 'Update Board'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  currentImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 12,
  },
  imageButton: {
    backgroundColor: '#0f766e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  imageButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});