import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import {
  buildWorkspaceInviteQrPayload,
  parseWorkspaceInviteQrPayload,
  respondToWorkspaceInvite,
} from '../utils/workspaceInvite';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';

export default function WorkspaceInviteScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState(null);

  useEffect(() => {
    if (!permission) {
      requestPermission().catch((error) => {
        console.log('Error requesting scanner permission:', error);
      });
    }
  }, [permission, requestPermission]);

  const handleScan = useCallback(async ({ data }) => {
    if (scanned || loadingInvite || joinLoading) {
      return;
    }

    const payload = parseWorkspaceInviteQrPayload(data);

    if (!payload?.inviteId || !payload?.inviteToken) {
      Alert.alert('Invalid QR code', 'This code is not a valid workspace invite.');
      setScanned(false);
      return;
    }

    try {
      setLoadingInvite(true);
      setScanned(true);

      const inviteSnap = await getDoc(doc(db, 'invites', payload.inviteId));

      if (!inviteSnap.exists()) {
        throw new Error('This invitation no longer exists.');
      }

      const invite = inviteSnap.data();

      if (invite.inviteType !== 'qr') {
        throw new Error('This QR code was not generated for workspace joining.');
      }

      if (invite.inviteToken !== payload.inviteToken) {
        throw new Error('This QR invitation is invalid or expired.');
      }

      setInvitePreview({
        id: inviteSnap.id,
        ...invite,
        invitePayload: buildWorkspaceInviteQrPayload(inviteSnap.id, invite.inviteToken),
      });
    } catch (error) {
      console.log('Error loading QR invite:', error);
      Alert.alert('Scan failed', error.message || 'Unable to load this invite.');
      setScanned(false);
      setInvitePreview(null);
    } finally {
      setLoadingInvite(false);
    }
  }, [joinLoading, loadingInvite, scanned]);

  const handleJoinWorkspace = async () => {
    if (!auth.currentUser?.uid) {
      Alert.alert('Sign in required', 'You must be signed in to join a workspace.');
      return;
    }

    if (!invitePreview?.id) {
      Alert.alert('Invite not found', 'Scan a workspace QR code first.');
      return;
    }

    try {
      setJoinLoading(true);

      await respondToWorkspaceInvite({
        inviteId: invitePreview.id,
        inviteToken: invitePreview.inviteToken || '',
        userUid: auth.currentUser.uid,
        response: 'accepted',
      });

      Alert.alert('Workspace joined', 'You have joined the workspace successfully.');
      navigation.navigate('Boards');
    } catch (error) {
      console.log('Error joining workspace from QR:', error);
      Alert.alert('Join failed', error.message || 'Unable to join workspace.');
    } finally {
      setJoinLoading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PALETTE.green} />
          <Text style={styles.statusText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={42} color={PALETTE.black} />
          <Text style={styles.title}>Camera access is required</Text>
          <Text style={styles.subtitle}>
            Enable camera permission so the app can scan workspace QR invites.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => requestPermission()}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Scan Workspace QR</Text>
        <Text style={styles.subtitle}>
          Point the camera at the owner&apos;s workspace QR code to load the invite.
        </Text>

        <View style={styles.scannerFrame}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleScan}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanCorner} />
            <View style={[styles.scanCorner, styles.scanCornerRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
          </View>
        </View>

        {loadingInvite ? (
          <View style={styles.resultCard}>
            <ActivityIndicator size="small" color={PALETTE.green} />
            <Text style={styles.statusText}>Loading invite...</Text>
          </View>
        ) : null}

        {invitePreview ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{invitePreview.organizationName || 'Workspace Invite'}</Text>
            <Text style={styles.resultMeta}>
              Role label: {invitePreview.workspaceRoleTitle || invitePreview.role || 'Member'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, joinLoading && styles.buttonDisabled]}
              onPress={handleJoinWorkspace}
              disabled={joinLoading}
            >
              <Text style={styles.primaryButtonText}>{joinLoading ? 'Joining...' : 'Join Workspace'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setInvitePreview(null);
                setScanned(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Scan Another Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultCard}>
            <Text style={styles.resultMeta}>Waiting for a workspace QR code...</Text>
          </View>
        )}
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
    padding: 18,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.black,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: PALETTE.mutedInk,
  },
  scannerFrame: {
    flex: 1,
    minHeight: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorner: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#ffffff',
    borderTopLeftRadius: 18,
  },
  scanCornerRight: {
    left: undefined,
    right: '18%',
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 18,
  },
  scanCornerBottomLeft: {
    top: undefined,
    bottom: '18%',
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 18,
  },
  scanCornerBottomRight: {
    top: undefined,
    bottom: '18%',
    left: undefined,
    right: '18%',
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 18,
  },
  resultCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.black,
  },
  resultMeta: {
    fontSize: 14,
    color: PALETTE.mutedInk,
  },
  statusText: {
    fontSize: 14,
    color: PALETTE.mutedInk,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: PALETTE.green,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: PALETTE.black,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
