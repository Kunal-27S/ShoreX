 import { View, Text, StyleSheet } from 'react-native';

export default function Preferences() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preferences</Text>
      {/* Add your preferences form here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#121212',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});