import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AUTH_UI_PALETTE as PALETTE } from '../../config/uiTokens';

function renderSubtitle(subtitle, highlightSecondLetter) {
  if (!subtitle) {
    return null;
  }

  const text = String(subtitle);

  if (!highlightSecondLetter || text.length < 2) {
    return text;
  }

  return (
    <>
      {text[0]}
      <Text style={styles.subtitleAccent}>{text[1]}</Text>
      {text.slice(2)}
    </>
  );
}

export default function NSyncBrand({
  size = 'large',
  subtitle,
  highlightSecondLetter = false,
}) {
  const compact = size === 'small';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.brand, compact && styles.brandCompact]}>
        N
        <Text style={styles.brandAccent}>S</Text>
        ync
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
          {renderSubtitle(subtitle, highlightSecondLetter)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: {
    fontSize: 60,
    fontWeight: '900',
    color: PALETTE.black,
    letterSpacing: 0.4,
    lineHeight: 64,
  },
  brandCompact: {
    fontSize: 40,
    lineHeight: 44,
  },
  brandAccent: {
    color: PALETTE.green,
  },
  subtitle: {
    marginTop: 6,
    color: PALETTE.mutedInk,
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitleAccent: {
    color: PALETTE.green,
    fontWeight: '700',
  },
  subtitleCompact: {
    marginTop: 4,
    fontSize: 12,
  },
});
