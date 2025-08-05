//refer https://icons.expo.fyi/Index for available icons
// expo guide: https://docs.expo.dev/guides/icons/

import React from 'react';
import { Colors } from 'react-native-ui-lib';
import { Feather, FontAwesome5, FontAwesome, MaterialCommunityIcons, Foundation, Ionicons, Fontisto, Entypo, AntDesign, Octicons, SimpleLineIcons, MaterialIcons, FontAwesome6 } from '@expo/vector-icons';

const Icon = ({name, type, size = 24, color = Colors.blue, ...rest}) => {

    switch(type){
        case 'feather':
            return <Feather name={name} color={color} size={size} {...rest}/>;
        case 'font-awesome':
            return <FontAwesome5 name={name} color={color} size={size} {...rest}/>;
        case 'font':
            return <FontAwesome name={name} color={color} size={size} {...rest}/>;
        case 'material-community':
            return <MaterialCommunityIcons name={name} color={color} size={size} {...rest}/>;
        case 'foundation':
            return <Foundation name={name} color={color} size={size} {...rest}/>;
        case 'ion':
            return <Ionicons name={name} color={color} size={size} {...rest}/>;
        case 'fontisto':
            return <Fontisto name={name} color={color} size={size} {...rest}/>;
        case 'entypo':
            return <Entypo name={name} color={color} size={size} {...rest}/>;
        case 'ant':
            return <AntDesign name={name} color={color} size={size} {...rest}/>;
        case 'octicons':
            return <Octicons name={name} color={color} size={size} {...rest}/>;
        case 'simple':
            return <SimpleLineIcons name={name} color={color} size={size} {...rest}/>;
        case 'font6':
            return <FontAwesome6 name={name} color={color} size={size} {...rest}/>;
        default:
            return <MaterialIcons name={name} color={color} size={size} {...rest}/>;
    };

};

export default React.memo(Icon);