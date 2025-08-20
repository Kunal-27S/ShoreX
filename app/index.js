import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { router } from 'expo-router';

export default function IndexScreen() {
  useEffect(() => {
    // Auto-navigate to landing page after a brief delay
    const timer = setTimeout(() => {
      router.replace('/landing');
    }, 2000); // 2 second delay - adjust as needed

    // Cleanup timer if component unmounts
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Optional: Add your logo here */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.appName}>Local Pulse</Text>
      </View>
      
      {/* Activity Indicator */}
      <ActivityIndicator 
        size="large" 
        color="#4A6FFF" 
        style={styles.loader} 
      />
      
      {/* Optional loading text */}
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loader: {
    marginVertical: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
    marginTop: 16,
  },
});