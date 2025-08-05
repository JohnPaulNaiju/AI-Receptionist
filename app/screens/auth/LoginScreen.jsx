import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { View, Text, Button, Colors } from 'react-native-ui-lib';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../utils';
import Toast from 'react-native-toast-message';
import { Icon, Input } from '../../components';

const LoginScreen = ({ navigation }) => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Toast.show({
            type: 'default',
            text1: 'Please fill in all fields',
            });
            return;
        }
        try{
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
        }catch(error){
            console.log('Login error:', error.message);
            Toast.show({
                type: 'default',
                text1: error.code === 'auth/invalid-credential' ? 'Invalid email or password' : 'Login failed. Please try again.',
            });
        }finally{
            setLoading(false);
        }
    };

    return (

        <View flex useSafeArea bg-bg1>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
                <ScrollView contentContainerStyle={{ flex: 1 }}>

                    <View marginT-150 center>
                        <Text text40 blue marginB-20>YB Hotels</Text>
                        <Text text60 marginB-30>Welcome Back!</Text>
                    </View>

                    <View marginT-46 width='100%'>

                        <Input
                        value={email}
                        onChange={setEmail}
                        placeholder="Email"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        left={<Icon name="mail" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}/>

                        <Input
                        marginT-16
                        value={password}
                        onChange={setPassword}
                        placeholder="Password"
                        secure={!showPassword}
                        left={<Icon name="lock-closed" type="ion" size={20} color={Colors.grey30} style={{ marginLeft: 16 }}/>}
                        right={
                            <TouchableOpacity marginR-26 onPress={() => setShowPassword(!showPassword)}>
                                <Icon name={showPassword ? "eye-off" : "eye"} type="ion" size={20} color={Colors.grey30}/>
                            </TouchableOpacity>
                        }/>

                        <View paddingH-16 marginT-20>
                            <Button
                            label={loading ? '' : 'Login'}
                            bg-blue
                            white
                            text70
                            br100
                            style={{ fontWeight: 'bold', height: 50 }}
                            onPress={handleLogin}
                            disabled={loading}>
                                {loading && <ActivityIndicator color={Colors.white} />}
                            </Button>
                        </View>

                        <View row centerH marginT-20>
                            <Text text80R text2>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text text80R blue>Register</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>

    );

};

export default LoginScreen;
