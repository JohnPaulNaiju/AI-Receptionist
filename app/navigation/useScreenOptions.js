import React from 'react';
import { Colors } from 'react-native-ui-lib';
import { Platform } from 'react-native';

export default function useScreenOptions() {
  // Default header options for main screens
  const main = {
    headerStyle: {
      backgroundColor: Colors.bg2,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerTitleStyle: {
      color: Colors.text,
      fontSize: 18,
      fontWeight: 'bold', // Explicitly set fontWeight
    },
    headerTintColor: Colors.blue,
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: Colors.bg },
    headerLeftContainerStyle: {
      paddingLeft: Platform.OS === 'ios' ? 10 : 0,
    },
    headerRightContainerStyle: {
      paddingRight: Platform.OS === 'ios' ? 10 : 0,
    },
  };

  // Options for the home screen
  const home = {
    ...main,
    headerShown: false,
  };

  // Options for modal screens
  const modal = {
    ...main,
    presentation: 'modal',
    headerShown: true,
  };

  return {
    main,
    home,
    modal,
  };
}
