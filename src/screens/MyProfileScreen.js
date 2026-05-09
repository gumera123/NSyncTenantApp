import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';

export default function MyProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const userEmail = auth.currentUser?.email || 'No email available';
  const profileName = userData?.name || 'Your Name';
  const profileInitial = (profileName || userEmail.charAt(0)).charAt(0).toUpperCase();

  const fetchUserData = useCallback(async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.log('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const rows = [
    {
      icon: 'mail-outline',
      label: 'Email',
      value: userEmail,
    },
    {
      icon: 'phone-portrait-outline',
      label: 'Phone',
      value: userData?.contactNumber || 'Add a phone number',
    },
    {
      icon: 'location-outline',
      label: 'Location',
      value: userData?.address || 'Add a location',
    },
    {
      icon: 'sparkles-outline',
      label: 'Birthday',
      value: userData?.birthday || 'Add a birthday',
    },
    {
      icon: 'briefcase-outline',
      label: 'Work anniversary',
      value: userData?.workAnniversary || 'Add a work anniversary',
    },
  ];

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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.goBack()} activeOpacity={0.78}>
            <Ionicons name="arrow-back" size={30} color="#24272d" />
          </TouchableOpacity>
          <Text style={styles.title}>My profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('Profile', { startEdit: true, returnToMyProfile: true })}
            activeOpacity={0.78}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileSummary}>
          {userData?.organizationLogoUrl ? (
            <Image source={{ uri: userData.organizationLogoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{profileInitial}</Text>
            </View>
          )}
          <Text style={styles.profileName}>{profileName}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Personal info</Text>
          <View style={styles.divider} />

          {rows.map((row, index) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <View style={styles.rowIconWrap}>
                  <View style={styles.rowIconBubble}>
                    <Ionicons name={row.icon} size={17} color={PALETTE.white} />
                  </View>
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              </View>
              {index < rows.length - 1 ? <View style={styles.rowDivider} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    color: '#202329',
    fontSize: 24,
    fontWeight: '700',
  },
  editButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingLeft: 18,
  },
  editText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  profileSummary: {
    marginTop: 66,
    marginBottom: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 21,
    marginRight: 24,
  },
  avatarFallback: {
    width: 82,
    height: 82,
    borderRadius: 21,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '800',
  },
  profileName: {
    flex: 1,
    color: '#25282e',
    fontSize: 20,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardTitle: {
    color: '#25282e',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e3e7',
    marginTop: 14,
  },
  infoRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.green,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    color: PALETTE.mutedInk,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  infoValue: {
    marginTop: 2,
    color: PALETTE.black,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#eef2f7',
  },
});
