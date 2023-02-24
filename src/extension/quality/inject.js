window.addEventListener("load", function (){
  const exSetQuality = 'exSetQuality2992';
  var script = document.getElementById(exSetQuality);
    if (!script) {
      script = document.createElement("script");
      script.type = "text/javascript";
      script.setAttribute("id", exSetQuality);
      script.onload = function () {script.remove()};
      script.src = chrome.runtime.getURL("page_context_inject.js");
      document.documentElement.appendChild(script);
    }
});