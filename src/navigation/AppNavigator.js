// src/navigation/AppNavigator.js
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BoardsScreen from '../screens/BoardsScreen';
import AddBoardScreen from '../screens/AddBoardScreen';
import TasksScreen from '../screens/TasksScreen';
import AddTaskScreen from '../screens/AddTaskScreen';
import EditTaskScreen from '../screens/EditTaskScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditBoardScreen from '../screens/EditBoardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BoardsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Boards" 
        component={BoardsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen
        name="AddTask"
        component={AddTaskScreen}
        options={{ title: 'Add Task' }}
      />
      <Stack.Screen
        name="EditTask"
        component={EditTaskScreen}
        options={{ title: 'Edit Task' }}
      />
      <Stack.Screen
        name="EditBoard"
        component={EditBoardScreen}
        options={{ title: 'Edit Board' }}
      />
    </Stack.Navigator>
  );
}

function AddBoardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AddBoard"
        component={AddBoardScreen}
        options={{ title: 'Add Board' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'BoardsTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AddBoardTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="BoardsTab" 
        component={BoardsStack} 
        options={{ tabBarLabel: 'Boards' }}
      />
      <Tab.Screen 
        name="AddBoardTab" 
        component={AddBoardStack} 
        options={{ tabBarLabel: 'Add Board' }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileStack} 
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={user ? 'MainTabs' : 'Login'}>
      {user ? (
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs} 
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Register' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}