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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { formatDateToString, parseDateString } from '../utils/dateHelper';

export default function EditTaskScreen({ route, navigation }) {
  const { task } = route.params;

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status || 'To Do');
  const [dueDate, setDueDate] = useState(parseDateString(task.dueDate || ''));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleUpdateTask = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }

    if (!dueDate) {
      Alert.alert('Validation Error', 'Due date is required.');
      return;
    }

    try {
      const taskRef = doc(db, 'tasks', task.id);

      await updateDoc(taskRef, {
        title: title.trim(),
        description: description.trim(),
        status,
        dueDate: formatDateToString(dueDate),
      });

      Alert.alert('Success', 'Task updated successfully.');
      navigation.goBack();
    } catch (error) {
      console.log('Update task error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteTask = async () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'tasks', task.id));
              Alert.alert('Success', 'Task deleted successfully.');
              navigation.goBack();
            } catch (error) {
              console.log('Delete task error:', error);
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Task Title"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={status}
          onValueChange={(itemValue) => setStatus(itemValue)}
        >
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

      <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTask}>
        <Text style={styles.buttonText}>Update Task</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTask}>
        <Text style={styles.buttonText}>Delete Task</Text>
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  datePickerConfirmText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  updateButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});