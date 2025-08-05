import React from "react";
import { Icon } from "../components";
import { Colors, TouchableOpacity, View, Text } from 'react-native-ui-lib';
import { TransitionPresets, CardStyleInterpolators } from '@react-navigation/stack';

export default () => {

    const main = {
        gestureEnabled: true, 
        animationEnabled: true, 
        headerTitleAlign: 'center', 
        ...TransitionPresets.SlideFromRightIOS, 
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS, 
        headerStyle: { 
            elevation: 0, 
            shadowOpacity: 0, 
            borderBottomWidth: 0, 
            backgroundColor: Colors.bg2, 
        }, 
    };

    const home = {
        ...main, 
        headerTitle: () => <Text text1 text50R gs>YB Hotels</Text>, 
        headerLeft: () => (
            <TouchableOpacity>
                <View center flex width={60}>
                    <Icon name='menu' type='feather'/>
                </View>
            </TouchableOpacity>
        ), 
        headerRight: () => (
            <TouchableOpacity onPress={() => {}}>
                <View center flex width={70}>
                    <Icon name='edit-3' type='feather'/>
                </View>
            </TouchableOpacity>
        ), 
    };

    return { main, home };

};