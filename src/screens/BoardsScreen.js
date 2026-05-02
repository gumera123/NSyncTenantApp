import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { createWorkspaceInvite } from '../utils/workspaceInvite';
import ConfirmDialog from '../components/ui/confirm-dialog';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';

function renderWorkspaceNameTitle(value) {
  const text = String(value || '').trim();

  if (!text) {
    return 'Workspace';
  }

  if (text.length < 2) {
    return text;
  }

  return (
    <>
      {text[0]}
      <Text style={styles.pageTitleAccent}>{text[1]}</Text>
      {text.slice(2)}
    </>
  );
}

export default function BoardsScreen({ navigation }) {
  const [boards, setBoards] = useState([]);
  const [favoriteBoards, setFavoriteBoards] = useState({});
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const currentUserId = auth.currentUser?.uid;
  const normalizedRole = (userData?.role || '').trim().toLowerCase();
  const isWorkspaceOwner = (userData?.organizationId || '') === (currentUserId || '');
  const isAdmin = normalizedRole === 'admin' || isWorkspaceOwner;
  const workspaceTitle =
    userData?.organizationName?.trim() ||
    userData?.teamName?.trim() ||
    userData?.name?.trim() ||
    'Workspace';

  const fetchBoards = useCallback(async () => {
    if (!auth.currentUser) {
      setBoards([]);
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userProfile = userDoc.exists() ? userDoc.data() : null;
      const organizationId = userProfile?.organizationId || auth.currentUser.uid;

      const [workspaceBoardsSnapshot, legacyBoardsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'boards'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'boards'), where('userId', '==', organizationId))),
      ]);

      const mergedBoards = [...workspaceBoardsSnapshot.docs, ...legacyBoardsSnapshot.docs];
      const uniqueBoards = [];
      const seenBoardIds = new Set();

      mergedBoards.forEach((docItem) => {
        if (seenBoardIds.has(docItem.id)) {
          return;
        }

        seenBoardIds.add(docItem.id);
        uniqueBoards.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      setBoards(uniqueBoards);
    } catch (error) {
      console.log('Error fetching boards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUserData = useCallback(async () => {
    if (!auth.currentUser) {
      setUserData(null);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.log('Error fetching current user:', error);
    }
  }, []);

  const handleDeleteBoard = async (boardId) => {
    if (!isAdmin) {
      Alert.alert('Admin Only', 'Only workspace admins can delete boards.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'boards', boardId));
      Alert.alert('Success', 'Board deleted.');
      fetchBoards();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteBoardWithConfirm = (board) => {
    if (!isAdmin) {
      Alert.alert('Admin Only', 'Only workspace admins can delete boards.');
      return;
    }

    setConfirmDialog({
      title: 'Delete Board',
      message: `Are you sure you want to delete "${board.title}"?`,
      confirmText: 'Delete',
      tone: 'danger',
      onConfirm: () => handleDeleteBoard(board.id),
    });
  };

  useEffect(() => {
    Promise.all([fetchBoards(), fetchCurrentUserData()]).catch((error) => {
      console.log('Error loading boards home data:', error);
    });

    const unsubscribe = navigation.addListener('focus', async () => {
      await Promise.all([fetchBoards(), fetchCurrentUserData()]);
    });
    return unsubscribe;
  }, [navigation, fetchBoards, fetchCurrentUserData]);

  useEffect(() => {
    if (!isAdmin && showInviteModal) {
      setShowInviteModal(false);
    }
  }, [isAdmin, showInviteModal]);

  const handleInviteMember = async () => {
    if (!auth.currentUser || !isAdmin) {
      Alert.alert('Admin Only', 'Only workspace admins can send invitations.');
      return;
    }

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      setInviteLoading(true);

      await createWorkspaceInvite({
        invitedEmail: inviteEmail,
        role: 'Member',
        invitedByUid: auth.currentUser.uid,
        invitedByName: userData?.name || '',
        organizationId: userData?.organizationId || auth.currentUser.uid,
        organizationName: userData?.organizationName || userData?.name || 'Workspace',
      });

      setInviteEmail('');
      setShowInviteModal(false);
      Alert.alert('Success', 'Invitation sent.');
    } catch (error) {
      console.log('Error inviting member:', error);
      Alert.alert('Error', error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredBoards = boards.filter((board) => {
    const title = board.title?.toLowerCase() || '';
    const description = board.description?.toLowerCase() || '';
    const queryText = searchQuery.toLowerCase();
    return title.includes(queryText) || description.includes(queryText);
  });

  const sortedBoards = [...filteredBoards].sort((left, right) => {
    const leftFavorite = favoriteBoards[left.id] ? 1 : 0;
    const rightFavorite = favoriteBoards[right.id] ? 1 : 0;

    if (leftFavorite !== rightFavorite) {
      return rightFavorite - leftFavorite;
    }

    const leftTitle = (left.title || '').toLowerCase();
    const rightTitle = (right.title || '').toLowerCase();
    return leftTitle.localeCompare(rightTitle);
  });

  const toggleFavorite = (boardId) => {
    setFavoriteBoards((currentFavorites) => ({
      ...currentFavorites,
      [boardId]: !currentFavorites[boardId],
    }));
  };

  const renderBoard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Tasks', { board: item })}
      activeOpacity={0.85}
    >
      <View style={styles.cardImageColumn}>
        {item.boardImageUrl ? (
          <Image source={{ uri: item.boardImageUrl }} style={styles.boardImage} />
        ) : (
          <View style={styles.boardImagePlaceholder}>
            <Ionicons name="layers-outline" size={30} color="#111827" />
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.boardTitle} numberOfLines={1}>{item.title}</Text>

        <Text style={styles.boardDescription} numberOfLines={2}>
          {item.description || 'Workspace overview and task tracking.'}
        </Text>

        <View style={styles.actionRow}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.favoriteButton, favoriteBoards[item.id] && styles.favoriteButtonActive]}
              onPress={() => toggleFavorite(item.id)}
            >
              <Ionicons 
                name={favoriteBoards[item.id] ? 'bookmark' : 'bookmark-outline'} 
                size={18} 
                color={favoriteBoards[item.id] ? '#ffffff' : '#111827'} 
              />
            </TouchableOpacity>
            {isAdmin ? (
              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('EditBoard', { board: item })}>
                <Ionicons name="create-outline" size={18} color="#111827" />
              </TouchableOpacity>
            ) : null}
            {isAdmin ? (
              <TouchableOpacity
                style={[styles.iconButton, styles.deleteIconButton]}
                onPress={(event) => {
                  event.stopPropagation();
                  handleDeleteBoardWithConfirm(item);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('Tasks', { board: item })}>
            <Text style={styles.primaryActionText}>Open Board</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>{renderWorkspaceNameTitle(workspaceTitle)}</Text>
            <Text style={styles.pageSubtitle}>Your workspace boards</Text>
          </View>

          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => setShowSearchInput((currentValue) => !currentValue)}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={20} color={PALETTE.black} />
          </TouchableOpacity>
        </View>

        {showSearchInput ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Search boards"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : null}

        {isAdmin ? (
          <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
            <Ionicons name="person-add-outline" size={17} color="#ffffff" />
            <Text style={styles.inviteButtonText}>Invite Members</Text>
          </TouchableOpacity>
        ) : null}

        <FlatList
          data={sortedBoards}
          keyExtractor={(item) => item.id}
          renderItem={renderBoard}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No boards found</Text>
              <Text style={styles.emptySub}>Create a board or adjust your search query.</Text>
            </View>
          }
          contentContainerStyle={sortedBoards.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {isAdmin ? (
          <Modal
            visible={showInviteModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowInviteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Invite Member</Text>

                <Text style={styles.modalLabel}>Registered Member Email</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="member@example.com"
                  placeholderTextColor="#94a3b8"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!inviteLoading}
                />

                <Text style={styles.modalHint}>All invited users are added as members by default.</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowInviteModal(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalPrimaryButton, inviteLoading && styles.modalPrimaryButtonDisabled]}
                    onPress={handleInviteMember}
                    disabled={inviteLoading}
                  >
                    <Text style={styles.modalPrimaryButtonText}>{inviteLoading ? 'Sending...' : 'Send Invite'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}

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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.softWhite,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 112,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.black,
  },
  pageTitleAccent: {
    color: PALETTE.green,
    fontWeight: '800',
  },
  pageSubtitle: {
    marginTop: 4,
    color: PALETTE.mutedInk,
  },
  searchIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: PALETTE.black,
  },
  inviteButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: PALETTE.black,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  inviteButtonText: {
    color: PALETTE.white,
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'row',
    minHeight: 154,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardImageColumn: {
    width: 118,
    position: 'relative',
  },
  boardImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  boardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 13,
  },
  cardContent: {
    flex: 1,
    borderLeftWidth: 4,
    borderLeftColor: PALETTE.green,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  boardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: PALETTE.black,
  },
  boardDescription: {
    marginTop: 4,
    color: PALETTE.mutedInk,
    lineHeight: 19,
    fontSize: 13,
  },
  actionRow: {
    marginTop: 12,
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    borderColor: PALETTE.green,
    backgroundColor: PALETTE.green,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconButton: {
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
  },
  primaryAction: {
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryActionText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '700',
  },
  imageBadge: {
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    color: PALETTE.black,
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 6,
    color: PALETTE.mutedInk,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalLabel: {
    color: '#0f172a',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#0f172a',
  },
  modalHint: {
    marginBottom: 10,
    color: '#475569',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  modalPrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
