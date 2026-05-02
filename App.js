// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import GlobalPromptHost from './src/components/ui/global-prompt-host';
import { showPrompt } from './src/utils/promptService';
import AdminDashboardApp from './src/admin/AdminDashboardApp';

const inferToneFromTitle = (titleText) => {
  const text = String(titleText || '').toLowerCase();

  if (text.includes('success')) {
    return 'success';
  }

  if (text.includes('error') || text.includes('failed') || text.includes('fail')) {
    return 'error';
  }

  if (text.includes('warning') || text.includes('validation') || text.includes('permission')) {
    return 'warning';
  }

  return 'info';
};

if (!globalThis.__NSYNC_ALERT_PATCHED__) {
  const nativeAlert = Alert.alert.bind(Alert);

  Alert.alert = (title, message, buttons, options) => {
    const hasMultipleButtons = Array.isArray(buttons) && buttons.length > 1;

    if (hasMultipleButtons) {
      return nativeAlert(title, message, buttons, options);
    }

    const singleButton = Array.isArray(buttons) && buttons.length === 1 ? buttons[0] : null;

    const shownInPrompt = showPrompt({
      title: String(title || 'Notice'),
      message: String(message || ''),
      tone: inferToneFromTitle(title),
      buttonText: singleButton?.text || 'OK',
      onDismiss: singleButton?.onPress,
    });

    if (!shownInPrompt) {
      return nativeAlert(title, message, buttons, options);
    }

    return undefined;
  };

  globalThis.__NSYNC_ALERT_PATCHED__ = true;
}

export default function App() {
  const isAdminWebRoute =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().startsWith('/admin');

  if (isAdminWebRoute) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AdminDashboardApp />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlobalPromptHost>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </GlobalPromptHost>
    </GestureHandlerRootView>
  );
}
