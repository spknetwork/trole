//version 1.0
class StWidget {
    constructor(url) { 
        this.url = url.indexOf('?')===-1?(url+'?embed'):(url+'&embed');
        this.element = null;
        this.iframe = null;
        this.user = null;
        this.properties = null;
        this.initialized = false;
        this.enableKeychainPassthrough = true;
        this.allowedCustomJson = ["community", "follow"];
        this.messageListener = null;
        this.onLastRead = null;
        this.frameOrigin = '*';
    }
    createElement(width=450, height=556, overlay=true, resizable=true) {
        this.initialize();
        var div = document.createElement('div');
        this.element = div;
        var style = { border: '1px solid gray' };
        if(overlay) {
            style['position'] = 'absolute';
            style['z-index'] = '10000';
        }
        if(resizable) {
            style['resize'] = 'both';
            style['overflow'] = 'hidden';
        }
        
        this.setStyle(style);
        this.resize(width, height);

        var iframe = document.createElement('iframe');
        this.iframe = iframe;
        iframe.src = this.url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        div.appendChild(iframe);

        return div;
    }
    resize(width=450, height=556) {
        this.setStyle({
            width: typeof width === 'string'?width:(width+'px'),
            height: typeof height === 'string'?height:(height+'px'),
        });
    }
    setStyle(style) {
        for(var name in style) this.element.style.setProperty(name, style[name]);
    }
    setLastReadCallback(fn) {
        this.onLastRead = fn;
    } 
    postMessage(message) {
        if(this.initialized) {
            var _this = this;
            if(this.iframe.contentWindow != null)
                this.iframe.contentWindow.postMessage(message, this.frameOrigin);
            else this.iframe.addEventListener( "load", ()=>{
                _this.iframe.contentWindow.postMessage(message, this.frameOrigin);
            });
            return true;
        }
        return false;
    } 
    setProperties(properties) {
        this.properties = properties;
        this.postMessage(["stlib", "setProperties", JSON.stringify(this.properties)]);
    }
    pause(value) { return this.postMessage(["stlib", "pause", JSON.stringify(value)]); }
    setUser(user) { 
        this.user = user;
        this.postMessage(["stlib", "setUser", JSON.stringify(user)])
        this.reload();
    }
    reload() {
        this.postMessage(["stlib", "reload", JSON.stringify("")])
    }
    navigate(url) {
        this.url = url.indexOf('?')===-1?(url+'?embed'):(url+'&embed');
        this.postMessage(["stlib", "navigate", JSON.stringify(this.url)]);
    }

    initialize() {
        if(this.messageListener != null) return;
        var _this = this;
        this.messageListener = (event) => {
            try {
                if(event.data != null && Array.isArray(event.data)) {
                    var data = event.data;
                    if(data.length > 2 && data[0] === 'stlib') {
                        _this.onMessage(event, data[1], data[2], data.length > 3?data[3]:[]);
                    }
                }
            }
            catch(e) { console.log(e); }
        };
        window.addEventListener("message", this.messageListener);
    }
    onMessage(event, msgId, name, args) {
        switch(name) {
            case "initialize":
                this.initialized = true;
                this.frameOrigin = event.origin; 
                if(this.properties != null) 
                    event.source.postMessage(["stlib", "setProperties", JSON.stringify(this.properties)], event.origin);
                if(this.user != null)
                    event.source.postMessage(["stlib", "setUser", JSON.stringify(this.user)], event.origin);
                event.source.postMessage(["stlib", "initMain", JSON.stringify("")], event.origin);
                break;
            case "notifications":
                if(this.onLastRead) this.onLastRead(args);
                break;
            case "requestCustomJson":
                if(this.enableKeychainPassthrough && 
                    this.allowedCustomJson.indexOf(args[1]) !== -1 &&
                    args[2] === 'Posting') 
                    window.hive_keychain.requestCustomJson(args[0], args[1], 'Posting', args[3], args[4], (r)=>{
                        event.source.postMessage(["stlib", msgId, JSON.stringify(r)], event.origin);
                    });
            break;
            case "requestVerifyKey":
                if(this.enableKeychainPassthrough && args[2] === 'Posting') 
                    window.hive_keychain.requestVerifyKey(args[0], args[1], 'Posting', (r)=>{
                        event.source.postMessage(["stlib", msgId, JSON.stringify(r)], event.origin);
                    });
            break;
            case "requestSignBuffer":
                if(this.enableKeychainPassthrough && args[2] === 'Posting') 
                    window.hive_keychain.requestSignBuffer(args[0], args[1], 'Posting', (r)=>{
                        event.source.postMessage(["stlib", msgId, JSON.stringify(r)], event.origin);
                    });
            break;
            case "requestEncodeMessage":
                if(this.enableKeychainPassthrough && args[3] === 'Posting') 
                    window.hive_keychain.requestEncodeMessage(args[0], args[1], args[2], 'Posting', (r)=>{
                        event.source.postMessage(["stlib", msgId, JSON.stringify(r)], event.origin);
                    });
            break;
        }
    }
    cleanup() {
        if(this.messageListener != null) {
            window.removeEventListener("message", this.messageListener);
            this.messageListener = null;
        }
    }
}