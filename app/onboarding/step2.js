import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import StepsIndicator from '../../components/StepsIndicator';
import { useTheme } from '../../contexts/ThemeContext';

export default function OnboardingStep2() {
  const router = useRouter();
  const { colors } = useTheme();
  const [interests, setInterests] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!interests.trim()) {
      setError('Please enter at least one interest.');
      return;
    }
    setLoading(true);
    try {
      const tags = interests.split(',').map(t => t.trim()).filter(Boolean);
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      await setDoc(userRef, { interests: tags }, { merge: true });
      router.replace('/onboarding/step3');
    } catch (e) {
      setError('Failed to save interests. Please try again.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
      <StepsIndicator currentStep={2} totalSteps={4} />
      <Text style={[styles.title, { color: colors.text }]}>What are your interests?</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="e.g. music, tech, sports"
        placeholderTextColor={colors.textSecondary}
        value={interests}
        onChangeText={setInterests}
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