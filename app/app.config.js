import 'dotenv/config';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const AUTH_DOMAIN = process.env.AUTH_DOMAIN;
const PROJECT_ID = process.env.PROJECT_ID;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET;
const MESSAGING_SENDER_ID = process.env.MESSAGING_SENDER_ID;
const APP_ID = process.env.APP_ID;
const MEASUREMENT_ID = process.env.MEASUREMENT_ID;
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON;
const GOOGLE_SERVICES_INFO = process.env.GOOGLE_SERVICES_INFO;
const D_ID_API_KEY = process.env.D_ID_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

//=== Increment these in every new release ===//
const buildNumber = 1;                       //
const version = '1.0.0';                    //
//=========================================//

export default {
    expo: {
        name: "YB Hotels", 
        slug: "yazeen-bro-hotels", 
        scheme: "yazeenbrohotels", 
        owner: "4note", 
        version: version, 
        orientation: "portrait", 
        description: "Hotel Booking", 
        userInterfaceStyle: "light", 
        platforms: ["ios", "android"], 
        assetBundlePatterns: ["**/*"], 
        runtimeVersion: { policy: "sdkVersion" }, 
        newArchEnabled: true, 
        ios: { 
            supportsTablet: true, 
            usesIcloudStorage: true, 
            backgroundColor: '#FFFFFF', 
            icon: "./assets/icon.png", 
            buildNumber: `"${buildNumber}"`, 
            googleServicesFile: GOOGLE_SERVICES_INFO, 
            associatedDomains: ["applinks:yazeen-bro-hotels.app"], 
            infoPlist: {  }, 
            config: { "usesNonExemptEncryption": false }, 
            bundleIdentifier: "com.yazeenbrohotels.yazeen", 
            entitlements: { "com.apple.developer.networking.wifi-info": true }, 
        }, 
        android: { 
            versionCode: buildNumber, 
            backgroundColor: '#FFFFFF', 
            softwareKeyboardLayoutMode: "resize", 
            package: "com.yazeenbrohotels.yazeen", 
            googleServicesFile: GOOGLE_SERVICES_JSON, 
            permissions: [ 
                "android.permission.RECORD_AUDIO", 
                "android.permission.FOREGROUND_SERVICE", 
                "android.permission.READ_MEDIA_IMAGES", 
                "android.permission.READ_MEDIA_VIDEO", 
            ], 
            adaptiveIcon: { 
                backgroundColor: "#FFFFFF", 
                foregroundImage: "./assets/icon.png", 
            }, 
            intentFilters: [ 
                { 
                    action: "VIEW", 
                    autoVerify: true, 
                    data: [ 
                        { 
                            scheme: "https", 
                            host: "yazeen-bro-hotels.app", 
                            pathPrefix: "/", 
                        }, 
                        { 
                            scheme: "http", 
                            host: "yazeen-bro-hotels.app", 
                            pathPrefix: "/", 
                        } 
                    ], 
                    category: ["BROWSABLE", "DEFAULT"] 
                } 
            ] 
        }, 
        plugins: [ 
            [ 
                "expo-build-properties", 
                { 
                    android: { 
                        allowBackup: false, 
                        targetSdkVersion: 35, 
                        compileSdkVersion: 35, 
                        buildToolsVersion: "35.0.0", 
                        enableProguardInReleaseBuilds: true, 
                        enableShrinkResourcesInReleaseBuilds: true, 
                        extraProguardRules: "-keep public class com.horcrux.svg.** {*;}", 
                    }, 
                    ios: { 
                        deploymentTarget: "15.1", 
                        useFrameworks: "static", 
                    } 
                } 
            ], 
            [
                "expo-splash-screen",
                {
                    backgroundColor: "#F6F6F6",
                    image: "./assets/splash.png",
                    dark: {
                        image: "./assets/splash.png",
                        backgroundColor: "#191A1F"
                    },
                    imageWidth: 200
                }
            ] 
        ], 
        extra: { 
            FIREBASE_API_KEY: FIREBASE_API_KEY, 
            AUTH_DOMAIN: AUTH_DOMAIN, 
            PROJECT_ID: PROJECT_ID, 
            STORAGE_BUCKET: STORAGE_BUCKET, 
            MESSAGING_SENDER_ID: MESSAGING_SENDER_ID, 
            APP_ID: APP_ID, 
            MEASUREMENT_ID: MEASUREMENT_ID, 
            D_ID_API_KEY: D_ID_API_KEY,
            GEMINI_API_KEY: GEMINI_API_KEY,
            eas: { 
                projectId: "b375d45b-a8a5-4059-9f66-30e3d1a3cd96", 
            }, 
        } 
    } 
};