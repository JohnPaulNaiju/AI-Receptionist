import { theme } from './theme';
import Constants from 'expo-constants';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform, StatusBar } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { Colors } from 'react-native-ui-lib';
import { initializeApp, getApp, getApps } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';

const loadTheme = async() => {

    Colors.setScheme('light');
    StatusBar.setBarStyle('dark-content');

    if(Platform.OS === 'android'){
        NavigationBar.setBackgroundColorAsync(theme.light.bg2);
        NavigationBar.setBorderColorAsync("#00000000");
        NavigationBar.setButtonStyleAsync('light');
    }

    Colors.loadSchemes(theme);

};

loadTheme();

const FIREBASE_API_KEY = Constants?.expoConfig?.extra?.FIREBASE_API_KEY;
const AUTH_DOMAIN = Constants?.expoConfig?.extra?.AUTH_DOMAIN;
const PROJECT_ID = Constants?.expoConfig?.extra?.PROJECT_ID;
const STORAGE_BUCKET = Constants?.expoConfig?.extra?.STORAGE_BUCKET;
const MESSAGING_SENDER_ID = Constants?.expoConfig?.extra?.MESSAGING_SENDER_ID;
const APP_ID = Constants?.expoConfig?.extra?.APP_ID;
const MEASUREMENT_ID = Constants?.expoConfig?.extra?.MEASUREMENT_ID;

const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: AUTH_DOMAIN,
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    messagingSenderId: MESSAGING_SENDER_ID,
    appId: APP_ID,
    measurementId: MEASUREMENT_ID,
};

const app = getApps().length===0 ? initializeApp(firebaseConfig) : getApp();

export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);