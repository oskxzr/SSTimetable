import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const [inputValue, setInputValue] = useState('');
  const [savedValue, setSavedValue] = useState('');

  useEffect(() => {
    loadStoredValue();
  }, []);

  const loadStoredValue = async () => {
    const value = await AsyncStorage.getItem('storedCalendarLink');
    if (value) {
      setSavedValue(value);
    }
  };

  const handleSave = async () => {
    await AsyncStorage.setItem('storedCalendarLink', inputValue);
    setSavedValue(inputValue);
    setInputValue('');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Enter the link to your timetable:</Text>
      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        placeholder={savedValue}
        style={{ borderWidth: 1, padding: 10, width: 200, marginVertical: 10}}
        onSubmitEditing={handleSave}
        multiline={true}
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
}
