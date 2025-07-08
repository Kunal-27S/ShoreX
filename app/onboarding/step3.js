import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import StepsIndicator from '../../components/StepsIndicator';
import { useTheme } from '../../contexts/ThemeContext';

export default function OnboardingStep3() {
  const router = useRouter();
  const { colors } = useTheme();
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!location.trim()) {
      setError('Please enter your city or allow location access.');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      await setDoc(userRef, { locationPreference: location }, { merge: true });
      router.replace('/onboarding/step4');
    } catch (e) {
      setError('Failed to save location. Please try again.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
      <StepsIndicator currentStep={3} totalSteps={4} />
      <Text style={[styles.title, { color: colors.text }]}>Where are you located?</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="Enter your city or area"
        placeholderTextColor={colors.textSecondary}
        value={location}
        onChangeText={setLocation}
        autoFocus
      />
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleNext} disabled={loading}>
        <Text style={[styles.buttonText, { color: '#fff' }]}>{loading ? 'Loading...' : 'Next'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    marginBottom: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  error: {
    marginBottom: 8,
    textAlign: 'center',
  },
}); 