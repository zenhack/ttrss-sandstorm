function trySetElement(selector, data) {
  var nodes = document.querySelectorAll(selector);
  if (nodes.length === 0) {
    // Page not rendered yet, try again later

    window.setTimeout(function () {
      trySetElement(selector, data)
    }, 100);
    return;
  }
  for (var i = 0; i < nodes.length; ++i) {
    nodes[i].setAttribute("src", data);
  };
}

var messageListener = function(event) {
  if (event.data.rpcId === "HOST_TEMPLATE") {
    if (event.data.error) {
      console.log("ERROR: " + event.data.error);
    } else {
      trySetElement(".offer-host", event.data.uri);
    }
  } else if (event.data.rpcId === "TOKEN_TEMPLATE") {
    if (event.data.error) {
      console.log("ERROR: " + event.data.error);
    } else {
      trySetElement(".offer-token", event.data.uri);
    }
  }
};

window.addEventListener("message", messageListener);
var hostTemplate = window.location.protocol + "//" + "$API_HOST";
var tokenTemplate = "$API_TOKEN";
window.parent.postMessage({renderTemplate: {rpcId: "HOST_TEMPLATE", template: hostTemplate, clipboardButton: 'left'}}, "*");
window.parent.postMessage({renderTemplate: {rpcId: "TOKEN_TEMPLATE", template: tokenTemplate, clipboardButton: 'left'}}, "*");
