import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { View, Text, Colors, Button } from 'react-native-ui-lib';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation } from '@react-navigation/native';

const EditProfileScreen = () => {
    const navigation = useNavigation();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        phoneNumber: '',
        address: ''
    });

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        if (!auth.currentUser) return;
        try {
            setLoading(true);
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData({
                    name: data.name || '',
                    email: data.email || auth.currentUser.email || '',
                    phoneNumber: data.phoneNumber || '',
                    address: data.address || ''
                });
            }
        } catch (error) {
            console.log('Error fetching user profile:', error);
            Alert.alert('Error', 'Failed to load profile information');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!userData.name.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }

        try {
            setSaving(true);
            const userRef = doc(db, 'users', auth.currentUser.uid);
            
            // Update Firestore document
            await updateDoc(userRef, {
                name: userData.name.trim(),
                phoneNumber: userData.phoneNumber.trim(),
                address: userData.address.trim(),
                updatedAt: new Date().toISOString()
            });

            // Update Firebase Auth profile
            await updateProfile(auth.currentUser, {
                displayName: userData.name.trim()
            });

            Alert.alert('Success', 'Profile updated successfully');
            navigation.goBack();
        } catch (error) {
            console.log('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (
        <View flex bg-bg2 useSafeArea paddingT-46>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <View style={styles.inputWrapper}>
                            <Icon name="person" type="ion" size={20} color={Colors.blue} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={userData.name}
                                onChangeText={(text) => setUserData({...userData, name: text})}
                                placeholder="Enter your full name"
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Icon name="mail" type="ion" size={20} color={Colors.blue} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, styles.disabledInput]}
                                value={userData.email}
                                editable={false}
                                placeholder="Email address"
                            />
                        </View>
                        <Text style={styles.helperText}>Email cannot be changed</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <View style={styles.inputWrapper}>
                            <Icon name="call" type="ion" size={20} color={Colors.blue} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={userData.phoneNumber}
                                onChangeText={(text) => setUserData({...userData, phoneNumber: text})}
                                placeholder="Enter your phone number"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Address</Text>
                        <View style={styles.inputWrapper}>
                            <Icon name="location" type="ion" size={20} color={Colors.blue} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={userData.address}
                                onChangeText={(text) => setUserData({...userData, address: text})}
                                placeholder="Enter your address"
                                multiline
                            />
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            label={saving ? 'Saving...' : 'Save Changes'}
                            bg-blue
                            style={styles.saveButton}
                            onPress={handleSaveProfile}
                            disabled={saving}
                        >
                            {saving && <ActivityIndicator color={Colors.white} style={styles.buttonLoader} />}
                        </Button>
                        <Button
                            label="Cancel"
                            outline
                            outlineColor={Colors.blue}
                            style={styles.cancelButton}
                            onPress={() => navigation.goBack()}
                            disabled={saving}
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    formContainer: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: Colors.text,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.grey70,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: Colors.text,
    },
    disabledInput: {
        backgroundColor: Colors.grey70,
        color: Colors.grey30,
    },
    helperText: {
        fontSize: 12,
        color: Colors.grey30,
        marginTop: 4,
        marginLeft: 4,
    },
    buttonContainer: {
        marginTop: 24,
    },
    saveButton: {
        height: 50,
        marginBottom: 12,
    },
    cancelButton: {
        height: 50,
        backgroundColor: 'transparent',
    },
    buttonLoader: {
        marginRight: 10,
    },
});

export default EditProfileScreen;
