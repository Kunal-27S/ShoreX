import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import StepsIndicator from './StepsIndicator';
import { auth, firestore } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import Carousel from 'react-native-reanimated-carousel';

const SCREEN_WIDTH = Dimensions.get('window').width;
const steps = ['Welcome', 'Discover', 'Connect', 'Complete'];

const onboardingImages = [
  require('../assets/images/onboarding/connect.png'),
  require('../assets/images/onboarding/community.png'),
  require('../assets/images/onboarding/inform.png'),
  require('../assets/images/onboarding/step2-1.png'),
  require('../assets/images/onboarding/step2-2.png'),
  require('../assets/images/onboarding/step2-3.png'),
  require('../assets/images/onboarding/step3-1.png'),
  require('../assets/images/onboarding/step3-2.png'),
  require('../assets/images/onboarding/step3-3.png'),
];

const onboardingCardImages = [
  require('../assets/images/onboarding/connect.png'),
  require('../assets/images/onboarding/community.png'),
  require('../assets/images/onboarding/inform.png'),
];

export default function OnboardingStepper({ visible, onClose }) {
  const [activeStep, setActiveStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState(null);

  const handleNext = async () => {
    if (activeStep === 0 && !nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }
    setError(null);
    if (activeStep === 0) {
      // Update nickname in Firestore
      try {
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(firestore, 'users', user.uid), { nickname: nickname.trim() });
        }
      } catch (e) {
        setError('Failed to save nickname');
        return;
      }
    }
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onClose && onClose();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const renderStep1 = () => (
    <View style={styles.step1Container}>
      <View style={styles.step1Top}>
        <Text style={styles.stepTitle}>Welcome to Ocean Pulse!</Text>
        <View style={styles.step1Bottom}>
        <Carousel
          width={160}
          height={160}
          autoPlay
          data={onboardingCardImages}
          scrollAnimationDuration={800}
          autoPlayInterval={3000}
          renderItem={({ item }) => (
            <Image source={item} style={styles.carouselImage} resizeMode="cover" />
          )}
          style={styles.carousel}
          panGestureHandlerProps={{ activeOffsetX: [-10, 10] }}
        />
      </View>
        <Text style={styles.stepSubtitle}>Join your local community and start sharing experiences. First, let's personalize your profile.</Text>
        <Text style={styles.helperText}>This is how others will see you in the community</Text>
     
        <TextInput
          style={styles.input}
          placeholder="Choose your nickname"
          placeholderTextColor="#aaa"
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="none"
        />
        {error && <Text style={styles.error}>{error}</Text>}
         </View>
     
    </View>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderStep1();
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Locality based</Text>
            <Text style={styles.stepSubtitle}>Get personalized feed based on your location. You only see things that are happening close to you, in your community/locality, thus making it more relevant and useful for you.</Text>
            <Image source={onboardingImages[3]} style={styles.onboardImageLarge} />
            <Text style={styles.stepTitle}>Auto deletion of posts</Text>
            <Text style={styles.stepSubtitle}>To add to the relevance of the posts, users are required to select the amount of time they want the post to remain, from 1 all the way to 24 hours (repostable even after that).</Text>
            <Image source={onboardingImages[4]} style={styles.onboardImageLarge} />
            <Text style={styles.stepTitle}>Connect with Neighbors</Text>
            <Text style={styles.stepSubtitle}>Connect with your fellow locality members. Chat with them, share your thoughts, and get to know them.</Text>
            <Image source={onboardingImages[5]} style={styles.onboardImageLarge} />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect with Neighbors</Text>
            <Text style={styles.stepSubtitle}>Connect with your fellow locality members. Chat with them, share your thoughts, and get to know them.</Text>
            <Image source={onboardingImages[5]} style={styles.onboardImageLarge} />
            <Text style={styles.stepTitle}>Create and interact with posts</Text>
            <Text style={styles.stepSubtitle}>Create new posts, like, mark as eye witnessed, comment, share, etc to other's posts. Use the Explore tab to explore trendy topics from over the world.</Text>
            <Image source={onboardingImages[6]} style={styles.onboardImageLarge} />
            <Text style={styles.stepTitle}>Ask our Advanced AI</Text>
            <Text style={styles.stepSubtitle}>Ask our AI chatbot about posts, current affairs, local news, traffic, cafes, restaurants, musicians, etc, and it responds keeping your location in mind.</Text>
            <Image source={onboardingImages[8]} style={styles.onboardImageLarge} />
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>You're All Set!</Text>
            <Text style={styles.stepSubtitle}>Experience the ocean pulse and become a part of it.</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <View style={styles.modalBox}>
          <StepsIndicator steps={steps} activeStep={activeStep} />
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            {getStepContent(activeStep)}
          </ScrollView>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, activeStep === 0 && styles.buttonDisabled]} onPress={handleBack} disabled={activeStep === 0}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>{activeStep === steps.length - 1 ? 'Complete' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { backgroundColor: '#181818', borderRadius: 16, padding: 14, width: SCREEN_WIDTH * 0.96, maxWidth: 340, alignItems: 'center', height: 600 },
  stepContent: { alignItems: 'center', marginBottom: 16 },
  stepTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 20, textAlign: 'center' },
  stepSubtitle: { color: '#ccc', fontSize: 15, marginBottom: 12, textAlign: 'center' },
  input: { backgroundColor: '#232323', color: '#fff', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 8, borderWidth: 1, borderColor: '#333', width: '100%', maxWidth: 320 },
  imageRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  onboardImage: { width: 80, height: 80, borderRadius: 12, marginHorizontal: 6 },
  onboardImageLarge: { width: 180, height: 180, borderRadius: 16, marginVertical: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16, marginBottom: 18 },
  button: { backgroundColor: '#4A6FFF', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, marginHorizontal: 8 },
  buttonDisabled: { backgroundColor: '#888' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
  step1Container: { flexDirection: 'column', width: '100%', alignItems: 'center', marginBottom: 12, height: 60 },
  step1Top: { width: '100%', alignItems: 'center', marginBottom: 18 },
  step1Bottom: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  carousel: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  carouselImage: { width: 160, height: 160, borderRadius: 16 },
  helperText: { color: '#aaa', fontSize: 13, marginTop: 4, marginBottom: 8 },
}); 