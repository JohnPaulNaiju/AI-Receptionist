import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { View, Text, Button, Colors, Checkbox, TouchableOpacity } from 'react-native-ui-lib';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../utils';
import { doc, setDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { Icon, Input } from '../../components';

const RegisterScreen = ({ navigation }) => {

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminCode, setAdminCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const ADMIN_SECRET_CODE = 'Laura123';

    const handleRegister = async () => {
        if (!name || !email || !password || !confirmPassword || !phoneNumber) {
            Toast.show({
                type: 'default',
                text1: 'Please fill in all required fields',
            });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({
                type: 'default',
                text1: 'Passwords do not match',
            });
            return;
        }

        if (password.length < 6) {
            Toast.show({
                type: 'default',
                text1: 'Password must be at least 6 characters',
            });
            return;
        }

        if (isAdmin && adminCode !== ADMIN_SECRET_CODE) {
            Toast.show({
                type: 'default',
                text1: 'Invalid admin code',
            });
            return;
        }

        try {
            setLoading(true);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name,
                email,
                phoneNumber,
                role: isAdmin ? 'admin' : 'user',
                createdAt: new Date().toISOString(),
            });
            Toast.show({
                type: 'default',
                text1: 'Registration successful!',
            });
        } catch (error) {
            console.log('Registration error:', error.message);
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            }
            
            Toast.show({
                type: 'default',
                text1: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    return (

        <View flex useSafeArea bg-bg1>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : null} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
                <ScrollView contentContainerStyle={{ flex: 1 }}>

                    <View marginT-86 center>
                        <Text text40 blue marginB-20>YB Hotels</Text>
                        <Text text60 marginB-30>Create an Account</Text>
                    </View>

                    <View width='100%'>

                        <Input
                        marginT-16
                        value={name}
                        onChange={setName}
                        placeholder="Full Name"
                        left={<Icon name="person" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}/>

                        <Input
                        marginT-16
                        value={email}
                        onChange={setEmail}
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        left={<Icon name="mail" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}/>

                        <Input
                        marginT-16
                        value={phoneNumber}
                        onChange={setPhoneNumber}
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                        left={<Icon name="call" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}/>

                        <Input
                        marginT-16
                        value={password}
                        onChange={setPassword}
                        placeholder="Password"
                        secure={!showPassword}
                        left={<Icon name="lock-closed" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}
                        right={
                            <TouchableOpacity marginR-16 onPress={() => setShowPassword(!showPassword)}>
                                <Icon name={showPassword ? "eye-off" : "eye"} type="ion" size={20} color={Colors.grey30}/>
                            </TouchableOpacity>
                        }/>

                        <Input
                        marginT-16
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Confirm Password"
                        secure={!showPassword}
                        left={<Icon name="lock-closed" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}
                        right={
                            <TouchableOpacity marginR-16 onPress={() => setShowPassword(!showPassword)}>
                                <Icon name={showPassword ? "eye-off" : "eye"} type="ion" size={20} color={Colors.grey30}/>
                            </TouchableOpacity>
                        }/>

                        <View row centerV marginT-20 paddingH-16>
                            <Checkbox color={Colors.blue} iconColor={Colors.white} value={isAdmin} checked={isAdmin} onValueChange={() => setIsAdmin(state => !state)}/>
                            <Text text70R text2 marginL-6>Register as Admin</Text>
                        </View>

                        {isAdmin && (
                            <Input
                            marginT-16
                            value={adminCode}
                            onChange={setAdminCode}
                            placeholder="Admin Code"
                            secure
                            left={<Icon name="key" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}/>
                        )}

                        <View paddingH-16 marginT-20>
                            <Button
                            label={loading ? '' : 'Register'}
                            bg-blue
                            white
                            text70
                            br100
                            style={{ fontWeight: 'bold', height: 50 }}
                            onPress={handleRegister}
                            disabled={loading}>
                                {loading && <ActivityIndicator color={Colors.white} />}
                            </Button>
                        </View>

                        <View row centerH marginT-20>
                            <Text text80R text2>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text text80R blue>Login</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>

    );

};

export default RegisterScreen;