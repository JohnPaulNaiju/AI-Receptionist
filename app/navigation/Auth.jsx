import React from 'react';
import { LoginScreen, RegisterScreen } from '../screens/auth';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

export default function Auth() {
    return (
        <Stack.Navigator initialRouteName="Login">
            <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                options={{ headerShown: false, gestureEnabled: true }}
            />
        </Stack.Navigator>
    );
};