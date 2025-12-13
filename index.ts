import { registerRootComponent } from 'expo';
import { Text, TextInput } from 'react-native';

import App from './App';

// Disable system font scaling
interface TextWithDefaultProps extends Text {
    defaultProps?: { allowFontScaling?: boolean; maxFontSizeMultiplier?: number };
}
interface TextInputWithDefaultProps extends TextInput {
    defaultProps?: { allowFontScaling?: boolean; maxFontSizeMultiplier?: number };
}

if ((Text as unknown as TextWithDefaultProps).defaultProps == null) {
    (Text as unknown as TextWithDefaultProps).defaultProps = {};
}
(Text as unknown as TextWithDefaultProps).defaultProps!.allowFontScaling = false;
(Text as unknown as TextWithDefaultProps).defaultProps!.maxFontSizeMultiplier = 1.0;

if ((TextInput as unknown as TextInputWithDefaultProps).defaultProps == null) {
    (TextInput as unknown as TextInputWithDefaultProps).defaultProps = {};
}
(TextInput as unknown as TextInputWithDefaultProps).defaultProps!.allowFontScaling = false;
(TextInput as unknown as TextInputWithDefaultProps).defaultProps!.maxFontSizeMultiplier = 1.0;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
