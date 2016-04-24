<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
      print "<h2>Android App Setup</h2>";
      print "<p>You can easily use this app on your Android device. Just follow these instructions:</p>";
      print "<ul>";
      print "<li>Download an app.  The Tiny Tiny RSS authors maintain an <a href=\"https://play.google.com/store/apps/details?id=org.fox.ttrss\">app on Google Play</a>.  An app by a different author is available on <a href=\"https://f-droid.org/repository/browse/?fdid=org.ttrssreader\">FDroid</a>.</li>";
      print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
      print "<li>Open the app.  Set the host to be the part of the webkey before the #.  Set the HTTP Auth user to an arbitrary string and the HTTP Auth password to the part of the webkey after the #.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
  }
}
?>
