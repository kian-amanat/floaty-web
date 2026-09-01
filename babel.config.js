module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // reanimated 4 ships its worklet transform in react-native-worklets
    plugins: ['react-native-worklets/plugin'],
  };
};
