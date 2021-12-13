<?php
class Pref_Feeds extends Handler_Protected {
	const E_ICON_FILE_TOO_LARGE = 'E_ICON_FILE_TOO_LARGE';
	const E_ICON_RENAME_FAILED = 'E_ICON_RENAME_FAILED';
	const E_ICON_UPLOAD_FAILED = 'E_ICON_UPLOAD_FAILED';
	const E_ICON_UPLOAD_SUCCESS = 'E_ICON_UPLOAD_SUCCESS';

	function csrf_ignore(string $method): bool {
		$csrf_ignored = array("index", "getfeedtree", "savefeedorder");

		return array_search($method, $csrf_ignored) !== false;
	}

	/**
	 * @return array<int, string>
	 */
	public static function get_ts_languages(): array {
		if (Config::get(Config::DB_TYPE) == 'pgsql') {
			return array_map('ucfirst',
				array_column(ORM::for_table('pg_ts_config')->select('cfgname')->find_array(), 'cfgname'));
		}

		return [];
	}

	function renameCat(): void {
		$cat = ORM::for_table("ttrss_feed_categories")
			->where("owner_uid", $_SESSION["uid"])
			->find_one($_REQUEST['id']);

		$title = clean($_REQUEST['title']);

		if ($cat && $title) {
			$cat->title = $title;
			$cat->save();
		}
	}

	/**
	 * @return array<int, array<string, bool|int|string>>
	 */
	private function get_category_items(int $cat_id): array {

		if (clean($_REQUEST['mode'] ?? 0) != 2)
			$search = $_SESSION["prefs_feed_search"] ?? "";
		else
			$search = "";

		// first one is set by API
		$show_empty_cats = self::_param_to_bool($_REQUEST['force_show_empty'] ?? false) ||
			(clean($_REQUEST['mode'] ?? 0) != 2 && !$search);

		$items = [];

		$feed_categories = ORM::for_table('ttrss_feed_categories')
			->select_many('id', 'title')
			->where(['owner_uid' => $_SESSION['uid'], 'parent_cat' => $cat_id])
			->order_by_asc('order_id')
			->order_by_asc('title')
			->find_many();

		foreach ($feed_categories as $feed_category) {
			$cat = [
				'id' => 'CAT:' . $feed_category->id,
				'bare_id' => (int)$feed_category->id,
				'name' => $feed_category->title,
				'items' => $this->get_category_items($feed_category->id),
				'checkbox' => false,
				'type' => 'category',
				'unread' => -1,
				'child_unread' => -1,
				'auxcounter' => -1,
				'parent_id' => $cat_id,
			];

			$num_children = $this->calculate_children_count($cat);
			$cat['param'] = sprintf(_ngettext('(%d feed)', '(%d feeds)', (int) $num_children), $num_children);

			if ($num_children > 0 || $show_empty_cats)
				array_push($items, $cat);
		}

		$feeds_obj = ORM::for_table('ttrss_feeds')
			->select_many('id', 'title', 'last_error', 'update_interval')
			->select_expr(SUBSTRING_FOR_DATE.'(last_updated,1,19)', 'last_updated')
			->where(['cat_id' => $cat_id, 'owner_uid' => $_SESSION['uid']])
			->order_by_asc('order_id')
			->order_by_asc('title');

		if ($search) {
			$feeds_obj->where_raw('(LOWER(title) LIKE ? OR LOWER(feed_url) LIKE LOWER(?))', ["%$search%", "%$search%"]);
		}

		foreach ($feeds_obj->find_many() as $feed) {
			array_push($items, [
				'id' => 'FEED:' . $feed->id,
				'bare_id' => (int) $feed->id,
				'auxcounter' => -1,
				'name' => $feed->title,
				'checkbox' => false,
				'unread' => -1,
				'error' => $feed->last_error,
				'icon' => Feeds::_get_icon($feed->id),
				'param' => TimeHelper::make_local_datetime($feed->last_updated, true),
				'updates_disabled' => (int)($feed->update_interval < 0),
			]);
		}

		return $items;
	}

	function getfeedtree(): void {
		print json_encode($this->_makefeedtree());
	}

	/**
	 * @return array<string, array<int|string, mixed>|string>
	 */
	function _makefeedtree(): array {

		if (clean($_REQUEST['mode'] ?? 0) != 2)
			$search = $_SESSION["prefs_feed_search"] ?? "";
		else
			$search = "";

		$root = array();
		$root['id'] = 'root';
		$root['name'] = __('Feeds');
		$root['items'] = array();
		$root['param'] = 0;
		$root['type'] = 'category';

		$enable_cats = get_pref(Prefs::ENABLE_FEED_CATS);

		if (clean($_REQUEST['mode'] ?? 0) == 2) {

			if ($enable_cats) {
				$cat = $this->feedlist_init_cat(-1);
			} else {
				$cat['items'] = array();
			}

			foreach (array(-4, -3, -1, -2, 0, -6) as $i) {
				array_push($cat['items'], $this->feedlist_init_feed($i));
			}

			/* Plugin feeds for -1 */

			$feeds = PluginHost::getInstance()->get_feeds(-1);

			if ($feeds) {
				foreach ($feeds as $feed) {
					$feed_id = PluginHost::pfeed_to_feed_id($feed['id']);

					$item = array();
					$item['id'] = 'FEED:' . $feed_id;
					$item['bare_id'] = (int)$feed_id;
					$item['auxcounter'] = -1;
					$item['name'] = $feed['title'];
					$item['checkbox'] = false;
					$item['error'] = '';
					$item['icon'] = $feed['icon'];

					$item['param'] = '';
					$item['unread'] = -1;
					$item['type'] = 'feed';

					array_push($cat['items'], $item);
				}
			}

			if ($enable_cats) {
				array_push($root['items'], $cat);
			} else {
				$root['items'] = array_merge($root['items'], $cat['items']);
			}

			$sth = $this->pdo->prepare("SELECT * FROM
				ttrss_labels2 WHERE owner_uid = ? ORDER by caption");
			$sth->execute([$_SESSION['uid']]);

			if (get_pref(Prefs::ENABLE_FEED_CATS)) {
				$cat = $this->feedlist_init_cat(-2);
			} else {
				$cat['items'] = [];
			}

			$labels = ORM::for_table('ttrss_labels2')
				->where('owner_uid', $_SESSION['uid'])
				->order_by_asc('caption')
				->find_many();

			if (count($labels)) {
				foreach ($labels as $label) {
					$label_id = Labels::label_to_feed_id($label->id);
					$feed = $this->feedlist_init_feed($label_id, null, false);
					$feed['fg_color'] = $label->fg_color;
					$feed['bg_color'] = $label->bg_color;
					array_push($cat['items'], $feed);
				}

				if ($enable_cats) {
					array_push($root['items'], $cat);
				} else {
					$root['items'] = array_merge($root['items'], $cat['items']);
				}
			}
		}

		if ($enable_cats) {
			$show_empty_cats = self::_param_to_bool($_REQUEST['force_show_empty'] ?? false) ||
				(clean($_REQUEST['mode'] ?? 0) != 2 && !$search);

			$feed_categories = ORM::for_table('ttrss_feed_categories')
				->select_many('id', 'title')
				->where('owner_uid', $_SESSION['uid'])
				->where_null('parent_cat')
				->order_by_asc('order_id')
				->order_by_asc('title')
				->find_many();

			foreach ($feed_categories as $feed_category) {
				$cat = [
					'id' => 'CAT:' . $feed_category->id,
					'bare_id' => (int) $feed_category->id,
					'auxcounter' => -1,
					'name' => $feed_category->title,
					'items' => $this->get_category_items($feed_category->id),
					'checkbox' => false,
					'type' => 'category',
					'unread' => -1,
					'child_unread' => -1,
				];

				$num_children = $this->calculate_children_count($cat);
				$cat['param'] = sprintf(_ngettext('(%d feed)', '(%d feeds)', (int) $num_children), $num_children);

				if ($num_children > 0 || $show_empty_cats)
					array_push($root['items'], $cat);

				//$root['param'] += count($cat['items']);
			}

			/* Uncategorized is a special case */
			$cat = [
				'id' => 'CAT:0',
				'bare_id' => 0,
				'auxcounter' => -1,
				'name' => __('Uncategorized'),
				'items' => [],
				'type' => 'category',
				'checkbox' => false,
				'unread' => -1,
				'child_unread' => -1,
			];

			$feeds_obj = ORM::for_table('ttrss_feeds')
				->select_many('id', 'title', 'last_error', 'update_interval')
				->select_expr(SUBSTRING_FOR_DATE.'(last_updated,1,19)', 'last_updated')
				->where('owner_uid', $_SESSION['uid'])
				->where_null('cat_id')
				->order_by_asc('order_id')
				->order_by_asc('title');

			if ($search) {
				$feeds_obj->where_raw('(LOWER(title) LIKE ? OR LOWER(feed_url) LIKE LOWER(?))', ["%$search%", "%$search%"]);
			}

			foreach ($feeds_obj->find_many() as $feed) {
				array_push($cat['items'], [
					'id' => 'FEED:' . $feed->id,
					'bare_id' => (int) $feed->id,
					'auxcounter' => -1,
					'name' => $feed->title,
					'checkbox' => false,
					'error' => $feed->last_error,
					'icon' => Feeds::_get_icon($feed->id),
					'param' => TimeHelper::make_local_datetime($feed->last_updated, true),
					'unread' => -1,
					'type' => 'feed',
					'updates_disabled' => (int)($feed->update_interval < 0),
				]);
			}

			$cat['param'] = sprintf(_ngettext('(%d feed)', '(%d feeds)', count($cat['items'])), count($cat['items']));

			if (count($cat['items']) > 0 || $show_empty_cats)
				array_push($root['items'], $cat);

			$num_children = $this->calculate_children_count($root);
			$root['param'] = sprintf(_ngettext('(%d feed)', '(%d feeds)', (int) $num_children), $num_children);

		} else {
			$feeds_obj = ORM::for_table('ttrss_feeds')
				->select_many('id', 'title', 'last_error', 'update_interval')
				->select_expr(SUBSTRING_FOR_DATE.'(last_updated,1,19)', 'last_updated')
				->where('owner_uid', $_SESSION['uid'])
				->order_by_asc('order_id')
				->order_by_asc('title');

			if ($search) {
				$feeds_obj->where_raw('(LOWER(title) LIKE ? OR LOWER(feed_url) LIKE LOWER(?))', ["%$search%", "%$search%"]);
			}

			foreach ($feeds_obj->find_many() as $feed) {
				array_push($root['items'], [
					'id' => 'FEED:' . $feed->id,
					'bare_id' => (int) $feed->id,
					'auxcounter' => -1,
					'name' => $feed->title,
					'checkbox' => false,
					'error' => $feed->last_error,
					'icon' => Feeds::_get_icon($feed->id),
					'param' => TimeHelper::make_local_datetime($feed->last_updated, true),
					'unread' => -1,
					'type' => 'feed',
					'updates_disabled' => (int)($feed->update_interval < 0),
				]);
			}

			$root['param'] = sprintf(_ngettext('(%d feed)', '(%d feeds)', count($root['items'])), count($root['items']));
		}

		return [
			'identifier' => 'id',
			'label' => 'name',
			'items' => clean($_REQUEST['mode'] ?? 0) != 2 ? [$root] : $root['items'],
		];
	}

	function catsortreset(): void {
		$sth = $this->pdo->prepare("UPDATE ttrss_feed_categories
				SET order_id = 0 WHERE owner_uid = ?");
		$sth->execute([$_SESSION['uid']]);
	}

	function feedsortreset(): void {
		$sth = $this->pdo->prepare("UPDATE ttrss_feeds
				SET order_id = 0 WHERE owner_uid = ?");
		$sth->execute([$_SESSION['uid']]);
	}

	/**
	 * @param array<string, mixed> $data_map
	 */
	private function process_category_order(array &$data_map, string $item_id = '', string $parent_id = '', int $nest_level = 0): void {

		$prefix = "";
		for ($i = 0; $i < $nest_level; $i++)
			$prefix .= "   ";

		Debug::log("$prefix C: $item_id P: $parent_id");

		$bare_item_id = substr($item_id, strpos($item_id, ':')+1);

		if ($item_id != 'root') {
			if ($parent_id && $parent_id != 'root') {
				$parent_bare_id = substr($parent_id, strpos($parent_id, ':')+1);
				$parent_qpart = $parent_bare_id;
			} else {
				$parent_qpart = null;
			}

			$feed_category = ORM::for_table('ttrss_feed_categories')
				->where('owner_uid', $_SESSION['uid'])
				->find_one($bare_item_id);

			if ($feed_category) {
				$feed_category->parent_cat = $parent_qpart;
				$feed_category->save();
			}
		}

		$order_id = 1;

		$cat = $data_map[$item_id];

		if ($cat && is_array($cat)) {
			foreach ($cat as $item) {
				$id = $item['_reference'];
				$bare_id = substr($id, strpos($id, ':')+1);

				Debug::log("$prefix [$order_id] $id/$bare_id");

				if ($item['_reference']) {

					if (strpos($id, "FEED") === 0) {

						$feed = ORM::for_table('ttrss_feeds')
							->where('owner_uid', $_SESSION['uid'])
							->find_one($bare_id);

						if ($feed) {
							$feed->order_id = $order_id;
							$feed->cat_id = ($item_id != "root" && $bare_item_id) ? $bare_item_id : null;
							$feed->save();
						}
					} else if (strpos($id, "CAT:") === 0) {
						$this->process_category_order($data_map, $item['_reference'], $item_id,
							$nest_level+1);

						$feed_category = ORM::for_table('ttrss_feed_categories')
							->where('owner_uid', $_SESSION['uid'])
							->find_one($bare_id);

						if ($feed_category) {
							$feed_category->order_id = $order_id;
							$feed_category->save();
						}
					}
				}

				++$order_id;
			}
		}
	}

	function savefeedorder(): void {
		$data = json_decode($_POST['payload'], true);

		#file_put_contents("/tmp/saveorder.json", clean($_POST['payload']));
		#$data = json_decode(file_get_contents("/tmp/saveorder.json"), true);

		if (!is_array($data['items']))
			$data['items'] = json_decode($data['items'], true);

#		print_r($data['items']);

		if (is_array($data) && is_array($data['items'])) {
#			$cat_order_id = 0;

			/** @var array<int, mixed> */
			$data_map = array();
			$root_item = '';

			foreach ($data['items'] as $item) {

#				if ($item['id'] != 'root') {
					if (is_array($item['items'])) {
						if (isset($item['items']['_reference'])) {
							$data_map[$item['id']] = array($item['items']);
						} else {
							$data_map[$item['id']] = $item['items'];
						}
					}
				if ($item['id'] == 'root') {
					$root_item = $item['id'];
				}
			}

			$this->process_category_order($data_map, $root_item);
		}
	}

	function removeIcon(): void {
		$feed_id = (int) $_REQUEST["feed_id"];
		$icon_file = Config::get(Config::ICONS_DIR) . "/$feed_id.ico";

		$feed = ORM::for_table('ttrss_feeds')
			->where('owner_uid', $_SESSION['uid'])
			->find_one($feed_id);

		if ($feed && file_exists($icon_file)) {
			if (unlink($icon_file)) {
				$feed->set([
					'favicon_avg_color' => null,
					'favicon_last_checked' => '1970-01-01',
					'favicon_is_custom' => false,
				]);
				$feed->save();
			}
		}
	}

	function uploadIcon(): void {
		$feed_id = (int) $_REQUEST['feed_id'];
		$tmp_file = tempnam(Config::get(Config::CACHE_DIR) . '/upload', 'icon');

		// default value
		$rc = self::E_ICON_UPLOAD_FAILED;

		$feed = ORM::for_table('ttrss_feeds')
			->where('owner_uid', $_SESSION['uid'])
			->find_one($feed_id);

		if ($feed && $tmp_file && move_uploaded_file($_FILES['icon_file']['tmp_name'], $tmp_file)) {
			if (filesize($tmp_file) < Config::get(Config::MAX_FAVICON_FILE_SIZE)) {

				$new_filename = Config::get(Config::ICONS_DIR) . "/$feed_id.ico";

				if (file_exists($new_filename)) unlink($new_filename);
					if (rename($tmp_file, $new_filename)) {
						chmod($new_filename, 0644);

						$feed->set([
							'favicon_avg_color' => null,
							'favicon_is_custom' => true,
						]);

						if ($feed->save()) {
							$rc = self::E_ICON_UPLOAD_SUCCESS;
						}

					} else {
						$rc = self::E_ICON_RENAME_FAILED;
					}
			} else {
				$rc = self::E_ICON_FILE_TOO_LARGE;
			}
		}

		if (file_exists($tmp_file))
			unlink($tmp_file);

		print json_encode(['rc' => $rc, 'icon_url' => Feeds::_get_icon($feed_id)]);
	}

	function editfeed(): void {
		global $purge_intervals;
		global $update_intervals;

		$feed_id = (int)clean($_REQUEST["id"]);

		$row = ORM::for_table('ttrss_feeds')
			->where("owner_uid", $_SESSION["uid"])
			->find_one($feed_id)->as_array();

		if ($row) {

			ob_start();
			PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_EDIT_FEED, $feed_id);
			$plugin_data = trim((string)ob_get_contents());
			ob_end_clean();

			$row["icon"] = Feeds::_get_icon($feed_id);

			$local_update_intervals = $update_intervals;
			$local_update_intervals[0] .= sprintf(" (%s)", $update_intervals[get_pref(Prefs::DEFAULT_UPDATE_INTERVAL)]);

			if (Config::get(Config::FORCE_ARTICLE_PURGE) == 0) {
				$local_purge_intervals = $purge_intervals;
				$default_purge_interval = get_pref(Prefs::PURGE_OLD_DAYS);

				if ($default_purge_interval > 0)
				$local_purge_intervals[0] .= " " . T_nsprintf('(%d day)', '(%d days)', $default_purge_interval, $default_purge_interval);
			else
				$local_purge_intervals[0] .= " " . sprintf("(%s)", __("Disabled"));

			} else {
				$purge_interval = Config::get(Config::FORCE_ARTICLE_PURGE);
				$local_purge_intervals = [ T_nsprintf('%d day', '%d days', $purge_interval, $purge_interval) ];
			}

			$user = ORM::for_table("ttrss_users")->find_one($_SESSION["uid"]);

			print json_encode([
				"feed" => $row,
				"cats" => [
					"enabled" => get_pref(Prefs::ENABLE_FEED_CATS),
					"select" => \Controls\select_feeds_cats("cat_id", $row["cat_id"]),
				],
				"plugin_data" => $plugin_data,
				"force_purge" => (int)Config::get(Config::FORCE_ARTICLE_PURGE),
				"intervals" => [
					"update" => $local_update_intervals,
					"purge" => $local_purge_intervals,
				],
				"user" => [
					"access_level" => $user->access_level
				],
				"lang" => [
					"enabled" => Config::get(Config::DB_TYPE) == "pgsql",
					"default" => get_pref(Prefs::DEFAULT_SEARCH_LANGUAGE),
					"all" => $this::get_ts_languages(),
					]
				]);
		}
	}

	private function _batch_toggle_checkbox(string $name): string {
		return \Controls\checkbox_tag("", false, "",
					["data-control-for" => $name, "title" => __("Check to enable field"), "onchange" => "App.dialogOf(this).toggleField(this)"]);
	}

	function editfeeds(): void {
		global $purge_intervals;
		global $update_intervals;

		$feed_ids = clean($_REQUEST["ids"]);

		$local_update_intervals = $update_intervals;
		$local_update_intervals[0] .= sprintf(" (%s)", $update_intervals[get_pref(Prefs::DEFAULT_UPDATE_INTERVAL)]);

		$local_purge_intervals = $purge_intervals;
		$default_purge_interval = get_pref(Prefs::PURGE_OLD_DAYS);

		if ($default_purge_interval > 0)
			$local_purge_intervals[0] .= " " . T_sprintf("(%d days)", $default_purge_interval);
		else
			$local_purge_intervals[0] .= " " . sprintf("(%s)", __("Disabled"));

		$options = [
			"include_in_digest" => __('Include in e-mail digest'),
			"always_display_enclosures" => __('Always display image attachments'),
			"hide_images" => __('Do not embed media'),
			"cache_images" => __('Cache media'),
			"mark_unread_on_update" => __('Mark updated articles as unread')
		];

		print_notice("Enable the options you wish to apply using checkboxes on the right.");
		?>

		<?= \Controls\hidden_tag("ids", $feed_ids) ?>
		<?= \Controls\hidden_tag("op", "pref-feeds") ?>
		<?= \Controls\hidden_tag("method", "batchEditSave") ?>

		<div dojoType="dijit.layout.TabContainer" style="height : 450px">
			<div dojoType="dijit.layout.ContentPane" title="<?= __('General') ?>">
				<section>
				<?php if (get_pref(Prefs::ENABLE_FEED_CATS)) { ?>
					<fieldset>
						<label><?= __('Place in category:') ?></label>
						<?= \Controls\select_feeds_cats("cat_id", null, ['disabled' => '1']) ?>
						<?= $this->_batch_toggle_checkbox("cat_id") ?>
					</fieldset>
				<?php } ?>

				<?php	if (Config::get(Config::DB_TYPE) == "pgsql") { ?>
					<fieldset>
						<label><?= __('Language:') ?></label>
						<?= \Controls\select_tag("feed_language", "", $this::get_ts_languages(), ["disabled"=> 1]) ?>
						<?= $this->_batch_toggle_checkbox("feed_language") ?>
					</fieldset>
				<?php } ?>
				</section>

				<hr/>

				<section>
					<fieldset>
						<label><?= __("Update interval:") ?></label>
						<?= \Controls\select_hash("update_interval", "", $local_update_intervals, ["disabled" => 1]) ?>
						<?= $this->_batch_toggle_checkbox("update_interval") ?>
					</fieldset>

					<?php if (Config::get(Config::FORCE_ARTICLE_PURGE) == 0) { ?>
						<fieldset>
							<label><?= __('Article purging:') ?></label>
							<?= \Controls\select_hash("purge_interval", "", $local_purge_intervals, ["disabled" => 1]) ?>
							<?= $this->_batch_toggle_checkbox("purge_interval") ?>
						</fieldset>
					<?php } ?>
				</section>
			</div>
			<div dojoType="dijit.layout.ContentPane" title="<?= __('Authentication') ?>">
				<section>
					<fieldset>
						<label><?= __("Login:") ?></label>
						<input dojoType='dijit.form.TextBox'
							disabled='1' autocomplete='new-password' name='auth_login' value=''>
						<?= $this->_batch_toggle_checkbox("auth_login") ?>
					</fieldset>
					<fieldset>
						<label><?= __("Password:") ?></label>
						<input dojoType='dijit.form.TextBox' type='password' name='auth_pass'
							autocomplete='new-password' disabled='1' value=''>
						<?= $this->_batch_toggle_checkbox("auth_pass") ?>
					</fieldset>
				</section>
			</div>
			<div dojoType="dijit.layout.ContentPane" title="<?= __('Options') ?>">
			<?php
				foreach ($options as $name => $caption) {
					?>
						<fieldset class='narrow'>
							<label class="checkbox text-muted">
								<?= \Controls\checkbox_tag($name, false, "", ["disabled" => "1"]) ?>
								<?= $caption ?>
								<?= $this->_batch_toggle_checkbox($name) ?>
							</label>
						</fieldset>
			<?php } ?>
			</div>
		</div>

		<footer>
			<?= \Controls\submit_tag(__("Save")) ?>
			<?= \Controls\cancel_dialog_tag(__("Cancel")) ?>
		</footer>
		<?php
	}

	function batchEditSave(): void {
		$this->editsaveops(true);
	}

	function editSave(): void {
		$this->editsaveops(false);
	}

	private function editsaveops(bool $batch): void {

		$feed_title = clean($_POST["title"]);
		$feed_url = clean($_POST["feed_url"]);
		$site_url = clean($_POST["site_url"]);
		$upd_intl = (int) clean($_POST["update_interval"] ?? 0);
		$purge_intl = (int) clean($_POST["purge_interval"] ?? 0);
		$feed_id = (int) clean($_POST["id"] ?? 0); /* editSave */
		$feed_ids = explode(",", clean($_POST["ids"] ?? "")); /* batchEditSave */
		$cat_id = (int) clean($_POST["cat_id"] ?? 0);
		$auth_login = clean($_POST["auth_login"]);
		$auth_pass = clean($_POST["auth_pass"]);
		$private = checkbox_to_sql_bool(clean($_POST["private"] ?? ""));
		$include_in_digest = checkbox_to_sql_bool(
			clean($_POST["include_in_digest"] ?? ""));
		$cache_images = checkbox_to_sql_bool(
			clean($_POST["cache_images"] ?? ""));
		$hide_images = checkbox_to_sql_bool(
			clean($_POST["hide_images"] ?? ""));
		$always_display_enclosures = checkbox_to_sql_bool(
			clean($_POST["always_display_enclosures"] ?? ""));

		$mark_unread_on_update = checkbox_to_sql_bool(
			clean($_POST["mark_unread_on_update"] ?? ""));

		$feed_language = clean($_POST["feed_language"] ?? "");

		if (!$batch) {

			/* $sth = $this->pdo->prepare("SELECT feed_url FROM ttrss_feeds WHERE id = ?");
			$sth->execute([$feed_id]);
			$row = $sth->fetch();$orig_feed_url = $row["feed_url"];

			$reset_basic_info = $orig_feed_url != $feed_url; */

			$feed = ORM::for_table('ttrss_feeds')
				->where('owner_uid', $_SESSION['uid'])
				->find_one($feed_id);

			if ($feed) {

				$feed->title = 							$feed_title;
				$feed->cat_id = 							$cat_id ? $cat_id : null;
				$feed->feed_url = 						$feed_url;
				$feed->site_url = 						$site_url;
				$feed->update_interval =				$upd_intl;
				$feed->purge_interval =					$purge_intl;
				$feed->auth_login = 						$auth_login;
				$feed->auth_pass = 						$auth_pass;
				$feed->private = 							(int)$private;
				$feed->cache_images = 					(int)$cache_images;
				$feed->hide_images = 					(int)$hide_images;
				$feed->feed_language = 					$feed_language;
				$feed->include_in_digest = 			(int)$include_in_digest;
				$feed->always_display_enclosures =	(int)$always_display_enclosures;
				$feed->mark_unread_on_update = 		(int)$mark_unread_on_update;

				$feed->save();

				PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_SAVE_FEED, $feed_id);
			}

		} else {
			$feed_data = array();

			foreach (array_keys($_POST) as $k) {
				if ($k != "op" && $k != "method" && $k != "ids") {
					$feed_data[$k] = clean($_POST[$k]);
				}
			}

			$this->pdo->beginTransaction();

			$feed_ids_qmarks = arr_qmarks($feed_ids);

			foreach (array_keys($feed_data) as $k) {

				$qpart = "";

				switch ($k) {
					case "title":
						$qpart = "title = " . $this->pdo->quote($feed_title);
						break;

					case "feed_url":
						$qpart = "feed_url = " . $this->pdo->quote($feed_url);
						break;

					case "update_interval":
						$qpart = "update_interval = " . $upd_intl; // made int above
						break;

					case "purge_interval":
						$qpart = "purge_interval = " . $purge_intl; // made int above
						break;

					case "auth_login":
						$qpart = "auth_login = " . $this->pdo->quote($auth_login);
						break;

					case "auth_pass":
						$qpart = "auth_pass =" . $this->pdo->quote($auth_pass). ", auth_pass_encrypted = false";
						break;

					case "private":
						$qpart = "private = " . $private; // made int above
						break;

					case "include_in_digest":
						$qpart = "include_in_digest = " . $include_in_digest; // made int above
						break;

					case "always_display_enclosures":
						$qpart = "always_display_enclosures = " . $always_display_enclosures; // made int above
						break;

					case "mark_unread_on_update":
						$qpart = "mark_unread_on_update = " . $mark_unread_on_update; // made int above
						break;

					case "cache_images":
						$qpart = "cache_images = " . $cache_images; // made int above
						break;

					case "hide_images":
						$qpart = "hide_images = " . $hide_images; // made int above
						break;

					case "cat_id":
						if (get_pref(Prefs::ENABLE_FEED_CATS)) {
							if ($cat_id) {
								$qpart = "cat_id = " . $cat_id; // made int above
							} else {
								$qpart = 'cat_id = NULL';
							}
						} else {
							$qpart = "";
						}

						break;

					case "feed_language":
						$qpart = "feed_language = " . $this->pdo->quote($feed_language);
						break;

				}

				if ($qpart) {
					$sth = $this->pdo->prepare("UPDATE ttrss_feeds SET $qpart WHERE id IN ($feed_ids_qmarks)
						AND owner_uid = ?");
					$sth->execute(array_merge($feed_ids, [$_SESSION['uid']]));
				}
			}

			$this->pdo->commit();
		}
	}

	function remove(): void {
		/** @var array<int, int> */
		$ids = array_map('intval', explode(",", clean($_REQUEST["ids"])));

		foreach ($ids as $id) {
			self::remove_feed($id, $_SESSION["uid"]);
		}
	}

	function removeCat(): void {
		$ids = explode(",", clean($_REQUEST["ids"]));
		foreach ($ids as $id) {
			Feeds::_remove_cat((int)$id, $_SESSION["uid"]);
		}
	}

	function addCat(): void {
		$feed_cat = clean($_REQUEST["cat"]);

		Feeds::_add_cat($feed_cat, $_SESSION['uid']);
	}

	function importOpml(): void {
		$opml = new OPML($_REQUEST);
		$opml->opml_import($_SESSION["uid"]);
	}

	private function index_feeds(): void {
		$error_button = "<button dojoType='dijit.form.Button'
				id='pref_feeds_errors_btn' style='display : none'
				onclick='CommonDialogs.showFeedsWithErrors()'>".
			__("Feeds with errors")."</button>";

		$inactive_button = "<button dojoType='dijit.form.Button'
				id='pref_feeds_inactive_btn'
				style='display : none'
				onclick=\"dijit.byId('feedTree').showInactiveFeeds()\">" .
				__("Inactive feeds") . "</button>";

		$feed_search = clean($_REQUEST["search"] ?? "");

		if (array_key_exists("search", $_REQUEST)) {
			$_SESSION["prefs_feed_search"] = $feed_search;
		} else {
			$feed_search = $_SESSION["prefs_feed_search"] ?? "";
		}

		?>

		<div dojoType="dijit.layout.BorderContainer" gutters="false">
			<div region='top' dojoType="fox.Toolbar">
				<div style='float : right'>
					<input dojoType="dijit.form.TextBox" id="feed_search" size="20" type="search"
						value="<?= htmlspecialchars($feed_search) ?>">
					<button dojoType="dijit.form.Button" onclick="dijit.byId('feedTree').reload()">
						<?= __('Search') ?></button>
				</div>

				<div dojoType="fox.form.DropDownButton">
					<span><?= __('Select') ?></span>
					<div dojoType="dijit.Menu" style="display: none;">
						<div onclick="dijit.byId('feedTree').model.setAllChecked(true)"
							dojoType="dijit.MenuItem"><?= __('All') ?></div>
						<div onclick="dijit.byId('feedTree').model.setAllChecked(false)"
							dojoType="dijit.MenuItem"><?= __('None') ?></div>
					</div>
				</div>

				<div dojoType="fox.form.DropDownButton">
					<span><?= __('Feeds') ?></span>
					<div dojoType="dijit.Menu" style="display: none">
						<div onclick="CommonDialogs.subscribeToFeed()"
							dojoType="dijit.MenuItem"><?= __('Subscribe to feed') ?></div>
						<div onclick="dijit.byId('feedTree').editSelectedFeed()"
							dojoType="dijit.MenuItem"><?= __('Edit selected feeds') ?></div>
						<div onclick="dijit.byId('feedTree').resetFeedOrder()"
							dojoType="dijit.MenuItem"><?= __('Reset sort order') ?></div>
						<div onclick="dijit.byId('feedTree').batchSubscribe()"
							dojoType="dijit.MenuItem"><?= __('Batch subscribe') ?></div>
						<div dojoType="dijit.MenuItem" onclick="dijit.byId('feedTree').removeSelectedFeeds()">
							<?= __('Unsubscribe') ?></div>
					</div>
				</div>

				<?php if (get_pref(Prefs::ENABLE_FEED_CATS)) { ?>
					<div dojoType="fox.form.DropDownButton">
						<span><?= __('Categories') ?></span>
						<div dojoType="dijit.Menu" style="display: none">
							<div onclick="dijit.byId('feedTree').createCategory()"
								dojoType="dijit.MenuItem"><?= __('Add category') ?></div>
							<div onclick="dijit.byId('feedTree').resetCatOrder()"
								dojoType="dijit.MenuItem"><?= __('Reset sort order') ?></div>
							<div onclick="dijit.byId('feedTree').removeSelectedCategories()"
								dojoType="dijit.MenuItem"><?= __('Remove selected') ?></div>
						</div>
					</div>
				<?php } ?>
				<?= $error_button ?>
				<?= $inactive_button ?>
			</div>
			<div style="padding : 0px" dojoType="dijit.layout.ContentPane" region="center">
				<div dojoType="fox.PrefFeedStore" jsId="feedStore"
					url="backend.php?op=pref-feeds&method=getfeedtree">
				</div>

				<div dojoType="lib.CheckBoxStoreModel" jsId="feedModel" store="feedStore"
					query="{id:'root'}" rootId="root" rootLabel="Feeds" childrenAttrs="items"
					checkboxStrict="false" checkboxAll="false">
				</div>

				<div dojoType="fox.PrefFeedTree" id="feedTree"
					dndController="dijit.tree.dndSource"
					betweenThreshold="5"
					autoExpand="<?= (!empty($feed_search) ? "true" : "false") ?>"
					persist="true"
					model="feedModel"
					openOnClick="false">
					<script type="dojo/method" event="onClick" args="item">
						var id = String(item.id);
						var bare_id = id.substr(id.indexOf(':')+1);

						if (id.match('FEED:')) {
							CommonDialogs.editFeed(bare_id);
						} else if (id.match('CAT:')) {
							dijit.byId('feedTree').editCategory(bare_id, item);
						}
					</script>
					<script type="dojo/method" event="onLoad" args="item">
						dijit.byId('feedTree').checkInactiveFeeds();
						dijit.byId('feedTree').checkErrorFeeds();
					</script>
				</div>
			</div>
		</div>
	<?php

	}

	private function index_opml(): void {
		?>

		<form id='opml_import_form' method='post' enctype='multipart/form-data'>
			<label class='dijitButton'><?= __("Choose file...") ?>
				<input style='display : none' id='opml_file' name='opml_file' type='file'>
			</label>
			<input type='hidden' name='op' value='pref-feeds'>
			<input type='hidden' name='csrf_token' value="<?= $_SESSION['csrf_token'] ?>">
			<input type='hidden' name='method' value='importOpml'>
			<button dojoType='dijit.form.Button' class='alt-primary' onclick="return Helpers.OPML.import()" type="submit">
			<?= \Controls\icon("file_upload") ?>
				<?= __('Import OPML') ?>
			</button>
		</form>

		<hr/>

		<?php print_notice("Only main settings profile can be migrated using OPML.") ?>

		<form dojoType='dijit.form.Form' id='opmlExportForm' style='display : inline-block'>
			<button dojoType='dijit.form.Button' onclick='Helpers.OPML.export()'>
				<?= \Controls\icon("file_download") ?>
				<?= __('Export OPML') ?>
			</button>

			<label class='checkbox'>
				<?= \Controls\checkbox_tag("include_settings", true, "1") ?>
				<?= __("Include tt-rss settings") ?>
			</label>
		</form>

		<?php
		PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_TAB_SECTION, "prefFeedsOPML");
	}

	private function index_shared(): void {
		?>

		<?= format_notice('Published articles can be subscribed by anyone who knows the following URL:') ?></h3>

		<button dojoType='dijit.form.Button' class='alt-primary'
			onclick="CommonDialogs.generatedFeed(-2, false)">
			<?= \Controls\icon('share') ?>
			<?= __('Display URL') ?>
		</button>

		<button class='alt-danger' dojoType='dijit.form.Button' onclick='return Helpers.Feeds.clearFeedAccessKeys()'>
			<?= \Controls\icon('delete') ?>
			<?= __('Clear all generated URLs') ?>
		</button>

		<?php
		PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_TAB_SECTION, "prefFeedsPublishedGenerated");
	}

	function index(): void {
		?>

		<div dojoType='dijit.layout.TabContainer' tabPosition='left-h'>
			<div style='padding : 0px' dojoType='dijit.layout.ContentPane'
				title="<i class='material-icons'>rss_feed</i> <?= __('My feeds') ?>">
				<?php $this->index_feeds() ?>
			</div>

			<div dojoType='dijit.layout.ContentPane'
						title="<i class='material-icons'>import_export</i> <?= __('OPML') ?>">
						<?php $this->index_opml() ?>
					</div>

			<div dojoType="dijit.layout.ContentPane"
				title="<i class='material-icons'>share</i> <?= __('Sharing') ?>">
				<?php $this->index_shared() ?>
			</div>

			<?php
				ob_start();
				PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_TAB, "prefFeeds");
				$plugin_data = trim((string)ob_get_contents());
				ob_end_clean();
			?>

			<?php if ($plugin_data) { ?>
				<div dojoType='dijit.layout.ContentPane'
					title="<i class='material-icons'>extension</i> <?= __('Plugins') ?>">

					<div dojoType='dijit.layout.AccordionContainer' region='center'>
						<?= $plugin_data ?>
					</div>
				</div>
			<?php } ?>
		</div>
		<?php
	}

	/**
	 * @return array<string, mixed>
	 */
	private function feedlist_init_cat(int $cat_id): array {
		return [
			'id' => 'CAT:' . $cat_id,
			'items' => array(),
			'name' => Feeds::_get_cat_title($cat_id),
			'type' => 'category',
			'unread' => -1, //(int) Feeds::_get_cat_unread($cat_id);
			'bare_id' => $cat_id,
		];
	}

	/**
	 * @return array<string, mixed>
	 */
	private function feedlist_init_feed(int $feed_id, ?string $title = null, bool $unread = false, string $error = '', string $updated = ''): array {
		if (!$title)
			$title = Feeds::_get_title($feed_id, false);

		if ($unread === false)
			$unread = getFeedUnread($feed_id, false);

		return [
			'id' => 'FEED:' . $feed_id,
			'name' => $title,
			'unread' => (int) $unread,
			'type' => 'feed',
			'error' => $error,
			'updated' => $updated,
			'icon' => Feeds::_get_icon($feed_id),
			'bare_id' => $feed_id,
			'auxcounter' => 0,
		];
	}

	function inactiveFeeds(): void {

		if (Config::get(Config::DB_TYPE) == "pgsql") {
			$interval_qpart = "NOW() - INTERVAL '3 months'";
		} else {
			$interval_qpart = "DATE_SUB(NOW(), INTERVAL 3 MONTH)";
		}

		$inactive_feeds = ORM::for_table('ttrss_feeds')
			->table_alias('f')
			->select_many('f.id', 'f.title', 'f.site_url', 'f.feed_url')
			->select_expr('MAX(e.updated)', 'last_article')
			->join('ttrss_user_entries', [ 'ue.feed_id', '=', 'f.id'], 'ue')
			->join('ttrss_entries', ['e.id', '=', 'ue.ref_id'], 'e')
			->where('f.owner_uid', $_SESSION['uid'])
			->where_raw(
				"(SELECT MAX(ttrss_entries.updated)
				FROM ttrss_entries
				JOIN ttrss_user_entries ON ttrss_entries.id = ttrss_user_entries.ref_id
				WHERE ttrss_user_entries.feed_id = f.id) < $interval_qpart")
			->group_by('f.title')
			->group_by('f.id')
			->group_by('f.site_url')
			->group_by('f.feed_url')
			->order_by_asc('last_article')
			->find_array();

		foreach ($inactive_feeds as $inactive_feed) {
			$inactive_feed['last_article'] = TimeHelper::make_local_datetime($inactive_feed['last_article'], false);
		}

		print json_encode($inactive_feeds);
	}

	function feedsWithErrors(): void {
		print json_encode(ORM::for_table('ttrss_feeds')
			->select_many('id', 'title', 'feed_url', 'last_error', 'site_url')
			->where_not_equal('last_error', '')
			->where('owner_uid', $_SESSION['uid'])
			->find_array());
	}

	static function remove_feed(int $id, int $owner_uid): void {

		if (PluginHost::getInstance()->run_hooks_until(PluginHost::HOOK_UNSUBSCRIBE_FEED, true, $id, $owner_uid))
			return;

		$pdo = Db::pdo();

		if ($id > 0) {
			$pdo->beginTransaction();

			/* save starred articles in Archived feed */

			$sth = $pdo->prepare("UPDATE ttrss_user_entries SET
					feed_id = NULL, orig_feed_id = NULL
				WHERE feed_id = ? AND marked = true AND owner_uid = ?");

			$sth->execute([$id, $owner_uid]);

			/* Remove access key for the feed */

			$sth = $pdo->prepare("DELETE FROM ttrss_access_keys WHERE
				feed_id = ? AND owner_uid = ?");
			$sth->execute([$id, $owner_uid]);

			/* remove the feed */

			$sth = $pdo->prepare("DELETE FROM ttrss_feeds
				WHERE id = ? AND owner_uid = ?");
			$sth->execute([$id, $owner_uid]);

			$pdo->commit();

			if (file_exists(Config::get(Config::ICONS_DIR) . "/$id.ico")) {
				unlink(Config::get(Config::ICONS_DIR) . "/$id.ico");
			}

		} else {
			Labels::remove(Labels::feed_to_label_id($id), $owner_uid);
		}
	}

	function batchSubscribe(): void {
		print json_encode([
			"enable_cats" => (int)get_pref(Prefs::ENABLE_FEED_CATS),
			"cat_select" => \Controls\select_feeds_cats("cat")
		]);
	}

	function batchAddFeeds(): void {
		$cat_id = clean($_REQUEST['cat']);
		$feeds = explode("\n", clean($_REQUEST['feeds']));
		$login = clean($_REQUEST['login']);
		$pass = clean($_REQUEST['pass']);

		$user = ORM::for_table('ttrss_users')->find_one($_SESSION["uid"]);

		// TODO: we should return some kind of error code to frontend here
		if ($user->access_level == UserHelper::ACCESS_LEVEL_READONLY) {
			return;
		}

		$csth = $this->pdo->prepare("SELECT id FROM ttrss_feeds
						WHERE feed_url = ? AND owner_uid = ?");

		$isth = $this->pdo->prepare("INSERT INTO ttrss_feeds
							(owner_uid,feed_url,title,cat_id,auth_login,auth_pass,update_method,auth_pass_encrypted)
						VALUES (?, ?, '[Unknown]', ?, ?, ?, 0, false)");

		foreach ($feeds as $feed) {
			$feed = trim($feed);

			if (UrlHelper::validate($feed)) {

				$this->pdo->beginTransaction();

				$csth->execute([$feed, $_SESSION['uid']]);

				if (!$csth->fetch()) {
					$isth->execute([$_SESSION['uid'], $feed, $cat_id ? $cat_id : null, $login, $pass]);
				}

				$this->pdo->commit();
			}
		}
	}

	function clearKeys(): void {
		Feeds::_clear_access_keys($_SESSION['uid']);
	}

	function regenFeedKey(): void {
		$feed_id = clean($_REQUEST['id']);
		$is_cat = self::_param_to_bool($_REQUEST['is_cat'] ?? false);

		$new_key = Feeds::_update_access_key($feed_id, $is_cat, $_SESSION["uid"]);

		print json_encode(["link" => $new_key]);
	}

	function getSharedURL(): void {
		$feed_id = clean($_REQUEST['id']);
		$is_cat = self::_param_to_bool($_REQUEST['is_cat'] ?? false);
		$search = clean($_REQUEST['search']);

		$link = Config::get_self_url() . "/public.php?" . http_build_query([
			'op' => 'rss',
			'id' => $feed_id,
			'is_cat' => (int)$is_cat,
			'q' => $search,
			'key' => Feeds::_get_access_key($feed_id, $is_cat, $_SESSION["uid"])
		]);

		print json_encode([
			"title" => Feeds::_get_title($feed_id, $is_cat),
			"link" => $link
		]);
	}

	/**
	 * @param array<string, mixed> $cat
	 */
	private function calculate_children_count(array $cat): int {
		$c = 0;

		foreach ($cat['items'] ?? [] as $child) {
			if (($child['type'] ?? '') == 'category') {
				$c += $this->calculate_children_count($child);
			} else {
				$c += 1;
			}
		}

		return $c;
	}

}
