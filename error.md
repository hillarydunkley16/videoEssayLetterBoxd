 ERROR  The action 'REPLACE' with payload {"name":"(home)","params":{"screen":"index","params":{}}} was not handled by any navigator.

Do you have a route named '(home)'?

This is a development-only warning and won't be shown in production.

Code: construct.js
  2 | var setPrototypeOf = require("./setPrototypeOf.js");
  3 | function _construct(t, e, r) {

> 4 |   if (isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments);
> |                                                                 ^
> 5 |   var o = [null];
> 6 |   o.push.apply(o, e);
> 7 |   var p = new (t.bind.apply(t, o))();
> Call Stack
> construct (`<native>`)
> apply (`<native>`)
> _construct (node_modules/@babel/runtime/helpers/construct.js:4:65)
> Wrapper (node_modules/@babel/runtime/helpers/wrapNativeSuper.js:15:23)
> construct (`<native>`)
> _callSuper (node_modules/@babel/runtime/helpers/callSuper.js:5:108)
> NamelessError (node_modules/@expo/metro-runtime/src/metroServerLogs.native.ts:102:20)
> captureCurrentStack (node_modules/@expo/metro-runtime/src/metroServerLogs.native.ts:106:27)
> HMRClient.log (node_modules/@expo/metro-runtime/src/metroServerLogs.native.ts:39:79)
> console.level (node_modules/react-native/Libraries/Core/setUpDeveloperTools.js:41:24)
> onUnhandledAction (node_modules/expo-router/build/ExpoRoot.js:199:22)
> useLatestCallback$argument_0 (node_modules/@react-navigation/core/lib/module/useNavigationBuilder.js:538:28)
> apply (`<native>`)
> latestCallback (node_modules/use-latest-callback/lib/src/index.js:21:33)
> dispatch (node_modules/@react-navigation/core/lib/module/useNavigationHelpers.js:29:26)
> listeners.focus._$argument_0 (node_modules/@react-navigation/core/lib/module/BaseNavigationContainer.js:110:59)
> listener (node_modules/@react-navigation/core/lib/module/useFocusedListenersChildrenAdapter.js:31:25)
> useLatestCallback$argument_0 (node_modules/@react-navigation/core/lib/module/BaseNavigationContainer.js:110:25)
> apply (`<native>`)
> latestCallback (node_modules/use-latest-callback/lib/src/index.js:21:33)
> exports.routingQueue.run (node_modules/expo-router/build/global-state/routing.js:92:37)
> `<anonymous>` (node_modules/expo-router/build/imperative-api.js:27:35)
> callCreate.reactStackBottomFrame (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:15973:26)
> runWithFiberInDEV (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:683:21)
> commitHookEffectListMount (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:9661:46)
> commitHookPassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:9782:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10925:42)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11048:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11048:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11048:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11048:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11048:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10918:49)
> recursivelyTraversePassiveMountEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10899:36)
> commitPassiveMountOnFiber (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:10937:49)
> flushPassiveEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:12726:34)
> flushPendingEffects (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:12691:33)
> flushSpawnedWork (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:12657:30)
> commitRoot (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:12491:25)
> commitRootWhenReady (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11740:17)
> performWorkOnRoot (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:11702:34)
> performSyncWorkOnRoot (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:3088:24)
> flushSyncWorkAcrossRoots_impl (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:2942:42)
> processRootScheduleInMicrotask (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:2973:36)
> scheduleMicrotask$argument_0 (node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js:3108:47)

Code: ExpoRoot.js
  142 |     }
  143 |     return (<storeContext_1.StoreContext.Provider value={store}>

> 144 |       <NavigationContainer_1.NavigationContainer ref={store.navigationRef} initialState={store.state} linking={store.linking} onUnhandledAction={onUnhandledAction} documentTitle={documentTitle} onReady={store.onReady}>
> |       ^
> 145 |         <serverLocationContext_1.ServerContext.Provider value={serverContext}>
> 146 |           `<WrapperComponent>`
> 147 |             `<Content />`
> Call Stack
> ContextNavigator (node_modules/expo-router/build/ExpoRoot.js:144:7)
> ExpoRoot (node_modules/expo-router/build/ExpoRoot.js:87:12)
> App (node_modules/expo-router/build/qualified-entry.js:21:7)
> WithDevTools (node_modules/expo/src/launch/withDevTools.ios.tsx:32:11)
>
