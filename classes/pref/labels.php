<?php
class Pref_Labels extends Handler_Protected {

	function csrf_ignore($method) {
		$csrf_ignored = array("index", "getlabeltree");

		return array_search($method, $csrf_ignored) !== false;
	}

	function edit() {
		$label = ORM::for_table('ttrss_labels2')
			->where('owner_uid', $_SESSION['uid'])
			->find_one($_REQUEST['id']);

		if ($label) {
			print json_encode($label->as_array());
		}
	}

	function getlabeltree() {
		$root = array();
		$root['id'] = 'root';
		$root['name'] = __('Labels');
		$root['items'] = array();

		$sth = $this->pdo->prepare("SELECT *
			FROM ttrss_labels2
			WHERE owner_uid = ?
			ORDER BY caption");
		$sth->execute([$_SESSION['uid']]);

		while ($line = $sth->fetch()) {
			$label = array();
			$label['id'] = 'LABEL:' . $line['id'];
			$label['bare_id'] = $line['id'];
			$label['name'] = $line['caption'];
			$label['fg_color'] = $line['fg_color'];
			$label['bg_color'] = $line['bg_color'];
			$label['type'] = 'label';
			$label['checkbox'] = false;

			array_push($root['items'], $label);
		}

		$fl = array();
		$fl['identifier'] = 'id';
		$fl['label'] = 'name';
		$fl['items'] = array($root);

		print json_encode($fl);
		return;
	}

	function colorset() {
		$kind = clean($_REQUEST["kind"]);
		$ids = explode(',', clean($_REQUEST["ids"]));
		$color = clean($_REQUEST["color"]);
		$fg = clean($_REQUEST["fg"]);
		$bg = clean($_REQUEST["bg"]);

		foreach ($ids as $id) {

			if ($kind == "fg" || $kind == "bg") {
				$sth = $this->pdo->prepare("UPDATE ttrss_labels2 SET
					${kind}_color = ? WHERE id = ?
					AND owner_uid = ?");

				$sth->execute([$color, $id, $_SESSION['uid']]);

			} else {

				$sth = $this->pdo->prepare("UPDATE ttrss_labels2 SET
					fg_color = ?, bg_color = ? WHERE id = ?
					AND owner_uid = ?");

				$sth->execute([$fg, $bg, $id, $_SESSION['uid']]);
			}

			/* Remove cached data */

			$sth = $this->pdo->prepare("UPDATE ttrss_user_entries SET label_cache = ''
				WHERE owner_uid = ?");
			$sth->execute([$_SESSION['uid']]);
		}
	}

	function colorreset() {
		$ids = explode(',', clean($_REQUEST["ids"]));

		foreach ($ids as $id) {
			$sth = $this->pdo->prepare("UPDATE ttrss_labels2 SET
				fg_color = '', bg_color = '' WHERE id = ?
				AND owner_uid = ?");
			$sth->execute([$id, $_SESSION['uid']]);

			/* Remove cached data */

			$sth = $this->pdo->prepare("UPDATE ttrss_user_entries SET label_cache = ''
				WHERE owner_uid = ?");
			$sth->execute([$_SESSION['uid']]);
		}
	}

	function save() {

		$id = clean($_REQUEST["id"]);
		$caption = clean($_REQUEST["caption"]);

		$this->pdo->beginTransaction();

		$sth = $this->pdo->prepare("SELECT caption FROM ttrss_labels2
			WHERE id = ? AND owner_uid = ?");
		$sth->execute([$id, $_SESSION['uid']]);

		if ($row = $sth->fetch()) {
			$old_caption = $row["caption"];

			$sth = $this->pdo->prepare("SELECT id FROM ttrss_labels2
				WHERE caption = ? AND owner_uid = ?");
			$sth->execute([$caption, $_SESSION['uid']]);

			if (!$sth->fetch()) {
				if ($caption) {
					$sth = $this->pdo->prepare("UPDATE ttrss_labels2 SET
						caption = ? WHERE id = ? AND
						owner_uid = ?");
					$sth->execute([$caption, $id, $_SESSION['uid']]);

					/* Update filters that reference label being renamed */

					$sth = $this->pdo->prepare("UPDATE ttrss_filters2_actions SET
						action_param = ? WHERE action_param = ?
						AND action_id = 7
						AND filter_id IN (SELECT id FROM ttrss_filters2 WHERE owner_uid = ?)");

					$sth->execute([$caption, $old_caption, $_SESSION['uid']]);

					print clean($_REQUEST["caption"]);
				} else {
					print $old_caption;
				}
			} else {
				print $old_caption;
			}
		}

		$this->pdo->commit();

	}

	function remove() {

		$ids = explode(",", clean($_REQUEST["ids"]));

		foreach ($ids as $id) {
			Labels::remove($id, $_SESSION["uid"]);
		}

	}

	function add() {
		$caption = clean($_REQUEST["caption"]);
		$output = clean($_REQUEST["output"]);

		if ($caption) {
			if (Labels::create($caption)) {
				if (!$output) {
					print T_sprintf("Created label <b>%s</b>", htmlspecialchars($caption));
				}
			}
		}
	}

	function index() {
		?>
		<div dojoType='dijit.layout.BorderContainer' gutters='false'>
			<div style='padding : 0px' dojoType='dijit.layout.ContentPane' region='top'>
				<div dojoType='fox.Toolbar'>
					<div dojoType='fox.form.DropDownButton'>
						<span><?= __('Select') ?></span>
						<div dojoType='dijit.Menu' style='display: none'>
						<div onclick="dijit.byId('labelTree').model.setAllChecked(true)"
							dojoType='dijit.MenuItem'><?=('All') ?></div>
						<div onclick="dijit.byId('labelTree').model.setAllChecked(false)"
							dojoType='dijit.MenuItem'><?=('None') ?></div>
					</div>
				</div>

				<button dojoType='dijit.form.Button' onclick='CommonDialogs.addLabel()'>
					<?=('Create label') ?></button dojoType='dijit.form.Button'>

				<button dojoType='dijit.form.Button' onclick="dijit.byId('labelTree').removeSelected()">
					<?=('Remove') ?></button dojoType='dijit.form.Button'>

				<button dojoType='dijit.form.Button' onclick="dijit.byId('labelTree').resetColors()">
					<?=('Clear colors') ?></button dojoType='dijit.form.Button'>

				</div>
			</div>

			<div style='padding : 0px' dojoType='dijit.layout.ContentPane' region='center'>
				<div dojoType='dojo.data.ItemFileWriteStore' jsId='labelStore'
					url='backend.php?op=pref-labels&method=getlabeltree'>
				</div>

				<div dojoType='lib.CheckBoxStoreModel' jsId='labelModel' store='labelStore'
					query="{id:'root'}" rootId='root'
					childrenAttrs='items' checkboxStrict='false' checkboxAll='false'>
				</div>

				<div dojoType='fox.PrefLabelTree' id='labelTree' model='labelModel' openOnClick='true'>
					<script type='dojo/method' event='onClick' args='item'>
						var id = String(item.id);
						var bare_id = id.substr(id.indexOf(':')+1);

						if (id.match('LABEL:')) {
							dijit.byId('labelTree').editLabel(bare_id);
						}
					</script>
				</div>
			</div>
			<?php PluginHost::getInstance()->run_hooks(PluginHost::HOOK_PREFS_TAB, "prefLabels") ?>
		</div>
		<?php
	}
}
