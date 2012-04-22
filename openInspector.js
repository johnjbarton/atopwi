// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */


define(['q/q', 'appendFrame', 'overrides/overrides'], 
function(  Q,   appendFrame,             overrides)  {

var debug = true;

function showInspectorIframe() {
  var inspectorElt = window.document.getElementById('WebInspector');
  inspectorElt.classList.remove('hide');
  return appendFrame('WebInspector', "inspector/front-end/devtools.html");
}

function onDynamicLoad(debuggee, chromeProxy, inspectorWindow, deferred, doLoadedDone) {
    var backend = inspectorWindow.InspectorBackend;

    // From the UI to the back end, commands with responses
    // eg chrome.debugger/Console.enable 
    
    function sendMessageObject(messageObject) {
      if (debug) {
        console.log(messageObject.id+" atopwi sendCommand "+messageObject.method);
      }
      chromeProxy.debugger.sendCommand(
        debuggee, 
        messageObject.method, 
        messageObject.params, 
        function handleResponse(data) {
          data.id = messageObject.id;
          if (debug) {
            var msg = data.id +
               " atopwi response to sendCommand " + messageObject.method;
            var obj = {messageObject: messageObject, data: data};
            console.log(msg, obj);
          }
          backend.dispatch(data); 
        }
      );
    }
    
    backend.sendMessageObjectToBackend = sendMessageObject;
    
    // From the backend to the UI, events
    // eg chrome.debugger.remote/Debugger.scriptParsed
    
    chromeProxy.jsonHandlers['chrome.debugger.remote'] = {
      jsonObjectHandler:  function(data) {
        if (debug) {
          console.log("jsonObjectHandler "+data.method, data);
        }
        backend.dispatch.apply(backend, [data]);
      }
    };
    
    inspectorWindow.InspectorFrontendHost.sendMessageToBackend = function() {
      throw new Error("Should not be called");
    };
    
    inspectorWindow.WebInspector.attached = true; // small icons for embed in orion
    
    // Called asynchronously from WebInspector _initializeCapability
    var stock_doLoadedDoneWithCapabilities = 
        inspectorWindow.WebInspector._doLoadedDoneWithCapabilities;
    
    inspectorWindow.WebInspector._doLoadedDoneWithCapabilities = function() {
      var args = Array.prototype.slice.call(arguments, 0);
      stock_doLoadedDoneWithCapabilities.apply(this, args);
      
      deferred.resolve(inspectorWindow);
    };
    
    doLoadedDone.call(inspectorWindow.WebInspector);
}

// Promise the inspectorWindow after the load event is processed

function openInspector(debuggee, chromeProxy) {
  var inspectorElt = showInspectorIframe();
  var inspectorWindow = inspectorElt.contentWindow;
  
  // Capture the DOMContentLoaded to monkey-patch inspectorWindow.
  //
  var deferred = Q.defer();
  inspectorWindow.addEventListener('DOMContentLoaded', function(event){
    
    if (debug) {
      console.log("DOMContentLoaded on inspectorWindow ", debuggee);
    }

    inspectorWindow.WebInspectorMonkeyPatchDeferred = Q.defer();

    overrides.injectAll(inspectorWindow, function onStaticLoad() {
    
      // The static files for the override have been loaded, but require.js is
      // still working. 

      inspectorWindow.WebInspectorMonkeyPatchDeferred.promise.then(
        onDynamicLoad.bind(null, debuggee, chromeProxy, inspectorWindow, deferred),
        function(rejection) {
          console.error("Monkey Patch rejection", rejection);
        }
      );
    
    });
    
  }, true);
  return deferred.promise;
}

return openInspector;

});