<?php
class Pref_Mobile extends Handler_Protected {
    function index() {
      print "<h2>Mobile App Setup</h2>";
	  print "<h2>Android</h2>";
      print "<ul>";
      print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
	  print "<ul>";
	  print "<li>In the header bar of this site, you should see a key icon (you may need to open the menu). Click the key icon and create a new key. Save the webkey URL it gives you.</li>";
	  print "<li>Open the app.  Set the Server to be the part of the webkey before the #.  You may need to add /api to the end of the server URL.</li>";
	  print "<li>Set the Username to \"sandstorm\" and the Password to the part of the webkey after the #.</li>";
	  print "<li>Check the Http Authentication checkbox.</li>";
      print "<li>You should now be good to go!</li>";
      print "</ul>";
  }
}
?>
