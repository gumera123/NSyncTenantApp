import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { formatDateToString } from '../utils/dateHelper';

export default function AddTaskScreen({ route, navigation }) {
  const { board } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('To Do');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleAddTask = async () => {
    if (!auth.currentUser) return;

    if (!title.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }

    if (!dueDate) {
      Alert.alert('Validation Error', 'Due date is required.');
      return;
    }

    try {
      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        status,
        dueDate: formatDateToString(dueDate),
        boardId: board.id,
        boardTitle: board.title,
        userId: auth.currentUser.uid,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Task created successfully.');
      navigation.goBack();
    } catch (error) {
      console.log('Add task error:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#ffffff', '#f8f9ff', '#f0f0ff']}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.accentCircleTop} />
          <View style={styles.accentCircleBottom} />
          <Text style={styles.title}>Create New Task</Text>
          <Text style={styles.subtitle}>Add a task to {board.title}</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Task Title"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Description (optional)"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.pickerContainer}>
              <Picker selectedValue={status} onValueChange={(itemValue) => setStatus(itemValue)}>
                <Picker.Item label="To Do" value="To Do" />
                <Picker.Item label="In Progress" value="In Progress" />
                <Picker.Item label="Done" value="Done" />
              </Picker>
            </View>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonLabel}>📅 Select Due Date</Text>
              <Text style={styles.dateButtonValue}>{formatDateToString(dueDate)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}

            {Platform.OS === 'ios' && showDatePicker && (
              <TouchableOpacity
                style={styles.datePickerConfirm}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerConfirmText}>Done</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.button} onPress={handleAddTask}>
              <Text style={styles.buttonText}>✨ Create Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    position: 'relative',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7c3aed',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  dateButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  datePickerConfirm: {
    backgroundColor: '#1e3a8a',
    padding: 12,
    borderRadius: 25,
    marginBottom: 16,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  datePickerConfirmText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  accentCircleTop: {
    position: 'absolute',
    top: -28,
    right: -26,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(124, 58, 237, 0.17)',
  },
  accentCircleBottom: {
    position: 'absolute',
    bottom: 14,
    left: -18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
  },
});