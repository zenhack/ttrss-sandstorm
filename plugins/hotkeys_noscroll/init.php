<?php
class Hotkeys_Noscroll extends Plugin {
	function about() {
		return array(null,
			"n/p (and up/down) hotkeys move between articles without scrolling",
			"fox");
	}

	function init($host) {
		$host->add_hook($host::HOOK_HOTKEY_MAP, $this);
	}

	function hook_hotkey_map($hotkeys) {

		$hotkeys["(40)|Down"] = "next_article_noscroll";
		$hotkeys["(38)|Up"] = "prev_article_noscroll";
		$hotkeys["n"] = "next_article_noscroll";
		$hotkeys["p"] = "prev_article_noscroll";

		return $hotkeys;
	}

	function api_version() {
		return 2;
	}

}
