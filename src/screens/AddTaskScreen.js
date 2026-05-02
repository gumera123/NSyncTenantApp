import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { formatDateToString } from '../utils/dateHelper';

const statusOptions = ['To Do', 'In Progress', 'Done'];

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
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const organizationId = board.organizationId || userData?.organizationId || auth.currentUser.uid;

      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        status,
        dueDate: formatDateToString(dueDate),
        boardId: board.id,
        boardTitle: board.title,
        userId: auth.currentUser.uid,
        createdBy: auth.currentUser.uid,
        organizationId,
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Task</Text>
        <Text style={styles.subtitle}>Board: {board.title}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Task Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Task title"
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

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusSegment}>
            {statusOptions.map((option) => {
              const isSelected = status === option;

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.statusChip, isSelected ? styles.statusChipActive : null]}
                  onPress={() => setStatus(option)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.statusChipText, isSelected ? styles.statusChipTextActive : null]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonLabel}>Due date</Text>
            <Text style={styles.dateButtonValue}>{formatDateToString(dueDate)}</Text>
          </TouchableOpacity>

          {showDatePicker ? (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          ) : null}

          {Platform.OS === 'ios' && showDatePicker ? (
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.createButton} onPress={handleAddTask}>
            <Text style={styles.createButtonText}>Create Task</Text>
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
  statusSegment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statusChip: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  statusChipText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  statusChipTextActive: {
    color: '#fff',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  dateButtonValue: {
    color: '#0f172a',
    fontWeight: '600',
  },
  doneButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  createButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
