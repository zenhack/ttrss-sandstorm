<?php
class Hotkeys_Swap_JK extends Plugin {

	function about() {
		return array(null,
			"Swap j and k hotkeys (for vi brethren)",
			"fox");
	}

	function init($host) {
		$host->add_hook($host::HOOK_HOTKEY_MAP, $this);
	}

	function hook_hotkey_map($hotkeys) {

		$hotkeys["j"] = "next_feed";
		$hotkeys["J"] = "next_unread_feed";
		$hotkeys["k"] = "prev_feed";
		$hotkeys["K"] = "prev_unread_feed";

		return $hotkeys;
	}

	function api_version() {
		return 2;
	}

}
