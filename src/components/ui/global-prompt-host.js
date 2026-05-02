import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setPromptHandler } from '../../utils/promptService';

const toneIconMap = {
  success: 'checkmark-outline',
  error: 'close-outline',
  warning: 'alert-outline',
  info: 'information-outline',
};

const toneColorMap = {
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  info: '#1d4ed8',
};

export default function GlobalPromptHost({ children }) {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const unsubscribe = setPromptHandler((payload) => {
      setPrompt({
        title: payload?.title || 'Notice',
        message: payload?.message || '',
        tone: payload?.tone || 'info',
        buttonText: payload?.buttonText || 'OK',
        onDismiss: payload?.onDismiss,
      });
    });

    return unsubscribe;
  }, []);

  const closePrompt = () => {
    const dismissHandler = prompt?.onDismiss;
    setPrompt(null);

    if (typeof dismissHandler === 'function') {
      dismissHandler();
    }
  };

  const tone = prompt?.tone || 'info';
  const iconName = toneIconMap[tone] || toneIconMap.info;
  const accentColor = toneColorMap[tone] || toneColorMap.info;

  return (
    <>
      {children}

      <Modal
        visible={Boolean(prompt)}
        transparent
        animationType="fade"
        onRequestClose={closePrompt}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { borderColor: `${accentColor}33` }]}>
              <Ionicons name={iconName} size={18} color={accentColor} />
            </View>

            <Text style={styles.title}>{prompt?.title}</Text>
            <Text style={styles.message}>{prompt?.message}</Text>

            <TouchableOpacity style={[styles.button, { backgroundColor: accentColor }]} onPress={closePrompt}>
              <Text style={styles.buttonText}>{prompt?.buttonText || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
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
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    marginTop: 8,
    color: '#475569',
    lineHeight: 22,
  },
  button: {
    marginTop: 18,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
