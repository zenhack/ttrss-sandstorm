'use strict'

/* eslint-disable no-new */
/* global __, ngettext, App, Headlines, xhr, dojo, dijit, PluginHost, Notify, fox */

const Article = {
	_scroll_reset_timeout: false,
	getScoreClass: function (score) {
		if (score > 500) {
			return "score-high";
		} else if (score > 0) {
			return "score-half-high";
		} else if (score < -100) {
			return "score-low";
		} else if (score < 0) {
			return "score-half-low";
		} else {
			return "score-neutral";
		}
	},
	getScorePic: function (score) {
		if (score > 500) {
			return "trending_up";
		} else if (score > 0) {
			return "trending_up";
		} else if (score < 0) {
			return "trending_down";
		} else {
			return "trending_neutral";
		}
	},
	selectionSetScore: function () {
		const ids = Headlines.getSelected();

		if (ids.length > 0) {
			const score = prompt(__("Please enter new score for selected articles:"));

			if (!isNaN(parseInt(score))) {
				ids.forEach((id) => {
					const row = App.byId(`RROW-${id}`);

					if (row) {
						row.setAttribute("data-score", score);

						const pic = row.querySelector(".icon-score");

						pic.innerHTML = Article.getScorePic(score);
						pic.setAttribute("title", score);

						["score-low", "score-high", "score-half-low", "score-half-high", "score-neutral"]
							.forEach(function(scl) {
								if (row.hasClassName(scl))
									row.removeClassName(scl);
							});

						row.addClassName(Article.getScoreClass(score));
					}
				});
			}

		} else {
			alert(__("No articles selected."));
		}
	},
	setScore: function (id, pic) {
		const row = pic.closest("div[id*=RROW]");

		if (row) {
			const score_old = row.getAttribute("data-score");
			const score = prompt(__("Please enter new score for this article:"), score_old);

			if (!isNaN(parseInt(score))) {
				row.setAttribute("data-score", score);

				const pic = row.querySelector(".icon-score");

				pic.innerHTML = Article.getScorePic(score);
				pic.setAttribute("title", score);

				["score-low", "score-high", "score-half-low", "score-half-high", "score-neutral"]
					.forEach(function(scl) {
						if (row.hasClassName(scl))
							row.removeClassName(scl);
					});

				row.addClassName(Article.getScoreClass(score));
			}
		}
	},
	popupOpenUrl: function(url) {
		const w = window.open("");

		w.opener = null;
		w.location = url;
	},
	cdmToggleGridSpan: function(id) {
		const row = App.byId(`RROW-${id}`);

		if (row) {
			row.toggleClassName('grid-span-row');

			this.setActive(id);
			this.cdmMoveToId(id);
		}
	},
	cdmUnsetActive: function (event) {
		const row = App.byId(`RROW-${Article.getActive()}`);

		if (row) {
			row.removeClassName("active");

			if (event)
				event.stopPropagation();

			return false;
		}
	},
	close: function () {
		if (dijit.byId("content-insert"))
			dijit.byId("headlines-wrap-inner").removeChild(
				dijit.byId("content-insert"));

		Article.setActive(0);
	},
	displayUrl: function (id) {
		const query = {op: "article", method: "getmetadatabyid", id: id};

		xhr.json("backend.php", query, (reply) => {
			if (reply && reply.link) {
				prompt(__("Article URL:"), reply.link);
			} else {
				alert(__("No URL could be displayed for this article."));
			}
		});
	},
	openInNewWindow: function (id) {
		/* global __csrf_token */
		App.postOpenWindow("backend.php",
			{ "op": "article", "method": "redirect", "id": id, "csrf_token": __csrf_token });

		Headlines.toggleUnread(id, 0);
	},
	renderNote: function (id, note) {
		return `<div class="article-note" data-note-for="${id}" style="display : ${note ? "" : "none"}">
				${App.FormFields.icon('note')} <div onclick class='body'>${note ? App.escapeHtml(note) : ""}</div>
			</div>`;
	},
	renderTags: function (id, tags) {
		const tags_short = tags.length > 5 ? tags.slice(0, 5) : tags;

		return `<span class="tags" title="${tags.join(", ")}" data-tags-for="${id}">
			${tags_short.length > 0 ? tags_short.map((tag) => `
				<a href="#" onclick="Feeds.open({feed: '${tag.trim()}'})" class="tag">${tag}</a>`
			).join(", ") : `${__("no tags")}`}</span>`;
	},
	renderLabels: function(id, labels) {
		return `<span class="labels" data-labels-for="${id}">
			${labels.map((label) => `
				<a href="#" class="label" data-label-id="${label[0]}"
					style="color : ${label[2]}; background-color : ${label[3]}"
					onclick="event.stopPropagation(); Feeds.open({feed:'${label[0]}'})">
						${App.escapeHtml(label[1])}
				</a>`
			).join("")}
		</span>`;
	},
	renderEnclosures: function (enclosures) {
		return `
				${enclosures.formatted}
				${enclosures.can_inline ?
					`<div class='attachments-inline'>
						${enclosures.entries.map((enc) => {
							if (!enclosures.inline_text_only) {
								if (enc.content_type && enc.content_type.indexOf("image/") != -1) {
									return `<p>
										<img loading="lazy"
											width="${enc.width ? enc.width : ''}"
											height="${enc.height ? enc.height : ''}"
											src="${App.escapeHtml(enc.content_url)}"
											title="${App.escapeHtml(enc.title ? enc.title : enc.content_url)}"/>
									</p>`
								} else if (enc.content_type && enc.content_type.indexOf("audio/") != -1 && App.audioCanPlay(enc.content_type)) {
									return `<p class='inline-player' title="${App.escapeHtml(enc.content_url)}">
										<audio preload="none" controls="controls">
											<source type="${App.escapeHtml(enc.content_type)}" src="${App.escapeHtml(enc.content_url)}"/>
										</audio>
									</p>
									`;
								} else {
									return `<p>
										<a target="_blank" href="${App.escapeHtml(enc.content_url)}"
											title="${App.escapeHtml(enc.title ? enc.title : enc.content_url)}"
											rel="noopener noreferrer">${App.escapeHtml(enc.content_url)}</a>
										</p>`
								}
							} else {
								return `<p>
									<a target="_blank" href="${App.escapeHtml(enc.content_url)}"
										title="${App.escapeHtml(enc.title ? enc.title : enc.content_url)}"
										rel="noopener noreferrer">${App.escapeHtml(enc.content_url)}</a>
									</p>`
							}
						}).join("")}
					</div>` : ''}
			${enclosures.entries.length > 0 ?
				`<div class="attachments" dojoType="fox.form.DropDownButton">
					<span>${__('Attachments')}</span>
					<div dojoType="dijit.Menu" style="display: none">
					${enclosures.entries.map((enc) => `
							<div onclick='Article.popupOpenUrl("${App.escapeHtml(enc.content_url)}")'
								title="${App.escapeHtml(enc.title ? enc.title : enc.content_url)}" dojoType="dijit.MenuItem">
									${enc.title ? enc.title : enc.filename}
							</div>
						`).join("")}
					</div>
				</div>` : ''}
			`
	},
	render: function (article) {
		App.cleanupMemory("content-insert");

		dijit.byId("headlines-wrap-inner").addChild(
			dijit.byId("content-insert"));

		const c = dijit.byId("content-insert");

		try {
			c.domNode.scrollTop = 0;
		} catch (e) {
		}

		c.attr('content', article);
		PluginHost.run(PluginHost.HOOK_ARTICLE_RENDERED, c.domNode);

		//Headlines.correctHeadlinesOffset(Article.getActive());

		try {
			c.focus();
		} catch (e) {
		}
	},
	formatComments: function(hl) {
		let comments = "";

		if (hl.comments || hl.num_comments > 0) {
			let comments_msg = __("comments");

			if (hl.num_comments > 0) {
				comments_msg = hl.num_comments + " " + ngettext("comment", "comments", hl.num_comments)
			}

			comments = `<a target="_blank" rel="noopener noreferrer" href="${App.escapeHtml(hl.comments ? hl.comments : hl.link)}">(${comments_msg})</a>`;
		}

		return comments;
	},
	unpack: function(row) {
		if (row.getAttribute("data-is-packed") == "1") {
			console.log("unpacking: " + row.id);

			const container = row.querySelector(".content-inner");

			container.innerHTML = row.getAttribute("data-content").trim() + row.getAttribute("data-rendered-enclosures").trim();

			dojo.parser.parse(container);

			// blank content element might screw up onclick selection and keyboard moving
			if (container.textContent.length == 0)
				container.innerHTML += "&nbsp;";

			// in expandable mode, save content for later, so that we can pack unfocused rows back
			if (App.isCombinedMode() && App.byId("main").hasClassName("expandable"))
				row.setAttribute("data-content-original", row.getAttribute("data-content"));

			row.setAttribute("data-is-packed", "0");

			PluginHost.run(PluginHost.HOOK_ARTICLE_RENDERED_CDM, row);
		}
	},
	pack: function(row) {
		if (row.getAttribute("data-is-packed") != "1") {
			console.log("packing", row.id);
			row.setAttribute("data-is-packed", "1");

			const content_inner = row.querySelector(".content-inner");

			// missing in unexpanded mode
			if (content_inner)
				content_inner.innerHTML = `<div class="text-center text-muted">
					${__("Loading, please wait...")}
				</div>`
		}
	},
	view: function (id, no_expand) {
		this.setActive(id);
		Headlines.scrollToArticleId(id);

		if (!no_expand) {
			const hl = Headlines.objectById(id);

			if (hl) {

				const comments = this.formatComments(hl);

				const article = `<div class="post post-${hl.id}" data-article-id="${hl.id}">
					<div class="header">
						<div class="row">
							<div class="title"><a target="_blank" rel="noopener noreferrer"
								title="${App.escapeHtml(hl.title)}"
								href="${App.escapeHtml(hl.link)}">${hl.title}</a></div>
							<div class="date">${hl.updated_long}</div>
						</div>
						<div class="row">
							<div class="buttons left">${hl.buttons_left}</div>
							<div class="comments">${comments}</div>
							<div class="author">${hl.author}</div>
							<i class="material-icons">label_outline</i>
							${Article.renderTags(hl.id, hl.tags)}
							&nbsp;<a title="${__("Edit tags for this article")}" href="#"
								onclick="Article.editTags(${hl.id})">(+)</a>
							<div class="buttons right">${hl.buttons}</div>
						</div>
					</div>
					${Article.renderNote(hl.id, hl.note)}
					<div class="content" lang="${hl.lang ? hl.lang : 'en'}">
						${hl.content}
						${Article.renderEnclosures(hl.enclosures)}
					</div>
					</div>`;

				Headlines.toggleUnread(id, 0);
				this.render(article);
			}
		}

		return false;
	},
	editTags: function (id) {
		const dialog = new fox.SingleUseDialog({
			title: __("Article tags"),
			content: `
				${App.FormFields.hidden_tag("id", id.toString())}
				${App.FormFields.hidden_tag("op", "article")}
				${App.FormFields.hidden_tag("method", "setArticleTags")}

				<header class='horizontal'>
					${__("Tags for this article (separated by commas):")}
				</header>

				<section>
					<textarea dojoType='dijit.form.SimpleTextarea' rows='4' disabled='true'
						id='tags_str' name='tags_str'>${__("Loading, please wait...")}</textarea>
					<div class='autocomplete' id='tags_choices' style='display:none'></div>
				</section>

				<footer>
					<button dojoType='dijit.form.Button' type='submit' class='alt-primary'>
						${__('Save')}
					</button>
					<button dojoType='dijit.form.Button' onclick='App.dialogOf(this).hide()'>
						${__('Cancel')}
					</button>
				</footer>
			`,
			execute: function () {
				if (this.validate()) {
					Notify.progress("Saving article tags...", true);

					xhr.json("backend.php", this.attr('value'), (data) => {
						try {
							Notify.close();
							dialog.hide();

							Headlines.onTagsUpdated(data);
						} catch (e) {
							App.Error.report(e);
						}
					});
				}
			},
		});

		const tmph = dojo.connect(dialog, 'onShow', function () {
			dojo.disconnect(tmph);

			xhr.json("backend.php", {op: "article", method: "printArticleTags", id: id}, (reply) => {

				dijit.getEnclosingWidget(App.byId("tags_str"))
					.attr('value', reply.tags.join(", "))
					.attr('disabled', false);

				/* new Ajax.Autocompleter("tags_str", "tags_choices",
					"backend.php?op=article&method=completeTags",
					{tokens: ',', paramName: "search"}); */
			});
		});

		dialog.show();

	},
	cdmMoveToId: function (id, params = {}) {
		const force_to_top = params.force_to_top || false;

		const ctr = App.byId("headlines-frame");
		const row = App.byId(`RROW-${id}`);

		if (ctr && row) {
			const grid_gap = parseInt(window.getComputedStyle(ctr).gridGap) || 0;

			if (force_to_top || !App.Scrollable.fitsInContainer(row, ctr)) {
				ctr.scrollTop = row.offsetTop - grid_gap;
			}
		}
	},
	setActive: function (id) {
		if (id != Article.getActive()) {
			console.log("setActive", id, "was", Article.getActive());

			App.findAll("div[id*=RROW][class*=active]").forEach((row) => {
				row.removeClassName("active");

				if (App.isCombinedMode() && !App.getInitParam("cdm_expanded"))
					Article.pack(row);
			});

			const row = App.byId(`RROW-${id}`);

			if (row) {
				Article.unpack(row);

				row.removeClassName("Unread");
				row.addClassName("active");

				PluginHost.run(PluginHost.HOOK_ARTICLE_SET_ACTIVE, row.getAttribute("data-article-id"));
			}
		}
	},
	getActive: function () {
		const row = document.querySelector("#headlines-frame > div[id*=RROW][class*=active]");

		if (row)
			return row.getAttribute("data-article-id");
		else
			return 0;
	},
	scrollByPages: function (page_offset) {
		App.Scrollable.scrollByPages(App.byId("content-insert"), page_offset);
	},
	scroll: function (offset) {
		App.Scrollable.scroll(App.byId("content-insert"), offset);
	},
	mouseIn: function (id) {
		this.post_under_pointer = id;
	},
	mouseOut: function (/* id */) {
		this.post_under_pointer = false;
	},
	getUnderPointer: function () {
		return this.post_under_pointer;
	}
}
