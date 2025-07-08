import React, { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

const marqueeImages = [
  require('../assets/images/marquee/image1.png'),
  require('../assets/images/marquee/image2.png'),
  require('../assets/images/marquee/image3.png'),
  require('../assets/images/marquee/image4.png'),
  require('../assets/images/marquee/image5.png'),
  require('../assets/images/marquee/image6.png'),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const MARQUEE_ROWS = 8;
const MARQUEE_REPEAT = 12;

function MarqueeRow({ images, duration, reverse, topOffset, imageSize }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: -SCREEN_WIDTH * 1.5,
        duration,
        useNativeDriver: true,
      })
    ).start();
  }, [anim, duration]);
  return (
    <Animated.View
      style={[
        styles.marqueeRow,
        {
          top: topOffset,
          transform: [
            { translateX: anim },
          ],
          flexDirection: reverse ? 'row-reverse' : 'row',
        },
      ]}
    >
      {Array(MARQUEE_REPEAT)
        .fill(images)
        .flat()
        .map((img, i) => (
          <Image
            key={i}
            source={img}
            style={[styles.marqueeImage, { width: imageSize, height: imageSize * 0.65 }]}
            resizeMode="cover"
          />
        ))}
    </Animated.View>
  );
}

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      {/* Angled Marquee Background with overlay */}
      <View style={styles.angledMarqueeWrapper} pointerEvents="none">
        <View style={styles.angledMarqueeContainer}>
          {[...Array(MARQUEE_ROWS)].map((_, i) => (
            <MarqueeRow
              key={i}
              images={marqueeImages}
              duration={35000 + i * 6000}
              reverse={i % 2 === 1}
              topOffset={i * 38}
              imageSize={180 - i * 8}
            />
          ))}
        </View>
        <View style={styles.marqueeOverlay} />
      </View>
      {/* Foreground Content */}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.foregroundBox}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Image source={require('../assets/images/logo.png')} style={styles.logo} />
            </View>
            <Text style={styles.title}>Local Pulse</Text>
          </View>
          <Text style={styles.subtitle}>Cinema-style updates for your neighborhood, in real-time.</Text>
          <Text style={styles.description}>
            Share hyperlocal, real-time updates. Discover what’s happening around you — instantly.
          </Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/signin')}>
            <Text style={styles.ctaButtonText}>🚀 Get Started</Text>
          </TouchableOpacity>
          <View style={styles.whyBoxCentered}>
            <Text style={styles.whyTitleCentered}>Why use Local Pulse?</Text>
            {[
              { icon: '⚡', text: 'Real-Time Updates' },
              { icon: '🤝', text: 'Community Driven' },
              { icon: '📍', text: 'Location Based' },
              { icon: '🔒', text: 'Privacy Focused' },
            ].map((item, i) => (
              <View key={i} style={styles.whyItemCentered}>
                <Text style={styles.whyIcon}>{item.icon}</Text>
                <Text style={styles.whyTextCentered}>{item.text}</Text>
              </View>
            ))}
          </View>
        
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  angledMarqueeWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  angledMarqueeContainer: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.7,
    left: -SCREEN_WIDTH * 0.7,
    width: SCREEN_WIDTH * 2.5,
    height: SCREEN_WIDTH * 2.5,
    transform: [{ rotate: '-30deg' }],
    opacity: 0.5,
  },
  marqueeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.25,
    zIndex: 1,
  },
  marqueeRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    marginVertical: 10,
    opacity: 0.7,
  },
  marqueeImage: {
    borderRadius: 16,
    marginRight: 32,
    opacity: 0.8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 2,
  },
  foregroundBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 28,
    maxWidth: 420,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -30,
    marginRight: 10,
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  logo: { width: 50, height: 50, borderRadius: 16 },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 22,
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.92,
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '400',
  },
  ctaButton: {
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 18,
    marginBottom: 18,
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  ctaButtonText: {
    color: '#667eea',
    fontWeight: 'bold',
    fontSize: 18,
  },
  whyBoxCentered: {
    marginTop: 18,
    marginBottom: 18,
    alignItems: 'center',
    width: '100%',
  },
  whyTitleCentered: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  whyItemCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  whyIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  whyTextCentered: {
    color: '#fff',
    fontSize: 16,
  },
  authRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
    gap: 16,
  },
  authButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
