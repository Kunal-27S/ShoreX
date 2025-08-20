import React, { useState, useRef, useEffect } from "react";
import { PublicRoute } from '../ProtectedRoute';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions, ScrollView, Modal, Pressable } from "react-native";
import { router } from "expo-router";
import { auth, firestore } from "../firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { MaterialIcons } from '@expo/vector-icons';

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

function SignUp() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [locationAccess, setLocationAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [error, setError] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [infoVisible, setInfoVisible] = useState(false);

  useEffect(() => {
    setErrors({});
  }, [email, username, password, confirmPassword, locationAccess]);

  // Function to check if username is available
  const checkUsernameAvailability = async (username) => {
    username = username.trim();
    if (!username || username.length < 3) return false;
    setCheckingUsername(true);
    try {
      const usersCollectionRef = collection(firestore, 'users');
      const usernameQuery = query(usersCollectionRef, where('displayName', '==', username));
      const usernameSnapshot = await getDocs(usernameQuery);
      return usernameSnapshot.empty;
    } catch (error) {
      setError("Failed to check username availability: " + error.message);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!username) newErrors.username = 'Username is required';
    else if (username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    if (!locationAccess) newErrors.locationAccess = 'Location access is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const allFieldsValid = () => {
    return (
      email &&
      /\S+@\S+\.\S+/.test(email) &&
      password &&
      password.length >= 6 &&
      confirmPassword &&
      password === confirmPassword &&
      username &&
      username.length >= 3 &&
      locationAccess &&
      !checkingUsername
    );
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const trimmedUsername = username.trim();
      const isUsernameAvailable = await checkUsernameAvailability(trimmedUsername);
      if (!isUsernameAvailable) {
        setErrors({ username: 'Username already exists. Please choose a different one.' });
        setLoading(false);
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: trimmedUsername });
      await sendEmailVerification(user);
      await setDoc(doc(firestore, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: trimmedUsername,
        createdAt: new Date(),
        emailVerified: false,
        settings: {
          theme: 'dark', // Default to dark theme for new users
          radius: '5'    // Default radius
        }
      });
      setVerificationSent(true);
    } catch (error) {
      setError(error.message || 'An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <View style={styles.container}>
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
        <View style={styles.contentContainer}>
          <View style={styles.formBox}>
            <Text style={styles.title}>Verification email sent!</Text>
            <Text style={styles.subtitle}>Please check your email to verify your account.</Text>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/signin')}>
              <Text style={styles.buttonText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Local Pulse to start sharing your experiences</Text>
          {Object.values(errors).length > 0 && (
            <Text style={styles.errorText}>{Object.values(errors)[0]}</Text>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Email Input */}
      <TextInput 
        style={styles.input} 
            placeholder="Email *"
            placeholderTextColor="#ccc"
        value={email} 
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

          {/* Username Input */}
      <TextInput 
        style={styles.input} 
            placeholder="Username *"
            placeholderTextColor="#ccc"
        value={username} 
        onChangeText={setUsername}
        autoCapitalize="none"
            onBlur={async () => {
              if (username.length >= 3) await checkUsernameAvailability(username);
            }}
      />
      {checkingUsername && <Text style={styles.checking}>Checking username...</Text>}

          {/* Password Input with Eye Icon */}
          <View style={styles.inputWithIcon}>
      <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Password *"
              placeholderTextColor="#ccc"
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

          {/* Confirm Password Input with Eye Icon */}
          <View style={styles.inputWithIcon}>
      <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Confirm Password *"
              placeholderTextColor="#ccc"
        value={confirmPassword} 
        onChangeText={setConfirmPassword} 
              secureTextEntry={!showConfirmPassword}
      />
      <TouchableOpacity 
              style={styles.iconRight}
              onPress={() => setShowConfirmPassword(v => !v)}
            >
              <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={22} color="#aaa" />
            </TouchableOpacity>
          </View>

          {/* Location Checkbox Row */}
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setLocationAccess(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: locationAccess }}
            >
              {locationAccess ? (
                <MaterialIcons name="check-box" size={24} color="#4A6FFF" />
              ) : (
                <MaterialIcons name="check-box-outline-blank" size={24} color="#aaa" />
              )}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>I agree to share my location *</Text>
            <TouchableOpacity onPress={() => setInfoVisible(true)} style={styles.infoButton}>
              <MaterialIcons name="info-outline" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>
          <Modal
            visible={infoVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setInfoVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setInfoVisible(false)}>
              <View style={styles.infoModalBox}>
                <Text style={styles.infoTitle}>Why do we need your location?</Text>
                <Text style={styles.infoText}>
                  Location access is required to show you relevant posts and events in your area. This helps create a more personalized and local experience.
                </Text>
                <TouchableOpacity style={styles.closeInfoButton} onPress={() => setInfoVisible(false)}>
                  <Text style={styles.closeInfoButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
          <TouchableOpacity
            style={[styles.button, (!allFieldsValid() || loading || checkingUsername) && styles.buttonDisabled]}
        onPress={handleSignUp} 
            disabled={!allFieldsValid() || loading || checkingUsername}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/signin")}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

export default function PublicSignUpWrapper(props) {
  return (
    <PublicRoute>
      <SignUp {...props} />
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  required: {
    color: '#e74c3c',
    fontWeight: 'bold',
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
  buttonDisabled: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 8,
  },
  showPasswordBtn: {
    marginLeft: 8,
    padding: 8,
  },
  link: {
    marginTop: 8,
    marginBottom: 24,
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
  },
  checking: {
    color: '#666',
    fontSize: 14,
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  infoButton: {
    marginLeft: 6,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoModalBox: {
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 24,
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  infoTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    color: '#ccc',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  closeInfoButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  closeInfoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});