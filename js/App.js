'use strict';

/* eslint-disable new-cap */
/* global __, Article, Headlines, Filters, fox */
/* global xhr, dojo, dijit, PluginHost, Notify, Feeds, Cookie */
/* global CommonDialogs, Plugins */

const App = {
   _initParams: [],
	_rpc_seq: 0,
	hotkey_prefix: 0,
	hotkey_prefix_pressed: false,
	hotkey_prefix_timeout: 0,
   global_unread: -1,
   _widescreen_mode: false,
   _loading_progress: 0,
   hotkey_actions: {},
   is_prefs: false,
   LABEL_BASE_INDEX: -1024,
   _translations: {},
   Hash: {
      get: function() {
         return dojo.queryToObject(window.location.hash.substring(1));
      },
      set: function(params) {
         const obj = dojo.queryToObject(window.location.hash.substring(1));
         window.location.hash = dojo.objectToQuery({...obj, ...params});
      }
   },
   l10n: {
      ngettext: function(msg1, msg2, n) {
         return self.__((parseInt(n) > 1) ? msg2 : msg1);
      },
      __: function(msg) {
         return App._translations[msg] ? App._translations[msg] : msg;
      }
   },
   FormFields: {
      attributes_to_string: function(attributes) {
         return Object.keys(attributes).map((k) =>
            `${App.escapeHtml(k)}="${App.escapeHtml(attributes[k])}"`)
            .join(" ");
      },
      hidden_tag: function(name, value, attributes = {}, id = "") {
         return `<input id="${App.escapeHtml(id)}" dojoType="dijit.form.TextBox" ${this.attributes_to_string(attributes)}
            style="display : none" name="${name}" value="${App.escapeHtml(value)}"></input>`
      },
      // allow html inside because of icons
      button_tag: function(value, type, attributes = {}) {
         return `<button dojoType="dijit.form.Button" ${this.attributes_to_string(attributes)}
            type="${type}">${value}</button>`

      },
      icon: function(icon, attributes = {}) {
         return `<i class="material-icons" ${this.attributes_to_string(attributes)}>${icon}</i>`;
      },
      submit_tag: function(value, attributes = {}) {
         return this.button_tag(value, "submit", {...{class: "alt-primary"}, ...attributes});
      },
      cancel_dialog_tag: function(value, attributes = {}) {
         return this.button_tag(value, "", {...{onclick: "App.dialogOf(this).hide()"}, ...attributes});
      },
      checkbox_tag: function(name, checked = false, value = "", attributes = {}, id = "") {
         // checked !== '0' prevents mysql "boolean" false to be implicitly cast as true
         return `<input dojoType="dijit.form.CheckBox" type="checkbox" name="${App.escapeHtml(name)}"
                     ${checked !== '0' && checked ? "checked" : ""}
                     ${value ? `value="${App.escapeHtml(value)}"` : ""}
                     ${this.attributes_to_string(attributes)} id="${App.escapeHtml(id)}">`
      },
      select_tag: function(name, value, values = [], attributes = {}, id = "") {
         return `
            <select name="${name}" dojoType="fox.form.Select" id="${App.escapeHtml(id)}" ${this.attributes_to_string(attributes)}>
               ${values.map((v) =>
                  `<option ${v == value ? 'selected="selected"' : ''} value="${App.escapeHtml(v)}">${App.escapeHtml(v)}</option>`
               ).join("")}
            </select>
         `
      },
      select_hash: function(name, value, values = {}, attributes = {}, id = "") {
         return `
            <select name="${name}" dojoType="fox.form.Select" id="${App.escapeHtml(id)}" ${this.attributes_to_string(attributes)}>
               ${Object.keys(values).map((vk) =>
                     `<option ${vk == value ? 'selected="selected"' : ''} value="${App.escapeHtml(vk)}">${App.escapeHtml(values[vk])}</option>`
               ).join("")}
            </select>
         `
      }
   },
   Scrollable: {
		scrollByPages: function (elem, page_offset) {
			if (!elem) return;

			/* keep a line or so from the previous page  */
			const offset = (elem.offsetHeight - (page_offset > 0 ? 50 : -50)) * page_offset;

			this.scroll(elem, offset);
		},
		scroll: function(elem, offset) {
			if (!elem) return;

			elem.scrollTop += offset;
		},
		isChildVisible: function(elem, ctr) {
			if (!elem) return;

			const ctop = ctr.scrollTop;
			const cbottom = ctop + ctr.offsetHeight;

			const etop = elem.offsetTop;
			const ebottom = etop + elem.offsetHeight;

			return etop >= ctop && ebottom <= cbottom ||
				etop < ctop && ebottom > ctop || ebottom > cbottom && etop < cbottom;
		},
		fitsInContainer: function (elem, ctr) {
			if (!elem) return;

			return elem.offsetTop + elem.offsetHeight <= ctr.scrollTop + ctr.offsetHeight &&
				elem.offsetTop >= ctr.scrollTop;
		},
      scrollTo: function (elem, ctr, params = {}) {
         const force_to_top = params.force_to_top || false;

         if (!elem || !ctr) return;

         if (force_to_top || !App.Scrollable.fitsInContainer(elem, ctr)) {
            ctr.scrollTop = elem.offsetTop;
         }
      }
   },
   byId: function(id) {
      return document.getElementById(id);
   },
   find: function(query) {
      return document.querySelector(query)
   },
   findAll: function(query) {
      return document.querySelectorAll(query);
   },
   dialogOf: function (elem) {

      // elem could be a Dijit widget
      elem = elem.domNode ? elem.domNode : elem;

      return dijit.getEnclosingWidget(elem.closest('.dijitDialog'));
   },
   getPhArgs(plugin, method, args = {}) {
      return {...{op: "pluginhandler", plugin: plugin, method: method}, ...args};
   },
   label_to_feed_id: function(label) {
      return this.LABEL_BASE_INDEX - 1 - Math.abs(label);
   },
   feed_to_label_id: function(feed) {
      return this.LABEL_BASE_INDEX - 1 + Math.abs(feed);
   },
   getInitParam: function(k) {
		return this._initParams[k];
	},
	setInitParam: function(k, v) {
		this._initParams[k] = v;
	},
	nightModeChanged: function(is_night, link) {
		console.log("night mode changed to", is_night);

		if (link) {
			const css_override = is_night ? "themes/night.css" : "themes/light.css";
			link.setAttribute("href", css_override + "?" + Date.now());
		}
	},
	setupNightModeDetection: function(callback) {
		if (!App.byId("theme_css")) {
			const mql = window.matchMedia('(prefers-color-scheme: dark)');

			try {
				mql.addEventListener("change", () => {
					this.nightModeChanged(mql.matches, App.byId("theme_auto_css"));
				});
			} catch (e) {
				console.warn("exception while trying to set MQL event listener");
			}

			const link = document.createElement("link");
         link.rel = "stylesheet";
         link.id = "theme_auto_css";

			if (callback) {
						link.onload = function() {
							document.querySelector("body").removeClassName("css_loading");
							callback();
						};

						link.onerror = function() {
							alert("Fatal error while loading application stylesheet: " + link.getAttribute("href"));
						}
					}

			this.nightModeChanged(mql.matches, link);

			document.querySelector("head").appendChild(link);
		} else {
			document.querySelector("body").removeClassName("css_loading");

			if (callback) callback();
		}
	},
   postCurrentWindow: function(target, params) {
      const form = document.createElement("form");

      form.setAttribute("method", "post");
      form.setAttribute("action", App.getInitParam("self_url_prefix") + "/" + target);

      for (const [k,v] of Object.entries(params)) {
         const field = document.createElement("input");

         field.setAttribute("name", k);
         field.setAttribute("value", v);
         field.setAttribute("type", "hidden");

         form.appendChild(field);
      }

      document.body.appendChild(form);

      form.submit();

      form.parentNode.removeChild(form);
   },
   postOpenWindow: function(target, params) {
      const w = window.open("");

		if (w) {
			w.opener = null;

			const form = document.createElement("form");

			form.setAttribute("method", "post");
			form.setAttribute("action", App.getInitParam("self_url_prefix") + "/" + target);

			for (const [k,v] of Object.entries(params)) {
				const field = document.createElement("input");

				field.setAttribute("name", k);
				field.setAttribute("value", v);
				field.setAttribute("type", "hidden");

				form.appendChild(field);
			}

			w.document.body.appendChild(form);
			form.submit();
		}

   },
	urlParam: function(name) {
		try {
         const results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.href);
         return decodeURIComponent(results[1].replace(/\+/g, " ")) || 0;
      } catch (e) {
         return 0;
      }
	},
	next_seq: function() {
		this._rpc_seq += 1;
		return this._rpc_seq;
	},
	get_seq: function() {
		return this._rpc_seq;
	},
	setLoadingProgress: function(p) {
		this._loading_progress += p;

		if (dijit.byId("loading_bar"))
			dijit.byId("loading_bar").update({progress: this._loading_progress});

		if (this._loading_progress >= 90) {
			App.byId("overlay").hide();
		}

	},
	isCombinedMode: function() {
		return this.getInitParam("combined_display_mode");
	},
	getActionByHotkeySequence: function(sequence) {
		const hotkeys_map = this.getInitParam("hotkeys");

		for (const seq in hotkeys_map[1]) {
			if (hotkeys_map[1].hasOwnProperty(seq)) {
				if (seq == sequence) {
					return hotkeys_map[1][seq];
				}
			}
		}
	},
	keyeventToAction: function(event) {

		const hotkeys_map = this.getInitParam("hotkeys");
		const keycode = event.which;
		const keychar = String.fromCharCode(keycode);

		if (keycode == 27) { // escape and drop prefix
			this.hotkey_prefix = false;
		}

		if (!this.hotkey_prefix && hotkeys_map[0].indexOf(keychar) != -1) {

			this.hotkey_prefix = keychar;
			App.byId("cmdline").innerHTML = keychar;
			Element.show("cmdline");

			window.clearTimeout(this.hotkey_prefix_timeout);
			this.hotkey_prefix_timeout = window.setTimeout(() => {
				this.hotkey_prefix = false;
				Element.hide("cmdline");
			}, 3 * 1000);

			event.stopPropagation();

			return false;
		}

		Element.hide("cmdline");

		let hotkey_name = "";

		if (event.type == "keydown") {
			hotkey_name = "(" + keycode + ")";

			// ensure ^*char notation
			if (event.shiftKey) hotkey_name = "*" + hotkey_name;
			if (event.ctrlKey) hotkey_name = "^" + hotkey_name;
			if (event.altKey) hotkey_name = "+" + hotkey_name;
			if (event.metaKey) hotkey_name = "%" + hotkey_name;
		} else {
			hotkey_name = keychar ? keychar : "(" + keycode + ")";
		}

		let hotkey_full = this.hotkey_prefix ? this.hotkey_prefix + " " + hotkey_name : hotkey_name;
		this.hotkey_prefix = false;

		let action_name = this.getActionByHotkeySequence(hotkey_full);

		// check for mode-specific hotkey
		if (!action_name) {
			hotkey_full = (this.isCombinedMode() ? "{C}" : "{3}") + hotkey_full;

			action_name = this.getActionByHotkeySequence(hotkey_full);
		}

		console.log('keyeventToAction', hotkey_full, '=>', action_name);

		return action_name;
	},
	cleanupMemory: function(root) {
		const dijits = dojo.query("[widgetid]", dijit.byId(root).domNode).map(dijit.byNode);

		dijits.forEach(function (d) {
			dojo.destroy(d.domNode);
		});

		App.findAll("#" + root + " *").forEach(function (i) {
			i.parentNode ? i.parentNode.removeChild(i) : true;
		});
   },
   // htmlspecialchars()-alike for headlines data-content attribute
   escapeHtml: function(p) {
      if (typeof p == "string") {
         const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
         };

         return p.replace(/[&<>"']/g, function(m) { return map[m]; });
      } else {
         return p;
      }
   },
   // http://stackoverflow.com/questions/6251937/how-to-get-selecteduser-highlighted-text-in-contenteditable-element-and-replac
   getSelectedText: function() {
      let text = "";

      if (typeof window.getSelection != "undefined") {
         const sel = window.getSelection();
         if (sel.rangeCount) {
            const container = document.createElement("div");
            for (let i = 0, len = sel.rangeCount; i < len; ++i) {
               container.appendChild(sel.getRangeAt(i).cloneContents());
            }
            text = container.innerHTML;
         }
      } else if (typeof document.selection != "undefined") {
         if (document.selection.type == "Text") {
            text = document.selection.createRange().textText;
         }
      }

      return text.stripTags();
   },
   displayIfChecked: function(checkbox, elemId) {
      if (checkbox.checked) {
         Element.show(elemId);
      } else {
         Element.hide(elemId);
      }
   },
   hotkeyHelp: function() {
      xhr.post("backend.php", {op: "rpc", method: "hotkeyHelp"}, (reply) => {
         const dialog = new fox.SingleUseDialog({
            title: __("Keyboard shortcuts"),
            content: reply,
         });

         dialog.show();
      });
   },
	handleRpcJson: function(reply) {

		const netalert = App.find(".net-alert");

      if (reply) {
         const error = reply['error'];
         const seq = reply['seq'];
         const message = reply['message'];
         const counters = reply['counters'];
         const runtime_info = reply['runtime-info'];

         if (error && error.code && error.code != App.Error.E_SUCCESS) {
            console.warn("handleRpcJson: fatal error", error);
            this.Error.fatal(error.code, error.params);
            return false;
         }

         if (seq && this.get_seq() != seq) {
            console.warn("handleRpcJson: sequence mismatch: ", seq, '!=', this.get_seq());
            return false;
         }

         // not in preferences
         if (typeof Feeds != "undefined") {
            if (message == "UPDATE_COUNTERS") {
               console.log("need to refresh counters for", reply.feeds);
               Feeds.requestCounters(reply.feeds);
            }

            if (counters)
               Feeds.parseCounters(counters);
         }

         if (runtime_info)
            this.parseRuntimeInfo(runtime_info);

         if (netalert) netalert.hide();

         return true;
      } else {
         if (netalert) netalert.show();

         Notify.error("Communication problem with server.");

         return false;
		}
	},
	parseRuntimeInfo: function(data) {
		Object.keys(data).forEach((k) => {
         const v = data[k];

         console.log("RI:", k, "=>", v);

         if (k == "daemon_is_running" && v != 1) {
            Notify.error("Update daemon is not running.", true);
            return;
         }

         if (k == "recent_log_events") {
            const alert = App.find(".log-alert");

            if (alert) {
               v > 0 ? alert.show() : alert.hide();
            }
         }

         if (k == "daemon_stamp_ok" && v != 1) {
            Notify.error("Update daemon is not updating feeds.", true);
            return;
         }

         if (typeof Feeds != "undefined") {
            if (k == "max_feed_id" || k == "num_feeds") {
               if (this.getInitParam(k) && this.getInitParam(k) != v) {
                  console.log("feed count changed, need to reload feedlist:", this.getInitParam(k), v);
                  Feeds.reload();
               }
            }
         }

         this.setInitParam(k, v);
		});

		PluginHost.run(PluginHost.HOOK_RUNTIME_INFO_LOADED, data);
	},
	backendSanityCallback: function(reply) {
		console.log("sanity check ok");

		const params = reply['init-params'];

		if (params) {
			console.log('reading init-params...');

			Object.keys(params).forEach((k) => {
            switch (k) {
               case "label_base_index":
                  this.LABEL_BASE_INDEX = parseInt(params[k]);
                  break;
               case "cdm_auto_catchup":
                  {
                     const headlines = App.byId("headlines-frame");

                  // we could be in preferences
                     if (headlines)
                        headlines.setAttribute("data-auto-catchup", params[k] ? "true" : "false");
                  }
                  break;
               case "hotkeys":
                  // filter mnemonic definitions (used for help panel) from hotkeys map
                  // i.e. *(191)|Ctrl-/ -> *(191)
                  {
                     const tmp = [];

                     Object.keys(params[k][1]).forEach((sequence) => {
                        const filtered = sequence.replace(/\|.*$/, "");
                        tmp[filtered] = params[k][1][sequence];
                     });

                     params[k][1] = tmp;
                  }
                  break;
            }

            console.log("IP:", k, "=>", params[k]);
            this.setInitParam(k, params[k]);
			});

			// PluginHost might not be available on non-index pages
			if (typeof PluginHost !== 'undefined')
				PluginHost.run(PluginHost.HOOK_PARAMS_LOADED, this._initParams);
		}

      const translations = reply['translations'];

      if (translations) {
         console.log('reading translations...');
         App._translations = translations;
      }

		this.initSecondStage();
	},
	Error: {
      E_SUCCESS: "E_SUCCESS",
      E_UNAUTHORIZED: "E_UNAUTHORIZED",
      E_SCHEMA_MISMATCH: "E_SCHEMA_MISMATCH",
      E_URL_SCHEME_MISMATCH: "E_URL_SCHEME_MISMATCH",
		fatal: function (error, params = {}) {
         if (error == App.Error.E_UNAUTHORIZED) {
            window.location.href = "index.php";
            return;
         } else if (error == App.Error.E_SCHEMA_MISMATCH) {
            window.location.href = "public.php?op=dbupdate";
            return;
         } else if (error == App.Error.E_URL_SCHEME_MISMATCH) {
            params.description = __("URL scheme reported by your browser (%a) doesn't match server-configured SELF_URL_PATH (%b), check X-Forwarded-Proto.")
               .replace("%a", params.client_scheme)
               .replace("%b", params.server_scheme);
            params.info = `SELF_URL_PATH: ${params.self_url_path}\nCLIENT_LOCATION: ${document.location.href}`
         }

			return this.report(error,
				{...{title: __("Fatal error")}, ...params});
		},
		report: function(error, params = {}) {
			if (!error) return;

			console.error("error.report:", error, params);

			const message = params.message ? params.message : error.toString();

			try {
				xhr.post("backend.php",
					{op: "rpc", method: "log",
						file: params.filename ? params.filename : error.fileName,
						line: params.lineno ? params.lineno : error.lineNumber,
						msg: message,
						context: error.stack},
					(reply) => {
						console.warn("[Error.report] log response", reply);
					});
			} catch (re) {
				console.error("[Error.report] exception while saving logging error on server", re);
			}

			try {
				const dialog = new fox.SingleUseDialog({
					title: params.title || __("Unhandled exception"),
					content: `
               <div class='exception-contents'>
                  <h3>${message}</h3>

                  ${params.description ? `<p>${params.description}</p>` : ''}

                  ${error.stack ?
                  `<header>${__('Stack trace')}</header>
                  <section>
                     <textarea readonly='readonly'>${error.stack}</textarea>
                  </section>` : ''}

                  ${params && params.info ?
                     `
                     <header>${__('Additional information')}</header>
                     <section>
                        <textarea readonly='readonly'>${params.info}</textarea>
                     </section>
                     ` : ''}
               </div>
               <footer class='text-center'>
                  <button dojoType="dijit.form.Button" class='alt-primary' type='submit'>
                     ${__('Close this window')}
                  </button>
               </footer>
            </div>`
				});

				dialog.show();
			} catch (de) {
				console.error("[Error.report] exception while showing error dialog", de);

				alert(error.stack ? error.stack : message);
			}

		},
		onWindowError: function (message, filename, lineno, colno, error) {
			// called without context (this) from window.onerror
			App.Error.report(error,
				{message: message, filename: filename, lineno: lineno, colno: colno});
		},
	},
	isPrefs() {
		return this.is_prefs;
   },
   audioCanPlay: function(ctype) {
      const a = document.createElement('audio');
      return a.canPlayType(ctype);
   },
   init: function(parser, is_prefs) {
      this.is_prefs = is_prefs;
      window.onerror = this.Error.onWindowError;

      this.setInitParam("csrf_token", __csrf_token);

      this.setupNightModeDetection(() => {
         parser.parse();

         console.log('is_prefs', this.is_prefs);

         if (!this.checkBrowserFeatures())
            return;

         this.setLoadingProgress(30);
         this.initHotkeyActions();

         const params = {
            op: "rpc",
            method: "sanityCheck",
            clientTzOffset: new Date().getTimezoneOffset() * 60,
            hasSandbox: "sandbox" in document.createElement("iframe"),
            clientLocation: window.location.href
         };

         xhr.json("backend.php", params, (reply) => {
            try {
               this.backendSanityCallback(reply);
            } catch (e) {
               this.Error.report(e);
            }
         });
      });
   },
   checkBrowserFeatures: function() {
      let errorMsg = "";

      ['MutationObserver', 'requestIdleCallback'].forEach((t) => {
         if (!(t in window)) {
            errorMsg = `Browser check failed: <code>window.${t}</code> not found.`;
            throw new Error(errorMsg);
         }
      });

      if (typeof Promise.allSettled == "undefined") {
         errorMsg = `Browser check failed: <code>Promise.allSettled</code> is not defined.`;
         throw new Error(errorMsg);
      }

      return errorMsg == "";
   },
   updateRuntimeInfo: function() {
      xhr.json("backend.php", {op: "rpc", method: "getruntimeinfo"}, () => {
         // handled by xhr.json()
      });
   },
   initSecondStage: function() {

      document.onkeydown = (event) => this.hotkeyHandler(event);
      document.onkeypress = (event) => this.hotkeyHandler(event);

      if (this.is_prefs) {

         this.setLoadingProgress(70);
         Notify.close();

         let tab = this.urlParam('tab');

         if (tab) {
            tab = dijit.byId(tab + "Tab");
            if (tab) {
               dijit.byId("pref-tabs").selectChild(tab);

               const method = this.urlParam("method");

               if (method) {
                  switch (method) {
                     case "editfeed":
                        window.setTimeout(() => {
                           CommonDialogs.editFeed(this.urlParam('methodparam'))
                        }, 100);
                        break;
                     default:
                        console.warn("initSecondStage, unknown method:", method);
                  }
               }
            }
         } else {
            let tab = localStorage.getItem("ttrss:prefs-tab");

            if (tab) {
               tab = dijit.byId(tab);
               if (tab) {
                  dijit.byId("pref-tabs").selectChild(tab);
               }
            }
         }

         dojo.connect(dijit.byId("pref-tabs"), "selectChild", function (elem) {
            localStorage.setItem("ttrss:prefs-tab", elem.id);
            App.updateRuntimeInfo();
         });

      } else {

         Feeds.reload();
         Article.close();

         if (parseInt(Cookie.get("ttrss_fh_width")) > 0) {
            dijit.byId("feeds-holder").domNode.setStyle(
               {width: Cookie.get("ttrss_fh_width") + "px"});
         }

         dijit.byId("main").resize();

         dojo.connect(dijit.byId('feeds-holder'), 'resize',
            (args) => {
               if (args && args.w >= 0) {
                  Cookie.set("ttrss_fh_width", args.w, this.getInitParam("cookie_lifetime"));
               }
            });

         dojo.connect(dijit.byId('content-insert'), 'resize',
            (args) => {
               if (args && args.w >= 0 && args.h >= 0) {
                  Cookie.set("ttrss_ci_width", args.w, this.getInitParam("cookie_lifetime"));
                  Cookie.set("ttrss_ci_height", args.h, this.getInitParam("cookie_lifetime"));
               }
            });

         dijit.byId('toolbar-main').setValues({
            view_mode: this.getInitParam("default_view_mode"),
            order_by: this.getInitParam("default_view_order_by")
         });

         this.setLoadingProgress(50);

         this._widescreen_mode = this.getInitParam("widescreen");
         this.setWidescreen(this._widescreen_mode);

         Headlines.initScrollHandler();

         if (this.getInitParam("simple_update")) {
            console.log("scheduling simple feed updater...");
            window.setInterval(() => { Feeds.updateRandom() }, 30 * 1000);
         }

         if (this.getInitParam('check_for_updates')) {
            window.setInterval(() => {
               this.checkForUpdates();
            }, 3600 * 1000);
         }

         PluginHost.run(PluginHost.HOOK_INIT_COMPLETE, null);
      }

      if (!this.getInitParam("bw_limit"))
         window.setInterval(() => {
            App.updateRuntimeInfo();
         }, 60 * 1000)

      console.log("second stage ok");

   },
   checkForUpdates: function() {
      console.log('checking for updates...');

      xhr.json("backend.php", {op: 'rpc', method: 'checkforupdates'})
         .then((reply) => {
            console.log('update reply', reply);

            const icon = App.byId("updates-available");

            if (reply.changeset.id || reply.plugins.length > 0) {
               icon.show();

               const tips = [];

               if (reply.changeset.id)
                  tips.push(__("Updates for Tiny Tiny RSS are available."));

               if (reply.plugins.length > 0)
                  tips.push(__("Updates for some local plugins are available."));

               icon.setAttribute("title", tips.join("\n"));

            } else {
               icon.hide();
            }
         });
   },
   updateTitle: function() {
      let tmp = "Tiny Tiny RSS";

      if (this.global_unread > 0) {
         tmp = "(" + this.global_unread + ") " + tmp;
      }

      document.title = tmp;
   },
   hotkeyHandler: function(event) {
      if (event.target.nodeName == "INPUT" || event.target.nodeName == "TEXTAREA") return;

      // Arrow buttons and escape are not reported via keypress, handle them via keydown.
      // escape = 27, left = 37, up = 38, right = 39, down = 40, pgup = 33, pgdn = 34, insert = 45, delete = 46
      if (event.type == "keydown" && event.which != 27 && (event.which < 33 || event.which > 46)) return;

      const action_name = this.keyeventToAction(event);

      if (action_name) {
         const action_func = this.hotkey_actions[action_name];

         if (action_func != null) {
            action_func(event);
            event.stopPropagation();
            return false;
         }
      }
   },
   setWidescreen: function(wide) {
      const article_id = Article.getActive();
      const headlines_frame = App.byId("headlines-frame");
      const content_insert = dijit.byId("content-insert");

      // TODO: setStyle stuff should probably be handled by CSS

      if (wide) {
         dijit.byId("headlines-wrap-inner").attr("design", 'sidebar');
         content_insert.attr("region", "trailing");

         content_insert.domNode.setStyle({width: '50%',
            height: 'auto',
            borderTopWidth: '0px' });

         if (parseInt(Cookie.get("ttrss_ci_width")) > 0) {
            content_insert.domNode.setStyle(
               {width: Cookie.get("ttrss_ci_width") + "px" });
         }

         headlines_frame.setStyle({ borderBottomWidth: '0px' });

      } else {

         content_insert.attr("region", "bottom");

         content_insert.domNode.setStyle({width: 'auto',
            height: '50%',
            borderTopWidth: '0px'});

         if (parseInt(Cookie.get("ttrss_ci_height")) > 0) {
            content_insert.domNode.setStyle(
               {height: Cookie.get("ttrss_ci_height") + "px" });
         }

         headlines_frame.setStyle({ borderBottomWidth: '1px' });
      }

      headlines_frame.setAttribute("data-is-wide-screen", wide ? "true" : "false");

      Article.close();

      if (article_id) Article.view(article_id);

      xhr.post("backend.php", {op: "rpc", method: "setWidescreen", wide: wide ? 1 : 0});
   },
   initHotkeyActions: function() {
      if (this.is_prefs) {

         this.hotkey_actions["feed_subscribe"] = () => {
            CommonDialogs.subscribeToFeed();
         };

         this.hotkey_actions["create_label"] = () => {
            CommonDialogs.addLabel();
         };

         this.hotkey_actions["create_filter"] = () => {
            Filters.edit();
         };

         this.hotkey_actions["help_dialog"] = () => {
            this.hotkeyHelp();
         };

      } else {

         this.hotkey_actions["next_feed"] = () => {
            const [feed, is_cat] = Feeds.getNextFeed(
               Feeds.getActive(), Feeds.activeIsCat());

				if (feed !== false)
					Feeds.open({feed: feed, is_cat: is_cat, delayed: true})
         };
         this.hotkey_actions["prev_feed"] = () => {
            const [feed, is_cat] = Feeds.getPreviousFeed(
               Feeds.getActive(), Feeds.activeIsCat());

				if (feed !== false)
					Feeds.open({feed: feed, is_cat: is_cat, delayed: true})
         };
         this.hotkey_actions["next_article_or_scroll"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scroll(Headlines.line_scroll_offset, event);
            else
               Headlines.move('next');
         };
         this.hotkey_actions["prev_article_or_scroll"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scroll(-Headlines.line_scroll_offset, event);
            else
               Headlines.move('prev');
         };
         this.hotkey_actions["next_article_noscroll"] = () => {
            Headlines.move('next');
         };
         this.hotkey_actions["prev_article_noscroll"] = () => {
            Headlines.move('prev');
         };
         this.hotkey_actions["next_article_noexpand"] = () => {
            Headlines.move('next', {no_expand: true});
         };
         this.hotkey_actions["prev_article_noexpand"] = () => {
            Headlines.move('prev', {no_expand: true});
         };
         this.hotkey_actions["search_dialog"] = () => {
            Feeds.search();
         };
         this.hotkey_actions["cancel_search"] = () => {
            Feeds.cancelSearch();
         };
         this.hotkey_actions["toggle_mark"] = () => {
            Headlines.selectionToggleMarked();
         };
         this.hotkey_actions["toggle_publ"] = () => {
            Headlines.selectionTogglePublished();
         };
         this.hotkey_actions["toggle_unread"] = () => {
            Headlines.selectionToggleUnread({no_error: 1});
         };
         this.hotkey_actions["edit_tags"] = () => {
            const id = Article.getActive();
            if (id) {
               Article.editTags(id);
            }
         };
         this.hotkey_actions["open_in_new_window"] = () => {
            if (Article.getActive()) {
               Article.openInNewWindow(Article.getActive());
            }
         };
         this.hotkey_actions["catchup_below"] = () => {
            Headlines.catchupRelativeTo(1);
         };
         this.hotkey_actions["catchup_above"] = () => {
            Headlines.catchupRelativeTo(0);
         };
         this.hotkey_actions["article_scroll_down"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scroll(Headlines.line_scroll_offset, event);
            else
               Article.scroll(Headlines.line_scroll_offset, event);
         };
         this.hotkey_actions["article_scroll_up"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scroll(-Headlines.line_scroll_offset, event);
            else
               Article.scroll(-Headlines.line_scroll_offset, event);
         };
         this.hotkey_actions["next_headlines_page"] = (event) => {
            Headlines.scrollByPages(1, event);
         };
         this.hotkey_actions["prev_headlines_page"] = (event) => {
            Headlines.scrollByPages(-1, event);
         };
         this.hotkey_actions["article_page_down"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scrollByPages(1, event);
            else
               Article.scrollByPages(1, event);
         };
         this.hotkey_actions["article_page_up"] = (event) => {
            if (this.isCombinedMode())
               Headlines.scrollByPages(-1, event);
            else
               Article.scrollByPages(-1, event);
         };
         this.hotkey_actions["close_article"] = () => {
            if (this.isCombinedMode()) {
               Article.cdmUnsetActive();
            } else {
               Article.close();
            }
         };
         this.hotkey_actions["email_article"] = () => {
            if (typeof Plugins.Mail != "undefined") {
               Plugins.Mail.onHotkey(Headlines.getSelected());
            } else {
               alert(__("Please enable mail or mailto plugin first."));
            }
         };
         this.hotkey_actions["select_all"] = () => {
            Headlines.select('all');
         };
         this.hotkey_actions["select_unread"] = () => {
            Headlines.select('unread');
         };
         this.hotkey_actions["select_marked"] = () => {
            Headlines.select('marked');
         };
         this.hotkey_actions["select_published"] = () => {
            Headlines.select('published');
         };
         this.hotkey_actions["select_invert"] = () => {
            Headlines.select('invert');
         };
         this.hotkey_actions["select_none"] = () => {
            Headlines.select('none');
         };
         this.hotkey_actions["feed_refresh"] = () => {
            if (typeof Feeds.getActive() != "undefined") {
               Feeds.open({feed: Feeds.getActive(), is_cat: Feeds.activeIsCat()});
            }
         };
         this.hotkey_actions["feed_unhide_read"] = () => {
            Feeds.toggleUnread();
         };
         this.hotkey_actions["feed_subscribe"] = () => {
            CommonDialogs.subscribeToFeed();
         };
         this.hotkey_actions["feed_debug_update"] = () => {
            if (!Feeds.activeIsCat() && parseInt(Feeds.getActive()) > 0) {

               /* global __csrf_token */
               App.postOpenWindow("backend.php", {op: "feeds", method: "updatedebugger",
                  feed_id: Feeds.getActive(), csrf_token: __csrf_token});

            } else {
               alert("You can't debug this kind of feed.");
            }
         };

         this.hotkey_actions["feed_debug_viewfeed"] = () => {
            App.postOpenWindow("backend.php", {op: "feeds", method: "view",
               feed: Feeds.getActive(), timestamps: 1, debug: 1, cat: Feeds.activeIsCat(), csrf_token: __csrf_token});
         };

         this.hotkey_actions["feed_edit"] = () => {
            if (Feeds.activeIsCat())
               alert(__("You can't edit this kind of feed."));
            else
               CommonDialogs.editFeed(Feeds.getActive());
         };
         this.hotkey_actions["feed_catchup"] = () => {
            if (typeof Feeds.getActive() != "undefined") {
               Feeds.catchupCurrent();
            }
         };
         this.hotkey_actions["feed_reverse"] = () => {
            Headlines.reverse();
         };
         this.hotkey_actions["feed_toggle_grid"] = () => {
            xhr.json("backend.php", {op: "rpc", method: "togglepref", key: "CDM_ENABLE_GRID"}, (reply) => {
               App.setInitParam("cdm_enable_grid", reply.value);
               Headlines.renderAgain();
            })
         };
         this.hotkey_actions["feed_toggle_vgroup"] = () => {
            xhr.post("backend.php", {op: "rpc", method: "togglepref", key: "VFEED_GROUP_BY_FEED"}, () => {
               Feeds.reloadCurrent();
            })
         };
         this.hotkey_actions["catchup_all"] = () => {
            Feeds.catchupAll();
         };
         this.hotkey_actions["cat_toggle_collapse"] = () => {
            if (Feeds.activeIsCat()) {
               dijit.byId("feedTree").collapseCat(Feeds.getActive());
            }
         };
         this.hotkey_actions["goto_read"] = () => {
            Feeds.open({feed: -6});
         };
         this.hotkey_actions["goto_all"] = () => {
            Feeds.open({feed: -4});
         };
         this.hotkey_actions["goto_fresh"] = () => {
            Feeds.open({feed: -3});
         };
         this.hotkey_actions["goto_marked"] = () => {
            Feeds.open({feed: -1});
         };
         this.hotkey_actions["goto_published"] = () => {
            Feeds.open({feed: -2});
         };
         this.hotkey_actions["goto_prefs"] = () => {
            App.openPreferences();
         };
         this.hotkey_actions["select_article_cursor"] = () => {
            const id = Article.getUnderPointer();
            if (id) {
               const row = App.byId(`RROW-${id}`);

               if (row)
                  row.toggleClassName("Selected");
            }
         };
         this.hotkey_actions["create_label"] = () => {
            CommonDialogs.addLabel();
         };
         this.hotkey_actions["create_filter"] = () => {
            Filters.edit();
         };
         this.hotkey_actions["collapse_sidebar"] = () => {
            Feeds.toggle();
         };
         this.hotkey_actions["toggle_full_text"] = () => {
            if (typeof Plugins.Af_Readability != "undefined") {
               if (Article.getActive())
                  Plugins.Af_Readability.embed(Article.getActive());
            } else {
               alert(__("Please enable af_readability first."));
            }
         };
         this.hotkey_actions["toggle_widescreen"] = () => {
            if (!this.isCombinedMode()) {
               this._widescreen_mode = !this._widescreen_mode;

               // reset stored sizes because geometry changed
               Cookie.set("ttrss_ci_width", 0);
               Cookie.set("ttrss_ci_height", 0);

               this.setWidescreen(this._widescreen_mode);
            } else {
               alert(__("Widescreen is not available in combined mode."));
            }
         };
         this.hotkey_actions["help_dialog"] = () => {
            this.hotkeyHelp();
         };
         this.hotkey_actions["toggle_combined_mode"] = () => {
            const value = this.isCombinedMode() ? "false" : "true";

            xhr.post("backend.php", {op: "rpc", method: "setpref", key: "COMBINED_DISPLAY_MODE", value: value}, () => {
               this.setInitParam("combined_display_mode",
                  !this.getInitParam("combined_display_mode"));

               Article.close();
               Headlines.renderAgain();
            })
         };
         this.hotkey_actions["toggle_cdm_expanded"] = () => {
            const value = this.getInitParam("cdm_expanded") ? "false" : "true";

            xhr.post("backend.php", {op: "rpc", method: "setpref", key: "CDM_EXPANDED", value: value}, () => {
               this.setInitParam("cdm_expanded", !this.getInitParam("cdm_expanded"));
               Headlines.renderAgain();
            });
         };
         this.hotkey_actions["article_span_grid"] = () => {
            Article.cdmToggleGridSpan(Article.getActive());
         };
      }
   },
   openPreferences: function(tab) {
      document.location.href = "prefs.php" + (tab ? "?tab=" + tab : "");
   },
   onActionSelected: function(opid) {
      switch (opid) {
         case "qmcPrefs":
            App.openPreferences();
            break;
         case "qmcLogout":
            App.postCurrentWindow("public.php", {op: "logout", csrf_token: __csrf_token});
            break;
         case "qmcSearch":
            Feeds.search();
            break;
         case "qmcAddFeed":
            CommonDialogs.subscribeToFeed();
            break;
         case "qmcDigest":
            window.location.href = "backend.php?op=digest";
            break;
         case "qmcEditFeed":
            if (Feeds.activeIsCat())
               alert(__("You can't edit this kind of feed."));
            else
               CommonDialogs.editFeed(Feeds.getActive());
            break;
         case "qmcRemoveFeed":
            {
               const actid = Feeds.getActive();

               if (!actid) {
                  alert(__("Please select some feed first."));
                  return;
               }

               if (Feeds.activeIsCat()) {
                  alert(__("You can't unsubscribe from the category."));
                  return;
               }

               const fn = Feeds.getName(actid);

               if (confirm(__("Unsubscribe from %s?").replace("%s", fn))) {
                  CommonDialogs.unsubscribeFeed(actid);
               }
            }
            break;
         case "qmcCatchupAll":
            Feeds.catchupAll();
            break;
         case "qmcShowOnlyUnread":
            Feeds.toggleUnread();
            break;
         case "qmcToggleWidescreen":
            if (!this.isCombinedMode()) {
               this._widescreen_mode = !this._widescreen_mode;

               // reset stored sizes because geometry changed
               Cookie.set("ttrss_ci_width", 0);
               Cookie.set("ttrss_ci_height", 0);

               this.setWidescreen(this._widescreen_mode);
            } else {
               alert(__("Widescreen is not available in combined mode."));
            }
            break;
         case "qmcHKhelp":
            this.hotkeyHelp()
            break;
         default:
            console.log("quickMenuGo: unknown action: " + opid);
      }
   },
}

