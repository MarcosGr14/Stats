(function registerPwa(root) {
    "use strict";

    if (!("serviceWorker" in navigator) || !/^https?:$/.test(root.location.protocol)) return;

    root.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
            console.warn("No se pudo activar el modo sin conexión.", error);
        });
    }, { once: true });
})(window);
