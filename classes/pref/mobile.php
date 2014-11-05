<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
      print "<h2>Android App Setup</h2>";
      print "<p>You can easily use this app on your Android device. Just follow these instructions:</p>";
      print "<ul>";
      print "<li>Download <a href=\"/apk.php\">this apk</a> and install it on your Android device. You will have to enable installation from unknown sources by going to Settings > Security, and checking the \"Unknown Sources\" checkbox.</li>";
      print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
      print "<li>Open the TinyTinyRss android app, and in its settings, paste the webkey URL you got from the previous step into the URL field.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
  }
}
?>
