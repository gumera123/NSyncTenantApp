import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { sendTeamMessage, loadTeamMessagesOnce, subscribeToTeamMessages } from '../utils/workspaceInvite';

const memberColorPalette = [
  { bubble: '#fef3c7', border: '#f59e0b', text: '#78350f', time: '#92400e', name: '#78350f' },
  { bubble: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', time: '#1d4ed8', name: '#1e40af' },
  { bubble: '#dcfce7', border: '#22c55e', text: '#14532d', time: '#166534', name: '#166534' },
  { bubble: '#fce7f3', border: '#ec4899', text: '#831843', time: '#9d174d', name: '#9d174d' },
  { bubble: '#f3e8ff', border: '#a855f7', text: '#581c87', time: '#6b21a8', name: '#6b21a8' },
  { bubble: '#e0f2fe', border: '#06b6d4', text: '#164e63', time: '#0e7490', name: '#155e75' },
  { bubble: '#ffedd5', border: '#f97316', text: '#7c2d12', time: '#9a3412', name: '#9a3412' },
];

function getMemberColorStyle(senderUid = '', senderEmail = '') {
  const key = `${senderUid}:${senderEmail}`;
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return memberColorPalette[hash % memberColorPalette.length];
}

export default function TeamChatScreen() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userOrganizationId, setUserOrganizationId] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [hasAccessError, setHasAccessError] = useState(false);
  const scrollViewRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const fetchUserData = useCallback(async () => {
    if (!auth.currentUser) {
      setHasAccessError(true);
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        setHasAccessError(true);
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const orgId = userData?.organizationId || auth.currentUser.uid;

      setCurrentUserData(userData);
      setUserOrganizationId(orgId);

      const initialMessages = await loadTeamMessagesOnce(orgId);
      setMessages(initialMessages);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      const unsubscribe = subscribeToTeamMessages(orgId, (updatedMessages) => {
        setMessages(updatedMessages);
      });

      unsubscribeRef.current = unsubscribe;
      setLoading(false);
    } catch (error) {
      console.log('Error loading team chat data:', error);
      setHasAccessError(true);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }, [fetchUserData])
  );

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !userOrganizationId || !auth.currentUser) {
      return;
    }

    try {
      setSending(true);

      await sendTeamMessage({
        senderUid: auth.currentUser.uid,
        senderName: currentUserData?.name || auth.currentUser.email || 'User',
        senderEmail: auth.currentUser.email || '',
        organizationId: userOrganizationId,
        message: inputText,
      });

      setInputText('');

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.log('Error sending message:', error);
      Alert.alert('Failed to send', error.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }, [inputText, userOrganizationId, currentUserData]);

  const formatMessageTime = (createdAt) => {
    const seconds = createdAt?.seconds;
    if (!seconds) {
      return 'Just now';
    }

    const messageDate = new Date(seconds * 1000);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();

    if (isToday) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (hasAccessError) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-open-outline" size={48} color="#64748b" />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorMessage}>You don&apos;t have permission to view team chat.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>Team Chat</Text>
            <Text style={styles.pageSubtitle}>Only team members can message here</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContentContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Start a conversation with your team!</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.senderUid === auth.currentUser?.uid;
              const memberColorStyle = getMemberColorStyle(msg.senderUid, msg.senderEmail);

              return (
                <View key={msg.id} style={[styles.messageRow, isCurrentUser ? styles.messageRowCurrent : styles.messageRowOther]}>
                  <View
                    style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.messageBubbleCurrent : styles.messageBubbleOther,
                      !isCurrentUser
                        ? { backgroundColor: memberColorStyle.bubble, borderColor: memberColorStyle.border }
                        : null,
                    ]}
                  >
                    {!isCurrentUser ? <Text style={[styles.senderName, { color: memberColorStyle.name }]}>{msg.senderName}</Text> : null}
                    <Text
                      style={[
                        styles.messageText,
                        isCurrentUser ? styles.messageTextCurrent : styles.messageTextOther,
                        !isCurrentUser ? { color: memberColorStyle.text } : null,
                      ]}
                    >
                      {msg.message}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isCurrentUser ? styles.messageTimeCurrent : styles.messageTimeOther,
                        !isCurrentUser ? { color: memberColorStyle.time } : null,
                      ]}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={5000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (sending || !inputText.trim()) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            activeOpacity={0.85}
            disabled={sending || !inputText.trim()}
          >
            <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={20} color={sending || !inputText.trim() ? '#94a3b8' : '#ffffff'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerContent: {
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    padding: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageRowCurrent: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    padding: 10,
  },
  messageBubbleCurrent: {
    backgroundColor: '#111827',
  },
  messageBubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextCurrent: {
    color: '#ffffff',
  },
  messageTextOther: {
    color: '#0f172a',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
  },
  messageTimeCurrent: {
    color: '#cbd5e1',
  },
  messageTimeOther: {
    color: '#94a3b8',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
