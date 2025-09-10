import { View, Text, StyleSheet } from 'react-native';

export default function ProfileSettings() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Settings</Text>
      {/* Add your profile settings form here */}
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