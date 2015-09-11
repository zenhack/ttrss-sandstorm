<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
      print "<h2>Android App Setup</h2>";
      print "<p>You can easily use this app on your Android device. Just follow these instructions:</p>";
      print "<ul>";
      print "<li>Download <a href=\"/apk.php\">this apk</a> and install it on your Android device. You will have to enable installation from unknown sources by going to Settings > Security, and checking the \"Unknown Sources\" checkbox.</li>";
      print '<li><iframe id="offer-template" style="
    height: 15px;
    width: 90%;
    overflow-x: scroll;
    border: none;
"></iframe></li>';
      print "<li>Open the TinyTinyRss android app, and in its settings, paste the webkey URL you got from the previous step into the URL field.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";

      print '<img src="/images/pub_set.png" onload=\'var script = document.createElement("script");script.type = "text/javascript"; script.src   = "/js/sandstorm-offer-template.js"; document.body.appendChild(script);\'></img>';
  }
}
?>
