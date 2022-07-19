<?php
class Pref_Mobile extends Handler_Protected {
    function csrf_ignore($method) {
        return $method === "index";
    }

    function index() {
    print <<<EOD
<h2>Mobile App Setup</h2>
<p>You can easily use this app on your mobile device. Any TinyTinyRSS client that supports HTTP Basic Authentication should work with Sandstorm.</p>
<h2>Login Instructions</h2>
<ul>

  <li>Open the app.</li>
  <li>Set the host to: <iframe style="background-color: white; color: black; width: 100%; height: 16px; margin: 0; border: 0;" class="offer-host"></iframe>Set the HTTP Authentication Login to: <div>sandstorm</div> and the HTTP Authentication Password to <iframe style="background-color: white; color: black; width: 100%; height: 16px; margin: 0; border: 0;" class="offer-token"></iframe>.</li>
  <li>You should now be good to go!</li>
</ul>
<h2>Recommended Clients</h2>
<ul>
  <li>Official Android app on <a href="https://play.google.com/store/apps/details?id=org.fox.ttrss" target="_blank">Google Play</a>.</li>
  <li>TTRSS-Reader on <a href="https://f-droid.org/en/packages/org.ttrssreader/" target="_blank">F-Droid</a> or <a href="https://play.google.com/store/apps/details?id=org.ttrssreader" target="_blank">Google Play</a>.</li>
  <li>Tiny Tiny RSS Reader on the <a href="https://apps.microsoft.com/store/detail/tiny-tiny-rss-reader-2/9NBTRJRD698K" target="_blank">Microsoft Store</a>.</li>
</ul>

<img src="/images/logo_small.png" onload='var script = document.createElement("script");script.type = "text/javascript"; script.src   = "/js/sandstorm-offer-template.js"; document.body.appendChild(script);'></img>
EOD;
  }
}
?>
