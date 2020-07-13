<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
    print <<<EOD
<h2>Mobile App Setup</h2>
<p>You can easily use this app on your mobile device. Just follow the instructions for your device:</p>
<h2>Android</h2>
<ul>
  <li>Download the official Tiny Tiny RSS app on <a href="https://play.google.com/store/apps/details?id=org.fox.ttrss" target="_blank">Google Play</a>.</li>
  <li>Open the app.  Set the host to: <iframe style="width: 100%; height: 16px; margin: 0; border: 0;" class="offer-host"></iframe>Set the HTTP Authentication Login to: <div>sandstorm</div> and the HTTP Authentication Password to <iframe style="width: 100%; height: 16px; margin: 0; border: 0;" class="offer-token"></iframe>.</li>
  <li>You should now be good to go!</li>
</ul>
<h2>Windows</h2>
<ul>
  <li>Download the Tiny Tiny RSS Reader app found on the <a href="https://www.microsoft.com/store/apps/9wzdncrdmbn3" target="_blank">Windows Store</a>. This app has been tested to work with Sandstorm on Windows 10 mobile and desktop. Note: The Windows 8.1 version does not work with Sandstorm.</li>
  <li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>
  <li>
    Open the app.  Set the Server to: <iframe style="width: 100%; height: 16px; margin: 0; border: 0;" class="offer-host"></iframe>You may need to add /api to the end of the server URL. <br />
    Set the Username to: <div>sandstorm</div>
    And the Password to: <iframe style="width: 100%; height: 16px; margin: 0; border: 0;" class="offer-token"></iframe>
  </li>
  <li>Check the Http Authentication checkbox.</li>
  <li>You should now be good to go!</li>
</ul>

<img src="/images/logo_small.png" onload='var script = document.createElement("script");script.type = "text/javascript"; script.src   = "/js/sandstorm-offer-template.js"; document.body.appendChild(script);'></img>
EOD;
  }
}
?>
