import React, { useState, useEffect, useRef } from "react";
import { PublicRoute } from '../ProtectedRoute';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions, ScrollView, BackHandler, ToastAndroid, Platform } from "react-native";
import { router } from "expo-router";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

const marqueeImages = [
  require('../assets/images/marquee/image1_converted.png'),
  require('../assets/images/marquee/image2_converted.png'),
  require('../assets/images/marquee/image3_converted.png'),
  require('../assets/images/marquee/image4_converted.png'),
  require('../assets/images/marquee/image5_converted.png'),
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
          <Animated.Image
            key={i}
            source={img}
            style={[styles.marqueeImage, { width: imageSize, height: imageSize * 0.65 }]}
            resizeMode="cover"
          />
        ))}
    </Animated.View>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [lastBackPress, setLastBackPress] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldownTime > 0) {
      timer = setInterval(() => {
        setCooldownTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownTime]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (lastBackPress && now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        } else {
          setLastBackPress(now);
          if (Platform.OS === 'android') {
            ToastAndroid.show('Press again to exit', ToastAndroid.SHORT);
          }
          return true;
        }
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [lastBackPress])
  );

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    setVerificationSent(false);
    setUnverifiedUser(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user.emailVerified) {
        setUnverifiedUser(user);
        setError('Please verify your email address before signing in. Check your inbox for the verification link.');
        setLoading(false);
        return;
      }
      setLoading(false);
      router.replace('/home');
    } catch (error) {
      let errorMessage = 'Failed to sign in. ';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (cooldownTime > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      if (unverifiedUser) {
        await sendEmailVerification(unverifiedUser);
        setVerificationSent(true);
        setError('A new verification email has been sent. Please check your inbox.');
        setCooldownTime(60);
      }
    } catch (error) {
      let errorMessage = 'Failed to send verification email. ';
      if (error.code === 'auth/too-many-requests') {
        errorMessage += 'Too many attempts. Please wait a few minutes before trying again.';
        setCooldownTime(300);
      } else if (error.code === 'auth/user-not-found') {
        errorMessage += 'User not found. Please sign up first.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += 'Invalid email address.';
      } else {
        errorMessage += 'Please try again later.';
      }
      setError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Marquee Background */}
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
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.formBox}>
          <Text style={styles.title}>Welcome Back to Ocean Pulse</Text>
          <Text style={styles.subtitle}>Sign in to continue to your dashboard</Text>
          {error && (
            <Text style={[styles.errorText, error.includes('verification email has been sent') && styles.successText]}>
              {error}
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="Email Address *"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Password *"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.iconRight}
              onPress={() => setShowPassword(v => !v)}
            >
              <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={22} color="#aaa" />
            </TouchableOpacity>
          </View>
          {unverifiedUser && (
            <TouchableOpacity
              onPress={handleResendVerification}
              disabled={cooldownTime > 0 || isResending}
              style={[styles.button, styles.buttonOutline, (cooldownTime > 0 || isResending) && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                {isResending ? 'Sending...' : cooldownTime > 0 ? `Resend verification (${cooldownTime}s)` : 'Resend verification email'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.link}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

export default function PublicSignInWrapper(props) {
  return (
    <PublicRoute>
      <SignIn {...props} />
    </PublicRoute>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
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
    opacity: 0.4,
  },
  marqueeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
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
    opacity: 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 2,
  },
  formBox: {
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: 20,
    padding: 28,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#232323',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#232323',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  iconRight: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: '#e74c3c',
    marginBottom: 8,
    fontSize: 13,
    alignSelf: 'flex-start',
  },
  successText: {
    color: '#4BB543',
  },
  button: {
    backgroundColor: '#4A6FFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
    marginBottom: 8,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: '#232323',
    borderWidth: 1,
    borderColor: '#4A6FFF',
  },
  buttonDisabled: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    marginTop: 8,
    marginBottom: 24,
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
  },
});

