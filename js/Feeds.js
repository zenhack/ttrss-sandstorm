'use strict'

/* global __, App, Headlines, xhr, dojo, dijit, fox, PluginHost, Notify, fox */

const	Feeds = {
	_default_feed_id: -3,
	counters_last_request: 0,
	_active_feed_id: undefined,
	_active_feed_is_cat: false,
	infscroll_in_progress: 0,
	infscroll_disabled: 0,
	_infscroll_timeout: false,
	_search_query: false,
	last_search_query: [],
	_viewfeed_wait_timeout: false,
	_feeds_holder_observer: new IntersectionObserver(
		(entries/*, observer*/) => {
			entries.forEach((entry) => {
				//console.log('feeds',entry.target, entry.intersectionRatio);

				if (entry.intersectionRatio == 0)
					Feeds.onHide(entry);
				else
					Feeds.onShow(entry);
			});
		},
		{threshold: [0, 1], root: document.querySelector("body")}
	),
	_counters_prev: [],
	// NOTE: this implementation is incomplete
	// for general objects but good enough for counters
	// http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html
	counterEquals: function(a, b) {
		// Create arrays of property names
		const aProps = Object.getOwnPropertyNames(a);
		const bProps = Object.getOwnPropertyNames(b);

		// If number of properties is different,
		// objects are not equivalent
		if (aProps.length != bProps.length) {
			return false;
		}

		for (let i = 0; i < aProps.length; i++) {
			const propName = aProps[i];

			// If values of same property are not equal,
			// objects are not equivalent
			if (a[propName] !== b[propName]) {
				return false;
			}
		}

		// If we made it this far, objects
		// are considered equivalent
		return true;
	},
	resetCounters: function () {
		this._counters_prev = [];
	},
	parseCounters: function (elems) {
		PluginHost.run(PluginHost.HOOK_COUNTERS_RECEIVED, elems);

		for (let l = 0; l < elems.length; l++) {

			if (Feeds._counters_prev[l] && this.counterEquals(elems[l], this._counters_prev[l])) {
				continue;
			}

			const id = elems[l].id;
			const kind = elems[l].kind;
			const ctr = parseInt(elems[l].counter);
			const error = elems[l].error;
			const has_img = elems[l].has_img;
			const updated = elems[l].updated;

			if (id == "global-unread") {
				App.global_unread = ctr;
				App.updateTitle();
				continue;
			}

			if (id == "subscribed-feeds") {
				/* feeds_found = ctr; */
				continue;
			}

			/*if (this.getUnread(id, (kind == "cat")) != ctr ||
					(kind == "cat")) {
			}*/

			this.setUnread(id, (kind == "cat"), ctr);
			this.setValue(id, (kind == "cat"), 'auxcounter', parseInt(elems[l].auxcounter));
			this.setValue(id, (kind == "cat"), 'markedcounter', parseInt(elems[l].markedcounter));

			if (kind != "cat") {
				this.setValue(id, false, 'error', error);
				this.setValue(id, false, 'updated', updated);

				if (id > 0) {
					if (has_img) {
						this.setIcon(id, false,
							App.getInitParam("icons_url") + "/" + id + ".ico?" + has_img);
					} else {
						this.setIcon(id, false, 'images/blank_icon.gif');
					}
				}
			}
		}

		Headlines.updateCurrentUnread();

		this.hideOrShowFeeds(App.getInitParam("hide_read_feeds"));
		this._counters_prev = elems;

		PluginHost.run(PluginHost.HOOK_COUNTERS_PROCESSED, elems);
	},
	reloadCurrent: function(method) {
		if (this.getActive() != undefined) {
			console.log("reloadCurrent", this.getActive(), this.activeIsCat(), method);

			this.open({feed: this.getActive(), is_cat: this.activeIsCat(), method: method});
		}
	},
	openDefaultFeed: function() {
		this.open({feed: this._default_feed_id});
	},
   onViewModeChanged: function() {
		// TODO: is this still needed?
      App.find("body").setAttribute("view-mode",
			dijit.byId("toolbar-main").getValues().view_mode);

      return Feeds.reloadCurrent('');
   },
	openNextUnread: function() {
		const [feed, is_cat] = this.getNextUnread(this.getActive(), this.activeIsCat());

		if (feed !== false)
			this.open({feed: feed, is_cat: is_cat});
	},
	toggle: function() {
		Element.toggle("feeds-holder");
	},
	cancelSearch: function() {
		this._search_query = "";
		this.reloadCurrent();
	},
	// null = get all data, [] would give empty response for specific type
	requestCounters: function(feed_ids = null, label_ids = null) {
		xhr.json("backend.php", {op: "rpc",
							method: "getAllCounters",
							"feed_ids[]": feed_ids,
							"feed_id_count": feed_ids ? feed_ids.length : -1,
							"label_ids[]": label_ids,
							"label_id_count": label_ids ? label_ids.length : -1,
							seq: App.next_seq()});
	},
	reload: function() {
		try {
			Element.show("feedlistLoading");

			this.resetCounters();

			if (dijit.byId("feedTree")) {
				dijit.byId("feedTree").destroyRecursive();
			}

			const store = new dojo.data.ItemFileWriteStore({
				url: "backend.php?op=pref_feeds&method=getfeedtree&mode=2"
			});

			// noinspection JSUnresolvedFunction
			const treeModel = new fox.FeedStoreModel({
				store: store,
				query: {
					"type": App.getInitParam('enable_feed_cats') ? "category" : "feed"
				},
				rootId: "root",
				rootLabel: "Feeds",
				childrenAttrs: ["items"]
			});

			// noinspection JSUnresolvedFunction
			const tree = new fox.FeedTree({
				model: treeModel,
				onClick: function (item/*, node*/) {
					const id = String(item.id);
					const is_cat = id.match("^CAT:");
					const feed = id.substr(id.indexOf(":") + 1);
					Feeds.open({feed: feed, is_cat: is_cat});
					return false;
				},
				openOnClick: false,
				showRoot: false,
				persist: true,
				id: "feedTree",
			}, "feedTree");

			const tmph = dojo.connect(dijit.byId('feedMenu'), '_openMyself', function (event) {
				console.log(dijit.getEnclosingWidget(event.target));
				dojo.disconnect(tmph);
			});

			App.byId("feeds-holder").appendChild(tree.domNode);

			const tmph2 = dojo.connect(tree, 'onLoad', function () {
				dojo.disconnect(tmph2);
				Element.hide("feedlistLoading");

				try {
					Feeds.init();
					App.setLoadingProgress(25);
				} catch (e) {
					App.Error.report(e);
				}
			});

			tree.startup();
		} catch (e) {
			App.Error.report(e);
		}
	},
	onHide: function() {
		App.byId("feeds-holder_splitter").hide();

		dijit.byId("main").resize();
		Headlines.updateCurrentUnread();
	},
	onShow: function() {
		App.byId("feeds-holder_splitter").show();

		dijit.byId("main").resize();
		Headlines.updateCurrentUnread();
	},
	init: function() {
		console.log("in feedlist init");

		this._feeds_holder_observer.observe(App.byId("feeds-holder"));

		App.setLoadingProgress(50);

		//document.onkeydown = (event) => { return App.hotkeyHandler(event) };
		//document.onkeypress = (event) => { return App.hotkeyHandler(event) };
		window.onresize = () => { Headlines.scrollHandler(); }

		const hash = App.Hash.get();

		console.log('got hash', hash);

		if (hash.f != undefined) {
			this.open({feed: parseInt(hash.f), is_cat: parseInt(hash.c)});
		} else {
			this.openDefaultFeed();
		}

		this.hideOrShowFeeds(App.getInitParam("hide_read_feeds"));

		if (App.getInitParam("is_default_pw")) {
			console.warn("user password is at default value");

			const dialog = new fox.SingleUseDialog({
				title: __("Your password is at default value"),
				content: `<div class='alert alert-error'>
					${__("You are using default tt-rss password. Please change it in the Preferences (Personal data / Authentication).")}
				</div>

				<footer class='text-center'>
					<button dojoType='dijit.form.Button' class='alt-primary' onclick="document.location.href = 'prefs.php'">
						${__('Open Preferences')}
					</button>
					<button dojoType='dijit.form.Button' onclick="App.dialogOf(this).hide()">
						${__('Close this window')}
					</button>
				</footer>`
			});

			dialog.show();
		}

		if (App.getInitParam("safe_mode")) {
			const dialog = new fox.SingleUseDialog({
				title: __("Safe mode"),
				content: `<div class='alert alert-info'>
						${__('Tiny Tiny RSS is running in safe mode. All themes and plugins are disabled. You will need to log out and back in to disable it.')}
					</div>
					<footer class='text-center'>
						<button dojoType='dijit.form.Button' type='submit' class='alt-primary'>
							${__('Close this window')}
						</button>
					</footer>`
			});

			dialog.show();
		}

		// bw_limit disables timeout() so we request initial counters separately
		if (App.getInitParam("bw_limit")) {
			this.requestCounters();
		} else {
			setTimeout(() => {
				this.requestCounters();
				setInterval(() => { this.requestCounters(); }, 60 * 1000)
			}, 250);
		}
	},
	activeIsCat: function() {
		return !!this._active_feed_is_cat;
	},
	getActive: function() {
		return this._active_feed_id;
	},
	setActive: function(id, is_cat) {
		console.log('setActive', id, is_cat);

		window.requestIdleCallback(() => {
			App.Hash.set({f: id, c: is_cat ? 1 : 0});
		});

		this._active_feed_id = id;
		this._active_feed_is_cat = is_cat;

		const container = App.byId("headlines-frame");

		// TODO @deprecated: these two should be removed (replaced with data- attributes below)
		container.setAttribute("feed-id", id);
		container.setAttribute("is-cat", is_cat ? 1 : 0);
		// ^

		container.setAttribute("data-feed-id", id);
		container.setAttribute("data-is-cat", is_cat ? "true" : "false");

		this.select(id, is_cat);

		PluginHost.run(PluginHost.HOOK_FEED_SET_ACTIVE, [this._active_feed_id, this._active_feed_is_cat]);
	},
	select: function(feed, is_cat) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.selectFeed(feed, is_cat);
	},
	toggleUnread: function() {
		const hide = !App.getInitParam("hide_read_feeds");

		xhr.post("backend.php", {op: "rpc", method: "setpref", key: "HIDE_READ_FEEDS", value: hide}, () => {
			this.hideOrShowFeeds(hide);
			App.setInitParam("hide_read_feeds", hide);
		});
	},
	hideOrShowFeeds: function (hide) {
		/*const tree = dijit.byId("feedTree");

		if (tree)
			return tree.hideRead(hide, App.getInitParam("hide_read_shows_special"));*/

		App.findAll("body")[0].setAttribute("hide-read-feeds", !!hide);
		App.findAll("body")[0].setAttribute("hide-read-shows-special", !!App.getInitParam("hide_read_shows_special"));
	},
	open: function(params) {
		const feed = params.feed;
		const is_cat = !!params.is_cat || false;
		const offset = params.offset || 0;
		const append = params.append || false;
		const method = params.method;
		// this is used to quickly switch between feeds, sets active but xhr is on a timeout
		const delayed = params.delayed || false;

		if (offset != 0) {
			if (this.infscroll_in_progress)
				return;

			this.infscroll_in_progress = 1;

			window.clearTimeout(this._infscroll_timeout);
			this._infscroll_timeout = window.setTimeout(() => {
				console.log('infscroll request timed out, aborting');
				this.infscroll_in_progress = 0;

				// call scroll handler to maybe repeat infscroll request
				Headlines.scrollHandler();
			}, 10 * 1000);
		}

		let query = {...{op: "feeds", method: "view", feed: feed}, ...dojo.formToObject("toolbar-main")};

		if (method) query.m = method;

		if (offset > 0) {
			if (Headlines.current_first_id) {
				query.fid = Headlines.current_first_id;
			}
		}

		if (this._search_query) {
			query = Object.assign(query, this._search_query);
		}

		if (offset != 0) {
			query.skip = offset;
		} else if (!is_cat && feed == this.getActive() && !params.method) {
			query.m = "ForceUpdate";
		}

		query.cat = is_cat;

		this.setActive(feed, is_cat);

		window.clearTimeout(this._viewfeed_wait_timeout);
		this._viewfeed_wait_timeout = window.setTimeout(() => {

			this.showLoading(feed, is_cat, true);
			//Notify.progress("Loading, please wait...", true);*/

			xhr.json("backend.php", query, (reply) => {
				try {
					window.clearTimeout(this._infscroll_timeout);
					this.showLoading(feed, is_cat, false);
					Headlines.onLoaded(reply, offset, append);
					PluginHost.run(PluginHost.HOOK_FEED_LOADED, [feed, is_cat]);
				} catch (e) {
					App.Error.report(e);
				}
			});
		}, delayed ? 250 : 0);
	},
	catchupAll: function() {
		const str = __("Mark all articles as read?");

		if (App.getInitParam("confirm_feed_catchup") != 1 || confirm(str)) {

			Notify.progress("Marking all feeds as read...");

			xhr.json("backend.php", {op: "feeds", method: "catchupAll"}, () => {
				this.reloadCurrent();
			});

			App.global_unread = 0;
			App.updateTitle();
		}
	},
	catchupFeed: function(feed, is_cat, mode) {
		is_cat = is_cat || false;

		let str = false;

		switch (mode) {
			case "1day":
				str = __("Mark %w in %s older than 1 day as read?");
				break;
			case "1week":
				str = __("Mark %w in %s older than 1 week as read?");
				break;
			case "2week":
				str = __("Mark %w in %s older than 2 weeks as read?");
				break;
			default:
				str = __("Mark %w in %s as read?");
		}

		const mark_what = this.last_search_query && this.last_search_query[0] ? __("search results") : __("all articles");
		const fn = this.getName(feed, is_cat);

		str = str.replace("%s", fn)
			.replace("%w", mark_what);

		if (App.getInitParam("confirm_feed_catchup") && !confirm(str)) {
			return;
		}

		const catchup_query = {
			op: 'rpc', method: 'catchupFeed', feed_id: feed,
			is_cat: is_cat, mode: mode, search_query: this.last_search_query[0],
			search_lang: this.last_search_query[1]
		};

		Notify.progress("Loading, please wait...", true);

		xhr.json("backend.php", catchup_query, () => {
			const show_next_feed = App.getInitParam("on_catchup_show_next_feed");

			// only select next unread feed if catching up entirely (as opposed to last week etc)
			if (show_next_feed && !mode) {
				const [next_feed, next_is_cat] = this.getNextUnread(feed, is_cat);

				if (next_feed !== false) {
					this.open({feed: next_feed, is_cat: next_is_cat});
				}
			} else if (feed == this.getActive() && is_cat == this.activeIsCat()) {
				this.reloadCurrent();
			}

			Notify.close();
		});
	},
	catchupCurrent: function(mode) {
		this.catchupFeed(this.getActive(), this.activeIsCat(), mode);
	},
	catchupFeedInGroup: function(id) {
		const title = this.getName(id);

		const str = __("Mark all articles in %s as read?").replace("%s", title);

		if (App.getInitParam("confirm_feed_catchup") != 1 || confirm(str)) {

			const rows = App.findAll("#headlines-frame > div[id*=RROW][class*=Unread][data-orig-feed-id='" + id + "']");

			rows.forEach((row) => {
				row.removeClassName("Unread");
			})
		}
	},
	getUnread: function(feed, is_cat) {
		try {
			const tree = dijit.byId("feedTree");

			if (tree && tree.model)
				return tree.model.getFeedUnread(feed, is_cat);

		} catch (e) {
			//
		}

		return -1;
	},
	getCategory: function(feed) {
		try {
			const tree = dijit.byId("feedTree");

			if (tree && tree.model)
				return tree.getFeedCategory(feed);

		} catch (e) {
			//
		}

		return false;
	},
	getName: function(feed, is_cat) {
		if (isNaN(feed)) return feed; // it's a tag

		const tree = dijit.byId("feedTree");

		if (tree && tree.model)
			return tree.model.getFeedValue(feed, is_cat, 'name');
	},
	setUnread: function(feed, is_cat, unread) {
		const tree = dijit.byId("feedTree");

		if (tree && tree.model)
			return tree.model.setFeedUnread(feed, is_cat, unread);
	},
	setValue: function(feed, is_cat, key, value) {
		try {
			const tree = dijit.byId("feedTree");

			if (tree && tree.model)
				return tree.model.setFeedValue(feed, is_cat, key, value);

		} catch (e) {
			//
		}
	},
	getValue: function(feed, is_cat, key) {
		try {
			const tree = dijit.byId("feedTree");

			if (tree && tree.model)
				return tree.model.getFeedValue(feed, is_cat, key);

		} catch (e) {
			//
		}
		return '';
	},
	setIcon: function(feed, is_cat, src) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.setIcon(feed, is_cat, src);
	},
	showLoading: function(feed, is_cat, show) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.showLoading(feed, is_cat, show);

		return false;
	},
	getNextFeed: function(feed, is_cat) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.getNextFeed(feed, is_cat, false);

		return [false, false];
	},
	getPreviousFeed: function(feed, is_cat) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.getPreviousFeed(feed, is_cat);

		return [false, false];
	},
	getNextUnread: function(feed, is_cat) {
		const tree = dijit.byId("feedTree");

		if (tree) return tree.getNextUnread(feed, is_cat);

		return [false, false];
	},
	search: function() {
		xhr.json("backend.php",
					{op: "feeds", method: "search"},
					(reply) => {
						try {
							const dialog = new fox.SingleUseDialog({
								content: `
									<form onsubmit='return false'>
										<section>
											<fieldset>
												<input dojoType='dijit.form.ValidationTextBox' id='search_query'
													style='font-size : 16px; width : 540px;'
													placeHolder="${__("Search %s...").replace("%s", Feeds.getName(Feeds.getActive(), Feeds.activeIsCat()))}"
													name='query' type='search' value=''>
											</fieldset>

											${reply.show_language ?
												`
												<fieldset>
													<label class='inline'>${__("Language:")}</label>
													${App.FormFields.select_tag("search_language", reply.default_language, reply.all_languages,
															{title: __('Used for word stemming')}, "search_language")}
												</fieldset>
												` : ''}
										</section>

										<footer>
											${reply.show_syntax_help ?
												`${App.FormFields.button_tag(App.FormFields.icon("help") + " " + __("Search syntax"), "",
													{class: 'alt-info pull-left', onclick: "window.open('https://tt-rss.org/wiki/SearchSyntax')"})}
													` : ''}

											${App.FormFields.submit_tag(App.FormFields.icon("search") + " " + __('Search'), {onclick: "App.dialogOf(this).execute()"})}
											${App.FormFields.cancel_dialog_tag(__('Cancel'))}
										</footer>
									</form>
								`,
								title: __("Search"),
								execute: function () {
									if (this.validate()) {
										Feeds._search_query = this.attr('value');

										// disallow empty queries
										if (!Feeds._search_query.query)
											Feeds._search_query = false;

										this.hide();
										Feeds.reloadCurrent();
									}
								},
							});

							const tmph = dojo.connect(dialog, 'onShow', function () {
								dojo.disconnect(tmph);

								if (Feeds._search_query) {
									if (Feeds._search_query.query)
										dijit.byId('search_query')
											.attr('value', Feeds._search_query.query);

									if (Feeds._search_query.search_language)
										dijit.byId('search_language')
											.attr('value', Feeds._search_query.search_language);
								}
							});

							dialog.show();
						} catch (e) {
							App.Error.report(e);
						}
					});

	},
	updateRandom: function() {
		console.log("in update_random_feed");

		xhr.json("backend.php", {op: "rpc", method: "updaterandomfeed"}, () => {
			//
		});
	},
	renderIcon: function(feed_id, exists) {
		return feed_id && exists ?
			`<img class="icon" src="${App.escapeHtml(App.getInitParam("icons_url"))}/${feed_id}.ico">` :
				`<i class='icon-no-feed material-icons'>rss_feed</i>`;
	}
};
