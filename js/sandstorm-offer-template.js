
var messageListener = function(event) {
  if (event.data.rpcId === "0") {
    if (event.data.error) {
      console.log("ERROR: " + event.data.error);
    } else {
      window.setTimeout(function () {
        var el = document.getElementById("offer-template");
        el.setAttribute("src", event.data.uri);
      }, 1000);
    }
  }
};

window.addEventListener("message", messageListener);
var template = "Copy the following webkey URL: " + window.location.protocol + "//" + "$API_HOST#$API_TOKEN";
window.parent.postMessage({renderTemplate: {rpcId: "0", template: template}}, "*");
