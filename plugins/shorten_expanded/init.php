<?php
class Shorten_Expanded extends Plugin {

	function about() {
		return array(null,
			"Shorten overly long articles in CDM/expanded",
			"fox");
	}

	function init($host) {

	}

	function get_css() {
		return file_get_contents(__DIR__ . "/init.css");
	}

	function get_js() {
		return file_get_contents(__DIR__ . "/init.js");
	}

	function api_version() {
		return 2;
	}

}
