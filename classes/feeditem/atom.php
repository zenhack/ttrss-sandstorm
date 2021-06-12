<?php
class FeedItem_Atom extends FeedItem_Common {
	const NS_XML = "http://www.w3.org/XML/1998/namespace";

	function get_id() {
		$id = $this->elem->getElementsByTagName("id")->item(0);

		if ($id) {
			return $id->nodeValue;
		} else {
			return clean($this->get_link());
		}
	}

	function get_date() {
		$updated = $this->elem->getElementsByTagName("updated")->item(0);

		if ($updated) {
			return strtotime($updated->nodeValue);
		}

		$published = $this->elem->getElementsByTagName("published")->item(0);

		if ($published) {
			return strtotime($published->nodeValue);
		}

		$date = $this->xpath->query("dc:date", $this->elem)->item(0);

		if ($date) {
			return strtotime($date->nodeValue);
		}
	}


	function get_link() {
		$links = $this->elem->getElementsByTagName("link");

		foreach ($links as $link) {
			if ($link && $link->hasAttribute("href") &&
				(!$link->hasAttribute("rel")
					|| $link->getAttribute("rel") == "alternate"
					|| $link->getAttribute("rel") == "standout")) {
				$base = $this->xpath->evaluate("string(ancestor-or-self::*[@xml:base][1]/@xml:base)", $link);

				if ($base)
					return rewrite_relative_url($base, clean(trim($link->getAttribute("href"))));
				else
					return clean(trim($link->getAttribute("href")));

			}
		}
	}

	function get_title() {
		$title = $this->elem->getElementsByTagName("title")->item(0);

		if ($title) {
			return clean(trim($title->nodeValue));
		}
	}

	/** $base is optional (returns $content if $base is null), $content is an HTML string */
	private function rewrite_content_to_base($base, $content) {

		if (!empty($base) && !empty($content)) {

			$tmpdoc = new DOMDocument();
			if (@$tmpdoc->loadHTML('<?xml encoding="UTF-8">' . $content)) {
				$tmpxpath = new DOMXPath($tmpdoc);

				$elems = $tmpxpath->query("(//*[@href]|//*[@src])");

				foreach ($elems as $elem) {
					if ($elem->hasAttribute("href")) {
						$elem->setAttribute("href",
							UrlHelper::rewrite_relative($base, $elem->getAttribute("href")));
					} else if ($elem->hasAttribute("src")) {
						$elem->setAttribute("src",
							UrlHelper::rewrite_relative($base, $elem->getAttribute("src")));
					}
				}

				return $tmpdoc->saveXML();
			}
		}

		return $content;
	}

	function get_content() {
		$content = $this->elem->getElementsByTagName("content")->item(0);

		if ($content) {
			$base = $this->xpath->evaluate("string(ancestor-or-self::*[@xml:base][1]/@xml:base)", $content);

			if ($content->hasAttribute('type')) {
				if ($content->getAttribute('type') == 'xhtml') {
					for ($i = 0; $i < $content->childNodes->length; $i++) {
						$child = $content->childNodes->item($i);

						if ($child->hasChildNodes()) {
							return $this->rewrite_content_to_base($base, $this->doc->saveHTML($child));
						}
					}
				}
			}

			return $this->rewrite_content_to_base($base, $this->subtree_or_text($content));
		}
	}

	// TODO: duplicate code should be merged with get_content()
	function get_description() {
		$content = $this->elem->getElementsByTagName("summary")->item(0);

		if ($content) {
			$base = $this->xpath->evaluate("string(ancestor-or-self::*[@xml:base][1]/@xml:base)", $content);

			if ($content->hasAttribute('type')) {
				if ($content->getAttribute('type') == 'xhtml') {
					for ($i = 0; $i < $content->childNodes->length; $i++) {
						$child = $content->childNodes->item($i);

						if ($child->hasChildNodes()) {
							return $this->rewrite_content_to_base($base, $this->doc->saveHTML($child));
						}
					}
				}
			}

			return $this->rewrite_content_to_base($base, $this->subtree_or_text($content));
		}

	}

	function get_categories() {
		$categories = $this->elem->getElementsByTagName("category");
		$cats = [];

		foreach ($categories as $cat) {
			if ($cat->hasAttribute("term"))
				array_push($cats, $cat->getAttribute("term"));
		}

		$categories = $this->xpath->query("dc:subject", $this->elem);

		foreach ($categories as $cat) {
			array_push($cats, $cat->nodeValue);
		}

		return $this->normalize_categories($cats);
	}

	function get_enclosures() {
		$links = $this->elem->getElementsByTagName("link");

		$encs = [];

		foreach ($links as $link) {
			if ($link && $link->hasAttribute("href") && $link->hasAttribute("rel")) {
				$base = $this->xpath->evaluate("string(ancestor-or-self::*[@xml:base][1]/@xml:base)", $link);

				if ($link->getAttribute("rel") == "enclosure") {
					$enc = new FeedEnclosure();

					$enc->type = clean($link->getAttribute("type"));
					$enc->length = clean($link->getAttribute("length"));
					$enc->link = clean($link->getAttribute("href"));

					if (!empty($base)) {
						$enc->link = UrlHelper::rewrite_relative($base, $enc->link);
					}

					array_push($encs, $enc);
				}
			}
		}

		$encs = array_merge($encs, parent::get_enclosures());

		return $encs;
	}

	function get_language() {
		$lang = $this->elem->getAttributeNS(self::NS_XML, "lang");

		if (!empty($lang)) {
			return clean($lang);
		} else {
			// Fall back to the language declared on the feed, if any.
			foreach ($this->doc->childNodes as $child) {
				if (method_exists($child, "getAttributeNS")) {
					return clean($child->getAttributeNS(self::NS_XML, "lang"));
				}
			}
		}
	}
}
