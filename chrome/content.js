/*
Copyright 2013 Media Science International

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

"use strict";
var data = {$type: "data", downloads: []},
    anchors = document.getElementsByTagName("a"),
    i;


/* find all downloads
*/
for(i = 0; i < anchors.length; i += 1) {
  if (anchors[i].download && anchors[i].href) {
      data.downloads.push({filename: anchors[i].download, href: anchors[i].href});
  }
}



/* unsolicited send data to extension
*/
console.log("unsolicited send (from content): " + JSON.stringify(data, null, 4));
chrome.runtime.sendMessage(data);



/* solicited send data to extension
*/
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("received msg (in content):" + JSON.stringify(request, null, 4));
    if (request.$type === "query") {
        console.log("solicited send (from content): " + JSON.stringify(data, null, 4));
        sendResponse(data);
    }
});



