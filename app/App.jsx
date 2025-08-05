/**
 * All Rights Reserved
 * Copyright (c) YB Hotels, Inc. and affiliates.
 *
 * This software and its source code are the exclusive property of YB Hotels 
 * and are protected by copyright law. Unauthorized use, modification, distribution, 
 * or redistribution of this software and its source code is strictly prohibited without 
 * the express written consent of YB Hotels.
 *
 * @flow strict
 * @format
 */

import './utils/init';
import React from 'react';
import Auth from './navigation/Auth';
import Main from './navigation/ScreenStack';
import 'react-native-gesture-handler';
import { auth, unsubListeners } from './utils';
import Toast from 'react-native-toast-message';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors, View, Text } from 'react-native-ui-lib';
import { NavigationContainer } from '@react-navigation/native';
import { preventAutoHideAsync, hideAsync } from 'expo-splash-screen';

preventAutoHideAsync();

const theme = {
    colors: {
        background: Colors.bg2, 
        border: Colors.line, 
        card: Colors.bg2, 
        notification: Colors.white, 
        primary: Colors.blue, 
        text: Colors.text1, 
    },
    dark: Colors.getScheme() === 'dark', 
};

const toastConfig = ({
    default: ({ text1 }) => (
        <View paddingH-14 paddingV-7 centerH br60 bg-line>
            <Text text2 text70R center>{text1}</Text>
        </View>
    ),
});

const ToastConfig = {
    type: 'default',
    position: 'top',
    autoHide: true,
    topOffset: 60,
    visibilityTime: 4000,
    config: toastConfig,
};

export default function App() {

    const [user, setUser] = React.useState(null);

    const authStateObserver = (User) => {
        if(User) setUser(true);
        else{ 
            setUser(false);
            unsubListeners();
        }
        hideAsync();
    };

    React.useEffect(() => {
        onAuthStateChanged(auth, authStateObserver);
    }, []);

    if(user === null) return null;

    return (

        <React.Fragment>
            <NavigationContainer theme={theme}>
                { user ? <Main/> : <Auth/> }
            </NavigationContainer>
            <Toast {...ToastConfig}/>
        </React.Fragment>

    );

};