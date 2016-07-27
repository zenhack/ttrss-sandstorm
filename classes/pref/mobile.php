<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
      print "<h2>Mobile App Setup</h2>";
      print "<p>You can easily use this app on your mobile device. Just follow the instructions for your device:</p>";
	  print "<h2>Android</h2>";
      print "<ul>";
      print "<li>Download an app.  The Tiny Tiny RSS authors maintain an app on <a href=\"https://play.google.com/store/apps/details?id=org.fox.ttrss\">Google Play</a>.</li>";
      print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
      print "<li>Open the app.  Set the host to be the part of the webkey before the #.  Set the HTTP Authentication Login to \"sandstorm\" and the HTTP Authentication Password to the part of the webkey after the #.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
	  print "<h2>Windows</h2>";
	  print "<ul>";
	  print "<li>Download the Tiny Tiny RSS Reader app found on the <a href=\"https://www.microsoft.com/store/apps/9wzdncrdmbn3\">Windows Store</a>. This app has been tested to work with Sandstorm on Windows 10 mobile and desktop. Note: The Windows 8.1 version does not work with Sandstorm.</li>";
	  print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
	  print "<li>Open the app.  Set the Server to be the part of the webkey before the #.  You may need to add /api to the end of the server URL.</li>";
	  print "<li>Set the Username to \"sandstorm\" and the Password to the part of the webkey after the #.</li>";
	  print "<li>Check the Http Authentication checkbox.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
  }
}
?>
