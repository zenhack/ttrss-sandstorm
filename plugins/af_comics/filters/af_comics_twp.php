<?php
class Af_Comics_Twp extends Af_ComicFilter {

	function supported() {
		return array("Three Word Phrase");
	}

	function process(&$article) {

		if (strpos($article["link"], "threewordphrase.com") !== false) {

				$doc = new DOMDocument();

				$res = UrlHelper::fetch($article["link"]);

				if ($res && $doc->loadHTML($res)) {
					$xpath = new DOMXpath($doc);

					$basenode = $xpath->query("//td/center/img")->item(0);

					if ($basenode) {
						$article["content"] = $doc->saveHTML($basenode);
					}
				}

			return true;
		}

		return false;
	}
}
