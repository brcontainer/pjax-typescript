(function () {
    var Protocol;
    (function (Protocol) {
        Protocol[Protocol["POST"] = "POST"] = "POST";
        Protocol[Protocol["GET"] = "GET"] = "GET";
    })(Protocol || (Protocol = {}));
    var Pjax = (function () {
        function Pjax() {
            var _this = this;
            this.supported = false;
            this.parserSupported = !!DOMParser;
            this.events = {};
            this.notPropagate = false;
            this.rand = null;
            this.timer = null;
            this.loader = null;
            this.xhr = null;
            this.config = {
                linkSelector: "a:not([data-pjax-ignore]):not([href^='#']):not([href^='javascript:'])",
                formSelector: "form:not([data-pjax-ignore]):not([action^='javascript:'])",
                containers: ["#pjax-container"],
                mouseCatch: [0],
                noCache: false,
                // updatecurrent	: false,
                updatehead: true,
                // reloadScripts	: false,
                // scrollLeft		: 0,
                // scrollTop		: 0,
                loaded: false,
                proxy: "",
                done: null,
                fail: null
            };
            // Region Element Config{
            this.getData = function (element, name) {
                var data = element.getAttribute("data-" + name), resp;
                if (data === "true" || data === "false") {
                    return data === "true";
                }
                else if (/^\[[\s\S]+\]$|^\{[\s\S]+\}$/.test(data)) {
                    try {
                        resp = JSON.parse(data);
                    }
                    catch (e) { }
                }
                return resp || data;
            };
            this.getConfig = function (element) {
                var config = _this.config;
                if (element) {
                    for (var p in config) {
                        var v = _this.getData(element, p);
                        if (v) {
                            config[p] = v;
                        }
                    }
                }
                return config;
            };
            // }
            // Region view HTML{
            this.showLoader = function () {
                var self = _this;
                if (_this.timer) {
                    _this.hideLoader();
                }
                if (!_this.loader) {
                    _this.loader = document.createElement("div");
                    _this.loader.innerHTML = '<div class="pjax-progress"></div>';
                    document.body.appendChild(_this.loader);
                }
                _this.loader.className = "pjax-loader pjax-start";
                _this.timer = setTimeout(function () {
                    self.timer = 0;
                    self.loader.className = "pjax-loader pjax-start pjax-inload";
                }, 10);
                setTimeout(function () {
                    self.hideLoader();
                }, 5000);
            };
            this.hideLoader = function () {
                var self = _this;
                if (_this.timer)
                    clearTimeout(_this.timer);
                if (!_this.loader) {
                    return;
                }
                if (_this.loader.className.match('pjax-inload') == null) {
                    setTimeout(_this.hideLoader, 100);
                    return;
                }
                _this.loader.className = "pjax-loader pjax-end";
                _this.timer = setTimeout(function () {
                    self.timer = 0;
                    self.loader.className = "pjax-loader pjax-hide";
                }, 1000);
            };
            // }
            // Region manage HTML {
            // check if current browser can parse string to HTML
            this.checkParser = function () {
                if (!_this.parserSupported) {
                    try {
                        var test = _this.parseHtml('<html><head><title>1</title></head><body>1</body></html>');
                        _this.parserSupported = !!(test.head && test.title && test.body);
                        return;
                    }
                    catch (ee) { }
                    _this.parserSupported = false;
                }
            };
            // try parse current string to valid HTML
            this.parseHtml = function (content) {
                if (_this.parserSupported)
                    return (new DOMParser()).parseFromString(content, "text/html");
                var html = document.implementation.createHTMLDocument("");
                if (/^(\s+|)(<\!doctype|<html([^>]+>|>))/i.test(content)) {
                    html.documentElement.innerHTML = content;
                    /* Fix bug in Android */
                    if (!html.body || !html.head) {
                        html = document.implementation.createHTMLDocument("");
                        html.write(content);
                    }
                }
                else {
                    html.body.innerHTML = content;
                }
                return html;
            };
            this.updateHead = function (head, config) {
                var nodes = [];
                var child = head.childNodes;
                var elem, tmp;
                var i, index;
                for (i = child.length - 1; i >= 0; i--) {
                    elem = child[i];
                    if (elem.outerHTML == undefined)
                        continue;
                    if (["TITLE", "SCRIPT"].indexOf(elem.tagName) != -1)
                        continue;
                    if ("LINK" == elem.tagName && (elem.getAttribute('type') || '').toLowerCase() == 'text/css')
                        continue;
                    nodes.push(elem.outerHTML);
                }
                child = document.head.childNodes;
                for (i = child.length - 1; i >= 0; i--) {
                    elem = child[i];
                    if (elem.outerHTML == undefined)
                        continue;
                    if (["TITLE", "SCRIPT"].indexOf(elem.tagName) != -1)
                        continue;
                    if ("LINK" == elem.tagName && (elem.getAttribute('type') || '').toLowerCase() == 'text/css')
                        continue;
                    index = nodes.indexOf(elem.outerHTML);
                    if (index === -1) {
                        elem.remove();
                    }
                    else {
                        nodes.splice(index, 1);
                    }
                }
                tmp = document.createElement('div');
                tmp.innerHTML = nodes.join('');
                child = tmp.childNodes;
                for (i = child.length - 1; i >= 0; i--) {
                    document.head.appendChild(child[i]);
                }
            };
            this.updateScripts = function (html, config) {
                var nodes = [];
                var scripts = html.querySelectorAll('script');
                var script, tmp;
                var i, index;
                for (i = scripts.length - 1; i >= 0; i--) {
                    script = scripts[i];
                    nodes.push(script.outerHTML);
                }
                scripts = document.querySelectorAll('script');
                for (i = scripts.length - 1; i >= 0; i--) {
                    script = scripts[i];
                    index = nodes.indexOf(script.outerHTML);
                    if (index === -1) {
                        script.remove();
                    }
                    else {
                        nodes.splice(index, 1);
                    }
                }
                tmp = document.createElement('div');
                tmp.innerHTML = nodes.join('');
                scripts = tmp.childNodes;
                for (i = scripts.length - 1; i >= 0; i--) {
                    var script = document.createElement('script');
                    script.type = "text/javascript";
                    if (typeof scripts[i].src == 'string' && scripts[i].src.length > 0) {
                        script.src = _this.processUrl(scripts[i].src);
                    }
                    script.text = scripts[i].text;
                    document.body.appendChild(script);
                }
            };
            this.updateStyle = function (html, config) {
                var nodes = [];
                var styles = html.querySelectorAll('link[type="text/css"], style');
                var style, tmp;
                var i, index;
                for (i = styles.length - 1; i >= 0; i--) {
                    style = styles[i];
                    nodes.push(style.outerHTML);
                }
                styles = document.querySelectorAll('link[type="text/css"], style');
                for (i = styles.length - 1; i >= 0; i--) {
                    style = styles[i];
                    index = nodes.indexOf(style.outerHTML);
                    if (index === -1) {
                        style.remove();
                    }
                    else {
                        nodes.splice(index, 1);
                    }
                }
                tmp = document.createElement('div');
                tmp.innerHTML = nodes.join('');
                styles = tmp.childNodes;
                for (i = styles.length - 1; i >= 0; i--) {
                    document.head.appendChild(styles[i]);
                }
            };
            this.updateState = function (options, title, url, replace) {
                if (replace === void 0) { replace = false; }
                var action = replace ? 'replaceState' : 'pushState';
                // UPDATE HISTORY
                window.history[action]({ pjax: options }, title, url);
                if (action == 'pushState') {
                    /* Fix bug in Android */
                    _this.notPropagate = true;
                    history.go(-1);
                    var self = _this;
                    setTimeout(function () {
                        if (url !== window.location.toString()) {
                            history.go(1);
                        }
                        self.notPropagate = false;
                    }, 50);
                }
            };
            this.updateHtml = function (url, content, config) {
                var self = _this;
                var html = _this.parseHtml(content);
                _this.triggerEvent('beforeChange', url, html, config);
                var containers = config.containers;
                var current;
                var title = html.title || "";
                var options = {
                    url: url,
                    content: content,
                    config: config
                };
                _this.updateState(options, title, url);
                document.title = title;
                if (config.updatehead)
                    _this.updateHead(html.head, config);
                _this.updateScripts(html, config);
                _this.updateStyle(html, config);
                // this.eventListeners(document.body, this.config, true);
                for (var i = 0, j = containers.length; i < j; i++) {
                    current = html.body.querySelector(containers[i]);
                    if (current) {
                        [].slice.call(document.querySelectorAll(containers[i])).forEach(function (el) {
                            self.triggerEvent("dom", url, el, current);
                            el.innerHTML = current.innerHTML;
                        });
                    }
                }
                _this.triggerEvent('afterChange', url);
                // this.eventListeners(document.body, config);
            };
            // }
            // Region Event Trigger {
            // call all functions with trigger name
            this.triggerEvent = function (name) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                if (typeof _this.events[name] != 'object')
                    return;
                var listEvents = _this.events[name], i;
                for (i = 0; i < listEvents.length; i++) {
                    listEvents[i].apply(listEvents, args);
                }
            };
            this.addEvent = function (name, callback, remove) {
                if (remove === void 0) { remove = false; }
                if (!_this.events[name]) {
                    _this.events[name] = [];
                }
                if (!remove) {
                    _this.events[name].push(callback);
                    return;
                }
                var listEvents = _this.events[name];
                var fr, i;
                // create a array with the indexes of all functions equal callback
                for (i = listEvents.length - 1; i >= 0; i--) {
                    if (listEvents[i] === callback)
                        fr.push(i);
                }
                // remove all that functions
                for (i = fr.length - 1; i >= 0; i--) {
                    _this.events[name].splice(fr[i], 1);
                }
            };
            // }
            // Region Request {
            this.triggerLink = function (event) {
                // if(this.config.mouseCatch.indexOf(event.button) == -1) return;
                var target = event.target;
                var element = null;
                var url;
                do {
                    if (target.tagName == 'A') {
                        element = target;
                        break;
                    }
                } while (target != document.body && (target = target.parentNode));
                if (element === null || !element.matches(_this.config.linkSelector)) {
                    return;
                }
                url = element.href;
                _this.request(Protocol.GET, url, null, element, event);
            };
            this.triggerForm = function (event) {
            };
            this.noCache = function (url) {
                var u, n = "_=" + (+new Date);
                if (!URL) {
                    u = new URL(url);
                }
                else {
                    u = document.createElement("a");
                    u.href = url;
                }
                u.search += (_this.rand = u.search ? ("&" + n) : ("?" + n));
                url = u.toString();
                u = null;
                return url;
            };
            this.processUrl = function (url) {
                if (_this.config.noCache)
                    url = _this.noCache(url);
                return url;
            };
            this.request = function (method, url, data, element, event) {
                var host = window.location.protocol.replace(/:/g, "") + "://" + window.location.host;
                if (url.indexOf(host + "/") !== 0 && url !== host)
                    return;
                try {
                    event.preventDefault();
                }
                catch (e) { }
                var config = _this.getConfig(element);
                _this.triggerEvent("initiate", url, config);
                url = config.proxy || url;
                _this.abort();
                _this.xhr = new XMLHttpRequest();
                _this.xhr.open(Protocol[method], _this.processUrl(url), true);
                var headers = {
                    "X-PJAX-Container": config.containers.join(","),
                    "X-PJAX-URL": url,
                    "X-PJAX": "true"
                };
                for (var k in headers) {
                    _this.xhr.setRequestHeader(k, headers[k]);
                }
                var self = _this;
                _this.xhr.onreadystatechange = function () {
                    if (this.readyState !== 4)
                        return;
                    var status = this.status;
                    var state = 1;
                    if (status >= 200 && status < 300 || status === 304) {
                        self.done(url, this.responseText, config, state);
                    }
                    else {
                        self.fail(url, status);
                    }
                };
                _this.xhr.send(data || "");
            };
            this.done = function (url, content, config, state) {
                _this.updateHtml(url, content, config);
                _this.triggerEvent("done", url);
                _this.triggerEvent("then", url);
            };
            this.fail = function (url, status) {
                _this.triggerEvent("fail", url, status);
                _this.triggerEvent("then", url);
            };
            this.abort = function () {
                if (_this.xhr instanceof XMLHttpRequest) {
                    _this.xhr.abort();
                }
            };
            this.state = function (e) {
                if (_this.notPropagate || !e.state || !e.state.pjax)
                    return;
                var pjax = e.state.pjax;
                _this.abort();
                _this.updateHtml(pjax.url, pjax.content, pjax.config);
                _this.triggerEvent('history', pjax.url);
            };
            // }
            // public eventListeners = (content : HTMLElement, config : Config, remove : boolean = false) =>{
            // 	var listStringContainers : Array<string> = this.config.containers;
            // 	var i : number, j : number;
            // 	var action : string = remove?'removeEventListener':'addEventListener';
            // 	for(i = listStringContainers.length - 1; i >= 0; i--){
            // 		var listNodes : NodeListOf<Element> = content.querySelectorAll(listStringContainers[i]);
            // 		for (j = listNodes.length - 1; j >= 0; j--) {
            // 			var elements = listNodes[j].querySelectorAll(this.config.linkSelector);
            // 			document[action]('click', this.triggerLink);
            // 			var elements = listNodes[j].querySelectorAll(this.config.formSelector);
            // 			document[action]('submit', this.triggerForm);
            // 		}
            // 	}
            // }
            this.remove = function () {
                if (!_this.config)
                    return;
                if (_this.config.loaded) {
                    _this.addEvent("initiate", _this.showLoader, true);
                    _this.addEvent("then", _this.hideLoader, true);
                }
                document.removeEventListener("click", _this.triggerLink);
                document.removeEventListener("submit", _this.triggerForm);
                window.removeEventListener("unload", _this.abort);
                window.removeEventListener("popstate", _this.state);
            };
            this.ready = function () {
                var url = window.location.toString(), state = window.history.state;
                if (!state || !state.pjax) {
                    var options = {
                        url: url,
                        content: document.documentElement.outerHTML,
                        config: _this.config
                    };
                    _this.updateState(options, document.title, url, true);
                }
                _this.config.loaded = true;
                _this.addEvent("initiate", _this.showLoader);
                _this.addEvent("then", _this.hideLoader);
                _this.addEvent("history", _this.hideLoader);
                window.addEventListener("unload", _this.abort);
                window.addEventListener("popstate", _this.state);
            };
            this.start = function (config) {
                if (config === void 0) { config = null; }
                for (var k in _this.config) {
                    if (k in config)
                        _this.config[k] = config[k];
                }
                _this.ready();
                if (/^(interactive|complete)$/.test(document.readyState)) {
                    _this.ready();
                }
                else {
                    document.addEventListener("DOMContentLoaded", _this.ready);
                }
                if (_this.config.linkSelector)
                    document.addEventListener('click', _this.triggerLink);
                if (_this.config.formSelector)
                    document.addEventListener('submit', _this.triggerForm);
                // this.eventListeners(document.body, this.config);
            };
            var h = window.history;
            this.supported = !!(h && h.pushState && Element && Element.prototype && (DOMParser || document.implementation.createHTMLDocument));
            this.checkParser();
        }
        return Pjax;
    })();
    var Object = new Pjax();
    // TODO : OBJECT TEST [REMOVE]
    window['T'] = Object;
    window['Pjax'] = {
        supported: Object.supported,
        start: Object.start,
        remove: Object.remove,
        on: function (name, callback) {
            Object.addEvent(name, callback);
        },
        off: function (name, callback) {
            Object.addEvent(name, callback, true);
        }
    };
}());
