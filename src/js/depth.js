document.querySelector('button#start').addEventListener('click', async () => {
    try {
        const session = await navigator.xr.requestSession("immersive-ar", {
            requiredFeatures: ["depth-sensing"],
            depthSensing: {
            usagePreference: ["gpu-optimized"],
            formatPreference: ["luminance-alpha", "float32"]
            }
        });
        const errorMsgElement = document.querySelector('span#errorMsg');
        errorMsgElement.innerHTML = `${session.depthUsage} ${session.depthFormat}`;
    } catch(e) {
        const errorMsgElement = document.querySelector('span#errorMsg');
        errorMsgElement.innerHTML = `${e.toString()}`;
    }

});