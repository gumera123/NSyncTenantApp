import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BoardsScreen from '../screens/BoardsScreen';
import AddBoardScreen from '../screens/AddBoardScreen';
import TasksScreen from '../screens/TasksScreen';
import AddTaskScreen from '../screens/AddTaskScreen';
import EditTaskScreen from '../screens/EditTaskScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditBoardScreen from '../screens/EditBoardScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { syncWorkspaceAccessForUser, loadUserNotifications } from '../utils/workspaceInvite';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const palette = {
  bg: '#f4f6f8',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#94a3b8',
  border: '#e2e8f0',
};

const stackDefaults = {
  headerStyle: { backgroundColor: palette.surface },
  headerTintColor: palette.text,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: palette.bg },
};

function BoardsStack() {
  return (
    <Stack.Navigator screenOptions={stackDefaults}>
      <Stack.Screen name="Boards" component={BoardsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddBoard" component={AddBoardScreen} options={{ title: 'New Board' }} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
      <Stack.Screen name="AddTask" component={AddTaskScreen} options={{ title: 'New Task' }} />
      <Stack.Screen name="EditTask" component={EditTaskScreen} options={{ title: 'Edit Task' }} />
      <Stack.Screen name="EditBoard" component={EditBoardScreen} options={{ title: 'Edit Board' }} />
    </Stack.Navigator>
  );
}

function NotificationsStack() {
  return (
    <Stack.Navigator screenOptions={stackDefaults}>
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={stackDefaults}>
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackDefaults}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function CustomTabBar({ state, descriptors, navigation, unreadCount, hideAddBoardButton }) {
  const handleAddBoard = () => {
    navigation.navigate('HomeTab', { screen: 'AddBoard' });
  };

  return (
    <View pointerEvents="box-none" style={styles.tabBarOverlay}>
      {hideAddBoardButton ? null : (
        <TouchableOpacity activeOpacity={0.92} style={styles.floatingAddButton} onPress={handleAddBoard}>
          <Ionicons name="add" size={26} color="#ffffff" />
        </TouchableOpacity>
      )}

      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          let iconName = 'ellipse-outline';
          if (route.name === 'HomeTab') {
            iconName = isFocused ? 'home' : 'home-outline';
          } else if (route.name === 'ReportsTab') {
            iconName = isFocused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'NotificationsTab') {
            iconName = isFocused ? 'mail' : 'mail-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = isFocused ? 'person' : 'person-outline';
          }

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              activeOpacity={0.9}
              onPress={onPress}
              style={styles.tabItem}
            >
              <View style={styles.tabIconWrap}>
                <Ionicons
                  name={iconName}
                  size={21}
                  color={isFocused ? '#ffffff' : '#9ca3af'}
                />
                {route.name === 'NotificationsTab' && unreadCount > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabsWithListener() {
  const [activeRouteName, setActiveRouteName] = useState('Boards');
  const [unreadCount, setUnreadCount] = useState(0);
  const hiddenTabRoutes = useMemo(() => ['Tasks', 'AddTask', 'EditTask', 'EditBoard', 'TeamChat'], []);
  const hiddenAddBoardRoutes = useMemo(() => ['Reports', 'Notifications', 'Profile'], []);

  const refreshUnreadNotifications = useCallback(async () => {
    if (!auth.currentUser) {
      setUnreadCount(0);
      return;
    }

    try {
      const notifications = await loadUserNotifications(auth.currentUser.uid);
      setUnreadCount(notifications.filter((notification) => !notification.isRead).length);
    } catch (error) {
      console.log('Error loading notification badge:', error);
    }
  }, []);

  useEffect(() => {
    refreshUnreadNotifications();
  }, [refreshUnreadNotifications, activeRouteName]);

  const shouldHideTabBar = hiddenTabRoutes.includes(activeRouteName);
  const shouldHideAddBoardButton = hiddenAddBoardRoutes.includes(activeRouteName);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        shouldHideTabBar ? null : (
          <CustomTabBar
            {...props}
            unreadCount={unreadCount}
            hideAddBoardButton={shouldHideAddBoardButton}
          />
        )
      )}
    >
      <Tab.Screen
        name="HomeTab"
        component={BoardsStack}
        listeners={({ route }) => ({
          state: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Boards';
            setActiveRouteName(nestedRouteName);
          },
          focus: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Boards';
            setActiveRouteName(nestedRouteName);
            refreshUnreadNotifications();
          },
          tabPress: () => {
            setActiveRouteName('Boards');
          },
        })}
        options={{
          tabBarLabel: 'Homepage',
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStack}
        listeners={({ route }) => ({
          state: () => {
            const activeNestedRoute = route.state?.routes?.[route.state.index ?? 0];
            const nestedRouteName =
              activeNestedRoute?.params?.activeTab === 'teamChat'
                ? 'TeamChat'
                : activeNestedRoute?.name ?? 'Notifications';
            setActiveRouteName(nestedRouteName);
          },
          focus: () => {
            const activeNestedRoute = route.state?.routes?.[route.state.index ?? 0];
            const nestedRouteName =
              activeNestedRoute?.params?.activeTab === 'teamChat'
                ? 'TeamChat'
                : activeNestedRoute?.name ?? 'Notifications';
            setActiveRouteName(nestedRouteName);
            refreshUnreadNotifications();
          },
          tabPress: () => {
            setActiveRouteName('Notifications');
          },
        })}
        options={{
          tabBarLabel: 'Inbox',
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsStack}
        listeners={({ route }) => ({
          state: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Reports';
            setActiveRouteName(nestedRouteName);
          },
          focus: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Reports';
            setActiveRouteName(nestedRouteName);
            refreshUnreadNotifications();
          },
        })}
        options={{
          tabBarLabel: 'Reports',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        listeners={({ route }) => ({
          state: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Profile';
            setActiveRouteName(nestedRouteName);
          },
          focus: () => {
            const nestedRouteName = route.state?.routes?.[route.state.index ?? 0]?.name ?? 'Profile';
            setActiveRouteName(nestedRouteName);
            refreshUnreadNotifications();
          },
        })}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

function MainTabs() {
  return <MainTabsWithListener />;
}

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    syncWorkspaceAccessForUser(user).catch((error) => {
      console.log('Error syncing workspace access:', error);
    });
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={user ? 'MainTabs' : 'Login'} screenOptions={stackDefaults}>
      {user ? (
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.bg,
  },
  tabBarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  tabBar: {
    width: '90%',
    minHeight: 68,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#090c12',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconWrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#090c12',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  floatingAddButton: {
    position: 'absolute',
    right: '12%',
    bottom: 88,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2d4f92',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
