<?php
class Af_Zz_VidMute extends Plugin {

	function about() {
		return array(null,
			"Mute audio in HTML5 videos",
			"fox");
	}

	function init($host) {

	}

	function get_js() {
		return file_get_contents(__DIR__ . "/init.js");
	}

	function api_version() {
		return 2;
	}

}
