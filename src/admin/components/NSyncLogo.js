import { StyleSheet, Text, View } from "react-native";

/**
 * NSync branded logo component
 * Renders "NSync" with the "S" highlighted in green
 */
export default function NSyncLogo({ size = "large", variant = "text-only" }) {
  const isSmall = size === "small";
  const isLarge = size === "large";

  if (variant === "icon") {
    // Icon variant: Large stylized S with green accent
    return (
      <View
        style={[styles.iconWrapper, isSmall ? styles.iconWrapperSmall : null]}
      >
        <View style={styles.iconBg}>
          <Text style={[styles.iconN, isSmall ? styles.iconNSmall : null]}>
            N
          </Text>
        </View>
      </View>
    );
  }

  // Text variant: "NSync" with green S
  return (
    <View style={styles.textWrapper}>
      <Text
        style={[
          styles.text,
          isSmall ? styles.textSmall : isLarge ? styles.textLarge : null,
        ]}
      >
        <Text
          style={[
            styles.textRegular,
            isSmall ? styles.textRegularSmall : null,
            isLarge ? styles.textRegularLarge : null,
          ]}
        >
          N
        </Text>
        <Text
          style={[
            styles.textGreen,
            isSmall ? styles.textGreenSmall : null,
            isLarge ? styles.textGreenLarge : null,
          ]}
        >
          S
        </Text>
        <Text
          style={[
            styles.textRegular,
            isSmall ? styles.textRegularSmall : null,
            isLarge ? styles.textRegularLarge : null,
          ]}
        >
          ync
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Icon variant styles
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff", // 60% white background
    borderWidth: 2,
    borderColor: "#071720", // 30% black border
  },
  iconWrapperSmall: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  iconBg: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconN: {
    fontSize: 32,
    fontWeight: "900",
    color: "#071720", // 30% black
  },
  iconNSmall: {
    fontSize: 22,
  },

  // Text variant styles
  textWrapper: {
    justifyContent: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  textLarge: {
    fontSize: 32,
    letterSpacing: -0.8,
  },
  textSmall: {
    fontSize: 16,
  },
  textRegular: {
    color: "#071720", // 30% black
  },
  textRegularLarge: {
    fontSize: 32,
  },
  textRegularSmall: {
    fontSize: 16,
  },
  textGreen: {
    color: "#24B35A", // 10% green accent
  },
  textGreenLarge: {
    fontSize: 32,
  },
  textGreenSmall: {
    fontSize: 16,
  },
});
