import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StepsIndicator({ steps, activeStep, currentStep, totalSteps }) {
  // If steps is not provided, generate a default array based on totalSteps
  let stepsArray = steps;
  if (!stepsArray && typeof totalSteps === 'number') {
    stepsArray = Array.from({ length: totalSteps }, (_, i) => `Step ${i + 1}`);
  }
  stepsArray = stepsArray || [];
  const active = typeof activeStep === 'number' ? activeStep : (typeof currentStep === 'number' ? currentStep - 1 : 0);

  return (
    <View style={styles.container}>
      {stepsArray.map((label, idx) => (
        <View key={label + idx} style={styles.stepContainer}>
          <View style={[styles.circle, idx === active ? styles.circleActive : styles.circleInactive]} />
          {idx < stepsArray.length - 1 && <View style={styles.line} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#4A6FFF',
    backgroundColor: 'transparent',
  },
  circleActive: {
    backgroundColor: '#4A6FFF',
  },
  circleInactive: {
    backgroundColor: '#232323',
  },
  line: {
    width: 32,
    height: 2,
    backgroundColor: '#4A6FFF',
    marginHorizontal: 4,
  },
}); 