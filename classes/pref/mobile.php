<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
    print <<<EOD
<h2>Mobile App Setup</h2>
<p>You can easily use this app on your mobile device. Just follow the instructions for your device:</p>
<h2>Android</h2>
<ul>
  <li>Download the official Tiny Tiny RSS app on <a href="https://play.google.com/store/apps/details?id=org.fox.ttrss" target="_blank">Google Play</a>.</li>
  <li>Open the app.  Set the host to: <iframe style="background-color: white; color: black; width: 100%; height: 16px; margin: 0; border: 0;" class="offer-host"></iframe>Set the HTTP Authentication Login to: <div>sandstorm</div> and the HTTP Authentication Password to <iframe style="background-color: white; color: black; width: 100%; height: 16px; margin: 0; border: 0;" class="offer-token"></iframe>.</li>
  <li>You should now be good to go!</li>
</ul>

<img src="/images/logo_small.png" onload='var script = document.createElement("script");script.type = "text/javascript"; script.src   = "/js/sandstorm-offer-template.js"; document.body.appendChild(script);'></img>
EOD;
  }
}
?>
