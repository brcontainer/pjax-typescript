(function(){

	enum Protocol {
		POST = "POST",
		GET = "GET"
	}

	interface LinkElement extends Element{
		href? : string,
	}

	interface FormElement extends Element{
		action? : string,
	}

	interface Config {
		linkSelector : string,
		formSelector : string,
		containers : Array<string>,
		mouseCatch : Array<number>,
		// updatecurrent : boolean,
		noCache : boolean,
		updatehead : boolean,
		// reloadScripts : boolean,
		// scrollLeft : number,
		// scrollTop : number,
		loaded : boolean,
		proxy : string,
		done : Function,
		fail : Function
	}

	interface PjaxState{
		url : string,
		content : any,
		config : Config,
	}

	class Pjax{

		public supported : boolean = false;
		private parserSupported : boolean = !!DOMParser;

		private events : Object = {};

		private notPropagate : boolean = false;
		private rand : string = null;

		private timer : number = null;
		private loader : HTMLElement = null;

		private xhr : XMLHttpRequest = null;

		private config : Config = {
			linkSelector	: "a:not([data-pjax-ignore]):not([href^='#']):not([href^='javascript:'])",
			formSelector	: "form:not([data-pjax-ignore]):not([action^='javascript:'])",
			containers		: [ "#pjax-container" ],
			mouseCatch		: [0],
			noCache			: false,
			// updatecurrent	: false,
			updatehead		: true,
			// reloadScripts	: false,
			// scrollLeft		: 0,
			// scrollTop		: 0,
			loaded			: false,
			proxy			: "",
			done			: null,
			fail			: null
		}

		constructor(){
			var h = window.history;
			this.supported = !!(h && h.pushState && Element && Element.prototype && (DOMParser || document.implementation.createHTMLDocument));
			this.checkParser();
		}

	// Region Element Config{
		private getData = (element : Element, name : string) =>{
			var data = element.getAttribute("data-" + name), resp;

			if(data === "true" || data === "false"){
				return data === "true";
			} else if (/^\[[\s\S]+\]$|^\{[\s\S]+\}$/.test(data)){
				try { resp = JSON.parse(data); } catch (e) {}
			}

			return resp || data;
		}

		private getConfig = (element : Element) =>{

			var config = this.config;

			if(element){
				for (var p in config){
					var v = this.getData(element, p);
					if(v){
						config[p] = v;
					}
				}
			}

			return config;
		}
	// }

	// Region view HTML{

		private showLoader = () =>{
			var self = this;

			if (this.timer) {
				this.hideLoader();
			}

			if (!this.loader) {
				this.loader = document.createElement("div");
				this.loader.innerHTML = '<div class="pjax-progress"></div>';
				document.body.appendChild(this.loader);
			}

			this.loader.className = "pjax-loader pjax-start";

			this.timer = setTimeout(function(){
				self.timer = 0;
				self.loader.className = "pjax-loader pjax-start pjax-inload";
			}, 10);

			setTimeout(function(){
				self.hideLoader();
			}, 5000);
		}

		private hideLoader = () =>{
			var self = this;
			
			if (this.timer) clearTimeout(this.timer);
			if (!this.loader) {
				return;
			}

			if(this.loader.className.match('pjax-inload') == null){
				setTimeout(this.hideLoader, 100);
				return;
			}

			this.loader.className = "pjax-loader pjax-end";

			this.timer = setTimeout(function () {
				self.timer = 0;
				self.loader.className = "pjax-loader pjax-hide";
			}, 1000);
		}
	// }

	// Region manage HTML {

		// check if current browser can parse string to HTML
		private checkParser = () =>{
			if(!this.parserSupported){
				try {
					var test = this.parseHtml('<html><head><title>1</title></head><body>1</body></html>');
					this.parserSupported = !!(test.head && test.title && test.body);
					return;
				} catch (ee){}
				this.parserSupported = false;
			}
		}

		// try parse current string to valid HTML
		private parseHtml = (content : string) =>{
			if(this.parserSupported) return (new DOMParser()).parseFromString(content, "text/html");

			var html = document.implementation.createHTMLDocument("");

			if(/^(\s+|)(<\!doctype|<html([^>]+>|>))/i.test(content)){
				html.documentElement.innerHTML = content;

				/* Fix bug in Android */
				if(!html.body || !html.head){
					html = document.implementation.createHTMLDocument("");
					html.write(content);
				}
			}else{
				html.body.innerHTML = content;
			}
			return html;
		}

		private updateHead = (head : HTMLHeadElement, config : Config) =>{
			var nodes : Array<string> = [];
			var child : NodeList = head.childNodes;
			var elem : HTMLElement, tmp : HTMLElement;
			var i : number, index : number;

			for (i = child.length - 1; i >= 0; i--){
				elem = <HTMLElement> child[i];
				if(elem.outerHTML == undefined) continue;
				if (["TITLE", "SCRIPT"].indexOf(elem.tagName) != -1) continue;
				if("LINK" == elem.tagName && (elem.getAttribute('type') || '').toLowerCase() == 'text/css') continue;

				nodes.push(elem.outerHTML);
			}

			child = document.head.childNodes;
			for (i = child.length - 1; i >= 0; i--){
				elem = <HTMLElement> child[i];
				if(elem.outerHTML == undefined) continue;
				if(["TITLE", "SCRIPT"].indexOf(elem.tagName) != -1) continue;
				if("LINK" == elem.tagName && (elem.getAttribute('type') || '').toLowerCase() == 'text/css') continue;

				index = nodes.indexOf(elem.outerHTML);

				if (index === -1) {
					elem.remove()
				} else {
					nodes.splice(index, 1);
				}
			}

			tmp = document.createElement('div');
			tmp.innerHTML = nodes.join('');

			child = tmp.childNodes;
			for (i = child.length - 1; i >= 0; i--){
				document.head.appendChild(child[i]);
			}
		}

		private updateScripts = (html : Document, config : Config) =>{
			var nodes : Array<string> = [];
			var scripts : any = html.querySelectorAll('script');
			var script : HTMLScriptElement, tmp : HTMLElement;
			var i : number, index : number;

			for (i = scripts.length - 1; i >= 0; i--){
				script = <HTMLScriptElement> scripts[i];
				nodes.push(script.outerHTML);
			}

			scripts = document.querySelectorAll('script');

			for (i = scripts.length - 1; i >= 0; i--){
				script = <HTMLScriptElement> scripts[i];

				index = nodes.indexOf(script.outerHTML);

				if (index === -1) {
					script.remove();
				} else {
					nodes.splice(index, 1);
				}
			}

			tmp = document.createElement('div');
			tmp.innerHTML = nodes.join('');

			scripts = tmp.childNodes;
			for (i = scripts.length - 1; i >= 0; i--){

				var script = document.createElement('script');
				script.type = "text/javascript";
				if(typeof scripts[i].src == 'string' && scripts[i].src.length > 0){
					script.src = this.processUrl(scripts[i].src);
				}
				script.text = scripts[i].text;

				document.body.appendChild(script);
			}
		}

		private updateStyle = (html : Document, config : Config) =>{
			var nodes : Array<string> = [];
			var styles : any = html.querySelectorAll('link[type="text/css"], style');
			var style : HTMLStyleElement, tmp : HTMLElement;
			var i : number, index : number;

			for (i = styles.length - 1; i >= 0; i--){
				style = <HTMLStyleElement> styles[i];
				nodes.push(style.outerHTML);
			}

			styles = document.querySelectorAll('link[type="text/css"], style');

			for (i = styles.length - 1; i >= 0; i--){
				style = <HTMLStyleElement> styles[i];

				index = nodes.indexOf(style.outerHTML);

				if (index === -1) {
					style.remove();
				} else {
					nodes.splice(index, 1);
				}
			}

			tmp = document.createElement('div');
			tmp.innerHTML = nodes.join('');

			styles = tmp.childNodes;
			for (i = styles.length - 1; i >= 0; i--){
				document.head.appendChild(styles[i]);
			}
		}

		private updateState = (options : PjaxState, title : string, url : string, replace : boolean = false) =>{

			var action = replace?'replaceState':'pushState';

			if(this.config.noCache) url = url.replace(this.rand, '');

			// UPDATE HISTORY
			window.history[action]({ pjax : options }, title, url);

			if(action == 'pushState'){
				/* Fix bug in Android */
				this.notPropagate = true;
				history.go(-1);

				var self = this;
				setTimeout(function(){
					if (url !== window.location.toString()){
						history.go(1);
					}
					self.notPropagate = false;
				}, 50);
			}
		}

		private updateHtml = (url : string, content : string, config : Config) =>{
			var self = this;
			
			var html : Document = this.parseHtml(content);
			this.triggerEvent('beforeChange', url, html, config);

			var containers : Array<string> = config.containers;
			var current : any;


			var title : string = html.title || "";

			var options : PjaxState = {
				url: url,
				content: content,
				config: config
			};

			this.updateState(options, title, url);

			document.title = title;

			if(config.updatehead) this.updateHead(html.head, config);
			this.updateScripts(html, config);
			this.updateStyle(html, config);

			// this.eventListeners(document.body, this.config, true);
			for (var i = 0, j = containers.length; i < j; i++){
				current = html.body.querySelector(containers[i]);

				if(current){
					[].slice.call(document.querySelectorAll(containers[i])).forEach(function(el){
					    self.triggerEvent("dom", url, el, current);
						el.innerHTML = current.innerHTML;
					});
				}
			}

			this.triggerEvent('afterChange', url);
			// this.eventListeners(document.body, config);
		}
	// }

	// Region Event Trigger {

		// call all functions with trigger name
		private triggerEvent = (name : string, ...args : any[]) =>{
			if(typeof this.events[name] != 'object') return;

			var listEvents = this.events[name], i : number;

			for(i = 0; i < listEvents.length; i++){
				listEvents[i](...args);
			}
		}

		public addEvent = (name : string, callback : Function, remove : boolean = false) =>{

			if(!this.events[name]){
				this.events[name] = [];
			}

			if(!remove){
				this.events[name].push(callback);
				return;
			}

			var listEvents = this.events[name];
			var fr : Array<number>, i : number;

			// create a array with the indexes of all functions equal callback
			for (i = listEvents.length - 1; i >= 0; i--){
				if(listEvents[i] === callback) fr.push(i);
			}

			// remove all that functions
			for (i = fr.length - 1; i >= 0; i--){
				this.events[name].splice(fr[i], 1);
			}
		}
	// }

	// Region Request {

		private triggerLink = (event : MouseEvent) =>{

			if(this.config.mouseCatch.indexOf(event.button) == -1) return;

			var target : Element = <Element> event.target;
			var element : LinkElement = null;
			var url : string;

			do{
				if(target.tagName == 'A'){
					element = target; break;
				}
			}while(target != document.body && (target = <Element> target.parentNode));

			if (element === null || !element.matches(this.config.linkSelector)){
				return;
			}

			url = element.href;

			this.request(Protocol.GET, url, null, element, event);
		}

		private triggerForm = (event : Event) =>{

		}

		private noCache = (url) =>{
			var u, n = "_=" + (+new Date);

			if (!URL) {
				u = new URL(url);
			} else {
				u = document.createElement("a");
				u.href = url;
			}

			u.search += (this.rand = u.search ? ("&"+n):("?"+n));

			url = u.toString();
			u = null;

			return url;
		}

		private processUrl = (url) =>{
			if(this.config.noCache) url = this.noCache(url);
			return url;
		}

		private request = (method : Protocol, url : string, data : any, element? : Element, event? : Event) =>{

			var host : string = window.location.protocol.replace(/:/g, "")+"://"+window.location.host;
			if (url.indexOf(host + "/") !== 0 && url !== host) return;

			try{
				event.preventDefault();
			}catch(e){}

			var config = this.getConfig(element);

			this.triggerEvent("initiate", url, config);

			url = this.processUrl(config.proxy || url);

			this.abort();
			this.xhr = new XMLHttpRequest();
			this.xhr.open(Protocol[method], url, true);

			var headers = {
				"X-PJAX-Container": config.containers.join(","),
				"X-PJAX-URL": url,
				"X-PJAX": "true"
			};

			for (var k in headers){
				this.xhr.setRequestHeader(k, headers[k]);
			}

			var self = this;
			this.xhr.onreadystatechange = function(){
				if (this.readyState !== 4) return;

				var status = this.status;
				var state = 1;

				if (status >= 200 && status < 300 || status === 304) {
					self.done(url, this.responseText, config, state);
				} else {
					self.fail(url, status);
				}
			};

			this.xhr.send(data || "");
		}

		private done = (url : string, content : string, config : Config, state : number) =>{
			this.updateHtml(url, content, config);
			this.triggerEvent("done", url);
			this.triggerEvent("then", url);
		}

		private fail = (url, status) =>{
			this.triggerEvent("fail", url, status);
			this.triggerEvent("then", url);
		}

		private abort = () =>{
			if(this.xhr instanceof XMLHttpRequest){
				this.xhr.abort();
			}
		}

		private state = (e) =>{
			if (this.notPropagate || !e.state || !e.state.pjax) return;

			var pjax = e.state.pjax;

			this.abort();
			this.updateHtml(pjax.url, pjax.content, pjax.config);
			this.triggerEvent('history', pjax.url);
		}
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

		public remove = () =>{
			if (!this.config) return;

			if (this.config.loaded) {
				this.addEvent("initiate", this.showLoader, true);
				this.addEvent("then", this.hideLoader, true);
			}

			document.removeEventListener("click", this.triggerLink);
			document.removeEventListener("submit", this.triggerForm);

			window.removeEventListener("unload", this.abort);
			window.removeEventListener("popstate", this.state);
		}

		private ready = () =>{

			var url = window.location.toString(), state = window.history.state;

			if (!state || !state.pjax){
				var options : PjaxState = {
					url : url,
					content : document.documentElement.outerHTML,
					config : this.config
				}
				this.updateState(options, document.title, url, true);
			}

			this.config.loaded = true;

			this.addEvent("initiate", this.showLoader);
			this.addEvent("then", this.hideLoader);
			this.addEvent("history", this.hideLoader);

			window.addEventListener("unload", this.abort);
			window.addEventListener("popstate", this.state);
		}

		public start = (config : Object = null) =>{
			for(var k in this.config){
				if(k in config) this.config[k] = config[k];
			}

			this.ready();

			if (/^(interactive|complete)$/.test(document.readyState)) {
				this.ready();
			} else {
				document.addEventListener("DOMContentLoaded", this.ready);
			}

			if(this.config.linkSelector) document.addEventListener('click', this.triggerLink);
			if(this.config.formSelector) document.addEventListener('submit', this.triggerForm);

			// this.eventListeners(document.body, this.config);
		}
	}

	var Object = new Pjax();

	window['T'] = Object;

	window['Pjax'] = {
		supported : Object.supported,
		start : Object.start,
		remove : Object.remove,
		on : function(name, callback){
			Object.addEvent(name, callback);
		},
		off : function(name, callback){
			Object.addEvent(name, callback, true);	
		}
	}
}());