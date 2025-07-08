import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import StepsIndicator from '../../components/StepsIndicator';
import { useTheme } from '../../contexts/ThemeContext';

export default function OnboardingStep1() {
  const router = useRouter();
  const { colors } = useTheme();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname.');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      await setDoc(userRef, { nickname }, { merge: true });
      router.replace('/onboarding/step2');
    } catch (e) {
      setError('Failed to save nickname. Please try again.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
      <StepsIndicator currentStep={1} totalSteps={4} />
      <Text style={[styles.title, { color: colors.text }]}>Choose a Nickname</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="Enter your nickname"
        placeholderTextColor={colors.textSecondary}
        value={nickname}
        onChangeText={setNickname}
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